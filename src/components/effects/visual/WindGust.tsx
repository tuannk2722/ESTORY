// components/effects/visual/WindGust.tsx
"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { EffectComponentProps } from "../EffectRegistry";

interface WindStreak {
  id: number;
  top: number;
  width: number;
  height: number;
  speed: number;
  delay: number;
  opacity: number;
}

export default function WindGust({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  const actualIntensity = (config.intensity ?? 0.75) * intensityMultiplier;
  const count = Math.max(8, Math.min(24, Math.round(16 * actualIntensity)));

  const streaks = useMemo<WindStreak[]>(() => {
    return Array.from({ length: count }, (_, i) => {
      const speed = 1.2 + (i % 4) * 0.4;
      const negativeDelay = -((i * 0.35) % speed);
      return {
        id: i,
        top: 8 + (i * 14) % 80,
        width: 250 + (i % 4) * 80,
        height: 2 + (i % 3) * 1.2,
        speed,
        delay: negativeDelay,
        opacity: 0.4 + (i % 3) * 0.15 * actualIntensity,
      };
    });
  }, [count, actualIntensity]);

  if (!isActive) return null;

  return (
    <div
      data-effect-id={config.id}
      data-effect-type="wind_gust"
      className="wind-gust-layer fixed inset-0 pointer-events-none z-[5] overflow-hidden"
      aria-hidden="true"
    >
      {streaks.map((s) => (
        <motion.div
          key={s.id}
          initial={{
            left: "-40%",
            opacity: 0,
            scaleX: 0.5,
          }}
          animate={{
            left: "140%",
            opacity: [0, s.opacity, s.opacity * 0.8, 0],
            scaleX: [0.5, 1.4, 1.8, 0.8],
          }}
          transition={{
            duration: s.speed,
            delay: s.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute pointer-events-none rounded-full"
          style={{
            top: `${s.top}%`,
            width: `${s.width}px`,
            height: `${s.height}px`,
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.8) 50%, transparent 100%)",
            boxShadow: "0 0 10px 2px rgba(255,255,255,0.5)",
          }}
        />
      ))}
    </div>
  );
}
