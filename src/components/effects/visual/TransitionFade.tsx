"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { EffectComponentProps } from "../EffectRegistry";
import { useReaderSettings } from "@/components/ui/ThemeProvider";

export default function TransitionFade({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  const { settings } = useReaderSettings();
  const [isPlaying, setIsPlaying] = useState(false);

  const durationSec = (config.duration_ms || 1400) / 1000;
  const peakOpacity = Math.min(0.9, (config.intensity * intensityMultiplier) * 0.85);

  useEffect(() => {
    if (isActive && !settings.reduced_motion) {
      setIsPlaying(true);
      const timer = setTimeout(() => {
        setIsPlaying(false);
      }, (config.duration_ms || 1400));
      return () => clearTimeout(timer);
    } else {
      setIsPlaying(false);
    }
  }, [isActive, config.duration_ms, settings.reduced_motion]);

  if (!isPlaying || settings.reduced_motion) return null;

  // Lớp màn phủ phù hợp với từng theme
  const themeBgColor =
    settings.theme === "light"
      ? "bg-slate-950"
      : settings.theme === "sepia"
      ? "bg-[#1f170e]"
      : "bg-black";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{
        // Khởi màn: tối nhanh -> giữ 1 nhịp ngắn -> tan biến hoàn toàn về 0
        opacity: [0, peakOpacity, peakOpacity * 0.9, 0],
      }}
      transition={{
        duration: durationSec,
        times: [0, 0.2, 0.45, 1],
        ease: "easeInOut",
      }}
      className={`pointer-events-none fixed inset-0 z-40 ${themeBgColor}`}
    />
  );
}
