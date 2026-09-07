// lib/effectSuggestion.ts
// Phase 2: Gợi ý effect theo từ khóa trong text (US-2.3)

import { EffectType } from "@/types/story";

export interface EffectSuggestion {
  keyword: string;
  effect_type: EffectType;
  confidence: number;
}

export interface KeywordEffectMapping {
  effect_type: EffectType;
  keywords: string[];
  baseConfidence: number;
}

export const KEYWORD_EFFECT_DICTIONARY: KeywordEffectMapping[] = [
  {
    effect_type: "lightning_flash",
    keywords: [
      "sấm",
      "chớp",
      "chói lòa",
      "chớp sáng",
      "sấm sét",
      "sáng lòa",
      "tia chớp",
      "chói lọi",
      "sấm nổ",
      "rạch ngang",
      "đoàng",
    ],
    baseConfidence: 0.95,
  },
  {
    effect_type: "particle_rain",
    keywords: [
      "mưa",
      "mưa bão",
      "lộp độp",
      "trút nước",
      "giọt mưa",
      "xối xả",
      "mưa rào",
      "ràn rạt",
      "nước mưa",
      "ướt sũng",
      "mưa tuôn",
    ],
    baseConfidence: 0.9,
  },
  {
    effect_type: "particle_snow",
    keywords: [
      "tuyết",
      "bông tuyết",
      "tuyết rơi",
      "giá rét",
      "băng giá",
      "lạnh buốt",
      "tuyết trắng",
      "bão tuyết",
    ],
    baseConfidence: 0.9,
  },
  {
    effect_type: "particle_fire",
    keywords: [
      "lửa",
      "ngọn lửa",
      "bùng cháy",
      "thiêu rụi",
      "rực sáng",
      "tàn tro",
      "đốm lửa",
      "cháy rực",
      "hỏa hoạn",
      "bốc hỏa",
    ],
    baseConfidence: 0.9,
  },
  {
    effect_type: "particle_smoke",
    keywords: [
      "khói",
      "sương mù",
      "mờ mịt",
      "bốc lên",
      "khói sương",
      "làn khói",
      "mịt mù",
      "sương lạnh",
      "khói đen",
    ],
    baseConfidence: 0.85,
  },
  {
    effect_type: "particle_fireflies",
    keywords: [
      "lân tinh",
      "đom đóm",
      "đốm sáng",
      "phù du",
      "ma quái",
      "lơ lửng",
      "xanh lục",
      "huyền ảo",
      "chập chờn",
    ],
    baseConfidence: 0.85,
  },
  {
    effect_type: "screen_shake",
    keywords: [
      "rung chuyển",
      "chấn động",
      "nổ tung",
      "rung lắc",
      "sập",
      "ầm ầm",
      "đinh tai",
      "chao đảo",
      "rung bần bật",
      "va đập",
    ],
    baseConfidence: 0.9,
  },
  {
    effect_type: "screen_blur",
    keywords: [
      "mờ ảo",
      "choáng váng",
      "mờ dần",
      "hoa mắt",
      "mất phương hướng",
      "mờ mịt",
      "nhòa đi",
      "chóng mặt",
    ],
    baseConfidence: 0.8,
  },
  {
    effect_type: "text_shake",
    keywords: [
      "run rẩy",
      "hét lớn",
      "thất thanh",
      "kinh hãi",
      "kêu la",
      "sợ hãi",
      "lắp bắp",
      "hoảng loạn",
      "gào thét",
    ],
    baseConfidence: 0.85,
  },
  {
    effect_type: "text_grow",
    keywords: [
      "khổng lồ",
      "to lớn",
      "phóng to",
      "trỗi dậy",
      "sừng sững",
      "gầm rú",
      "khủng khiếp",
      "dâng trào",
    ],
    baseConfidence: 0.8,
  },
  {
    effect_type: "text_fade_flashback",
    keywords: [
      "ngày ấy",
      "năm xưa",
      "quá khứ",
      "hồi ức",
      "nhớ lại",
      "ký ức",
      "thuở trước",
      "ngày xưa",
      "năm 1974",
    ],
    baseConfidence: 0.85,
  },
  {
    effect_type: "typewriter",
    keywords: [
      "nhật ký",
      "ghi chép",
      "bức thư",
      "dòng chữ",
      "trang sổ",
      "bản thảo",
      "đọc đến",
      "gõ phím",
    ],
    baseConfidence: 0.85,
  },
  {
    effect_type: "bg_color_shift",
    keywords: [
      "hoàng hôn",
      "u ám",
      "bóng tối",
      "đổi màu",
      "nhuộm tím",
      "màn đêm",
      "chân trời",
      "bình minh",
      "tím sẫm",
      "rực đỏ",
    ],
    baseConfidence: 0.8,
  },
  {
    effect_type: "transition_fade",
    keywords: [
      "bước sang",
      "chuyển cảnh",
      "kết thúc",
      "bắt đầu",
      "phần tiếp theo",
      "phần i",
      "phần ii",
      "phần iii",
      "phần iv",
      "phần v",
    ],
    baseConfidence: 0.75,
  },
  {
    effect_type: "transition_page_tear",
    keywords: [
      "xé rách",
      "lật trang",
      "đóng lại",
      "khép lại",
      "chia cắt",
      "xé toạc",
      "kết thúc trọn vẹn",
    ],
    baseConfidence: 0.8,
  },
  {
    effect_type: "vibration",
    keywords: [
      "rung tim",
      "nhịp tim",
      "nhói buốt",
      "rùng mình",
      "sống lưng",
      "giật mình",
      "lạnh toát",
    ],
    baseConfidence: 0.8,
  },
];

/**
 * Gợi ý hiệu ứng dựa trên nội dung văn bản (dùng ở Phase 2 Author Editor - US-2.3)
 * Gợi ý KHÔNG tự động áp dụng — tác giả luôn phải xác nhận.
 */
export function suggestEffectsForText(text: string): EffectSuggestion[] {
  if (!text || typeof text !== "string") return [];

  const lowerText = text.toLowerCase();
  const suggestionsMap = new Map<EffectType, EffectSuggestion>();

  for (const entry of KEYWORD_EFFECT_DICTIONARY) {
    for (const kw of entry.keywords) {
      if (lowerText.includes(kw.toLowerCase())) {
        const existing = suggestionsMap.get(entry.effect_type);
        // Ưu tiên từ khóa dài hơn hoặc có độ tin cậy cao hơn
        if (!existing || kw.length > existing.keyword.length) {
          suggestionsMap.set(entry.effect_type, {
            keyword: kw,
            effect_type: entry.effect_type,
            confidence: entry.baseConfidence,
          });
        }
      }
    }
  }

  // Chuyển Map thành Array và sắp xếp theo confidence giảm dần
  return Array.from(suggestionsMap.values()).sort(
    (a, b) => b.confidence - a.confidence
  );
}

export const detectEffectKeywords = suggestEffectsForText;
