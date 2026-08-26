// components/effects/visual/ParticleSmoke.tsx
// Phase 2: Hiệu ứng Khói Sương — Làn sương khói huyền ảo trôi bồng bềnh
"use client";

import React, { useMemo } from "react";
import { EffectComponentProps } from "../EffectRegistry";

export default function ParticleSmoke({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  const actualIntensity = (config.intensity || 0.7) * intensityMultiplier;
  const cloudCount = Math.max(3, Math.min(8, Math.floor(5 * actualIntensity)));

  const clouds = useMemo(() => {
    return Array.from({ length: cloudCount }).map((_, i) => {
      const duration = 14 + i * 3;
      const negativeDelay = -((i * 4.5) % duration);
      return {
        id: i,
        top: `${10 + i * 16}%`,
        left: `${(i * 22) % 75}%`,
        delay: `${negativeDelay.toFixed(2)}s`,
        duration: `${duration}s`,
        width: `${400 + (i % 3) * 160}px`,
        height: `${160 + (i % 3) * 60}px`,
        opacity: 0.35 + (i % 3) * 0.12 * actualIntensity,
      };
    });
  }, [cloudCount, actualIntensity]);

  if (!isActive) return null;

  return (
    <div
      data-effect-id={config.id}
      data-effect-type="particle_smoke"
      className="particle-smoke-layer pointer-events-none fixed inset-0 z-20 overflow-hidden"
      aria-hidden="true"
    >
      {clouds.map((c) => (
        <div
          key={c.id}
          className="absolute rounded-full animate-fog-drift pointer-events-none"
          style={{
            top: c.top,
            left: c.left,
            width: c.width,
            height: c.height,
            opacity: c.opacity,
            animationDuration: c.duration,
            animationDelay: c.delay,
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
            background:
              "radial-gradient(ellipse at center, rgba(241, 245, 249, 0.55) 0%, rgba(203, 213, 225, 0.3) 50%, transparent 80%)",
            filter: "blur(28px)",
          }}
        />
      ))}
    </div>
  );
}
