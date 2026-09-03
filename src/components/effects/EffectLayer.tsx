"use client";

import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type Easing } from "framer-motion";
import { useReaderSettings } from "@/components/ui/ThemeProvider";
import { useMobileDetect } from "@/hooks/useMobileDetect";
import { EFFECT_METADATA } from "@/lib/effects/effectCatalog";
import { isEffectAllowedWithReducedMotion } from "@/lib/effects/effectPlayback";
import type { EffectConfig } from "@/types/story";
import { EFFECT_REGISTRY } from "./EffectRegistry";

export interface EffectLayerProps {
  effects?: EffectConfig[];
  isActive: boolean;
  reducedMotion?: boolean;
}

interface EffectTransitionProfile {
  enterDuration: number;
  exitDuration: number;
  ease: Easing;
  initialOpacity?: number;
}

const EFFECT_TRANSITION_PROFILES: Record<string, EffectTransitionProfile> = {
  particle_rain: { enterDuration: 0.8, exitDuration: 0.8, ease: "easeInOut" },
  particle_snow: { enterDuration: 1, exitDuration: 1, ease: "easeInOut" },
  particle_smoke: { enterDuration: 0.9, exitDuration: 0.9, ease: "easeInOut" },
  particle_fireflies: { enterDuration: 1, exitDuration: 1, ease: "easeInOut" },
  particle_gold: { enterDuration: 0.8, exitDuration: 0.8, ease: "easeInOut" },
  particle_leaves: { enterDuration: 0.9, exitDuration: 0.9, ease: "easeInOut" },
  sunbeam: { enterDuration: 1.2, exitDuration: 1, ease: "easeInOut" },
  candle_flicker: { enterDuration: 0.8, exitDuration: 0.8, ease: "easeInOut" },
  floating_clouds: { enterDuration: 1.2, exitDuration: 1.2, ease: "easeInOut" },
  water_ripple: { enterDuration: 0.9, exitDuration: 0.9, ease: "easeInOut" },
  glow_shimmer: { enterDuration: 0.8, exitDuration: 0.8, ease: "easeInOut" },
  bg_color_shift: { enterDuration: 0.9, exitDuration: 0.8, ease: "easeInOut" },
  text_fade_flashback: { enterDuration: 0.9, exitDuration: 0.8, ease: "easeInOut" },
  screen_blur: { enterDuration: 0.6, exitDuration: 0.7, ease: "easeInOut" },
  lightning_flash: { enterDuration: 0.05, exitDuration: 0.4, ease: "easeOut", initialOpacity: 1 },
  screen_shake: { enterDuration: 0.05, exitDuration: 0.35, ease: "easeOut", initialOpacity: 1 },
  text_shake: { enterDuration: 0.05, exitDuration: 0.3, ease: "easeOut", initialOpacity: 1 },
  vibration: { enterDuration: 0.05, exitDuration: 0.2, ease: "easeOut", initialOpacity: 1 },
  wind_gust: { enterDuration: 0.25, exitDuration: 0.6, ease: "easeOut" },
  particle_fire: { enterDuration: 0.4, exitDuration: 0.7, ease: "easeOut" },
  text_grow: { enterDuration: 0.3, exitDuration: 0.4, ease: "easeInOut" },
  typewriter: { enterDuration: 0.2, exitDuration: 0.4, ease: "easeOut" },
  transition_fade: { enterDuration: 0.8, exitDuration: 0.8, ease: "easeInOut" },
  transition_page_tear: { enterDuration: 0.1, exitDuration: 0.5, ease: "easeOut" },
};

const DEFAULT_TRANSITION: EffectTransitionProfile = {
  enterDuration: 0.6,
  exitDuration: 0.6,
  ease: "easeInOut",
};

const subscribeToHydration = () => () => undefined;

/**
 * Owns delay/duration for every block effect. Individual effects only respond
 * to `isActive`, avoiding duplicate timers and inconsistent durations.
 */
export default function EffectLayer({
  effects = [],
  isActive,
  reducedMotion,
}: EffectLayerProps) {
  const { settings } = useReaderSettings();
  const isMobile = useMobileDetect();
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );
  const isReducedMotion = reducedMotion ?? Boolean(settings.reduced_motion);

  const enabledEffects = useMemo(
    () =>
      effects.filter(
        (effect) =>
          settings.effects_by_category?.[effect.category] !== false &&
          (!isReducedMotion || isEffectAllowedWithReducedMotion(effect))
      ),
    [effects, isReducedMotion, settings.effects_by_category]
  );

  const effectsKey = useMemo(
    () =>
      enabledEffects
        .map(
          (effect) =>
            `${effect.id}-${effect.type}-${effect.loop}-${effect.duration_ms}-${effect.delay_ms}-${effect.audio_src ?? ""}`
        )
        .join("|"),
    [enabledEffects]
  );

  const [activeEffects, setActiveEffects] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // State reset is queued so this effect only coordinates external timers.
    timers.push(setTimeout(() => setActiveEffects({}), 0));
    if (!isActive || !settings.effects_enabled) {
      return () => timers.forEach(clearTimeout);
    }

    enabledEffects.forEach((effect) => {
      const delay = Math.max(0, effect.delay_ms ?? 0);
      const duration =
        effect.duration_ms && effect.duration_ms > 0
          ? effect.duration_ms
          : EFFECT_METADATA[effect.type]?.defaultDurationMs || 3000;

      timers.push(
        setTimeout(() => {
          setActiveEffects((current) => ({ ...current, [effect.id]: true }));
        }, delay)
      );

      if (effect.loop !== true) {
        timers.push(
          setTimeout(() => {
            setActiveEffects((current) => ({ ...current, [effect.id]: false }));
          }, delay + duration)
        );
      }
    });

    return () => timers.forEach(clearTimeout);
  }, [effectsKey, enabledEffects, isActive, settings.effects_enabled]);

  if (!settings.effects_enabled || enabledEffects.length === 0) return null;

  const intensityMultiplier =
    (settings.intensity_multiplier ?? 1) * (isMobile ? 0.5 : 1);

  const effectElements = (
    <div className="effect-layer pointer-events-none relative z-[5]">
      <AnimatePresence mode="sync">
        {enabledEffects.map((effect) => {
          if (!isActive || !activeEffects[effect.id]) return null;

          const Component = EFFECT_REGISTRY[effect.type];
          if (!Component) return null;

          const profile = EFFECT_TRANSITION_PROFILES[effect.type] ?? DEFAULT_TRANSITION;
          const enterDuration = isReducedMotion ? 0 : profile.enterDuration;
          const exitDuration = isReducedMotion ? 0 : profile.exitDuration;

          return (
            <motion.div
              key={effect.id}
              initial={{ opacity: profile.initialOpacity ?? 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: activeEffects[effect.id]
                  ? enterDuration
                  : exitDuration,
                ease: profile.ease,
              }}
              className="effect-item-container pointer-events-none"
            >
              <Component
                config={effect}
                isActive
                intensityMultiplier={intensityMultiplier}
                reducedMotion={isReducedMotion}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );

  if (isHydrated && typeof document !== "undefined") {
    return createPortal(
      effectElements,
      document.getElementById("effect-portal-root") ?? document.body
    );
  }

  return effectElements;
}
