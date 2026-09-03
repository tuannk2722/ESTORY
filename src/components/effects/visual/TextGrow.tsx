// components/effects/visual/TextGrow.tsx
// Phase 2: Hiệu ứng Phóng To Chữ — Chữ phồng to đột ngột nhấn mạnh âm thanh khủng khiếp
"use client";

import { useEffect } from "react";
import { EffectComponentProps } from "../EffectRegistry";

export default function TextGrow({
  config,
  isActive,
}: EffectComponentProps) {
  useEffect(() => {
    const blockEl =
      document.querySelector(`[data-has-effect*="${config.id}"]`) ||
      document.querySelector(".story-block.active") ||
      document.querySelector(".story-block");
    if (!blockEl) return;

    if (isActive) {
      blockEl.classList.add(
        "scale-[1.05]",
        "transition-transform",
        "duration-500",
        "font-semibold"
      );
    } else {
      blockEl.classList.remove("scale-[1.05]", "font-semibold");
    }

    return () => {
      blockEl.classList.remove("scale-[1.05]", "font-semibold");
    };
  }, [isActive, config.id]);

  if (!isActive) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[5] flex items-center justify-center transition-all"
      aria-hidden="true"
    >
      <div
        className="w-full h-full animate-pulse opacity-25 pointer-events-none"
        style={{
          background: "radial-gradient(circle at center, rgba(226, 183, 20, 0.35) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
