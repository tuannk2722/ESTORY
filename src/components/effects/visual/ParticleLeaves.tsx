// components/effects/visual/ParticleLeaves.tsx
"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { EffectComponentProps } from "../EffectRegistry";

interface LeafParticle {
  id: number;
  startX: number;
  endX: number;
  size: number;
  duration: number;
  delay: number;
  rotationInitial: number;
  rotationFinal: number;
  type: "leaf" | "flower";
  color: string;
}

export default function ParticleLeaves({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  const actualIntensity = (config.intensity ?? 0.75) * intensityMultiplier;
  const count = Math.max(12, Math.min(36, Math.round(24 * actualIntensity)));

  const leaves = useMemo<LeafParticle[]>(() => {
    const leafColors = ["#4ADE80", "#22C55E", "#16A34A", "#86EFAC", "#15803D"];
    const flowerColors = ["#FEF08A", "#FDE047", "#FACC15"];

    return Array.from({ length: count }, (_, i) => {
      const isFlower = i % 4 === 0;
      const startX = (i * 19 + 7) % 110 - 10;
      const drift = 15 + (i % 4) * 8;
      const duration = 4 + (i % 5) * 1;
      const negativeDelay = -((i * 0.55) % duration);

      return {
        id: i,
        startX,
        endX: startX + drift,
        size: isFlower ? 10 + (i % 3) * 2 : 14 + (i % 4) * 3,
        duration,
        delay: negativeDelay,
        rotationInitial: (i * 45) % 360,
        rotationFinal: (i * 45 + 360) % 720,
        type: isFlower ? "flower" : "leaf",
        color: isFlower
          ? flowerColors[i % flowerColors.length]
          : leafColors[i % leafColors.length],
      };
    });
  }, [count]);

  if (!isActive) return null;

  return (
    <div
      data-effect-id={config.id}
      data-effect-type="particle_leaves"
      className="particle-leaves-layer fixed inset-0 pointer-events-none z-[5] overflow-hidden"
      aria-hidden="true"
    >
      {leaves.map((l) => (
        <motion.div
          key={l.id}
          initial={{
            top: "-8%",
            left: `${l.startX}%`,
            opacity: 0,
            rotateX: 0,
            rotateY: 0,
            rotateZ: l.rotationInitial,
          }}
          animate={{
            top: "108%",
            left: `${l.endX}%`,
            opacity: [0, 0.9, 0.85, 0],
            rotateX: [0, 180, 360],
            rotateY: [0, 270, 540],
            rotateZ: [l.rotationInitial, l.rotationFinal],
          }}
          transition={{
            duration: l.duration,
            delay: l.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute pointer-events-none"
          style={{
            width: `${l.size}px`,
            height: `${l.type === "leaf" ? l.size * 1.6 : l.size}px`,
          }}
        >
          {l.type === "leaf" ? (
            <svg viewBox="0 0 24 36" width="100%" height="100%" fill="none">
              <path
                d="M 12,2 C 22,10 20,28 12,34 C 4,28 2,10 12,2 Z"
                fill={l.color}
                stroke="#14532D"
                strokeWidth="1"
                opacity="0.9"
              />
              <line x1="12" y1="4" x2="12" y2="32" stroke="#166534" strokeWidth="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" width="100%" height="100%">
              <circle cx="10" cy="10" r="8" fill={l.color} opacity="0.95" />
              <circle cx="10" cy="10" r="3" fill="#EAB308" />
            </svg>
          )}
        </motion.div>
      ))}
    </div>
  );
}
