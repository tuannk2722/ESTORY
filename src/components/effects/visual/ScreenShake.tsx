// components/effects/visual/ScreenShake.tsx
// Phase 2: Hiệu ứng Rung Màn Hình (Screen Shake) — Chấn động toàn khung nhìn khi có sự kiện kinh hoàng
"use client";

import { useEffect } from "react";
import { EffectComponentProps } from "../EffectRegistry";

export default function ScreenShake({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  useEffect(() => {
    const targetElement =
      (document.querySelector(".effect-modal-preview-portal") as HTMLElement) ||
      (document.querySelector(".scene-live-preview-overlay") as HTMLElement) ||
      (document.querySelector("[role='dialog']") as HTMLElement) ||
      (document.querySelector(".scene-layer") as HTMLElement) ||
      (document.querySelector(".reader-pane") as HTMLElement) ||
      (document.querySelector(".reader-screen") as HTMLElement) ||
      (document.querySelector(".editor-screen") as HTMLElement) ||
      document.body;

    if (!targetElement) return;

    if (isActive) {
      const actualIntensity = (config.intensity ?? 0.8) * intensityMultiplier;
      const x = Math.max(4, Math.round(actualIntensity * 10));
      const y = Math.max(3, Math.round(actualIntensity * 8));

      targetElement.style.setProperty("--shake-x", `${x}px`);
      targetElement.style.setProperty("--shake-y", `${y}px`);
      targetElement.classList.add("animate-screen-shake");
    } else {
      targetElement.classList.remove("animate-screen-shake");
    }

    return () => {
      targetElement.classList.remove("animate-screen-shake");
    };
  }, [isActive, config.intensity, intensityMultiplier]);

  return null;
}
