// components/effects/visual/TextGrow.tsx
// Phase 2: Hiệu ứng Phóng To Chữ — Chữ phồng to đột ngột nhấn mạnh âm thanh khủng khiếp
"use client";

import React, { useEffect, useState } from "react";
import { EffectComponentProps } from "../EffectRegistry";

export default function TextGrow({
  config,
  isActive,
}: EffectComponentProps) {
  const [active, setActive] = useState(false);
  const isLoop = !!config.loop;

  useEffect(() => {
    if (!isActive) {
      setActive(false);
      const blockEl =
        document.querySelector(`[data-has-effect*="${config.id}"]`) ||
        document.querySelector(".story-block.active") ||
        document.querySelector(".story-block");
      if (blockEl) {
        blockEl.classList.remove("scale-[1.05]", "font-semibold");
      }
      return;
    }

    const delay = config.delay_ms || 0;
    const startTimer = setTimeout(() => {
      setActive(true);
      const blockEl =
        document.querySelector(`[data-has-effect*="${config.id}"]`) ||
        document.querySelector(".story-block.active") ||
        document.querySelector(".story-block");
      if (blockEl) {
        blockEl.classList.add("scale-[1.05]", "transition-transform", "duration-500", "font-semibold");
      }
    }, delay);

    let endTimer: NodeJS.Timeout | null = null;
    if (!isLoop && config.duration_ms && config.duration_ms > 0) {
      endTimer = setTimeout(() => {
        setActive(false);
        const blockEl =
          document.querySelector(`[data-has-effect*="${config.id}"]`) ||
          document.querySelector(".story-block.active") ||
          document.querySelector(".story-block");
        if (blockEl) {
          blockEl.classList.remove("scale-[1.05]", "font-semibold");
        }
      }, delay + config.duration_ms);
    }

    return () => {
      clearTimeout(startTimer);
      if (endTimer) clearTimeout(endTimer);
      const blockEl =
        document.querySelector(`[data-has-effect*="${config.id}"]`) ||
        document.querySelector(".story-block.active") ||
        document.querySelector(".story-block");
      if (blockEl) {
        blockEl.classList.remove("scale-[1.05]", "font-semibold");
      }
    };
  }, [isActive, config, isLoop]);

  if (!active) return null;

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
