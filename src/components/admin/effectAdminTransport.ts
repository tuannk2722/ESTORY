import type { ApiFailure } from "@/types/api";
import type {
  EffectAdminList,
  EffectAdminListQuery,
  ManagedEffectAdminItem,
} from "@/types/effect-admin";
import type { EffectType } from "@/types/story";

export type {
  EffectAdminCategoryFilter,
  EffectAdminCapabilities,
  EffectAdminList,
  EffectAdminListQuery,
  EffectAdminStatusFilter,
} from "@/types/effect-admin";
export type EffectAdminListItem = ManagedEffectAdminItem;

interface DataEnvelope<T> {
  data: T;
  meta?: { updatedAt?: string };
}

export class EffectAdminRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "EffectAdminRequestError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readFailure(value: unknown): ApiFailure["error"] | null {
  if (!isRecord(value) || !isRecord(value.error)) return null;
  const { code, message, fieldErrors } = value.error;
  if (typeof code !== "string" || typeof message !== "string") return null;
  return {
    code,
    message,
    ...(isRecord(fieldErrors) ? {
      fieldErrors: Object.fromEntries(Object.entries(fieldErrors).filter(
        (entry): entry is [string, string[]] => Array.isArray(entry[1])
          && entry[1].every((item) => typeof item === "string"),
      )),
    } : {}),
  };
}

async function request<T>(url: string, options?: RequestInit): Promise<DataEnvelope<T>> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const failure = readFailure(json);
    throw new EffectAdminRequestError(
      response.status,
      failure?.code ?? "REQUEST_FAILED",
      failure?.message ?? "Không thể hoàn tất yêu cầu.",
      failure?.fieldErrors,
    );
  }
  if (!isRecord(json) || !("data" in json)) {
    throw new EffectAdminRequestError(500, "INVALID_RESPONSE", "Không xác nhận được phản hồi từ máy chủ.");
  }
  const meta = isRecord(json.meta) && typeof json.meta.updatedAt === "string"
    ? { updatedAt: json.meta.updatedAt }
    : undefined;
  return { data: json.data as T, meta };
}

function jsonOptions(method: "POST" | "PATCH" | "DELETE", body: object): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function getEffectCatalog(query: EffectAdminListQuery, signal?: AbortSignal) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category !== "all") params.set("category", query.category);
  if (query.status !== "all") params.set("status", query.status);
  if (query.cursor) params.set("cursor", query.cursor);
  return request<EffectAdminList>(`/api/admin/effects?${params.toString()}`, { signal });
}

export function updateEffectMetadata(body: {
  effectId: EffectType;
  label: string;
  description: string;
  isActive: boolean;
  expectedUpdatedAt: string;
}) {
  return request<ManagedEffectAdminItem>("/api/admin/effects", jsonOptions("PATCH", body));
}

function keywordUrl(effectId: EffectType) {
  return `/api/admin/effects/${encodeURIComponent(effectId)}/keywords`;
}

export function createEffectKeyword(
  effectId: EffectType,
  body: { keyword: string; weight: number; expectedUpdatedAt: string },
) {
  return request<ManagedEffectAdminItem>(keywordUrl(effectId), jsonOptions("POST", body));
}

export function updateEffectKeyword(
  effectId: EffectType,
  body: { keywordId: string; keyword: string; weight: number; expectedUpdatedAt: string },
) {
  return request<ManagedEffectAdminItem>(keywordUrl(effectId), jsonOptions("PATCH", body));
}

export function deleteEffectKeyword(
  effectId: EffectType,
  body: { keywordId: string; expectedUpdatedAt: string },
) {
  return request<ManagedEffectAdminItem>(keywordUrl(effectId), jsonOptions("DELETE", body));
}

export function effectAdminErrorMessage(error: unknown): string {
  if (!(error instanceof EffectAdminRequestError)) {
    return "Mất kết nối với máy chủ. Vui lòng thử lại.";
  }
  if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
  if (error.status === 403) return "Bạn không còn quyền quản lý thư viện hiệu ứng.";
  if (error.status === 404) return "Hiệu ứng hoặc từ khóa này không còn tồn tại.";
  if (error.status === 409) return "Dữ liệu đã được quản trị viên khác cập nhật. Hãy tải dữ liệu mới trước khi tiếp tục.";
  if (error.status === 503) return "Thư viện hiệu ứng đang tạm khóa trong quá trình chuyển đổi dữ liệu.";
  return error.message || "Không thể hoàn tất yêu cầu.";
}
