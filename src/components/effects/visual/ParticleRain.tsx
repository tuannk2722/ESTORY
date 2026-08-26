// components/effects/visual/ParticleRain.tsx
// Phase 2: Hiệu ứng Mưa Rơi — Giọt mưa dạ quang rơi tức thì và liên tục
"use client";

import React, { useMemo } from "react";
import { EffectComponentProps } from "../EffectRegistry";

export default function ParticleRain({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  const actualIntensity = (config.intensity ?? 0.75) * intensityMultiplier;
  const dropCount = Math.max(30, Math.min(80, Math.floor(55 * actualIntensity)));

  const drops = useMemo(() => {
    return Array.from({ length: dropCount }).map((_, i) => {
      const duration = 0.5 + (i % 5) * 0.08;
      // Dùng negative delay để mưa phủ kín màn hình ngay từ frame 0
      const negativeDelay = -((i * 0.17) % duration);
      const opacity = 0.45 + (i % 4) * 0.12 * actualIntensity;
      const height = 24 + (i % 6) * 8;
      const width = i % 3 === 0 ? "2px" : "1.5px";
      const left = `${(i * 100) / dropCount + ((i * 7) % 5) - 2.5}%`;

      return {
        id: i,
        left,
        delay: `${negativeDelay.toFixed(2)}s`,
        duration: `${duration.toFixed(2)}s`,
        opacity,
        height: `${height}px`,
        width,
      };
    });
  }, [dropCount, actualIntensity]);

  if (!isActive) return null;

  return (
    <div
      data-effect-id={config.id}
      data-effect-type="particle_rain"
      className="particle-rain-layer pointer-events-none fixed inset-0 z-[5] overflow-hidden"
      aria-hidden="true"
    >
      {/* Light mist overlay on bottom */}
      <div
        className="absolute bottom-0 inset-x-0 h-36 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(56, 189, 248, 0.12) 0%, transparent 100%)",
        }}
      />

      {drops.map((drop) => (
        <div
          key={drop.id}
          className="absolute rounded-full animate-rain-fall"
          style={{
            left: drop.left,
            width: drop.width,
            height: drop.height,
            opacity: drop.opacity,
            animationDuration: drop.duration,
            animationDelay: drop.delay,
            animationIterationCount: "infinite",
            animationTimingFunction: "linear",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(56, 189, 248, 0.85) 60%, rgba(186, 230, 253, 1) 100%)",
            boxShadow: "0 0 3px rgba(56, 189, 248, 0.6)",
            top: "-60px",
          }}
        />
      ))}
    </div>
  );
}
