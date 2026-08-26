// components/effects/visual/BgColorShift.tsx
// Phase 2: Hiệu ứng Đổi Tông Màu Nền — Chuyển sắc nền nhẹ nhàng sang tông u ám hoặc hoàng hôn
"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EffectComponentProps } from "../EffectRegistry";

export default function BgColorShift({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  const actualIntensity = (config.intensity || 0.6) * intensityMultiplier;
  const isLoop = !!config.loop;
  const durationSec = config.duration_ms ? config.duration_ms / 1000 : 2.5;

  const themeTint = useMemo(() => {
    return {
      className: "bg-indigo-950/70 mix-blend-multiply",
      maxOpacity: Math.min(0.7, actualIntensity * 0.75),
    };
  }, [actualIntensity]);

  if (!isActive) return null;

  return (
    <AnimatePresence>
      <motion.div
        data-effect-id={config.id}
        data-effect-type="bg_color_shift"
        initial={{ opacity: 0 }}
        animate={{
          opacity: isLoop
            ? [0.2, themeTint.maxOpacity, 0.35, themeTint.maxOpacity, 0.2]
            : themeTint.maxOpacity,
        }}
        exit={{ opacity: 0 }}
        transition={{
          duration: isLoop ? durationSec : 0.8,
          repeat: isLoop ? Infinity : 0,
          ease: "easeInOut",
        }}
        className={`pointer-events-none fixed inset-0 z-[5] ${themeTint.className}`}
        aria-hidden="true"
      />
    </AnimatePresence>
  );
}
