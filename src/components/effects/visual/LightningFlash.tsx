// components/effects/visual/LightningFlash.tsx
// Phase 2: Hiệu ứng Chớp Sáng — Tia chớp chói lòa toàn màn hình kèm khả năng lặp định kỳ
"use client";

import React from "react";
import { motion } from "framer-motion";
import { EffectComponentProps } from "../EffectRegistry";

export default function LightningFlash({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  const actualIntensity = Math.min(1.0, (config.intensity || 0.85) * intensityMultiplier);
  const isLoop = !!config.loop;

  if (!isActive) return null;

  return (
    <div
      data-effect-id={config.id}
      data-effect-type="lightning_flash"
      className="lightning-flash-layer pointer-events-none fixed inset-0 z-50 overflow-hidden"
      aria-hidden="true"
    >
      {/* Primary White/Cyan Lightning Burst */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          opacity: isLoop
            ? [
              0,
              actualIntensity * 1.0,
              0.15,
              actualIntensity * 0.75,
              0,
              0,
              0,
            ]
            : [
              0,
              actualIntensity * 1.0,
              0.15,
              actualIntensity * 0.75,
              0,
            ],
        }}
        transition={{
          duration: isLoop ? 3.6 : (config.duration_ms ? config.duration_ms / 1000 : 1.2),
          times: isLoop ? [0, 0.04, 0.1, 0.18, 0.35, 0.7, 1] : [0, 0.08, 0.2, 0.38, 1],
          repeat: isLoop ? Infinity : 0,
          ease: "easeOut",
        }}
        className="absolute inset-0 bg-white"
        style={{
          boxShadow: "inset 0 0 100px rgba(56, 189, 248, 0.8)",
        }}
      />

      {/* Secondary Cyan Atmospheric Flare */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          opacity: isLoop
            ? [0, 0.6 * actualIntensity, 0, 0.4 * actualIntensity, 0, 0]
            : [0, 0.6 * actualIntensity, 0, 0.4 * actualIntensity, 0],
        }}
        transition={{
          duration: isLoop ? 3.6 : (config.duration_ms ? config.duration_ms / 1000 : 1.2),
          times: isLoop ? [0, 0.06, 0.15, 0.25, 0.45, 1] : [0, 0.1, 0.25, 0.45, 1],
          repeat: isLoop ? Infinity : 0,
          ease: "easeOut",
        }}
        className="absolute inset-0 bg-cyan-400 mix-blend-screen"
      />
    </div>
  );
}
