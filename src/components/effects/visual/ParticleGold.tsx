// components/effects/visual/ParticleGold.tsx
"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { EffectComponentProps } from "../EffectRegistry";

interface GoldParticle {
  id: number;
  startX: number;
  endX: number;
  size: number;
  duration: number;
  delay: number;
  isDiamond: boolean;
  color: string;
}

export default function ParticleGold({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  const actualIntensity = (config.intensity ?? 0.75) * intensityMultiplier;
  const count = Math.max(15, Math.min(50, Math.round(35 * actualIntensity)));

  const particles = useMemo<GoldParticle[]>(() => {
    const goldColors = ["#FDE047", "#FACC15", "#EAB308", "#FEF08A", "#F59E0B"];
    const diamondColors = ["#FFFFFF", "#E0F2FE", "#BAE6FD", "#FDF4FF"];

    return Array.from({ length: count }, (_, i) => {
      const isDiamond = i % 3 === 0;
      const startX = (i * 17 + 5) % 100;
      const drift = ((i % 5) - 2) * 6;

      return {
        id: i,
        startX,
        endX: Math.max(0, Math.min(100, startX + drift)),
        size: 3.5 + (i % 4) * 2,
        duration: 3 + (i % 4) * 1,
        delay: -((i * 0.45) % 4),
        isDiamond,
        color: isDiamond
          ? diamondColors[i % diamondColors.length]
          : goldColors[i % goldColors.length],
      };
    });
  }, [count]);

  if (!isActive) return null;

  return (
    <div
      data-effect-id={config.id}
      data-effect-type="particle_gold"
      className="particle-gold-layer fixed inset-0 pointer-events-none z-[5] overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{
            top: "-5%",
            left: `${p.startX}%`,
            opacity: 0,
            scale: 0.6,
            rotate: 0,
          }}
          animate={{
            top: "105%",
            left: `${p.endX}%`,
            opacity: [0, 0.95, 0.85, 0],
            scale: [0.6, 1.25, 0.9, 0.4],
            rotate: p.isDiamond ? [0, 180, 360] : [0, 90, 180],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute pointer-events-none"
          style={{
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: p.isDiamond ? "2px" : "50%",
            boxShadow: p.isDiamond
              ? `0 0 14px 3px rgba(224, 242, 254, 0.95), 0 0 24px 6px rgba(56, 189, 248, 0.6)`
              : `0 0 12px 3px rgba(253, 224, 71, 0.9), 0 0 20px 5px rgba(245, 158, 11, 0.5)`,
          }}
        />
      ))}
    </div>
  );
}
