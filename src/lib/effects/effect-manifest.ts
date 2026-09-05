import type { EffectCategory, EffectType } from '@/types/story';
import { deepFreeze } from '@/lib/immutable';

export type EffectScope = 'block' | 'scene';
export interface EffectTechnicalDefinition {
  id: EffectType;
  category: EffectCategory;
  icon_key: string;
  allowed_scopes: EffectScope[];
  defaults: { intensity: number; duration_ms: number; delay_ms: number; loop: boolean };
  constraints: typeof EFFECT_CONFIG_CONSTRAINTS;
}

// Shared technical constraints; labels and activation belong to the overlay.
export const EFFECT_CONFIG_CONSTRAINTS = deepFreeze({
  intensity: { min: 0, max: 1 },
  duration_ms: { min: 0 },
  delay_ms: { min: 0 },
});

function define(id: EffectType, category: EffectCategory, icon_key: string, intensity: number, duration_ms: number, scene: boolean, delay_ms = 0): EffectTechnicalDefinition {
  return {
    id,
    category,
    icon_key,
    allowed_scopes: scene ? ['block', 'scene'] : ['block'],
    defaults: { intensity, duration_ms, delay_ms, loop: id === 'audio' },
    constraints: EFFECT_CONFIG_CONSTRAINTS,
  };
}

export const EFFECT_MANIFEST = deepFreeze({
  sunbeam: define('sunbeam', 'visual', 'Sun', 0.75, 4000, true),
  candle_flicker: define('candle_flicker', 'visual', 'Flame', 0.8, 3500, true),
  floating_clouds: define('floating_clouds', 'visual', 'Cloud', 0.7, 5000, true),
  water_ripple: define('water_ripple', 'visual', 'Waves', 0.75, 3500, true),
  lightning_flash: define('lightning_flash', 'visual', 'Zap', 0.85, 1200, false),
  particle_rain: define('particle_rain', 'visual', 'CloudRain', 0.75, 2000, true),
  particle_snow: define('particle_snow', 'visual', 'Snowflake', 0.7, 3000, true),
  particle_fire: define('particle_fire', 'visual', 'Flame', 0.8, 3000, true),
  particle_smoke: define('particle_smoke', 'visual', 'CloudFog', 0.7, 3000, true),
  particle_fireflies: define('particle_fireflies', 'visual', 'Sparkles', 0.75, 3000, true),
  particle_gold: define('particle_gold', 'visual', 'Coins', 0.8, 3000, true),
  particle_leaves: define('particle_leaves', 'visual', 'Leaf', 0.7, 3500, true),
  wind_gust: define('wind_gust', 'motion', 'Wind', 0.8, 1500, true),
  glow_shimmer: define('glow_shimmer', 'visual', 'Gem', 0.75, 3000, true),
  bg_color_shift: define('bg_color_shift', 'visual', 'Palette', 0.6, 2500, true),
  screen_blur: define('screen_blur', 'visual', 'EyeOff', 0.5, 1500, false),
  text_shake: define('text_shake', 'visual', 'Activity', 0.65, 1000, false),
  text_grow: define('text_grow', 'visual', 'Maximize2', 0.8, 1800, false),
  text_fade_flashback: define('text_fade_flashback', 'visual', 'History', 0.6, 2500, false),
  typewriter: define('typewriter', 'visual', 'Keyboard', 0.8, 3000, false),
  screen_shake: define('screen_shake', 'motion', 'Activity', 0.85, 800, false, 150),
  vibration: define('vibration', 'motion', 'Vibrate', 0.6, 400, false),
  transition_fade: define('transition_fade', 'transition', 'Layers', 0.75, 1200, false),
  transition_page_tear: define('transition_page_tear', 'transition', 'FileMinus2', 0.75, 1500, false),
  audio: define('audio', 'audio', 'Volume2', 0.75, 0, true),
} satisfies Record<EffectType, EffectTechnicalDefinition>);

export const EFFECT_TYPES = Object.freeze(Object.keys(EFFECT_MANIFEST) as EffectType[]);
export function isEffectAllowedInScope(type: EffectType, scope: EffectScope): boolean {
  return Object.hasOwn(EFFECT_MANIFEST, type) && EFFECT_MANIFEST[type].allowed_scopes.includes(scope);
}
