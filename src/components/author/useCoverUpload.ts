"use client";

import { useCallback, useRef, useState } from "react";
import {
  friendlyRequestMessage,
  UploadCancelledError,
  uploadStoryCover,
} from "./authorTransport";
import type { CoverUploadState, UploadPartProgress } from "./types";

const IDLE_UPLOAD: CoverUploadState = { phase: "idle", parts: [] };

export function useCoverUpload() {
  const [state, setState] = useState<CoverUploadState>(IDLE_UPLOAD);
  const [completed, setCompleted] = useState<{ file: File; uploadId: string } | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const resetForFile = useCallback((file: File | null) => {
    setCompleted((current) => current?.file === file ? current : null);
    setState((current) => completed?.file === file ? current : IDLE_UPLOAD);
  }, [completed]);

  const ensureUploaded = useCallback(async (file: File): Promise<string> => {
    if (completed?.file === file) return completed.uploadId;
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ phase: "requesting-url", parts: [] });
    try {
      const uploadId = await uploadStoryCover(file, controller.signal, {
        onIntent: () => undefined,
        onUploading: (parts) => setState({ phase: "uploading", parts }),
        onProgress: (progress: UploadPartProgress) => setState((current) => ({
          phase: "uploading",
          parts: current.parts.map((part) => part.role === progress.role ? progress : part),
        })),
        onProcessing: () => setState((current) => ({ ...current, phase: "processing" })),
      });
      setCompleted({ file, uploadId });
      setState((current) => ({ ...current, phase: "complete" }));
      return uploadId;
    } catch (error) {
      if (error instanceof UploadCancelledError) {
        setState((current) => ({ ...current, phase: "cancelled" }));
      } else {
        setState((current) => ({
          ...current,
          phase: "error",
          message: friendlyRequestMessage(error, "Không thể tải ảnh bìa. Hãy thử lại."),
        }));
      }
      throw error;
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, [completed]);

  const cancel = useCallback(() => controllerRef.current?.abort(), []);
  const clearCompleted = useCallback(() => {
    setCompleted(null);
    setState(IDLE_UPLOAD);
  }, []);

  return { state, ensureUploaded, resetForFile, cancel, clearCompleted };
}
