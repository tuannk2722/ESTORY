// types/story.ts

export type EffectType =
  | "bg_color_shift"      // đổi tông màu nền
  | "particle_rain"
  | "particle_snow"
  | "particle_fire"
  | "particle_smoke"
  | "particle_fireflies"
  | "particle_gold"       // mưa bụi vàng / châu báu lấp lánh
  | "particle_leaves"     // lá khế / hoa khế bay lượn
  | "wind_gust"           // luồng gió cuốn cát bụi khi chim thần hạ cánh / cất cánh
  | "glow_shimmer"        // hào quang ngũ sắc ngọc quý rực rỡ
  | "sunbeam"             // vệt nắng xiên qua tán lá, ánh sáng hoàng hôn
  | "candle_flicker"      // ánh nến bập bùng, quầng lửa ấm áp
  | "floating_clouds"     // dải mây trôi bồng bềnh qua cảnh vật
  | "water_ripple"        // ánh trăng / mặt nước gợn sóng lấp lánh
  | "screen_shake"
  | "screen_blur"
  | "text_shake"
  | "text_grow"
  | "text_fade_flashback"
  | "typewriter"
  | "lightning_flash"
  | "vibration"            // Vibration API, chỉ hoạt động trên mobile hỗ trợ
  | "transition_fade"
  | "transition_page_tear"
  | "audio";

export type EffectCategory = "visual" | "audio" | "motion" | "transition";

export interface EffectConfig {
  id: string;              // unique trong phạm vi block, dùng cho preview/edit
  type: EffectType;
  category: EffectCategory;
  intensity: number;       // 0.0 – 1.0
  duration_ms: number;     // thời lượng chạy (ms), dùng khi loop === false
  delay_ms?: number;       // độ trễ trước khi kích hoạt (dùng cho chuỗi hiệu ứng nối tiếp)
  audio_src?: string;      // bắt buộc nếu category === "audio"
  loop?: boolean;          // lặp lại liên tục (cho cả Audio BGM lẫn Visual/Motion particles/không gian)
}

export interface StoryBlock {
  id: string;               // unique trong toàn chương, dạng "ch1-block-003"
  type: "paragraph" | "dialogue" | "heading";
  text: string;
  mood_tag?: string;        // VD: "kinh dị", "lãng mạn" — dùng cho gợi ý hiệu ứng khi soạn thảo
  effects: EffectConfig[];  // có thể rỗng
}

export interface Chapter {
  id: string;                // "ch1"
  title: string;
  order: number;
  blocks: StoryBlock[];
}

export type StoryStatus = "draft" | "pending_review" | "published" | "rejected" | "archived";

export interface Story {
  id: string;                 // slug, dùng làm route param
  title: string;
  author: string;             // Phase 1–2: tên chuỗi tự do. Phase 3: đổi thành authorId (xem mục 2.7 / 11)
  description: string;
  cover_image?: string;
  genre: string[];
  status: StoryStatus;         // Phase 1–2: luôn để "published" (chưa có kiểm duyệt). Phase 3: có hiệu lực đầy đủ, xem mục 2.7
  view_count: number;          // Phase 1–2: có thể để cố định 0, chưa cần tracking thật
  chapters: Chapter[];
}
