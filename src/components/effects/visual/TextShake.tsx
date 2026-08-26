// components/effects/visual/TextShake.tsx
// Phase 2: Hiệu ứng Rung Chữ — Đoạn văn rung lắc nhẹ thể hiện sự sợ hãi, hét lớn
"use client";

import React, { useEffect, useState } from "react";
import { EffectComponentProps } from "../EffectRegistry";

export default function TextShake({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  const [isShaking, setIsShaking] = useState(false);
  const isLoop = !!config.loop;

  useEffect(() => {
    if (!isActive) {
      setIsShaking(false);
      return;
    }

    setIsShaking(true);

    let timer: NodeJS.Timeout | null = null;
    if (!isLoop && config.duration_ms && config.duration_ms > 0) {
      timer = setTimeout(() => {
        setIsShaking(false);
      }, config.duration_ms);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isActive, config.duration_ms, isLoop]);

  useEffect(() => {
    // Tìm block tương ứng với effect hoặc story-block đang active
    const blockEl =
      document.querySelector(`[data-has-effect*="${config.id}"]`) ||
      document.querySelector(".story-block.active") ||
      document.querySelector(".story-block");
    if (!blockEl) return;

    if (isShaking) {
      (blockEl as HTMLElement).style.animation = `text-shake 0.15s ease-in-out infinite`;
      (blockEl as HTMLElement).style.display = "block";
    } else {
      (blockEl as HTMLElement).style.animation = "";
    }

    return () => {
      if (blockEl) (blockEl as HTMLElement).style.animation = "";
    };
  }, [isShaking, config.id]);

  return null;
}
