"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { EffectComponentProps } from "../EffectRegistry";
import { useReaderSettings } from "@/components/ui/ThemeProvider";

export default function LightningFlash({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  const { settings } = useReaderSettings();

  const actualIntensity = config.intensity * intensityMultiplier;
  const durationSec = (config.duration_ms || 1200) / 1000;

  // Lựa chọn màu tia chớp theo từng Theme — phải đặt TRƯỚC mọi early return
  const flashColor = useMemo(() => {
    switch (settings.theme) {
      case "light":
        return "bg-indigo-950/60";
      case "sepia":
        return "bg-amber-200";
      case "dark":
      default:
        return "bg-white";
    }
  }, [settings.theme]);

  if (!isActive) return null;

  // Fallback nếu người dùng bật Reduced Motion
  if (settings.reduced_motion) {
    return (
      <div
        className={`pointer-events-none fixed inset-0 z-50 ${flashColor} transition-opacity duration-300`}
        style={{ opacity: actualIntensity * 0.25 }}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{
        opacity: [0, actualIntensity * 0.95, 0, actualIntensity * 0.65, 0],
      }}
      transition={{
        duration: durationSec,
        times: [0, 0.12, 0.3, 0.5, 1],
        ease: "easeOut",
      }}
      className={`pointer-events-none fixed inset-0 z-50 ${flashColor}`}
    />
  );
}
