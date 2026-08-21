"use client";

import React, { useEffect, useState } from "react";
import { EffectComponentProps } from "../EffectRegistry";
import { useReaderSettings } from "@/components/ui/ThemeProvider";

export default function ScreenShake({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  const { settings } = useReaderSettings();
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    // Kiểm tra cài đặt và trạng thái active
    const isMotionEnabled =
      settings.effects_enabled &&
      settings.effects_by_category?.motion !== false &&
      !settings.reduced_motion;

    if (isActive && isMotionEnabled) {
      setShaking(true);
      const timer = setTimeout(() => {
        setShaking(false);
      }, config.duration_ms || 700);
      return () => clearTimeout(timer);
    } else {
      setShaking(false);
    }
  }, [isActive, config.duration_ms, settings.effects_enabled, settings.effects_by_category?.motion, settings.reduced_motion]);

  useEffect(() => {
    const targetElement =
      (document.querySelector(".reader-pane") as HTMLElement) ||
      (document.querySelector(".reader-screen") as HTMLElement) ||
      document.body;

    if (!targetElement) return;

    if (shaking) {
      const actualIntensity = config.intensity * intensityMultiplier;
      const x = Math.max(3, Math.round(actualIntensity * 9));
      const y = Math.max(2, Math.round(actualIntensity * 7));

      targetElement.style.setProperty("--shake-x", `${x}px`);
      targetElement.style.setProperty("--shake-y", `${y}px`);
      targetElement.classList.add("animate-screen-shake");
    } else {
      targetElement.classList.remove("animate-screen-shake");
    }

    return () => {
      targetElement.classList.remove("animate-screen-shake");
    };
  }, [shaking, config.intensity, intensityMultiplier]);

  return null;
}
