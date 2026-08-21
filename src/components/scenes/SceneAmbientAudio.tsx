// components/scenes/SceneAmbientAudio.tsx
// Phase 2: Wrap Howler.js cho ambient_audio_src (loop nền, tách biệt khỏi AudioEffectPlayer)
"use client";

import { useEffect } from "react";

export interface SceneAmbientAudioProps {
  audioSrc?: string;
  volume?: number;
  isActive?: boolean;
}

export default function SceneAmbientAudio({ audioSrc, volume = 0.5, isActive = true }: SceneAmbientAudioProps) {
  useEffect(() => {
    if (!isActive || !audioSrc) return;
    // TODO: Phase 2 Howler ambient audio background loop management
  }, [isActive, audioSrc, volume]);

  return null;
}
