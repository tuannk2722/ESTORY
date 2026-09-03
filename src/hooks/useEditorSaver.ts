"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Scene } from "@/types/scene";
import type { Chapter } from "@/types/story";

export interface UseEditorSaverOptions {
  storyId: string;
  chapterId: string;
  chapter: Chapter;
  scenes: Scene[];
  dirty: boolean;
  changeVersion: number;
  revision: string;
  onSaveStart?: (version: number) => void;
  onSaveSuccess?: (version: number, revision: string) => void;
  onSaveError?: (error: string) => void;
  onSaveConflict?: () => void;
}

interface EditorSaveResponse {
  error?: string;
  errors?: string[];
  revision?: string;
}

export function useEditorSaver({
  storyId,
  chapterId,
  chapter,
  scenes,
  dirty,
  changeVersion,
  revision,
  onSaveStart,
  onSaveSuccess,
  onSaveError,
  onSaveConflict,
}: UseEditorSaverOptions) {
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const handleSave = useCallback(async () => {
    if (isSaving || !dirty) return;

    const savingVersion = changeVersion;
    setIsSaving(true);
    onSaveStart?.(savingVersion);

    try {
      const response = await fetch(
        `/api/stories/${storyId}/chapters/${chapterId}/editor`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chapter, scenes, revision }),
        }
      );
      const data: EditorSaveResponse = await response
        .json()
        .catch(() => ({}));

      if (response.status === 409) {
        const conflictMessage =
          data.errors?.join(", ") ||
          "Nội dung đã thay đổi ở một phiên khác. Hãy tải lại trang để đối chiếu trước khi lưu.";
        toast.error(conflictMessage, { duration: 6000 });
        onSaveConflict?.();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.errors?.join(", ") ||
            data.error ||
            "Không thể lưu chương truyện."
        );
      }

      if (!data.revision) {
        throw new Error("Server không trả về revision sau khi lưu.");
      }

      toast.success("Đã lưu nội dung và bối cảnh thành công!", {
        duration: 6000,
      });
      onSaveSuccess?.(savingVersion, data.revision);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Không thể lưu chương truyện.";
      toast.error(message, { duration: 6000 });
      onSaveError?.(message);
    } finally {
      setIsSaving(false);
    }
  }, [
    changeVersion,
    chapter,
    chapterId,
    dirty,
    isSaving,
    onSaveConflict,
    onSaveError,
    onSaveStart,
    onSaveSuccess,
    revision,
    scenes,
    storyId,
  ]);

  return { isSaving, handleSave };
}
