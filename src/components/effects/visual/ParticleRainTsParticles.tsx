"use client";

// components/effects/visual/ParticleRainTsParticles.tsx
// Implement ParticleRain bằng tsParticles v4 (@tsparticles/react + @tsparticles/slim)
// Sử dụng shape "line" quay dọc 90 độ mô phỏng vệt giọt mưa thật, màu sắc tương phản cao theo từng Theme

import React, { useCallback, useMemo } from "react";
import { Particles, ParticlesProvider } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import { EffectComponentProps } from "../EffectRegistry";
import { useReaderSettings } from "@/components/ui/ThemeProvider";

// Hàm khởi tạo engine — phải stable (không tạo lại trong component)
async function initEngine(engine: Parameters<typeof loadSlim>[0]) {
  await loadSlim(engine);
}

export default function ParticleRainTsParticles({
  config,
  isActive,
  intensityMultiplier = 1,
}: EffectComponentProps) {
  const { settings } = useReaderSettings();

  const actualIntensity = config.intensity * intensityMultiplier;

  // Số giọt mưa tỉ lệ theo intensity: [35, 90]
  const particleCount = Math.max(35, Math.min(90, Math.floor(65 * actualIntensity)));

  // Bảng màu giọt mưa tương phản cao, nhìn rõ trên từng nền Theme
  const rainColors = useMemo(() => {
    switch (settings.theme) {
      case "light":
        // Trên nền trắng sáng: Màu xanh nước biển thẫm + xanh navy + xám than (tương phản đậm)
        return ["#1e3a8a", "#1d4ed8", "#0f172a", "#1e293b"];
      case "sepia":
        // Trên nền giấy kem Sepia: Màu nâu hổ phách đậm + nâu gỗ mun + than chì cổ kính
        return ["#451a03", "#78350f", "#3b2d1d", "#1c1917"];
      case "dark":
      default:
        // Trên nền đen tối: Màu xanh dạ quang Cyan + Sky Blue + trắng sáng phát quang
        return ["#38bdf8", "#67e8f9", "#93c5fd", "#e0f2fe"];
    }
  }, [settings.theme]);

  const particlesOptions = useMemo(
    () => ({
      fullScreen: { enable: false },
      fpsLimit: 60,
      particles: {
        number: {
          value: particleCount,
          density: { enable: true },
        },
        color: { value: rainColors },
        // Dùng shape "line" kết hợp stroke để tạo thành vệt mưa kéo dài
        shape: { type: "line" as const },
        stroke: {
          width: 1.8,
          color: rainColors,
        },
        // Chiều dài vệt mưa (15px -> 35px)
        size: {
          value: { min: 14, max: 32 },
        },
        // Độ đậm cao (0.6 -> 0.95) để nhìn rõ mồn một trên mọi nền
        opacity: {
          value: { min: 0.6, max: Math.min(1, 0.95 * Math.max(0.7, actualIntensity)) },
        },
        // Xoay 90 độ để vệt đường thẳng đứng thẳng rơi xuống
        rotate: {
          value: 90,
          direction: "clockwise" as const,
        },
        move: {
          enable: true,
          direction: "bottom" as const,
          speed: { min: 28, max: 48 + 15 * actualIntensity },
          straight: true,
          outModes: { default: "out" as const },
        },
      },
      detectRetina: true,
    }),
    [particleCount, rainColors, actualIntensity]
  );

  const particlesLoaded = useCallback(async () => {
    // callback khi canvas particle mount
  }, []);

  if (!isActive || settings.reduced_motion) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[5] overflow-hidden">
      <ParticlesProvider init={initEngine}>
        <Particles
          id={`rain-${config.id}`}
          options={particlesOptions}
          particlesLoaded={particlesLoaded}
          style={{ width: "100%", height: "100%" }}
        />
      </ParticlesProvider>
    </div>
  );
}
