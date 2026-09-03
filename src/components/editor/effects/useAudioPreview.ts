// src/components/editor/effects/useAudioPreview.ts
// Editor-only Howler preview with deterministic stop/unload cleanup.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Howl } from "howler";

function disposeHowl(howl: Howl | null) {
  if (!howl) return;
  howl.stop();
  howl.unload();
}

export function useAudioPreview() {
  const [previewingAudioSrc, setPreviewingAudioSrc] = useState<string | null>(
    null
  );
  const audioRef = useRef<Howl | null>(null);

  const stopAudio = useCallback(() => {
    disposeHowl(audioRef.current);
    audioRef.current = null;
    setPreviewingAudioSrc(null);
  }, []);

  const togglePlayAudio = useCallback(
    (src: string, volume = 0.8, loop = false) => {
      const normalizedSrc = src.trim();
      if (!normalizedSrc) return;

      if (previewingAudioSrc === normalizedSrc) {
        stopAudio();
        return;
      }

      disposeHowl(audioRef.current);
      audioRef.current = null;

      try {
        const howl = new Howl({
          src: [normalizedSrc],
          volume: Math.max(0.1, Math.min(1, volume)),
          loop,
          onend: () => {
            if (audioRef.current !== howl) return;
            disposeHowl(howl);
            audioRef.current = null;
            setPreviewingAudioSrc(null);
          },
          onloaderror: () => {
            if (audioRef.current !== howl) return;
            disposeHowl(howl);
            audioRef.current = null;
            setPreviewingAudioSrc(null);
          },
          onplayerror: () => {
            if (audioRef.current !== howl) return;
            disposeHowl(howl);
            audioRef.current = null;
            setPreviewingAudioSrc(null);
          },
        });

        audioRef.current = howl;
        setPreviewingAudioSrc(normalizedSrc);
        howl.play();
      } catch {
        audioRef.current = null;
        setPreviewingAudioSrc(null);
      }
    },
    [previewingAudioSrc, stopAudio]
  );

  const setAudioPreviewVolume = useCallback((volume: number) => {
    audioRef.current?.volume(Math.max(0.1, Math.min(1, volume)));
  }, []);

  useEffect(() => {
    return () => {
      disposeHowl(audioRef.current);
      audioRef.current = null;
    };
  }, []);

  return {
    previewingAudioSrc,
    togglePlayAudio,
    setAudioPreviewVolume,
    stopAudio,
  };
}
