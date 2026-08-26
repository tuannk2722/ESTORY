"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type Easing } from "framer-motion";
import { EffectConfig } from "@/types/story";
import { EFFECT_REGISTRY } from "./EffectRegistry";
import { EFFECT_METADATA } from "@/components/editor/effect-meta";
import { useReaderSettings } from "@/components/ui/ThemeProvider";
import { useMobileDetect } from "@/hooks/useMobileDetect";

export interface EffectLayerProps {
  effects?: EffectConfig[];
  isActive: boolean;
}

interface EffectTransitionProfile {
  enterDuration: number;
  exitDuration: number;
  ease: Easing;
  initialOpacity?: number;
}

/**
 * Hồ sơ chuyển động chuyển tiếp chuyên biệt cho từng loại hiệu ứng
 * - Ambient / Weather / Khí quyển: Fade-in êm dịu (~0.8s), tan biến dần tự nhiên (~0.8s - 1.0s)
 * - Sudden Impact / Chấn động: Attack tức thì (~0.05s) giữ trọn kịch tính, Decay suy giảm êm (~0.35s - 0.45s)
 * - Motion / Gió lốc: Thốc nhanh (~0.25s), tan theo quán tính (~0.6s)
 */
const EFFECT_TRANSITION_PROFILES: Record<string, EffectTransitionProfile> = {
  // 1. Ambient, Weather & Atmosphere Particles (Xuất hiện êm dịu, tan biến tự nhiên)
  particle_rain: { enterDuration: 0.8, exitDuration: 0.8, ease: "easeInOut" },
  particle_snow: { enterDuration: 1.0, exitDuration: 1.0, ease: "easeInOut" },
  particle_smoke: { enterDuration: 0.9, exitDuration: 0.9, ease: "easeInOut" },
  particle_fireflies: { enterDuration: 1.0, exitDuration: 1.0, ease: "easeInOut" },
  particle_gold: { enterDuration: 0.8, exitDuration: 0.8, ease: "easeInOut" },
  particle_leaves: { enterDuration: 0.9, exitDuration: 0.9, ease: "easeInOut" },
  sunbeam: { enterDuration: 1.2, exitDuration: 1.0, ease: "easeInOut" },
  candle_flicker: { enterDuration: 0.8, exitDuration: 0.8, ease: "easeInOut" },
  floating_clouds: { enterDuration: 1.2, exitDuration: 1.2, ease: "easeInOut" },
  water_ripple: { enterDuration: 0.9, exitDuration: 0.9, ease: "easeInOut" },
  glow_shimmer: { enterDuration: 0.8, exitDuration: 0.8, ease: "easeInOut" },
  bg_color_shift: { enterDuration: 0.9, exitDuration: 0.8, ease: "easeInOut" },
  text_fade_flashback: { enterDuration: 0.9, exitDuration: 0.8, ease: "easeInOut" },
  screen_blur: { enterDuration: 0.6, exitDuration: 0.7, ease: "easeInOut" },

  // 2. Sudden Impact & Dramatic Shock (Attack bộc phát tức thì, Decay tắt êm)
  lightning_flash: { enterDuration: 0.05, exitDuration: 0.4, ease: "easeOut", initialOpacity: 1 },
  screen_shake: { enterDuration: 0.05, exitDuration: 0.35, ease: "easeOut", initialOpacity: 1 },
  text_shake: { enterDuration: 0.05, exitDuration: 0.3, ease: "easeOut", initialOpacity: 1 },
  vibration: { enterDuration: 0.05, exitDuration: 0.2, ease: "easeOut", initialOpacity: 1 },

  // 3. Motion & Dynamic Air
  wind_gust: { enterDuration: 0.25, exitDuration: 0.6, ease: "easeOut" },
  particle_fire: { enterDuration: 0.4, exitDuration: 0.7, ease: "easeOut" },

  // 4. Typographic & Transition
  text_grow: { enterDuration: 0.3, exitDuration: 0.4, ease: "easeInOut" },
  typewriter: { enterDuration: 0.2, exitDuration: 0.4, ease: "easeOut" },
  transition_fade: { enterDuration: 0.8, exitDuration: 0.8, ease: "easeInOut" },
  transition_page_tear: { enterDuration: 0.1, exitDuration: 0.5, ease: "easeOut" },
};

/**
 * Wrapper component nhận EffectConfig[] và render đúng effect component tương ứng
 * Sử dụng createPortal để đưa các viewport effects ra document.body phủ trọn 100vw x 100vh
 */
export default function EffectLayer({ effects = [], isActive }: EffectLayerProps) {
  const { settings } = useReaderSettings();
  const isMobile = useMobileDetect();
  const [delayedActiveEffects, setDelayedActiveEffects] = useState<Record<string, boolean>>({});
  const [isMounted, setIsMounted] = useState(false);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Tính intensity multiplier tổng hợp (Settings Multiplier * Mobile scaling)
  const mobileScale = isMobile ? 0.5 : 1.0;
  const totalIntensityMultiplier = (settings.intensity_multiplier ?? 1.0) * mobileScale;
  const prevIsActiveRef = useRef(false);
  const effectsKey = effects
    .map(
      (e) =>
        `${e.id}-${e.type}-${e.loop}-${e.duration_ms}-${e.delay_ms}-${e.audio_src || ""}`
    )
    .join("|");
  const prevEffectsKeyRef = useRef("");

  useEffect(() => {
    // Block rời viewport → reset trạng thái trigger để chuẩn bị cho lần cuộn tới tiếp theo
    if (!isActive) {
      prevIsActiveRef.current = false;
      prevEffectsKeyRef.current = "";
      setDelayedActiveEffects({});
      return;
    }

    // Không trigger nếu effects bị tắt toàn cục
    if (!settings.effects_enabled) {
      setDelayedActiveEffects({});
      return;
    }

    // Nếu block vẫn đang active và cấu hình effects không đổi → giữ nguyên trạng thái, không hủy timer
    if (prevIsActiveRef.current && prevEffectsKeyRef.current === effectsKey) {
      return;
    }

    prevIsActiveRef.current = true;
    prevEffectsKeyRef.current = effectsKey;

    const timers: NodeJS.Timeout[] = [];
    const activeMap: Record<string, boolean> = {};

    effects.forEach((eff) => {
      // Kiểm tra category có được bật trong cài đặt không
      const isCatEnabled = settings.effects_by_category?.[eff.category] !== false;
      if (!isCatEnabled) return;

      const delay = eff.delay_ms && eff.delay_ms > 0 ? eff.delay_ms : 0;
      const isLoop = eff.loop === true;
      const meta = EFFECT_METADATA[eff.type];
      const duration =
        eff.duration_ms && eff.duration_ms > 0
          ? eff.duration_ms
          : meta?.defaultDurationMs || 3000;

      if (delay > 0) {
        const timer = setTimeout(() => {
          setDelayedActiveEffects((prev) => ({ ...prev, [eff.id]: true }));
        }, delay);
        timers.push(timer);
      } else {
        activeMap[eff.id] = true;
      }

      // Nếu loop === false, tự động ngắt hiệu ứng sau khi hết thời lượng duration
      if (!isLoop) {
        const stopTimer = setTimeout(() => {
          setDelayedActiveEffects((prev) => ({ ...prev, [eff.id]: false }));
        }, delay + duration);
        timers.push(stopTimer);
      }
    });

    setDelayedActiveEffects(activeMap);

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [isActive, effectsKey, settings.effects_enabled, settings.effects_by_category, effects]);

  if (!settings.effects_enabled || effects.length === 0) {
    return null;
  }

  const isReducedMotion = !!settings.reduced_motion;

  const effectElements = (
    <div className="effect-layer pointer-events-none">
      <AnimatePresence mode="sync">
        {effects.map((eff) => {
          const isEffectActive = isActive && !!delayedActiveEffects[eff.id];
          const isCatEnabled = settings.effects_by_category?.[eff.category] !== false;
          if (!isCatEnabled || !isEffectActive) return null;

          // Registry ánh xạ cả audio, visual, motion và transition.
          const Component = EFFECT_REGISTRY[eff.type];
          if (!Component) return null;

          const profile = EFFECT_TRANSITION_PROFILES[eff.type] || {
            enterDuration: 0.6,
            exitDuration: 0.6,
            ease: "easeInOut",
          };

          const enterDuration = isReducedMotion ? 0.1 : profile.enterDuration;
          const exitDuration = isReducedMotion ? 0.1 : profile.exitDuration;

          return (
            <motion.div
              key={eff.id}
              initial={{ opacity: profile.initialOpacity ?? 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: isEffectActive ? enterDuration : exitDuration,
                ease: profile.ease,
              }}
              className="effect-item-container pointer-events-none"
            >
              <Component
                config={eff}
                isActive={true}
                intensityMultiplier={totalIntensityMultiplier}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );

  if (isMounted && typeof document !== "undefined") {
    const portalTarget = document.getElementById("effect-portal-root") || document.body;
    if (portalTarget) {
      return createPortal(effectElements, portalTarget);
    }
  }

  return effectElements;
}

