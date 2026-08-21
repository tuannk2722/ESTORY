"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EffectComponentProps } from "../EffectRegistry";
import { useReaderSettings } from "@/components/ui/ThemeProvider";

export default function BgColorShift({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  const { settings } = useReaderSettings();

  const actualIntensity = config.intensity * intensityMultiplier;
  const durationSec = (config.duration_ms || 2200) / 1000;

  // Lựa chọn màu sắc chuyển đổi theo từng Theme
  const themeTint = useMemo(() => {
    switch (settings.theme) {
      case "light":
        // Trên nền Light: tạo mây dông xám tro u ám nhẹ nhàng
        return {
          className: "bg-slate-700/25 mix-blend-multiply",
          maxOpacity: Math.min(0.35, actualIntensity * 0.4),
        };
      case "sepia":
        // Trên nền Sepia: tạo sương mù nâu sẫm ấm áp
        return {
          className: "bg-amber-950/20 mix-blend-multiply",
          maxOpacity: Math.min(0.35, actualIntensity * 0.35),
        };
      case "dark":
      default:
        // Trên nền Dark: tạo màn đêm tím đen huyền bí
        return {
          className: "bg-indigo-950/50 mix-blend-screen",
          maxOpacity: Math.min(0.5, actualIntensity * 0.55),
        };
    }
  }, [settings.theme, actualIntensity]);

  if (settings.reduced_motion) return null;

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: themeTint.maxOpacity }}
          exit={{ opacity: 0 }}
          transition={{ duration: durationSec, ease: "easeInOut" }}
          className={`pointer-events-none fixed inset-0 z-10 ${themeTint.className}`}
        />
      )}
    </AnimatePresence>
  );
}
