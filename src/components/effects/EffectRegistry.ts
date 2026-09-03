// components/effects/EffectRegistry.ts
// Quy tắc bắt buộc: Mỗi EffectType = 1 component riêng trong /components/effects/visual|audio
// Không nhét nhiều effect logic vào 1 file lớn (docs/03-file-structure.md & docs/08-effects-and-scenes.md mục 8.2)

import { ComponentType } from "react";
import { EffectType, EffectConfig } from "@/types/story";
import LightningFlash from "./visual/LightningFlash";
import ParticleRain from "./visual/ParticleRain";
import BgColorShift from "./visual/BgColorShift";
import ScreenShake from "./visual/ScreenShake";
import TextShake from "./visual/TextShake";
import TransitionFade from "./visual/TransitionFade";
import AudioEffectPlayer from "./audio/AudioEffectPlayer";
import TextGrow from "./visual/TextGrow";
import ScreenBlur from "./visual/ScreenBlur";
import ParticleGold from "./visual/ParticleGold";
import ParticleLeaves from "./visual/ParticleLeaves";
import WindGust from "./visual/WindGust";
import GlowShimmer from "./visual/GlowShimmer";
import ParticleSnow from "./visual/ParticleSnow";
import ParticleSmoke from "./visual/ParticleSmoke";
import ParticleFireflies from "./visual/ParticleFireflies";
import ParticleFire from "./visual/ParticleFire";
import Sunbeam from "./visual/Sunbeam";
import CandleFlicker from "./visual/CandleFlicker";
import FloatingClouds from "./visual/FloatingClouds";
import WaterRipple from "./visual/WaterRipple";
import TextFadeFlashback from "./visual/TextFadeFlashback";
import Typewriter from "./visual/Typewriter";
import HapticVibration from "./visual/HapticVibration";
import TransitionPageTear from "./visual/TransitionPageTear";

export interface EffectComponentProps {
  config: EffectConfig;
  isActive: boolean;
  intensityMultiplier?: number;
  /** Effective playback mode supplied by the Reader/preview boundary. */
  reducedMotion?: boolean;
}

export const EFFECT_REGISTRY: Record<EffectType, ComponentType<EffectComponentProps> | null> = {
  lightning_flash: LightningFlash,
  particle_rain: ParticleRain,
  bg_color_shift: BgColorShift,
  screen_shake: ScreenShake,
  text_shake: TextShake,
  particle_snow: ParticleSnow,
  particle_fire: ParticleFire,
  particle_smoke: ParticleSmoke,
  particle_fireflies: ParticleFireflies,
  particle_gold: ParticleGold,
  particle_leaves: ParticleLeaves,
  wind_gust: WindGust,
  glow_shimmer: GlowShimmer,
  sunbeam: Sunbeam,
  candle_flicker: CandleFlicker,
  floating_clouds: FloatingClouds,
  water_ripple: WaterRipple,
  screen_blur: ScreenBlur,
  text_grow: TextGrow,
  text_fade_flashback: TextFadeFlashback,
  typewriter: Typewriter,
  vibration: HapticVibration,
  transition_fade: TransitionFade,
  transition_page_tear: TransitionPageTear,
  audio: AudioEffectPlayer,
};
