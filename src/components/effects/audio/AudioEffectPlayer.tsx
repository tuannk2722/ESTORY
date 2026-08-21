// components/effects/audio/AudioEffectPlayer.tsx
"use client";

import { useEffect } from "react";
import { EffectConfig } from "@/types/story";

export interface AudioEffectPlayerProps {
  config: EffectConfig;
  isActive: boolean;
  intensityMultiplier?: number;
}

/**
 * Component quản lý hiệu ứng âm thanh sử dụng Howler.js (Wrap Howler instance pool)
 */
export default function AudioEffectPlayer({ config, isActive }: AudioEffectPlayerProps) {
  useEffect(() => {
    if (!isActive || !config.audio_src) return;
    // TODO: Quản lý Howler pool phát SFX/BGM
  }, [isActive, config]);

  return null;
}
