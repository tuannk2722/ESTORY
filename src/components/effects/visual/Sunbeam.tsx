// components/effects/visual/Sunbeam.tsx
// Phase 2: Hiệu ứng Vệt Nắng Xiên — Tia nắng vàng ấm áp lấp lánh xuyên qua tán cây
"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { EffectComponentProps } from "../EffectRegistry";

export default function Sunbeam({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  const actualIntensity = (config.intensity || 0.75) * intensityMultiplier;
  const beamCount = Math.max(3, Math.min(6, Math.floor(4 * actualIntensity)));

  const beams = useMemo(() => {
    return Array.from({ length: beamCount }).map((_, i) => ({
      id: i,
      left: `${12 + i * 20 + ((i * 5) % 6)}%`,
      width: `${80 + i * 35}px`,
      angle: -30 + (i % 3) * 4,
      duration: 5.5 + (i % 3) * 1.5,
      opacity: 0.35 + (i % 3) * 0.15 * actualIntensity,
    }));
  }, [beamCount, actualIntensity]);

  if (!isActive) return null;

  return (
    <div
      data-effect-id={config.id}
      data-effect-type="sunbeam"
      className="sunbeam-effect-layer fixed inset-0 pointer-events-none z-20 overflow-hidden"
      aria-hidden="true"
    >
      {/* 1. Warm Sun Source Glow (Top Right) */}
      <div
        className="absolute -top-32 right-1/4 w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(253, 224, 71, 0.45) 0%, rgba(245, 158, 11, 0.2) 40%, rgba(217, 119, 6, 0.05) 70%, transparent 100%)",
          filter: "blur(48px)",
        }}
      />

      {/* 2. Shimmering Light Beams */}
      {beams.map((b) => (
        <motion.div
          key={b.id}
          initial={{ opacity: b.opacity * 0.7 }}
          animate={{
            opacity: [
              b.opacity * 0.6,
              b.opacity * 1.15,
              b.opacity * 0.75,
              b.opacity * 1.25,
              b.opacity * 0.6,
            ],
            x: ["0px", "18px", "-12px", "0px"],
          }}
          transition={{
            duration: b.duration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -top-24 h-[150vh] origin-top"
          style={{
            left: b.left,
            width: b.width,
            transform: `rotate(${b.angle}deg)`,
            background:
              "linear-gradient(180deg, rgba(254, 240, 138, 0.65) 0%, rgba(250, 204, 21, 0.35) 30%, rgba(245, 158, 11, 0.12) 65%, transparent 100%)",
            filter: "blur(16px)",
          }}
        />
      ))}

      {/* 3. Golden Dust Motes floating in sunlight */}
      {Array.from({ length: 14 }).map((_, i) => (
        <motion.div
          key={`mote-${i}`}
          initial={{
            top: `${15 + (i * 6) % 70}%`,
            left: `${20 + (i * 7) % 65}%`,
            opacity: 0.2,
          }}
          animate={{
            y: ["0px", "-24px", "12px", "0px"],
            x: ["0px", "15px", "-10px", "0px"],
            opacity: [0.3, 0.9, 0.4, 0.8, 0.3],
            scale: [0.8, 1.3, 0.7, 1.1, 0.8],
          }}
          transition={{
            duration: 4 + (i % 4),
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute w-1.5 h-1.5 rounded-full bg-yellow-200 pointer-events-none"
          style={{
            boxShadow: "0 0 6px rgba(253, 224, 71, 0.9)",
          }}
        />
      ))}
    </div>
  );
}
