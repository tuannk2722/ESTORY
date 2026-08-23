// components/editor/effect-meta.ts
// Metadata cho các loại hiệu ứng trong Author Editor (Phase 2 - US-2.2)

import { EffectType, EffectCategory } from "@/types/story";
import {
  Zap,
  CloudRain,
  Snowflake,
  Flame,
  CloudFog,
  Sparkles,
  Activity,
  EyeOff,
  Vibrate,
  Maximize2,
  History,
  Keyboard,
  Palette,
  Layers,
  FileMinus2,
  Volume2,
  LucideIcon,
} from "lucide-react";

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
  { id: "visual", label: "Hình Ảnh (Visual)" },
  { id: "motion", label: "Chuyển Động (Motion)" },
  { id: "audio", label: "Âm Thanh (Audio)" },
  { id: "transition", label: "Chuyển Cảnh (Transition)" },
];

export const EFFECT_METADATA: Partial<Record<EffectType, EffectMeta>> = {
  lightning_flash: {
    type: "lightning_flash",
    category: "visual",
    label: "Chớp Sáng (Lightning Flash)",
    description: "Chớp trắng chói lòa toàn màn hình khi có sấm sét, cao trào",
    icon: Zap,
    defaultIntensity: 0.85,
    defaultDurationMs: 1200,
    defaultDelayMs: 0,
  },
  particle_rain: {
    type: "particle_rain",
    category: "visual",
    label: "Mưa Rơi (Particle Rain)",
    description: "Hạt mưa rơi xối xả phủ khắp khung đọc truyện",
    icon: CloudRain,
    defaultIntensity: 0.75,
    defaultDurationMs: 5000,
    defaultDelayMs: 0,
  },
  particle_snow: {
    type: "particle_snow",
    category: "visual",
    label: "Tuyết Rơi (Particle Snow)",
    description: "Bông tuyết trắng trôi lững lờ trong không khí giá lạnh",
    icon: Snowflake,
    defaultIntensity: 0.7,
    defaultDurationMs: 5000,
    defaultDelayMs: 0,
  },
  particle_fire: {
    type: "particle_fire",
    category: "visual",
    label: "Tàn Lửa Cháy (Particle Fire)",
    description: "Đốm lửa và tàn tro bốc lên rực cháy",
    icon: Flame,
    defaultIntensity: 0.8,
    defaultDurationMs: 4000,
    defaultDelayMs: 0,
  },
  particle_smoke: {
    type: "particle_smoke",
    category: "visual",
    label: "Khói Sương (Particle Smoke)",
    description: "Làn khói mờ mịt, sương lạnh trườn qua mặt đá",
    icon: CloudFog,
    defaultIntensity: 0.7,
    defaultDurationMs: 4000,
    defaultDelayMs: 0,
  },
  particle_fireflies: {
    type: "particle_fireflies",
    category: "visual",
    label: "Lân Tinh / Đom Đóm",
    description: "Những đốm sáng lân tinh xanh lục ma mị trôi lơ lửng",
    icon: Sparkles,
    defaultIntensity: 0.75,
    defaultDurationMs: 4500,
    defaultDelayMs: 0,
  },
  bg_color_shift: {
    type: "bg_color_shift",
    category: "visual",
    label: "Đổi Tông Màu Nền",
    description: "Chuyển sắc nền nhẹ nhàng sang tông u ám hoặc hoàng hôn",
    icon: Palette,
    defaultIntensity: 0.6,
    defaultDurationMs: 2500,
    defaultDelayMs: 0,
  },
  screen_blur: {
    type: "screen_blur",
    category: "visual",
    label: "Mờ Ảo (Screen Blur)",
    description: "Màn hình mờ dần tạo cảm giác choáng váng, hoa mắt",
    icon: EyeOff,
    defaultIntensity: 0.5,
    defaultDurationMs: 1500,
    defaultDelayMs: 0,
  },
  text_shake: {
    type: "text_shake",
    category: "visual",
    label: "Rung Chữ (Text Shake)",
    description: "Đoạn văn rung lắc nhẹ thể hiện sự sợ hãi, hét lớn",
    icon: Activity,
    defaultIntensity: 0.65,
    defaultDurationMs: 1000,
    defaultDelayMs: 0,
  },
  text_grow: {
    type: "text_grow",
    category: "visual",
    label: "Phóng To Chữ (Text Grow)",
    description: "Chữ phồng to đột ngột nhấn mạnh âm thanh khủng khiếp",
    icon: Maximize2,
    defaultIntensity: 0.8,
    defaultDurationMs: 1800,
    defaultDelayMs: 0,
  },
  text_fade_flashback: {
    type: "text_fade_flashback",
    category: "visual",
    label: "Hồi Ức (Flashback)",
    description: "Hiệu ứng mờ dần màu sepia thể hiện ký ức năm xưa",
    icon: History,
    defaultIntensity: 0.6,
    defaultDurationMs: 2500,
    defaultDelayMs: 0,
  },
  typewriter: {
    type: "typewriter",
    category: "visual",
    label: "Đánh Máy (Typewriter)",
    description: "Từng ký tự hiện ra như đang gõ máy chữ hoặc chép nhật ký",
    icon: Keyboard,
    defaultIntensity: 0.8,
    defaultDurationMs: 3000,
    defaultDelayMs: 0,
  },
  screen_shake: {
    type: "screen_shake",
    category: "motion",
    label: "Rung Màn Hình (Screen Shake)",
    description: "Toàn bộ khung nhìn rung lắc mạnh khi nổ hoặc sấm giáng",
    icon: Activity,
    defaultIntensity: 0.85,
    defaultDurationMs: 800,
    defaultDelayMs: 150,
  },
  vibration: {
    type: "vibration",
    category: "motion",
    label: "Rung Thiết Bị (Haptic Vibration)",
    description: "Kích hoạt rung nhẹ trên điện thoại hỗ trợ Vibration API",
    icon: Vibrate,
    defaultIntensity: 0.6,
    defaultDurationMs: 400,
    defaultDelayMs: 0,
  },
  transition_fade: {
    type: "transition_fade",
    category: "transition",
    label: "Chuyển Cảnh Mờ (Fade)",
    description: "Chuyển cảnh mượt mà mở đầu hoặc kết thúc phân đoạn",
    icon: Layers,
    defaultIntensity: 0.75,
    defaultDurationMs: 1200,
    defaultDelayMs: 0,
  },
  transition_page_tear: {
    type: "transition_page_tear",
    category: "transition",
    label: "Xé Trang (Page Tear)",
    description: "Hiệu ứng rách giấy/xé trang chuyển sang chương mới",
    icon: FileMinus2,
    defaultIntensity: 0.75,
    defaultDurationMs: 1500,
    defaultDelayMs: 0,
  },
};

export const AUDIO_EFFECT_PRESETS = [
  { label: "Tiếng Mưa Rơi (Gentle Rain)", src: "/audio/gentle_rain_falling.mp3" },
  { label: "Sấm Rền Vang (Thunder Rumble)", src: "/audio/thunder-rumble.mp3" },
  { label: "Không Khí U Ám (Horror Atmosphere)", src: "/audio/horror_atmosphe.mp3" },
];

export function getEffectIcon(type: EffectType, category?: EffectCategory): LucideIcon {
  if (category === "audio") return Volume2;
  return EFFECT_METADATA[type]?.icon || Zap;
}
