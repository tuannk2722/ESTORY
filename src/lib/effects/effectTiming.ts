// src/lib/effects/effectTiming.ts
// Shared timing resolution and lifecycle calculation for Block effects and Scene ambient effects

import { EffectConfig } from "@/types/story";
import { EFFECT_METADATA } from "./effectCatalog";

export interface ResolvedEffectTiming {
  delayMs: number;
  durationMs: number;
  isLoop: boolean;
  totalActiveTimeMs: number; // delay + duration (hoặc Infinity nếu loop)
}

/**
 * Tính toán timing và vòng đời chính xác cho Effect theo context (Block vs Scene)
 */
export function resolveEffectTiming(
  effect: EffectConfig,
  context: "block" | "scene" = "block"
): ResolvedEffectTiming {
  const meta = EFFECT_METADATA[effect.type];
  const delayMs = effect.delay_ms && effect.delay_ms > 0 ? effect.delay_ms : 0;

  // Quyết định isLoop:
  // Nếu effect.loop đã có giá trị rõ ràng -> dùng nó
  // Nếu không: Block effect mặc định loop = false, Scene ambient effect mặc định loop = true
  const isLoop =
    effect.loop !== undefined
      ? effect.loop
      : context === "scene"
        ? true
        : false;

  const defaultDuration =
    context === "scene" ? meta?.defaultDurationMs || 3500 : meta?.defaultDurationMs || 2000;

  const durationMs =
    effect.duration_ms && effect.duration_ms > 0 ? effect.duration_ms : defaultDuration;

  const totalActiveTimeMs = isLoop ? Infinity : delayMs + durationMs;

  return {
    delayMs,
    durationMs,
    isLoop,
    totalActiveTimeMs,
  };
}
