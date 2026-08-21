// components/effects/EffectRegistry.ts
// Quy tắc bắt buộc: Mỗi EffectType = 1 component riêng trong /components/effects/visual|audio
// Không nhét nhiều effect logic vào 1 file lớn (docs/03-file-structure.md & docs/08-effects-and-scenes.md mục 8.2)

import { ComponentType } from "react";
import { EffectType, EffectConfig } from "@/types/story";
import LightningFlash from "./visual/LightningFlash";
import ParticleRain from "./visual/ParticleRain"; // CSS fallback — giữ lại để tham khảo
import ParticleRainTsParticles from "./visual/ParticleRainTsParticles"; // tsParticles implementation
import BgColorShift from "./visual/BgColorShift";
import ScreenShake from "./visual/ScreenShake";
import TextShake from "./visual/TextShake";
import TransitionFade from "./visual/TransitionFade";
import AudioEffectPlayer from "./audio/AudioEffectPlayer";

export interface EffectComponentProps {
  config: EffectConfig;
  isActive: boolean;
  intensityMultiplier?: number;
}

export const EFFECT_REGISTRY: Record<EffectType, ComponentType<EffectComponentProps> | null> = {
  lightning_flash: LightningFlash,
  particle_rain: ParticleRain, // CSS fallback — giữ lại để tham khảo
  // particle_rain: ParticleRainTsParticles, // Dùng bản tsParticles — swap về ParticleRain nếu cần CSS fallback
  bg_color_shift: BgColorShift,
  screen_shake: ScreenShake,
  text_shake: TextShake,
  particle_snow: null,
  particle_fire: null,
  particle_smoke: null,
  particle_fireflies: null,
  screen_blur: null,
  text_grow: null,
  text_fade_flashback: null,
  typewriter: null,
  vibration: null,
  transition_fade: TransitionFade,
  transition_page_tear: null,
};

export { AudioEffectPlayer };
