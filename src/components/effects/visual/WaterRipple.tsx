// components/effects/visual/WaterRipple.tsx
// Phase 2: Hiệu ứng Mặt Nước Gợn Sóng — Ánh trăng phản quang gợn sóng lấp lánh êm đềm
"use client";

import React, { useMemo } from "react";
import { EffectComponentProps } from "../EffectRegistry";

export default function WaterRipple({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  const actualIntensity = (config.intensity || 0.75) * intensityMultiplier;
  const rippleCount = Math.max(5, Math.min(10, Math.floor(7 * actualIntensity)));

  const ripples = useMemo(() => {
    return Array.from({ length: rippleCount }).map((_, i) => {
      const duration = 2.8 + (i % 4) * 0.6;
      const negativeDelay = -((i * 0.7) % duration);
      return {
        id: i,
        left: `${(i * 14 + 6) % 88}%`,
        top: `${50 + (i * 8) % 40}%`,
        width: `${140 + (i % 3) * 60}px`,
        height: `${28 + (i % 3) * 14}px`,
        duration,
        delay: negativeDelay,
        opacity: 0.45 + (i % 3) * 0.15 * actualIntensity,
      };
    });
  }, [rippleCount, actualIntensity]);

  if (!isActive) return null;

  return (
    <div
      data-effect-id={config.id}
      data-effect-type="water_ripple"
      className="water-ripple-layer fixed inset-0 pointer-events-none z-20 overflow-hidden"
      aria-hidden="true"
    >
      {/* Bottom Water Glow Horizon */}
      <div
        className="absolute -bottom-12 inset-x-0 h-72 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(14, 165, 233, 0.28) 0%, rgba(2, 132, 199, 0.12) 50%, transparent 100%)",
          filter: "blur(18px)",
        }}
      />

      {/* Expanding Shimmering Ripples */}
      {ripples.map((r) => (
        <div
          key={r.id}
          className="absolute rounded-full animate-water-ripple"
          style={{
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
            opacity: r.opacity,
            animationDuration: `${r.duration}s`,
            animationDelay: `${r.delay}s`,
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
            background:
              "radial-gradient(ellipse at center, rgba(224, 242, 254, 0.9) 0%, rgba(56, 189, 248, 0.5) 45%, transparent 75%)",
            boxShadow: "0 0 16px 3px rgba(56, 189, 248, 0.55)",
            filter: "blur(3px)",
          }}
        />
      ))}
    </div>
  );
}
