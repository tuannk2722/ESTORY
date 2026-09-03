// src/lib/effects/effectFactory.ts
// Factory functions for creating, initializing, and cloning EffectConfig objects

import { EffectConfig, EffectType } from "@/types/story";
import { EFFECT_METADATA } from "./effectCatalog";
import { createEffectId } from "@/lib/editor/ids";

/**
 * Khởi tạo EffectConfig hoàn chỉnh với giá trị mặc định chuẩn từ effectCatalog
 */
export function createEffectConfig(
  type: EffectType,
  overrides?: Partial<EffectConfig>
): EffectConfig {
  const meta = EFFECT_METADATA[type];
  const id = overrides?.id || createEffectId(type);

  return {
    intensity: overrides?.intensity ?? meta?.defaultIntensity ?? 0.75,
    duration_ms: overrides?.duration_ms ?? meta?.defaultDurationMs ?? 2000,
    delay_ms: overrides?.delay_ms ?? meta?.defaultDelayMs ?? 0,
    loop: overrides?.loop ?? (type === "audio" ? true : false),
    audio_src: overrides?.audio_src,
    audio_asset_id: overrides?.audio_asset_id,
    ...overrides,
    // Type và category là cặp bất biến do catalog quản lý. Đặt sau
    // overrides để caller không thể vô tình tạo cấu hình mâu thuẫn.
    id,
    type,
    category: meta?.category ?? "visual",
  };
}

/**
 * Khởi tạo Audio EffectConfig chuyên biệt cho nhạc nền hoặc hiệu ứng âm thanh
 */
export function createAudioEffect(
  audioSrc: string,
  volume: number = 0.5,
  loop: boolean = true,
  overrides?: Partial<EffectConfig>
): EffectConfig {
  return createEffectConfig("audio", {
    category: "audio",
    audio_src: audioSrc,
    intensity: volume,
    loop,
    duration_ms: 0,
    delay_ms: 0,
    ...overrides,
  });
}

/**
 * Tạo bản sao độc lập (clone) của một EffectConfig với ID mới (hoặc giữ ID cũ nếu chỉ định)
 */
export function cloneEffectConfig(
  effect: EffectConfig,
  generateNewId: boolean = false
): EffectConfig {
  return {
    ...effect,
    id: generateNewId ? createEffectId(effect.type) : effect.id,
  };
}
