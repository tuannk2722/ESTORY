"use client";

import React, { useEffect, useState, useRef } from "react";
import { EffectConfig } from "@/types/story";
import { EFFECT_REGISTRY, AudioEffectPlayer } from "./EffectRegistry";
import { useReaderSettings } from "@/components/ui/ThemeProvider";
import { useMobileDetect } from "@/hooks/useMobileDetect";

export interface EffectLayerProps {
  effects?: EffectConfig[];
  isActive: boolean;
}

/**
 * Wrapper component nhận EffectConfig[] và render đúng effect component tương ứng
 */
export default function EffectLayer({ effects = [], isActive }: EffectLayerProps) {
  const { settings } = useReaderSettings();
  const isMobile = useMobileDetect();
  const [delayedActiveEffects, setDelayedActiveEffects] = useState<Record<string, boolean>>({});
  // Ref theo dõi lần vào viewport (reset khi block rời đi, trigger lại khi block vào lại)
  const hasTriggeredRef = useRef(false);

  // Tính intensity multiplier tổng hợp (Settings Multiplier * Mobile scaling)
  const mobileScale = isMobile ? 0.5 : 1.0;
  const totalIntensityMultiplier = (settings.intensity_multiplier ?? 1.0) * mobileScale;

  useEffect(() => {
    // Block rời viewport → reset trạng thái trigger để chuẩn bị cho lần cuộn tới tiếp theo
    if (!isActive) {
      hasTriggeredRef.current = false;
      setDelayedActiveEffects({});
      return;
    }

    // Không trigger nếu effects bị tắt toàn cục
    if (!settings.effects_enabled) {
      setDelayedActiveEffects({});
      return;
    }

    // Đã trigger trong lần vào này rồi → bỏ qua (trừ loop effect được quản lý riêng)
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;

    const timers: NodeJS.Timeout[] = [];
    const activeMap: Record<string, boolean> = {};

    effects.forEach((eff) => {
      // Kiểm tra category có được bật trong cài đặt không
      const isCatEnabled = settings.effects_by_category?.[eff.category] !== false;
      if (!isCatEnabled) return;

      if (eff.delay_ms && eff.delay_ms > 0) {
        const timer = setTimeout(() => {
          setDelayedActiveEffects((prev) => ({ ...prev, [eff.id]: true }));
        }, eff.delay_ms);
        timers.push(timer);
      } else {
        activeMap[eff.id] = true;
      }
    });

    setDelayedActiveEffects(activeMap);

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [isActive, effects, settings.effects_enabled, settings.effects_by_category]);

  if (!isActive || !settings.effects_enabled || effects.length === 0) {
    return null;
  }

  return (
    <div className="effect-layer pointer-events-none">
      {effects.map((eff) => {
        const isEffectActive = !!delayedActiveEffects[eff.id];
        const isCatEnabled = settings.effects_by_category?.[eff.category] !== false;
        if (!isCatEnabled) return null;

        // Xử lý riêng cho Audio
        if (eff.category === "audio") {
          return (
            <AudioEffectPlayer
              key={eff.id}
              config={eff}
              isActive={isEffectActive}
              intensityMultiplier={totalIntensityMultiplier}
            />
          );
        }

        // Xử lý cho Visual / Motion / Transition qua Registry
        const Component = EFFECT_REGISTRY[eff.type];
        if (!Component) return null;

        return (
          <Component
            key={eff.id}
            config={eff}
            isActive={isEffectActive}
            intensityMultiplier={totalIntensityMultiplier}
          />
        );
      })}
    </div>
  );
}
