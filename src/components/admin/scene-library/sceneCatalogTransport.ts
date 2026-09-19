import type { ApiFailure } from "@/types/api";
import type {
  BackgroundAdminList,
  BackgroundAdminListQuery,
  BackgroundCatalogCreate,
  BackgroundCatalogUpdate,
  ManagedBackgroundAsset,
  ManagedColorPalette,
  PaletteAdminList,
  PaletteAdminListQuery,
  PaletteCatalogUpdate,
  PaletteCatalogWrite,
  SceneCatalogDeletionResult,
} from "@/types/scene-catalog-admin";

interface DataEnvelope<T> {
  data: T;
  meta?: { updatedAt?: string };
}
interface PresignedPart {
  role: "primary" | "poster";
  url: string;
  headers: Record<string, string>;
}

interface PresignResult {
  uploadId: string;
  parts: PresignedPart[];
}

export class SceneCatalogRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "SceneCatalogRequestError";
  }
}

export class SceneCatalogUploadCancelledError extends Error {
  constructor() {
    super("Upload cancelled");
    this.name = "SceneCatalogUploadCancelledError";
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
    throw new SceneCatalogRequestError(
      response.status,
      failure?.code ?? "REQUEST_FAILED",
      failure?.message ?? "Không thể hoàn tất yêu cầu.",
      failure?.fieldErrors,
    );
  }
  if (!isRecord(json) || !("data" in json)) {
    throw new SceneCatalogRequestError(500, "INVALID_RESPONSE", "Không xác nhận được phản hồi từ máy chủ.");
  }
  const meta = isRecord(json.meta) && typeof json.meta.updatedAt === "string"
    ? { updatedAt: json.meta.updatedAt }
    : undefined;
  return { data: json.data as T, ...(meta ? { meta } : {}) };
}

function jsonOptions(method: "POST" | "PATCH" | "DELETE", body: object): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function backgroundParams(query: BackgroundAdminListQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.type !== "all") params.set("type", query.type);
  if (query.motion !== "all") params.set("motion", query.motion);
  if (query.status !== "all") params.set("status", query.status);
  if (query.cursor) params.set("cursor", query.cursor);
  return params.toString();
}

function paletteParams(query: PaletteAdminListQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status !== "all") params.set("status", query.status);
  if (query.cursor) params.set("cursor", query.cursor);
  return params.toString();
}

export function getBackgroundCatalog(query: BackgroundAdminListQuery, signal?: AbortSignal) {
  return request<BackgroundAdminList>(
    `/api/admin/scene-library/backgrounds?${backgroundParams(query)}`,
    { signal },
  );
}

export function getPaletteCatalog(query: PaletteAdminListQuery, signal?: AbortSignal) {
  return request<PaletteAdminList>(
    `/api/admin/scene-library/palettes?${paletteParams(query)}`,
    { signal },
  );
}

export function createBackground(body: BackgroundCatalogCreate) {
  return request<ManagedBackgroundAsset>(
    "/api/admin/scene-library/backgrounds",
    jsonOptions("POST", body),
  );
}

export function updateBackground(itemId: string, body: BackgroundCatalogUpdate) {
  return request<ManagedBackgroundAsset>(
    `/api/admin/scene-library/backgrounds/${encodeURIComponent(itemId)}`,
    jsonOptions("PATCH", { action: "update", ...body }),
  );
}

export function transitionBackground(
  itemId: string,
  status: "active" | "archived",
  expectedUpdatedAt: string,
) {
  return request<ManagedBackgroundAsset>(
    `/api/admin/scene-library/backgrounds/${encodeURIComponent(itemId)}`,
    jsonOptions("PATCH", { action: "transition", status, expectedUpdatedAt }),
  );
}

export function deleteBackground(itemId: string, expectedUpdatedAt: string) {
  return request<SceneCatalogDeletionResult>(
    `/api/admin/scene-library/backgrounds/${encodeURIComponent(itemId)}`,
    jsonOptions("DELETE", { expectedUpdatedAt }),
  );
}

export function createPalette(body: PaletteCatalogWrite) {
  return request<ManagedColorPalette>(
    "/api/admin/scene-library/palettes",
    jsonOptions("POST", body),
  );
}

export function updatePalette(itemId: string, body: PaletteCatalogUpdate) {
  return request<ManagedColorPalette>(
    `/api/admin/scene-library/palettes/${encodeURIComponent(itemId)}`,
    jsonOptions("PATCH", { action: "update", ...body }),
  );
}

export function transitionPalette(
  itemId: string,
  status: "active" | "archived",
  expectedUpdatedAt: string,
) {
  return request<ManagedColorPalette>(
    `/api/admin/scene-library/palettes/${encodeURIComponent(itemId)}`,
    jsonOptions("PATCH", { action: "transition", status, expectedUpdatedAt }),
  );
}

export function deletePalette(itemId: string, expectedUpdatedAt: string) {
  return request<SceneCatalogDeletionResult>(
    `/api/admin/scene-library/palettes/${encodeURIComponent(itemId)}`,
    jsonOptions("DELETE", { expectedUpdatedAt }),
  );
}

function uploadPart(
  part: PresignedPart,
  file: File,
  signal: AbortSignal,
  onProgress: (role: PresignedPart["role"], percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new SceneCatalogUploadCancelledError());
      return;
    }
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    signal.addEventListener("abort", abort, { once: true });
    xhr.open("PUT", part.url);
    Object.entries(part.headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(part.role, Math.round(event.loaded / event.total * 100));
    });
    xhr.addEventListener("load", () => {
      signal.removeEventListener("abort", abort);
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(part.role, 100);
        resolve();
      } else {
        reject(new SceneCatalogRequestError(xhr.status, "DIRECT_UPLOAD_FAILED", "Không thể gửi tệp tới kho lưu trữ."));
      }
    });
    xhr.addEventListener("error", () => {
      signal.removeEventListener("abort", abort);
      reject(new SceneCatalogRequestError(0, "NETWORK_ERROR", "Mất kết nối khi đang tải tệp."));
    });
    xhr.addEventListener("abort", () => {
      signal.removeEventListener("abort", abort);
      reject(new SceneCatalogUploadCancelledError());
    });
    xhr.send(file);
  });
}

async function cancelUpload(uploadId: string): Promise<void> {
  await fetch(`/api/upload/${encodeURIComponent(uploadId)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  }).catch(() => undefined);
}

export async function uploadGlobalBackground(
  primary: File,
  poster: File | undefined,
  signal: AbortSignal,
  onProgress: (progress: { primary: number; poster?: number; processing: boolean }) => void,
): Promise<string> {
  let uploadId: string | null = null;
  try {
    const intent = await request<PresignResult>("/api/upload/presign", jsonOptions("POST", {
      purpose: "global_background",
      file: { name: primary.name, contentType: primary.type, size: primary.size },
      ...(poster ? { poster: { name: poster.name, contentType: poster.type, size: poster.size } } : {}),
    }));
    uploadId = intent.data.uploadId;
    const progress: { primary: number; poster?: number; processing: boolean } = {
      primary: 0,
      ...(poster ? { poster: 0 } : {}),
      processing: false,
    };
    onProgress({ ...progress });
    await Promise.all(intent.data.parts.map((part) => {
      const file = part.role === "primary" ? primary : poster;
      if (!file) throw new SceneCatalogRequestError(500, "INVALID_UPLOAD_INTENT", "Thiếu tệp poster.");
      return uploadPart(part, file, signal, (role, percent) => {
        progress[role] = percent;
        onProgress({ ...progress });
      });
    }));
    progress.processing = true;
    onProgress({ ...progress });
    await request("/api/upload/complete", jsonOptions("POST", { uploadId }));
    return uploadId;
  } catch (error) {
    if (uploadId) await cancelUpload(uploadId);
    if (signal.aborted && !(error instanceof SceneCatalogUploadCancelledError)) {
      throw new SceneCatalogUploadCancelledError();
    }
    throw error;
  }
}

export function sceneCatalogErrorMessage(error: unknown): string {
  if (!(error instanceof SceneCatalogRequestError)) return "Mất kết nối với máy chủ. Vui lòng thử lại.";
  if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
  if (error.status === 403) return "Bạn không còn quyền quản lý thư viện bối cảnh.";
  if (error.status === 404) return "Mục thư viện hoặc upload này không còn tồn tại.";
  if (error.status === 409) return "Dữ liệu đã thay đổi hoặc trạng thái hiện tại không còn phù hợp. Hãy tải lại trước khi tiếp tục.";
  if (error.status === 503) return "Thư viện đang tạm gián đoạn. Dữ liệu trong biểu mẫu vẫn được giữ lại.";
  return error.message || "Không thể hoàn tất yêu cầu.";
}
