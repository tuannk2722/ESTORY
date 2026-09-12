import type { ApiFailure } from "@/types/api";
import type { StoryCommandResult, UploadPartProgress } from "./types";

interface PresignedPart {
  role: "primary" | "poster";
  url: string;
  headers: Record<string, string>;
}

interface PresignResult {
  uploadId: string;
  parts: PresignedPart[];
}

export class AuthorRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AuthorRequestError";
  }
}

export class UploadCancelledError extends Error {
  constructor() {
    super("Upload cancelled");
    this.name = "UploadCancelledError";
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
      ? { fieldErrors: Object.fromEntries(Object.entries(fieldErrors).filter(
        (entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every((item) => typeof item === "string"),
      )) }
      : {}),
  };
}

export function friendlyRequestMessage(error: unknown, fallback: string): string {
  if (!(error instanceof AuthorRequestError)) return fallback;
  if (error.status === 409) {
    return "Dữ liệu đã thay đổi ở nơi khác. Hãy tải lại trang để đối chiếu trước khi tiếp tục.";
  }
  if (error.status === 503) return "Tính năng lưu đang tạm gián đoạn. Dữ liệu trên biểu mẫu vẫn được giữ lại.";
  if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
  if (error.status === 403 || error.status === 404) return "Bạn không còn quyền truy cập nội dung này.";
  return error.message || fallback;
}

async function parseResponse(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export async function commandRequest<T>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body: unknown,
): Promise<StoryCommandResult<T>> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await parseResponse(response);
  if (!response.ok) {
    const failure = readFailure(json);
    throw new AuthorRequestError(
      response.status,
      failure?.code ?? "REQUEST_FAILED",
      failure?.message ?? "Không thể hoàn tất yêu cầu.",
      failure?.fieldErrors,
    );
  }
  if (!isRecord(json) || !("data" in json) || !isRecord(json.meta)
      || typeof json.meta.updatedAt !== "string") {
    throw new AuthorRequestError(500, "INVALID_RESPONSE", "Không xác nhận được kết quả từ máy chủ.");
  }
  return { data: json.data as T, meta: { updatedAt: json.meta.updatedAt } };
}

async function publicPost<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const json = await parseResponse(response);
  if (!response.ok) {
    if (signal?.aborted) throw new UploadCancelledError();
    const failure = readFailure(json);
    throw new AuthorRequestError(
      response.status,
      failure?.code ?? "UPLOAD_FAILED",
      failure?.message ?? "Không thể tải ảnh lên.",
      failure?.fieldErrors,
    );
  }
  if (!isRecord(json) || !("data" in json)) {
    throw new AuthorRequestError(500, "INVALID_RESPONSE", "Không xác nhận được kết quả tải lên.");
  }
  return json.data as T;
}

function uploadPart(
  part: PresignedPart,
  file: File,
  signal: AbortSignal,
  onProgress: (progress: UploadPartProgress) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new UploadCancelledError());
      return;
    }
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    signal.addEventListener("abort", abort, { once: true });
    request.open("PUT", part.url);
    for (const [name, value] of Object.entries(part.headers)) request.setRequestHeader(name, value);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress({ role: part.role, percent: Math.round((event.loaded / event.total) * 100) });
      }
    });
    request.addEventListener("load", () => {
      signal.removeEventListener("abort", abort);
      if (request.status >= 200 && request.status < 300) {
        onProgress({ role: part.role, percent: 100 });
        resolve();
      } else {
        reject(new AuthorRequestError(request.status, "DIRECT_UPLOAD_FAILED", "Không thể gửi ảnh tới kho lưu trữ."));
      }
    });
    request.addEventListener("error", () => {
      signal.removeEventListener("abort", abort);
      reject(new AuthorRequestError(0, "NETWORK_ERROR", "Mất kết nối khi đang tải ảnh."));
    });
    request.addEventListener("abort", () => {
      signal.removeEventListener("abort", abort);
      reject(new UploadCancelledError());
    });
    request.send(file);
  });
}

async function cancelIntent(uploadId: string): Promise<void> {
  await fetch(`/api/upload/${encodeURIComponent(uploadId)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  }).catch(() => undefined);
}

export async function uploadStoryCover(
  file: File,
  signal: AbortSignal,
  callbacks: {
    onIntent(uploadId: string): void;
    onUploading(parts: UploadPartProgress[]): void;
    onProgress(progress: UploadPartProgress): void;
    onProcessing(): void;
  },
): Promise<string> {
  let uploadId: string | null = null;
  try {
    const intent = await publicPost<PresignResult>("/api/upload/presign", {
      purpose: "story_cover",
      file: { name: file.name, contentType: file.type, size: file.size },
    }, signal);
    uploadId = intent.uploadId;
    callbacks.onIntent(intent.uploadId);
    const progress = intent.parts.map((part) => ({ role: part.role, percent: 0 }));
    callbacks.onUploading(progress);
    await Promise.all(intent.parts.map((part) => {
      if (part.role !== "primary") {
        throw new AuthorRequestError(500, "INVALID_UPLOAD_INTENT", "Kho lưu trữ trả về phần ảnh không hợp lệ.");
      }
      return uploadPart(part, file, signal, callbacks.onProgress);
    }));
    callbacks.onProcessing();
    await publicPost("/api/upload/complete", { uploadId: intent.uploadId }, signal);
    return intent.uploadId;
  } catch (error) {
    if (uploadId) await cancelIntent(uploadId);
    if (signal.aborted && !(error instanceof UploadCancelledError)) throw new UploadCancelledError();
    throw error;
  }
}
