// components/effects/visual/ParticleFireflies.tsx
"use client";

import React, { useMemo } from "react";
import { EffectComponentProps } from "../EffectRegistry";

interface Firefly {
  id: number;
  left: number;
  top: number;
  size: number;
  duration: number;
  delay: number;
}

export default function ParticleFireflies({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  const actualIntensity = (config.intensity ?? 0.75) * intensityMultiplier;
  const count = Math.max(8, Math.min(30, Math.round(18 * actualIntensity)));

  const fireflies = useMemo<Firefly[]>(() => {
    return Array.from({ length: count }, (_, i) => {
      const duration = 3.5 + (i % 5) * 1.2;
      const negativeDelay = -((i * 0.6) % duration);
      return {
        id: i,
        left: (i * 19 + 7) % 95,
        top: (i * 23 + 11) % 90,
        size: 3.5 + (i % 4) * 2,
        duration,
        delay: negativeDelay,
      };
    });
  }, [count]);

  if (!isActive) return null;

  return (
    <div
      data-effect-id={config.id}
      data-effect-type="particle_fireflies"
      className="particle-fireflies-layer fixed inset-0 pointer-events-none z-[5] overflow-hidden"
      aria-hidden="true"
    >
      {fireflies.map((f) => (
        <div
          key={f.id}
          className="absolute rounded-full pointer-events-none animate-firefly"
          style={{
            left: `${f.left}%`,
            top: `${f.top}%`,
            width: `${f.size}px`,
            height: `${f.size}px`,
            backgroundColor: "#34D399",
            boxShadow:
              "0 0 12px 3px rgba(52, 211, 153, 0.85), 0 0 24px 6px rgba(16, 185, 129, 0.45)",
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
