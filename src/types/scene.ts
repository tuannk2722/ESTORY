// types/scene.ts
// Phase 2: Domain Model cho Scene System (docs/02-data-schema.md mục 2.9 & docs/08-effects-and-scenes.md)
import { EffectConfig } from "./story";

// ─── 3 thư viện nguyên liệu — ADMIN quản lý (Phase 3) / seed JSON (Phase 1–2) ───

export type BackgroundType = "image" | "gradient" | "particle_composition" | "video";
export type BackgroundScope = "global" | "personal";
export type BackgroundSource = "admin_upload" | "author_upload" | "ai_generated";

export interface BackgroundAsset {
  id: string;
  type: BackgroundType;
  label: string;                  // "Lễ hội ấm áp", "Bão đêm"...
  value: string;                  // image: URL; gradient: CSS string; particle: JSON config; video: URL (mp4/webm, câm, loop)
  motion: "static" | "looping";   // "looping" = tự chuyển động liên tục (video luôn looping; particle thường looping; image/gradient thường static)
  poster_frame?: string;          // BẮT BUỘC nếu motion === "looping" — ảnh tĩnh fallback khi prefers-reduced-motion bật (xem mục 8.4)
  mood_tags: string[];
  scope?: BackgroundScope;        // "global" (mặc định) | "personal" (author tạo ở Phase 3)
  source?: BackgroundSource;       // "admin_upload" (mặc định) | "author_upload" | "ai_generated"
  owner_id?: string;              // Bắt buộc nếu scope === "personal"
  generation_prompt?: string;     // Prompt gốc khi tạo bằng AI ở Phase 3
}

export interface ColorPalette {
  id: string;
  label: string;                  // "Hoàng cung rực rỡ", "U ám kinh dị"
  colors: {
    primary: string;              // Màu chủ đạo cho UI/decorations
    secondary: string;            // Màu phụ trợ
    accent: string;               // Màu của Drop Cap chữ hoa đầu đoạn, viền khung hội thoại dialogue-box, icon tiến trình
    background_tint: string;      // Lớp phủ màu lên trên background (~35% opacity), tạo đồng bộ tông
  };
  mood_tags: string[];
}

export interface ScenePreset {
  id: string;
  label: string;                  // "Lễ rước dâu", "Trận thủy chiến"
  background_id: string;          // → BackgroundAsset.id
  palette_id: string;             // → ColorPalette.id
  effects?: EffectConfig[];       // Danh sách hiệu ứng không gian êm dịu (nhạc nền loop, hạt mưa, đom đóm, tuyết rơi...)
  mood_tags: string[];
}

export interface SceneLibraryData {
  backgrounds: BackgroundAsset[];
  palettes: ColorPalette[];
  scenePresets: ScenePreset[];
}

// ─── Scene: AUTHOR tạo cho 1 truyện cụ thể, áp cho 1 dải block ───

export interface Scene {
  id: string;
  chapter_id: string;
  start_block_id: string;
  end_block_id: string;
  based_on_preset_id?: string;    // optional, chỉ lưu vết "dùng preset nào" — có thể chỉnh riêng sau
  background_id: string;
  palette_id: string;
  effects?: EffectConfig[];       // Danh sách hiệu ứng không gian êm dịu (nhạc nền loop, hạt mưa, đom đóm, tuyết rơi...)
}
