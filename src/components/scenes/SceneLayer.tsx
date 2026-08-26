// components/scenes/SceneLayer.tsx
// Phase 2: Render tầng bối cảnh (Scene), tách biệt hoàn toàn với /components/effects (docs/08-effects-and-scenes.md)
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Scene, BackgroundAsset, ColorPalette } from "@/types/scene";
import SceneBackground from "./SceneBackground";
import SceneAmbientAudio from "./SceneAmbientAudio";
import { EFFECT_REGISTRY } from "@/components/effects/EffectRegistry";
import { EFFECT_METADATA } from "@/components/editor/effect-meta";
import { useReaderSettings } from "@/components/ui/ThemeProvider";
import { useMobileDetect } from "@/hooks/useMobileDetect";
import { AnimatePresence, motion } from "framer-motion";

export interface SceneLayerProps {
  scene?: Scene | null;
  backgroundAsset?: BackgroundAsset;
  colorPalette?: ColorPalette;
  reducedMotion?: boolean;
  isAudioPaused?: boolean;
  children?: React.ReactNode;
}

/**
 * Wrapper nhận Scene đang active và render background/palette/audio/visual effects
 */
export default function SceneLayer({
  scene,
  backgroundAsset,
  colorPalette,
  reducedMotion = false,
  isAudioPaused = false,
  children,
}: SceneLayerProps) {
  const { settings } = useReaderSettings();
  const isMobile = useMobileDetect();
  const [activeEffectsMap, setActiveEffectsMap] = useState<Record<string, boolean>>({});

  const mobileScale = isMobile ? 0.5 : 1.0;
  const totalIntensityMultiplier = (settings.intensity_multiplier ?? 1.0) * mobileScale;

  // Trích xuất hiệu ứng âm thanh nền (Ambient Audio) từ scene.effects
  const audioEffect = useMemo(() => {
    return scene?.effects?.find((e) => e.type === "audio" || e.category === "audio");
  }, [scene?.effects]);

  // Trích xuất các hiệu ứng không gian êm dịu (Hạt mưa, đom đóm, tuyết, bụi vàng...) từ scene.effects
  const visualEffects = useMemo(() => {
    return scene?.effects?.filter((e) => e.type !== "audio" && e.category !== "audio") || [];
  }, [scene?.effects]);

  // Quản lý vòng đời (Lifecycle) của các hiệu ứng visual trong Scene: delay_ms và duration_ms khi loop === false
  useEffect(() => {
    if (!settings.effects_enabled || visualEffects.length === 0) {
      setActiveEffectsMap({});
      return;
    }

    const timers: NodeJS.Timeout[] = [];
    const initialMap: Record<string, boolean> = {};

    visualEffects.forEach((eff, idx) => {
      const effKey = eff.id || `${eff.type}-${idx}`;
      const isCatEnabled = settings.effects_by_category?.[eff.category] !== false;
      if (!isCatEnabled) return;

      const delay = eff.delay_ms && eff.delay_ms > 0 ? eff.delay_ms : 0;
      const isLoop = eff.loop !== false;
      const meta = EFFECT_METADATA[eff.type];
      const duration =
        eff.duration_ms && eff.duration_ms > 0
          ? eff.duration_ms
          : meta?.defaultDurationMs || 3500;

      if (delay > 0) {
        const startTimer = setTimeout(() => {
          setActiveEffectsMap((prev) => ({ ...prev, [effKey]: true }));
        }, delay);
        timers.push(startTimer);
      } else {
        initialMap[effKey] = true;
      }

      // Nếu loop === false, tự động tắt hiệu ứng sau khi hết thời lượng duration
      if (!isLoop) {
        const stopTimer = setTimeout(() => {
          setActiveEffectsMap((prev) => ({ ...prev, [effKey]: false }));
        }, delay + duration);
        timers.push(stopTimer);
      }
    });

    setActiveEffectsMap(initialMap);

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [scene?.id, scene?.effects, visualEffects, settings.effects_enabled, settings.effects_by_category]);

  // CSS variables động cho ColorPalette (giữ cố định màu chữ chính theo theme, chỉ áp dụng accent/primary/secondary)
  const paletteStyle = useMemo<React.CSSProperties>(() => {
    if (!colorPalette) return {};
    return {
      "--color-primary": colorPalette.colors.primary,
      "--color-secondary": colorPalette.colors.secondary,
      "--color-accent": colorPalette.colors.accent,
      // Lưu ý: Không ghi đè --color-foreground để màu chữ truyện luôn giữ cố định theo Reader Theme (Dark/Light/Sepia)
    } as React.CSSProperties;
  }, [colorPalette]);

  return (
    <div
      className="scene-layer relative w-full min-h-screen transition-colors duration-1000 ease-out"
      style={paletteStyle}
    >
      {/* 1. Background Layer với Cinematic Crossfade ~1200ms */}
      <AnimatePresence mode="sync">
        {backgroundAsset && (
          <motion.div
            key={backgroundAsset.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: reducedMotion ? 0.1 : 1.2,
              ease: [0.4, 0, 0.2, 1],
            }}
            className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
          >
            <SceneBackground
              asset={backgroundAsset}
              reducedMotion={reducedMotion}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Color Palette Cinematic Color Grading & Ambient Atmosphere với Crossfade ~1200ms */}
      <AnimatePresence mode="sync">
        {colorPalette && (
          <motion.div
            key={colorPalette.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: reducedMotion ? 0.1 : 1.2,
              ease: [0.4, 0, 0.2, 1],
            }}
            className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
          >
            {/* 2a. Color Wash (Nhuộm sắc độ vào Background bằng mix-blend-mode) */}
            <div
              className="absolute inset-0 pointer-events-none transition-colors duration-1000 ease-out"
              style={{
                backgroundColor: colorPalette.colors.primary,
                mixBlendMode: "color",
                opacity: 0.45,
              }}
              aria-hidden="true"
            />

            {/* 2b. Atmospheric Gradient & Depth Tint: Tạo chiều sâu khí quyển và tăng tương phản chữ */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(circle at 50% 35%, transparent 15%, ${colorPalette.colors.background_tint} 85%)`,
                opacity: 0.88,
              }}
              aria-hidden="true"
            />

            {/* 2c. Ambient Lighting Aura: Ánh sáng môi trường viền trên/dưới theo màu primary & secondary */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(to bottom, ${colorPalette.colors.primary}33 0%, transparent 25%, transparent 75%, ${colorPalette.colors.secondary}66 100%)`,
              }}
              aria-hidden="true"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Ambient Visual Effects (Hạt không gian nhẹ nhàng: mưa, tuyết, đom đóm, bụi vàng, nắng, nến, mây, sóng...) */}
      <AnimatePresence mode="sync">
        {settings.effects_enabled &&
          visualEffects.map((eff, idx) => {
            const effKey = eff.id || `${eff.type}-${idx}`;
            const isEffectActive = !!activeEffectsMap[effKey];
            const isCatEnabled = settings.effects_by_category?.[eff.category] !== false;
            if (!isEffectActive || !isCatEnabled) return null;

            const Comp = EFFECT_REGISTRY[eff.type];
            if (!Comp) return null;

            return (
              <motion.div
                key={effKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: reducedMotion ? 0.1 : 1.0,
                  ease: "easeInOut",
                }}
                className="fixed inset-0 pointer-events-none z-[5] overflow-hidden"
              >
                <Comp
                  config={eff}
                  isActive={isEffectActive}
                  intensityMultiplier={totalIntensityMultiplier}
                />
              </motion.div>
            );
          })}
      </AnimatePresence>

      {/* 4. Ambient Audio (Nhạc nền êm dịu) */}
      {audioEffect?.audio_src && (
        <SceneAmbientAudio
          audioSrc={audioEffect.audio_src}
          volume={audioEffect.intensity ?? 0.5}
          isActive={
            settings.effects_enabled &&
            settings.effects_by_category?.audio !== false
          }
          isPaused={isAudioPaused}
          loop={audioEffect.loop !== false}
          durationMs={audioEffect.duration_ms}
        />
      )}

      {/* 5. Khung đọc chính: Cố định vị trí trung tâm chuẩn mực, không bị bọc hộp cứng nhắc, giữ mắt đọc êm ái */}
      <div className="relative z-10 w-full max-w-2xl mx-auto">
        {children}
      </div>
    </div>
  );
}



