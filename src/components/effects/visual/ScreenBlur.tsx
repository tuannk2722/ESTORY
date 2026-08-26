// components/effects/visual/ScreenBlur.tsx
// Phase 2: Hiệu ứng Mờ Ảo — Màn hình mờ dần tạo cảm giác choáng váng
"use client";

import React from "react";
import { EffectComponentProps } from "../EffectRegistry";

export default function ScreenBlur({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  if (!isActive) return null;

  const effectiveIntensity = Math.min(
    1,
    Math.max(0.3, (config.intensity ?? 0.6) * intensityMultiplier)
  );
  const blurPx = Math.round(effectiveIntensity * 10);

  return (
    <div
      data-effect-id={config.id}
      data-effect-type="screen_blur"
      className="screen-blur-layer fixed inset-0 pointer-events-none z-30 transition-all duration-700 ease-in-out"
      style={{
        backdropFilter: `blur(${blurPx}px)`,
        WebkitBackdropFilter: `blur(${blurPx}px)`,
        backgroundColor: `rgba(255, 255, 255, ${effectiveIntensity * 0.12})`,
      }}
      aria-hidden="true"
    />
  );
}
