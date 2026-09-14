import type { ApiFailure } from "@/types/api";
import type {
  ModerationDecision,
  ModerationStoryDetail,
} from "@/types/story-moderation";

interface CommandEnvelope<T> {
  data: T;
  meta: { updatedAt: string };
}

export class AdminRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AdminRequestError";
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
    ...(isRecord(fieldErrors)
      ? {
          fieldErrors: Object.fromEntries(
            Object.entries(fieldErrors).filter(
              (entry): entry is [string, string[]] => Array.isArray(entry[1])
                && entry[1].every((item) => typeof item === "string"),
            ),
          ),
        }
      : {}),
  };
}

async function parseResponse(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function readCommandEnvelope<T>(value: unknown): CommandEnvelope<T> | null {
  if (!isRecord(value) || !("data" in value) || !isRecord(value.meta)
    || typeof value.meta.updatedAt !== "string") return null;
  return { data: value.data as T, meta: { updatedAt: value.meta.updatedAt } };
}

async function request<T>(url: string, options?: RequestInit): Promise<CommandEnvelope<T>> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const json = await parseResponse(response);
  if (!response.ok) {
    const failure = readFailure(json);
    throw new AdminRequestError(
      response.status,
      failure?.code ?? "REQUEST_FAILED",
      failure?.message ?? "Không thể hoàn tất yêu cầu.",
      failure?.fieldErrors,
    );
  }
  const result = readCommandEnvelope<T>(json);
  if (!result) {
    throw new AdminRequestError(500, "INVALID_RESPONSE", "Không xác nhận được phản hồi từ máy chủ.");
  }
  return result;
}

export function getModerationDetail(storyId: string, signal: AbortSignal) {
  return request<ModerationStoryDetail>(
    `/api/admin/stories/${encodeURIComponent(storyId)}`,
    { signal },
  );
}

export function submitModerationDecision(
  storyId: string,
  decision: "approve" | "reject",
  body: { expectedUpdatedAt: string; reason?: string },
) {
  return request<ModerationDecision>(
    `/api/admin/stories/${encodeURIComponent(storyId)}/${decision}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

export function moderationErrorMessage(error: unknown): string {
  if (!(error instanceof AdminRequestError)) {
    return "Mất kết nối với máy chủ. Vui lòng thử lại.";
  }
  if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
  if (error.status === 403) return "Bạn không còn quyền thực hiện thao tác quản trị này.";
  if (error.status === 404) return "Tác phẩm không còn tồn tại hoặc đã bị di chuyển.";
  if (error.status === 503) return "Thao tác kiểm duyệt đang tạm khóa trong quá trình chuyển đổi dữ liệu.";
  return error.message || "Không thể hoàn tất yêu cầu.";
}
