// components/effects/EffectRegistry.ts
// Quy tắc bắt buộc: Mỗi EffectType = 1 component riêng trong /components/effects/visual|audio
// Không nhét nhiều effect logic vào 1 file lớn (docs/03-file-structure.md & docs/08-effects-and-scenes.md mục 8.2)

import { ComponentType } from "react";
import { EffectType, EffectConfig } from "@/types/story";

export interface EffectComponentProps {
  config: EffectConfig;
  isActive: boolean;
  intensityMultiplier?: number;
}

// TODO: Phase 1 & 2 - Map từng EffectType tới component cụ thể
// export const EFFECT_REGISTRY: Record<EffectType, ComponentType<EffectComponentProps> | null> = {
//   bg_color_shift: BgColorShift,
//   particle_rain: ParticleRain,
//   particle_snow: null, // stub
//   particle_fire: null, // stub
//   particle_smoke: null, // stub
//   particle_fireflies: null, // stub
//   screen_shake: ScreenShake,
//   screen_blur: null, // stub
//   text_shake: TextShake,
//   text_grow: null, // stub
//   text_fade_flashback: null, // stub
//   typewriter: null, // stub
//   lightning_flash: LightningFlash,
//   vibration: null, // stub
//   transition_fade: null, // stub
//   transition_page_tear: null, // stub
// };

export const EFFECT_REGISTRY: Partial<Record<EffectType, ComponentType<EffectComponentProps>>> = {};
