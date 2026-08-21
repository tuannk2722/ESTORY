"use client";

import React, { useMemo } from "react";
import { EffectComponentProps } from "../EffectRegistry";
import { useReaderSettings } from "@/components/ui/ThemeProvider";

export default function ParticleRain({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  const { settings } = useReaderSettings();

  const actualIntensity = config.intensity * intensityMultiplier;
  const dropCount = Math.max(20, Math.min(65, Math.floor(45 * actualIntensity)));

  // Bảng màu giọt mưa tương thích theo từng Theme
  const rainGradient = useMemo(() => {
    switch (settings.theme) {
      case "light":
        // Trên nền giấy trắng: giọt mưa màu xanh biển thẫm + xám chì tương phản cao
        return "bg-gradient-to-b from-transparent via-slate-600/60 to-blue-900/90 shadow-xs";
      case "sepia":
        // Trên nền giấy kem Sepia: giọt mưa màu nâu hổ phách sẫm cổ kính
        return "bg-gradient-to-b from-transparent via-amber-950/50 to-stone-800/85";
      case "dark":
      default:
        // Trên nền đen OLED: giọt mưa phát sáng xanh dạ quang sắc nét
        return "bg-gradient-to-b from-transparent via-cyan-300/60 to-blue-400/90 drop-shadow-[0_0_2px_rgba(56,189,248,0.5)]";
    }
  }, [settings.theme]);

  const drops = useMemo(() => {
    return Array.from({ length: dropCount }).map((_, i) => ({
      id: i,
      left: `${(i * 100) / dropCount + (Math.random() * 3 - 1.5)}%`,
      delay: `${Math.random() * 1.8}s`,
      duration: `${0.55 + Math.random() * 0.35}s`,
      opacity: 0.35 + Math.random() * 0.55 * actualIntensity,
      height: `${20 + Math.random() * 30}px`,
      width: Math.random() > 0.6 ? "2px" : "1.5px",
    }));
  }, [dropCount, actualIntensity]);

  if (!isActive || settings.reduced_motion) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {drops.map((drop) => (
        <div
          key={drop.id}
          className={`absolute rounded-full animate-rain ${rainGradient}`}
          style={{
            left: drop.left,
            width: drop.width,
            height: drop.height,
            opacity: drop.opacity,
            animationDuration: drop.duration,
            animationDelay: drop.delay,
            animationIterationCount: "infinite",
            animationTimingFunction: "linear",
            top: "-50px",
          }}
        />
      ))}
      <style jsx>{`
        @keyframes rainDrop {
          0% {
            transform: translateY(0vh);
          }
          100% {
            transform: translateY(112vh);
          }
        }
        .animate-rain {
          animation-name: rainDrop;
        }
      `}</style>
    </div>
  );
}
