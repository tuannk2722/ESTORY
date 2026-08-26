// components/effects/visual/CandleFlicker.tsx
// Phase 2: Hiệu ứng Ánh Nến Bập Bùng — Quầng lửa ấm áp lung linh ở góc không gian
"use client";

import React from "react";
import { motion } from "framer-motion";
import { EffectComponentProps } from "../EffectRegistry";

export default function CandleFlicker({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  const actualIntensity = (config.intensity || 0.8) * intensityMultiplier;

  if (!isActive) return null;

  return (
    <div
      data-effect-id={config.id}
      data-effect-type="candle_flicker"
      className="candle-flicker-layer fixed inset-0 pointer-events-none z-20 overflow-hidden"
      aria-hidden="true"
    >
      {/* 1. Góc dưới bên trái - Quầng lửa nến ấm */}
      <motion.div
        animate={{
          opacity: [
            0.55 * actualIntensity,
            0.9 * actualIntensity,
            0.65 * actualIntensity,
            0.95 * actualIntensity,
            0.55 * actualIntensity,
          ],
          scale: [1, 1.1, 0.95, 1.15, 1],
        }}
        transition={{
          duration: 2.8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute -bottom-16 -left-16 w-[480px] h-[480px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(249, 115, 22, 0.6) 0%, rgba(234, 88, 12, 0.35) 35%, rgba(194, 65, 12, 0.12) 65%, transparent 100%)",
          filter: "blur(36px)",
        }}
      />

      {/* 2. Góc dưới bên phải - Quầng lửa phụ đối xứng */}
      <motion.div
        animate={{
          opacity: [
            0.4 * actualIntensity,
            0.75 * actualIntensity,
            0.5 * actualIntensity,
            0.8 * actualIntensity,
            0.4 * actualIntensity,
          ],
          scale: [1.05, 0.95, 1.12, 0.98, 1.05],
        }}
        transition={{
          duration: 3.4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute -bottom-20 -right-20 w-[420px] h-[420px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(245, 158, 11, 0.55) 0%, rgba(217, 119, 6, 0.3) 35%, rgba(180, 83, 9, 0.08) 65%, transparent 100%)",
          filter: "blur(36px)",
        }}
      />

      {/* 3. Tàn đóm nến nhỏ bay lơ lửng bập bùng */}
      {Array.from({ length: 14 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{
            bottom: "8%",
            left: `${8 + (i * 6) % 35}%`,
            opacity: 0.3,
          }}
          animate={{
            bottom: ["8%", "45%"],
            left: [
              `${8 + (i * 6) % 35}%`,
              `${10 + ((i * 6) % 35) + (i % 2 === 0 ? 5 : -5)}%`,
            ],
            opacity: [0.2, 0.95 * actualIntensity, 0.6 * actualIntensity, 0],
            scale: [0.7, 1.3, 0.4],
          }}
          transition={{
            duration: 2.8 + (i % 3) * 0.7,
            repeat: Infinity,
            ease: "easeOut",
          }}
          className="absolute w-2 h-2 rounded-full bg-amber-300 pointer-events-none"
          style={{
            boxShadow: "0 0 10px 2px rgba(251, 191, 36, 0.95)",
          }}
        />
      ))}
    </div>
  );
}
