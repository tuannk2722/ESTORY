// components/effects/visual/TextFadeFlashback.tsx
// Phase 2: Hiệu ứng Hồi Ức (Flashback) — Nhuộm sắc sepia hoài niệm và lớp sương mờ ký ức
"use client";

import React from "react";
import { EffectComponentProps } from "../EffectRegistry";

export default function TextFadeFlashback({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  if (!isActive) return null;

  const opacity = Math.min(0.85, 0.45 * (config.intensity ?? 0.75) * intensityMultiplier);

  return (
    <div
      data-effect-id={config.id}
      data-effect-type="text_fade_flashback"
      className="flashback-effect-layer fixed inset-0 pointer-events-none z-[5] overflow-hidden transition-opacity duration-1000 ease-in-out"
      aria-hidden="true"
    >
      {/* Sepia Nostalgia Color Wash */}
      <div
        className="absolute inset-0 pointer-events-none mix-blend-color transition-opacity duration-1000"
        style={{
          backgroundColor: "#8C5E32",
          opacity,
        }}
      />

      {/* Dreamy Warm Glow Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(245, 230, 200, 0.15) 0%, rgba(112, 72, 38, 0.45) 80%, rgba(40, 24, 12, 0.75) 100%)",
        }}
      />
    </div>
  );
}
