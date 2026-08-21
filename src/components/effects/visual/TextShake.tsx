"use client";

import React, { useEffect, useState } from "react";
import { EffectComponentProps } from "../EffectRegistry";
import { useReaderSettings } from "@/components/ui/ThemeProvider";

export default function TextShake({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  const { settings } = useReaderSettings();
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (isActive && !settings.reduced_motion) {
      setIsShaking(true);
      const timer = setTimeout(() => {
        setIsShaking(false);
      }, config.duration_ms || 800);
      return () => clearTimeout(timer);
    } else {
      setIsShaking(false);
    }
  }, [isActive, config.duration_ms, settings.reduced_motion]);

  useEffect(() => {
    // Tìm block tương ứng với effect
    const blockEl = document.querySelector(`[data-has-effect="${config.id}"]`) || document.querySelector(".story-block.active");
    if (!blockEl) return;

    if (isShaking) {
      const intensity = config.intensity * intensityMultiplier;
      (blockEl as HTMLElement).style.animation = `text-shake 0.15s ease-in-out infinite`;
      (blockEl as HTMLElement).style.display = "block";
    } else {
      (blockEl as HTMLElement).style.animation = "";
    }

    return () => {
      if (blockEl) (blockEl as HTMLElement).style.animation = "";
    };
  }, [isShaking, config.id, config.intensity, intensityMultiplier]);

  return null;
}
