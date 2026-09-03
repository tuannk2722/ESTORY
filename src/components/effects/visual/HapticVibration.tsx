// components/effects/visual/HapticVibration.tsx
// Phase 2: Hiệu ứng Rung Thiết Bị (Vibration API trên mobile + micro-shake visual trên màn hình)
"use client";

import React, { useEffect } from "react";
import { EffectComponentProps } from "../EffectRegistry";

export default function HapticVibration({
  config,
  isActive,
}: EffectComponentProps) {
  useEffect(() => {
    if (!isActive) return;

    // Trigger mobile vibration if Vibration API is available
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        const pattern = config.intensity > 0.7 ? [60, 40, 60] : [40];
        navigator.vibrate(pattern);
      } catch {
        // Silently ignore if blocked by browser policy
      }
    }
  }, [isActive, config.intensity]);

  if (!isActive) return null;

  return (
    <div
      data-effect-id={config.id}
      data-effect-type="vibration"
      className="vibration-effect-layer fixed inset-0 pointer-events-none z-[5] animate-vibrate-subtle"
      aria-hidden="true"
    />
  );
}
