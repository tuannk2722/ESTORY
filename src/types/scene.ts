// types/scene.ts

// ─── 4 thư viện nguyên liệu — ADMIN quản lý (Phase 3) / seed JSON (Phase 1–2) ───

export type BackgroundType = "image" | "gradient" | "particle_composition" | "video";

export interface BackgroundAsset {
  id: string;
  type: BackgroundType;
  label: string;                  // "Lễ hội ấm áp", "Bão đêm"...
  value: string;                  // image: URL; gradient: CSS string; particle: JSON config; video: URL (mp4/webm, câm, loop)
  motion: "static" | "looping";   // "looping" = tự chuyển động liên tục (video luôn looping; particle thường looping; image/gradient thường static)
  poster_frame?: string;          // BẮT BUỘC nếu motion === "looping" — ảnh tĩnh fallback khi prefers-reduced-motion bật (xem mục 8.4)
  mood_tags: string[];
}

export interface ColorPalette {
  id: string;
  label: string;                  // "Hoàng cung rực rỡ", "U ám kinh dị"
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    background_tint: string;      // lớp phủ màu lên trên background, tạo đồng bộ tông
  };
  mood_tags: string[];
}

export interface LayoutPreset {
  id: string;
  label: string;                  // "Căn giữa chuẩn", "Overlay trên ảnh", "Panel bên"
  text_position: "center" | "bottom_overlay" | "side_panel";
  text_max_width: string;         // VD "65ch"
  text_backdrop_opacity: number;  // 0–1, lớp nền mờ sau chữ để đảm bảo đọc được — phải đạt WCAG AA (xem `09-non-functional-requirements.md`)
}

export interface ScenePreset {
  id: string;
  label: string;                  // "Lễ rước dâu", "Trận thủy chiến"
  background_id: string;          // → BackgroundAsset.id
  palette_id: string;             // → ColorPalette.id
  layout_id: string;              // → LayoutPreset.id
  ambient_audio_src?: string;     // BGM loop nền — khác với SFX chấm phá của Effect
  ambient_volume?: number;
  mood_tags: string[];
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
  layout_id: string;
  ambient_audio_src?: string;
  ambient_volume?: number;
}
