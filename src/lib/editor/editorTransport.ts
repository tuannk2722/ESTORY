import { z } from "zod";
import type { Chapter } from "@/types/story";
import type { Scene } from "@/types/scene";
import { commandMetaSchema, editorDataSchema, replaceEditorSchema } from "@/lib/validation/story-command-schema";

const requestSchema = replaceEditorSchema.omit({ actorId: true, storyId: true, chapterId: true });
const responseSchema = z.strictObject({ data: editorDataSchema, meta: commandMetaSchema });
const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

export class EditorSaveError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "EditorSaveError";
  }
}

export function buildEditorSaveBody(chapter: Chapter, scenes: Scene[], expectedUpdatedAt: string) {
  const result = requestSchema.safeParse({ blocks: chapter.blocks, scenes, expectedUpdatedAt });
  if (!result.success) throw new Error("Nội dung hoặc bối cảnh chưa hợp lệ. Hãy kiểm tra lại trước khi lưu.");
  return result.data;
}

/** Shared by the browser and HTTP integration tests; no retry with a newer revision. */
export async function saveEditorAggregate(
  storyId: string, chapter: Chapter, scenes: Scene[], revision: string,
  request: typeof fetch = fetch,
) {
  const body = buildEditorSaveBody(chapter, scenes, revision);
  const response = await request(
    `/api/stories/${encodeURIComponent(storyId)}/chapters/${encodeURIComponent(chapter.id)}/editor`,
    { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = errorSchema.safeParse(json);
    throw new EditorSaveError(response.status, error.success ? error.data.error.code : "SAVE_FAILED",
      response.status === 409
        ? "Nội dung hoặc trạng thái truyện đã thay đổi. Hãy tải lại trang để đối chiếu trước khi lưu."
        : response.status === 503
          ? "Chức năng lưu đang tạm đóng. Thay đổi của bạn vẫn được giữ trong phiên soạn thảo này."
          : error.success ? error.data.error.message : "Không thể lưu chương truyện.");
  }
  const result = responseSchema.safeParse(json);
  if (!result.success || result.data.data.chapter.id !== chapter.id) {
    throw new Error("Không xác nhận được kết quả lưu. Hãy tải lại trang để kiểm tra nội dung đã lưu.");
  }
  return result.data;
}
