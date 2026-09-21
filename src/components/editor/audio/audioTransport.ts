import { z } from "zod";
import { AuthorRequestError, uploadPart } from "@/components/author/authorTransport";
import { audioAssetSchema, integrationStatusSchema } from "@/lib/validation/audio-asset-schema";
import { presignUploadResponseSchema } from "@/lib/validation/media-upload-schema";
import { AUDIO_MAX_BYTES, AUDIO_MAX_DURATION_MS } from "@/lib/media/constants";

export async function audioRequest<T>(url: string, schema: z.ZodType<T>, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store", ...(body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  const json = await response.json();
  if (!response.ok) throw new AuthorRequestError(response.status, json.error?.code ?? "REQUEST_FAILED", json.error?.message ?? "Không thể hoàn tất yêu cầu.", json.error?.fieldErrors);
  return schema.parse(json.data);
}
export const getIntegrationStatus = () => audioRequest("/api/integrations/freesound/status", integrationStatusSchema);
export function audioError(error: unknown): string {
  if (error instanceof AuthorRequestError) {
    if (error.code === "FREESOUND_RECONNECT") return "Hãy kết nối lại tài khoản Freesound để nhập âm thanh.";
    if (error.code === "DAILY_QUOTA_EXHAUSTED") return `Đã hết lượt hôm nay. Đặt lại lúc ${new Date(error.fieldErrors?.reset_at?.[0] ?? Date.now()).toLocaleString("vi-VN")}.`;
    if (error.status === 429) return "Bạn đang thao tác quá nhanh. Hãy thử lại sau một lát.";
    if (error.status === 401) return "Phiên đăng nhập đã hết hạn.";
    if (error.status === 503) return "Dịch vụ âm thanh đang tạm gián đoạn. Hãy thử lại sau.";
  }
  return error instanceof Error ? error.message : "Không thể hoàn tất thao tác âm thanh.";
}
export async function validateAudioFile(file: File): Promise<void> {
  if (!/\.(mp3|wav|ogg)$/i.test(file.name) || !["audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg"].includes(file.type)) throw new Error("Chọn tệp MP3, WAV hoặc OGG.");
  if (file.size === 0 || file.size > AUDIO_MAX_BYTES) throw new Error("Tệp âm thanh phải có dung lượng từ 1 byte đến 8 MiB.");
  const url = URL.createObjectURL(file);
  const audio = new Audio();
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Không đọc được thời lượng tệp.")), 10_000);
      audio.onloadedmetadata = () => { clearTimeout(timer); resolve(); };
      audio.onerror = () => { clearTimeout(timer); reject(new Error("Không đọc được tệp âm thanh.")); };
      audio.preload = "metadata"; audio.src = url;
    });
    if (!Number.isFinite(audio.duration) || audio.duration <= 0 || audio.duration * 1000 > AUDIO_MAX_DURATION_MS) throw new Error("Âm thanh phải dài tối đa 5 phút.");
  } finally { audio.removeAttribute("src"); audio.load(); URL.revokeObjectURL(url); }
}
export async function uploadPersonalAudio(file: File, signal: AbortSignal, onProgress: (percent: number) => void) {
  const intent = await audioRequest("/api/upload/presign", presignUploadResponseSchema, { purpose: "personal_audio", file: { name: file.name, contentType: file.type, size: file.size } });
  try {
    await uploadPart(intent.parts[0], file, signal, (p) => onProgress(p.percent));
    if (signal.aborted) throw new Error("Đã hủy tải lên.");
    await audioRequest("/api/upload/complete", z.unknown(), { uploadId: intent.uploadId });
    return intent.uploadId;
  } catch (error) {
    await fetch(`/api/upload/${encodeURIComponent(intent.uploadId)}`, { method: "DELETE" }).catch(() => {});
    throw error;
  }
}
export const claimAudio = (uploadId: string, title: string) => audioRequest("/api/audio-assets", audioAssetSchema, { uploadId, title });
