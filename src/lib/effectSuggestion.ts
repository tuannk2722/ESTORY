// lib/effectSuggestion.ts
// Phase 2: Gợi ý effect theo từ khóa trong text

import { EffectType } from "@/types/story";

export interface EffectSuggestion {
  keyword: string;
  effect_type: EffectType;
  confidence: number;
}

/**
 * Gợi ý hiệu ứng dựa trên nội dung văn bản (dùng ở Phase 2 Author Editor)
 */
export function suggestEffectsForText(_text: string): EffectSuggestion[] {
  // TODO: Phase 2 triển khai dictionary từ khóa hoặc kết nối bảng gợi ý
  return [];
}
