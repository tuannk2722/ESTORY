// components/effects/visual/TextShake.tsx
// Phase 2: Hiệu ứng Rung Chữ — Đoạn văn rung lắc nhẹ thể hiện sự sợ hãi, hét lớn
"use client";

import { useEffect } from "react";
import { EffectComponentProps } from "../EffectRegistry";

export default function TextShake({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  useEffect(() => {
    // Tìm block tương ứng với effect hoặc story-block đang active
    const blockEl =
      document.querySelector(`[data-has-effect*="${config.id}"]`) ||
      document.querySelector(".story-block.active") ||
      document.querySelector(".story-block");
    if (!blockEl) return;

    if (isActive) {
      const intensity = (config.intensity ?? 0.7) * intensityMultiplier;
      const duration = Math.max(0.08, 0.2 - intensity * 0.08);
      (blockEl as HTMLElement).style.animation = `text-shake ${duration}s ease-in-out infinite`;
      (blockEl as HTMLElement).style.display = "block";
    } else {
      (blockEl as HTMLElement).style.animation = "";
    }

    return () => {
      if (blockEl) (blockEl as HTMLElement).style.animation = "";
    };
  }, [config.id, config.intensity, intensityMultiplier, isActive]);

  return null;
}
