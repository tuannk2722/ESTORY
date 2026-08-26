// components/effects/visual/ParticleSnow.tsx
// Phase 2: Hiệu ứng Tuyết Phủ — Hoa tuyết trắng trôi lững lờ tức thì trên toàn màn hình
"use client";

import React, { useMemo } from "react";
import { EffectComponentProps } from "../EffectRegistry";

export default function ParticleSnow({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  const actualIntensity = (config.intensity || 0.7) * intensityMultiplier;
  const flakeCount = Math.max(25, Math.min(75, Math.floor(50 * actualIntensity)));

  const flakes = useMemo(() => {
    return Array.from({ length: flakeCount }).map((_, i) => {
      const duration = 4.5 + (i % 6) * 0.8;
      const negativeDelay = -((i * 0.45) % duration);
      const size = 3 + (i % 5) * 1.5;
      const opacity = 0.4 + (i % 4) * 0.15 * actualIntensity;

      return {
        id: i,
        left: `${(i * 100) / flakeCount + ((i * 7) % 6) - 3}%`,
        delay: `${negativeDelay.toFixed(2)}s`,
        duration: `${duration.toFixed(2)}s`,
        opacity,
        size: `${size}px`,
      };
    });
  }, [flakeCount, actualIntensity]);

  if (!isActive) return null;

  return (
    <div
      data-effect-id={config.id}
      data-effect-type="particle_snow"
      className="particle-snow-layer pointer-events-none fixed inset-0 z-[5] overflow-hidden"
      aria-hidden="true"
    >
      {flakes.map((f) => (
        <div
          key={f.id}
          className="absolute rounded-full bg-white/95 animate-snow-fall pointer-events-none"
          style={{
            left: f.left,
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            animationDuration: f.duration,
            animationDelay: f.delay,
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
            boxShadow: "0 0 10px 2px rgba(255, 255, 255, 0.9)",
            top: "-20px",
          }}
        />
      ))}
    </div>
  );
}
