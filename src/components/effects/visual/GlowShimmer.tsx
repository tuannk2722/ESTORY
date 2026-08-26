// components/effects/visual/GlowShimmer.tsx
// Phase 2: Hiệu ứng Hào Quang Ngũ Sắc — Ánh sáng ngọc báu rực rỡ lấp lánh
"use client";

import React from "react";
import { motion } from "framer-motion";
import { EffectComponentProps } from "../EffectRegistry";

export default function GlowShimmer({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  const intensity = (config.intensity ?? 0.75) * intensityMultiplier;
  const isLoop = config.loop !== false;

  if (!isActive) return null;

  return (
    <div
      data-effect-id={config.id}
      data-effect-type="glow_shimmer"
      className="glow-shimmer-layer fixed inset-0 pointer-events-none z-[5] overflow-hidden"
      aria-hidden="true"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          opacity: isLoop
            ? [0.2, intensity * 0.9, intensity * 0.5, intensity * 0.95, 0.2]
            : [0, intensity * 0.9, intensity * 0.5, intensity * 0.95, 0],
        }}
        transition={{
          duration: isLoop ? 4 : (config.duration_ms ? config.duration_ms / 1000 : 3),
          repeat: isLoop ? Infinity : 0,
          ease: "easeInOut",
        }}
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(253, 224, 71, 0.5) 0%, rgba(56, 189, 248, 0.3) 40%, rgba(236, 72, 153, 0.18) 65%, transparent 100%)",
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
}
