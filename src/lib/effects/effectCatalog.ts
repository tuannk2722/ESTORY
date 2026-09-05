// Compatibility projection for Phase 2 consumers; technical values come only from the manifest.
import type { EffectType, EffectCategory } from '@/types/story';
import type { LucideIcon } from 'lucide-react';
import { EFFECT_MANIFEST, EFFECT_TYPES, isEffectAllowedInScope } from './effect-manifest';
import { EFFECT_PRESENTATION_SEED } from './effect-seed';
import { EFFECT_ICONS } from './effect-icons';

export interface EffectMeta {
  type: EffectType;
  category: EffectCategory;
  label: string;
  description: string;
  icon: LucideIcon;
  defaultIntensity: number;
  defaultDurationMs: number;
  defaultDelayMs: number;
}

export const EFFECT_CATEGORIES: { id: EffectCategory; label: string }[] = [
  { id: "visual", label: "Hình Ảnh" },
  { id: "motion", label: "Chuyển Động" },
  { id: "audio", label: "Âm Thanh" },
  { id: "transition", label: "Chuyển Cảnh" },
];

export const EFFECT_METADATA = Object.fromEntries(EFFECT_TYPES.map(type => {
  const definition = EFFECT_MANIFEST[type];
  return [type, {
    type, category: definition.category, ...EFFECT_PRESENTATION_SEED[type],
    icon: EFFECT_ICONS[definition.icon_key],
    defaultIntensity: definition.defaults.intensity,
    defaultDurationMs: definition.defaults.duration_ms,
    defaultDelayMs: definition.defaults.delay_ms,
  }];
})) as Record<EffectType, EffectMeta>;

export const AUDIO_EFFECT_PRESETS = [
  { label: "Tiếng Mưa Rơi (Gentle Rain)", src: "/audio/gentle_rain_falling.mp3" },
  { label: "Sấm Rền Vang (Thunder Rumble)", src: "/audio/thunder-rumble.mp3" },
  { label: "Không Khí U Ám (Horror Atmosphere)", src: "/audio/horror_atmosphe.mp3" },
];

// Legacy visual picker helper: audio has its own control.
export function isSceneEffectType(type: EffectType) {
  return type !== 'audio' && isEffectAllowedInScope(type, 'scene');
}

export function getEffectIcon(type: EffectType, category?: EffectCategory): LucideIcon {
  if (category === 'audio' || type === 'audio') return EFFECT_ICONS.Volume2;
  return EFFECT_METADATA[type]?.icon || EFFECT_ICONS.Zap;
}
