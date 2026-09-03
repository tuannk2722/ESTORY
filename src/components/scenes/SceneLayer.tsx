"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EFFECT_REGISTRY } from "@/components/effects/EffectRegistry";
import { useReaderSettings } from "@/components/ui/ThemeProvider";
import { useMobileDetect } from "@/hooks/useMobileDetect";
import { EFFECT_METADATA } from "@/lib/effects/effectCatalog";
import { isEffectAllowedWithReducedMotion } from "@/lib/effects/effectPlayback";
import { calculateEffectVolume } from "@/lib/reader/readerMetrics";
import type { BackgroundAsset, ColorPalette, Scene } from "@/types/scene";
import SceneAmbientAudio from "./SceneAmbientAudio";
import SceneBackground from "./SceneBackground";

export interface SceneLayerProps {
  scene?: Scene | null;
  backgroundAsset?: BackgroundAsset;
  colorPalette?: ColorPalette;
  reducedMotion?: boolean;
  isAudioPaused?: boolean;
  children?: React.ReactNode;
}

interface SceneVisualEffectsProps {
  effects: NonNullable<Scene["effects"]>;
  intensityMultiplier: number;
  reducedMotion: boolean;
}

function createImmediateEffectsMap(effects: NonNullable<Scene["effects"]>) {
  return effects.reduce<Record<string, boolean>>((map, effect, index) => {
    if (!effect.delay_ms || effect.delay_ms <= 0) {
      map[effect.id || `${effect.type}-${index}`] = true;
    }
    return map;
  }, {});
}

/**
 * The parent keys this component by the effective scene configuration. This
 * gives each scene/settings change a clean lifecycle without resetting state
 * synchronously from an effect.
 */
function SceneVisualEffects({
  effects,
  intensityMultiplier,
  reducedMotion,
}: SceneVisualEffectsProps) {
  const [activeEffectsMap, setActiveEffectsMap] = useState(() =>
    createImmediateEffectsMap(effects)
  );

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    effects.forEach((effect, index) => {
      const effectKey = effect.id || `${effect.type}-${index}`;
      const delay = Math.max(0, effect.delay_ms ?? 0);
      const duration =
        effect.duration_ms && effect.duration_ms > 0
          ? effect.duration_ms
          : EFFECT_METADATA[effect.type]?.defaultDurationMs || 3500;

      if (delay > 0) {
        timers.push(
          setTimeout(() => {
            setActiveEffectsMap((current) => ({
              ...current,
              [effectKey]: true,
            }));
          }, delay)
        );
      }

      if (effect.loop === false) {
        timers.push(
          setTimeout(() => {
            setActiveEffectsMap((current) => ({
              ...current,
              [effectKey]: false,
            }));
          }, delay + duration)
        );
      }
    });

    return () => timers.forEach(clearTimeout);
  }, [effects]);

  return (
    <AnimatePresence mode="sync">
      {effects.map((effect, index) => {
        const effectKey = effect.id || `${effect.type}-${index}`;
        if (!activeEffectsMap[effectKey]) return null;

        const Component = EFFECT_REGISTRY[effect.type];
        if (!Component) return null;

        return (
          <motion.div
            key={effectKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed inset-0 z-[5] overflow-hidden pointer-events-none"
          >
            <Component
              config={effect}
              isActive
              intensityMultiplier={intensityMultiplier}
              reducedMotion={reducedMotion}
            />
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
}

/** Renders the active scene independently from block-level effects. */
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
  const totalIntensityMultiplier =
    (settings.intensity_multiplier ?? 1) * (isMobile ? 0.5 : 1);

  const audioEffect = useMemo(
    () =>
      scene?.effects?.find(
        (effect) => effect.type === "audio" || effect.category === "audio"
      ),
    [scene?.effects]
  );

  const enabledVisualEffects = useMemo(
    () =>
      (scene?.effects ?? []).filter(
        (effect) =>
          effect.type !== "audio" &&
          effect.category !== "audio" &&
          settings.effects_by_category?.[effect.category] !== false
      ),
    [scene?.effects, settings.effects_by_category]
  );

  const playableVisualEffects = useMemo(
    () =>
      enabledVisualEffects.filter(
        (effect) =>
          !reducedMotion || isEffectAllowedWithReducedMotion(effect)
      ),
    [enabledVisualEffects, reducedMotion]
  );

  const visualEffectsKey = useMemo(
    () =>
      playableVisualEffects
        .map(
          (effect) =>
            `${effect.id}-${effect.type}-${effect.loop}-${effect.delay_ms}-${effect.duration_ms}`
        )
        .join("|"),
    [playableVisualEffects]
  );

  const paletteStyle = useMemo<React.CSSProperties>(() => {
    if (!colorPalette) return {};
    return {
      "--color-primary": colorPalette.colors.primary,
      "--color-secondary": colorPalette.colors.secondary,
      "--color-accent": colorPalette.colors.accent,
    } as React.CSSProperties;
  }, [colorPalette]);

  const crossfadeDuration = reducedMotion ? 0 : 0.8;
  const ambientVolume = calculateEffectVolume(
    audioEffect?.intensity,
    settings.intensity_multiplier,
    0.5
  );

  return (
    <div
      className="scene-layer relative w-full min-h-screen transition-colors duration-700 ease-out"
      style={paletteStyle}
    >
      <AnimatePresence mode="sync">
        {backgroundAsset && (
          <motion.div
            key={backgroundAsset.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: crossfadeDuration,
              ease: [0.4, 0, 0.2, 1],
            }}
            className="fixed inset-0 z-0 overflow-hidden pointer-events-none"
          >
            <SceneBackground
              asset={backgroundAsset}
              reducedMotion={reducedMotion}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="sync">
        {colorPalette && (
          <motion.div
            key={colorPalette.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: crossfadeDuration,
              ease: [0.4, 0, 0.2, 1],
            }}
            className="fixed inset-0 z-0 overflow-hidden pointer-events-none"
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundColor: colorPalette.colors.primary,
                mixBlendMode: "color",
                opacity: 0.45,
              }}
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(circle at 50% 35%, transparent 15%, ${colorPalette.colors.background_tint} 85%)`,
                opacity: 0.88,
              }}
              aria-hidden="true"
            />
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

      {/* Reduced motion keeps the poster/static background and removes animated effects. */}
      {settings.effects_enabled &&
        playableVisualEffects.length > 0 && (
          <SceneVisualEffects
            key={`${scene?.id ?? "scene"}:${visualEffectsKey}`}
            effects={playableVisualEffects}
            intensityMultiplier={totalIntensityMultiplier}
            reducedMotion={reducedMotion}
          />
        )}

      {audioEffect?.audio_src && (
        <SceneAmbientAudio
          audioSrc={audioEffect.audio_src}
          volume={ambientVolume}
          isActive={
            settings.effects_enabled &&
            settings.effects_by_category?.audio !== false &&
            ambientVolume > 0
          }
          isPaused={isAudioPaused}
          loop={audioEffect.loop !== false}
          durationMs={audioEffect.duration_ms}
        />
      )}

      <div className="relative z-20 w-full max-w-2xl mx-auto">
        {children}
      </div>
    </div>
  );
}
