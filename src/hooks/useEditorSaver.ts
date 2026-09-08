"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorSaveError, saveEditorAggregate } from "@/lib/editor/editorTransport";
import { toast } from "sonner";
import type { Scene } from "@/types/scene";
import type { Chapter } from "@/types/story";

export interface UseEditorSaverOptions {
  storyId: string;
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

export function useEditorSaver({
  storyId,
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
  const inFlight = useRef(false);

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
    if (inFlight.current || !dirty) return;
    inFlight.current = true;

    const savingVersion = changeVersion;
    setIsSaving(true);
    onSaveStart?.(savingVersion);

    try {
      const result = await saveEditorAggregate(storyId, chapter, scenes, revision);

      toast.success("Đã lưu nội dung và bối cảnh thành công!", {
        duration: 6000,
      });
      onSaveSuccess?.(savingVersion, result.meta.updatedAt);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Không thể lưu chương truyện.";
      toast.error(message, { duration: 6000 });
      if (error instanceof EditorSaveError && error.status === 409) onSaveConflict?.();
      else onSaveError?.(message);
    } finally {
      inFlight.current = false;
      setIsSaving(false);
    }
  }, [
    changeVersion,
    chapter,
    dirty,
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
