// components/effects/visual/FloatingClouds.tsx
// Phase 2: Hiệu ứng Mây Trôi Bồng Bềnh — Sương khói lững lờ trôi ngang qua khung cảnh
"use client";

import React, { useMemo } from "react";
import { EffectComponentProps } from "../EffectRegistry";

export default function FloatingClouds({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  const actualIntensity = (config.intensity || 0.7) * intensityMultiplier;
  const cloudCount = Math.max(3, Math.min(6, Math.floor(4 * actualIntensity)));

  const cloudLayers = useMemo(() => {
    return Array.from({ length: cloudCount }).map((_, i) => {
      const duration = 16 + i * 5;
      const negativeDelay = -((i * 5.5) % duration);
      return {
        id: i,
        top: `${8 + i * 22}%`,
        width: `${550 + i * 160}px`,
        height: `${140 + i * 40}px`,
        duration,
        delay: negativeDelay,
        opacity: 0.35 + (i % 3) * 0.12 * actualIntensity,
      };
    });
  }, [cloudCount, actualIntensity]);

  if (!isActive) return null;

  return (
    <div
      data-effect-id={config.id}
      data-effect-type="floating_clouds"
      className="floating-clouds-layer fixed inset-0 pointer-events-none z-20 overflow-hidden"
      aria-hidden="true"
    >
      {cloudLayers.map((c) => (
        <div
          key={c.id}
          className="absolute rounded-full animate-cloud-drift pointer-events-none"
          style={{
            top: c.top,
            left: 0,
            width: c.width,
            height: c.height,
            opacity: c.opacity,
            animationDuration: `${c.duration}s`,
            animationDelay: `${c.delay}s`,
            animationIterationCount: "infinite",
            animationTimingFunction: "linear",
            background:
              "radial-gradient(ellipse at center, rgba(255, 255, 255, 0.6) 0%, rgba(226, 232, 240, 0.35) 45%, transparent 80%)",
            filter: "blur(24px)",
          }}
        />
      ))}
    </div>
  );
}
