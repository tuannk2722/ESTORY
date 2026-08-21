// types/settings.ts
import { EffectCategory } from "./story";

export interface ReaderSettings {
  effects_enabled: boolean;
  effects_by_category: Record<EffectCategory, boolean>;
  intensity_multiplier: number;   // 0.0 – 1.0, nhân với intensity gốc của từng effect
  reduced_motion: boolean;        // mặc định sync với prefers-reduced-motion, user có thể override
  font_size: "sm" | "md" | "lg" | "xl";
  theme: "light" | "dark" | "sepia";
}

export type ReadingStatus = "reading" | "completed";

export interface ReadingProgress {
  story_id: string;
  chapter_id: string;
  block_id: string;         // block cuối cùng đọc tới
  status: ReadingStatus;    // mặc định "reading", đổi "completed" khi đọc hết block cuối chương cuối
  updated_at: string;       // ISO date
}
