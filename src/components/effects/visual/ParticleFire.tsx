// components/effects/visual/ParticleFire.tsx
// Phase 2: Hiệu ứng Đốm Lửa & Tàn Tro Bay — Bập bùng ấm áp hoặc rực lửa chiến trận
"use client";

import React, { useMemo } from "react";
import { EffectComponentProps } from "../EffectRegistry";

interface FireSpark {
  id: number;
  left: number;
  bottom: number;
  size: number;
  duration: number;
  delay: number;
  xOffset: number;
  color: string;
  glow: string;
}

export default function ParticleFire({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  if (!isActive) return null;

  const actualIntensity = (config.intensity ?? 0.75) * intensityMultiplier;
  const count = Math.max(12, Math.min(32, Math.round(26 * actualIntensity)));

  // Generate deterministic fire sparks
  const sparks = useMemo<FireSpark[]>(() => {
    const colors = [
      "#FF4500", // Orange Red
      "#FF8C00", // Dark Orange
      "#FFA500", // Orange
      "#FFD700", // Gold
      "#FF2400", // Scarlet
    ];

    return Array.from({ length: 32 }).map((_, i) => {
      const color = colors[i % colors.length];
      const size = 3 + (i % 4) * 2;
      const duration = 2.2 + (i % 5) * 0.7;
      const negativeDelay = -((i * 0.35) % duration);
      return {
        id: i,
        left: (i * 13 + 7) % 96,
        bottom: -5 - (i % 5) * 4,
        size,
        duration,
        delay: negativeDelay,
        xOffset: ((i % 3) - 1) * 28,
        color,
        glow: `0 0 ${size * 2}px ${color}, 0 0 ${size * 4}px rgba(255, 69, 0, 0.6)`,
      };
    });
  }, []);

  const activeSparks = sparks.slice(0, count);

  return (
    <div
      data-effect-id={config.id}
      data-effect-type="particle_fire"
      className="particle-fire-layer fixed inset-0 pointer-events-none z-10 overflow-hidden"
      aria-hidden="true"
    >
      {/* Warm Fire Ambience Bottom Glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(234, 88, 12, 0.28) 0%, rgba(249, 115, 22, 0.12) 50%, transparent 100%)",
        }}
      />

      {/* Floating Embers / Sparks */}
      {activeSparks.map((spark) => (
        <div
          key={spark.id}
          className="absolute rounded-full pointer-events-none animate-fire-ember"
          style={{
            left: `${spark.left}%`,
            bottom: `${spark.bottom}%`,
            width: `${spark.size}px`,
            height: `${spark.size}px`,
            backgroundColor: spark.color,
            boxShadow: spark.glow,
            animationDuration: `${spark.duration}s`,
            animationDelay: `${spark.delay}s`,
            animationIterationCount: "infinite",
            transform: `translateX(${spark.xOffset}px)`,
          }}
        />
      ))}
    </div>
  );
}
