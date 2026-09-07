# 02 — Data Schema (Domain Model)

> Xem `00-INDEX.md` cho thứ tự ưu tiên & điều hướng. Nhóm **Data Schema** — ưu tiên #2, chỉ sau `01-tech-stack.md` (Constraints). Nguồn chân lý cho mọi structure dữ liệu, dùng đúng ở mọi phase. Prisma schema (bản map Phase 3) ở `11-phase3-technical-roadmap.md` mục 9.4.

---

## 2.1. Story schema (TypeScript — nguồn chân lý, Prisma chỉ là bản map)

```typescript
// types/story.ts

export type EffectType =
  | "bg_color_shift"      // đổi tông màu nền
  | "particle_rain"
  | "particle_snow"
  | "particle_fire"
  | "particle_smoke"
  | "particle_fireflies"
  | "particle_gold"       // bụi vàng châu báu lấp lánh
  | "particle_leaves"     // lá khế / cánh hoa rơi theo gió
  | "wind_gust"           // luồng gió cuốn cát bụi
  | "glow_shimmer"        // hào quang ngũ sắc ngọc báu
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
  | "audio";                // audio effect gắn vào một block hoặc loop BGM

export type EffectCategory = "visual" | "audio" | "motion" | "transition";

export interface EffectConfig {
  id: string;              // unique trong phạm vi block, dùng cho preview/edit
  type: EffectType;
  category: EffectCategory;
  intensity: number;       // 0.0 – 1.0
  duration_ms: number;     // giới hạn runtime khi loop === false; với audio đây là mốc cắt tối đa, không kéo dài/phát lại file ngắn
  delay_ms?: number;       // độ trễ trước khi kích hoạt
  audio_src?: string;      // bắt buộc nếu category === "audio" — luôn là URL cuối cùng đã lưu (preset / URL thủ công / bản sao từ AudioAsset.url)
  audio_asset_id?: string; // optional, chỉ có khi audio_src được chọn từ thư viện cá nhân (AudioAsset.id, mục 2.11) — dùng để tra cứu attribution & đánh dấu "đã dùng" trong picker, KHÔNG dùng để resolve audio_src lúc runtime (audio_src đã là giá trị copy sẵn, theo đúng nguyên tắc "copy, không tham chiếu sống" ở 08-effects-and-scenes.md mục 8.3)
  loop?: boolean;          // false: chạy/phát đúng một lần rồi tắt; true: lặp liên tục (Scene ambient effect hoặc looping particle/audio)
}

export interface StoryBlock {
  id: string;               // unique trong toàn chương, dạng "ch1-block-003"
  type: "paragraph" | "dialogue" | "heading";
  text: string;
  mood_tag?: string;        // VD: "kinh dị", "lãng mạn" — dùng cho gợi ý hiệu ứng khi soạn thảo
  effects: EffectConfig[];  // có thể rỗng
}

// Hiệu lực đầy đủ từ Phase 3 (gắn với authorId/kiểm duyệt thật — xem 12-auth-and-author-management.md mục 12.7.3).
// Phase 1–2: field vẫn nên có mặt (mặc định "published", vì chưa có khái niệm author quản lý ẩn/hiện riêng chương) để không phải thêm field mới vào dữ liệu cũ khi lên Phase 3.
export type ChapterStatus = "draft" | "published";

export interface Chapter {
  id: string;                // "ch1"
  title: string;
  order: number;
  status: ChapterStatus;      // độc lập với Story.status, nhưng chỉ có hiệu lực với reader khi Story.status === "published" — công thức đầy đủ: 12-auth-and-author-management.md mục 12.7.4
  view_count?: number;        // Phase 1–2: không cần track, để undefined/0. Phase 3: tăng khi reader mở chương — dùng cho StoryStats mục 2.10, KHÔNG bắt buộc hiển thị UI ngay
  blocks: StoryBlock[];
}

export type StoryStatus = "draft" | "pending_review" | "published" | "rejected" | "archived";

export interface Story {
  id: string;                 // slug, dùng làm route param
  title: string;
  author: string;             // byline public; Prisma map từ Story.authorDisplayName, KHÔNG phải owner ID
  description: string;
  cover_image?: string;
  genre: string[];
  status: StoryStatus;         // Phase 1–2: luôn để "published" (chưa có kiểm duyệt). Phase 3: có hiệu lực đầy đủ, xem mục 2.7
  view_count: number;          // Phase 1–2: có thể để cố định 0, chưa cần tracking thật
  chapters: Chapter[];
}
```

Từ Phase 3, attribution và ownership là hai dữ liệu khác nhau: Prisma
`Story.authorDisplayName` lưu snapshot byline public tương ứng `Story.author` ở domain,
còn `Story.authorId` là quan hệ tới `User` chỉ dùng cho ownership/authorization.
Repository không expose internal `Story.id`/`authorId` thay cho slug/byline và không suy
ownership từ chuỗi tác giả. Migration legacy phải backfill chính xác
`authorDisplayName` từ JSON; đổi tên profile sau này không tự hồi tố byline đã lưu.

## 2.2. Ví dụ file nội dung (`/content/stories/demo-story.json`)

Dùng ở Phase 1–2, và làm dữ liệu seed/migrate ở Phase 3. `status` (cả `Story` lẫn từng `Chapter`) và `view_count` là field **bắt buộc** trong interface (mục 2.1) — ở Phase 1–2 luôn để `"published"`/`0` như dưới đây, xem lý do ở mục 2.7 và `12-auth-and-author-management.md` mục 12.7:

```json
{
  "id": "demo-story",
  "title": "Đêm Giông",
  "author": "Bạn",
  "description": "Một đêm mưa bão định mệnh.",
  "genre": ["kinh dị", "tâm lý"],
  "status": "published",
  "view_count": 0,
  "chapters": [
    {
      "id": "ch1",
      "title": "Chương 1: Cơn Bão Đầu Tiên",
      "order": 1,
      "status": "published",
      "blocks": [
        {
          "id": "ch1-block-001",
          "type": "paragraph",
          "text": "Sấm chớp lóe lên giữa màn đêm, xé toạc bầu trời đen kịt.",
          "mood_tag": "kinh dị / căng thẳng",
          "effects": [
            {
              "id": "eff-001",
              "type": "lightning_flash",
              "category": "visual",
              "intensity": 0.7,
              "duration_ms": 1200
            },
            {
              "id": "eff-002",
              "type": "vibration",
              "category": "motion",
              "intensity": 0.3,
              "duration_ms": 200,
              "delay_ms": 300
            }
          ]
        }
      ]
    }
  ]
}
```

## 2.3. Reading progress & Settings schema

```typescript
// types/settings.ts

// Danh sách font phải khớp đúng thứ tự/tên với bảng "Lựa chọn font-story"
// ở 04-ui-ux-design.md — thêm/bớt font ở đây thì phải đồng bộ 2 nơi.
export type StoryFontFamily =
  | "cormorant"     // Cormorant Garamond — mặc định
  | "lora"
  | "merriweather"
  | "literata"
  | "eb-garamond";

export interface ReaderSettings {
  effects_enabled: boolean;
  effects_by_category: Record<EffectCategory, boolean>;
  intensity_multiplier: number;   // 0.0 – 1.0, nhân với intensity gốc của từng effect
  reduced_motion: boolean;        // mặc định sync với prefers-reduced-motion, user có thể override
  font_size: "sm" | "md" | "lg" | "xl";
  font_family: StoryFontFamily;   // CHỈ áp dụng cho vùng văn bản truyện (font-story/prose-reader).
                                   // Không ảnh hưởng font-display (tiêu đề chương) hay font-ui (giao diện điều khiển) — xem 04-ui-ux-design.md
  theme: "light" | "dark" | "sepia"; // app chrome; canvas Reader luôn Cinematic Dark
}

export type ReadingStatus = "reading" | "completed";

export interface ReadingProgress {
  story_id: string;
  chapter_id: string;
  block_id: string;         // block cuối cùng đọc tới
  status: ReadingStatus;    // mặc định "reading", đổi "completed" khi đọc hết block cuối chương cuối
  updated_at: string;       // ISO date
}
```
> Phase 1–2: 2 type này lưu localStorage qua `lib/settingsStore.ts`. Phase 3: cùng shape, chỉ đổi nơi lưu (DB, gắn `userId`) — xem `11-phase3-technical-roadmap.md` mục 9.5. `lib/settingsStore.ts` phải viết theo interface trừu tượng ngay từ Phase 1.
>
> **Trang "Đang đọc"** = danh sách `Story` có `ReadingProgress.status === "reading"`, sắp xếp `updated_at` giảm dần — suy ra trực tiếp từ `ReadingProgress`, không cần bảng riêng. (Trang "Đã đọc" bổ sung sau bằng cách lọc `status === "completed"`, schema đã sẵn sàng.)

## 2.4. Bookmark schema (trang "Đã lưu" — tách biệt với "Đang đọc")

```typescript
// types/bookmark.ts
export interface Bookmark {
  user_id: string;
  story_id: string;
  created_at: string;   // ISO date
}
```
> Danh sách **độc lập** với "Đang đọc" — user chủ động lưu, không tự động theo tiến trình đọc. 1 truyện có thể vừa ở "Đang đọc" vừa ở "Đã lưu" cùng lúc, 2 list không phụ thuộc nhau.
> Phase 1–2: lưu tạm localStorage tương tự `ReadingProgress`. Phase 3: bảng `Bookmark` thật, gắn `userId` — `11-phase3-technical-roadmap.md` mục 9.4.

## 2.5. User & Role schema (hiệu lực đầy đủ từ Phase 3 — auth thật)

```typescript
// types/user.ts — CHƯA dùng ở Phase 1–2, định nghĩa trước để Phase 3 không đổi shape giữa chừng
export type Role = "reader" | "author" | "admin";

// Projection an toàn cho client/session/API. Search/Preview dùng app token chung nên
// không phụ thuộc trạng thái này; chỉ Import mới yêu cầu connected === true.
export interface FreesoundConnectionStatus {
  connected: boolean;
  freesound_username?: string;
}

// lib/integrations/freesound/credential-store.ts — SERVER-ONLY.
// Đây KHÔNG phải field của AppUser và không được serialize vào session/API/log.
export interface FreesoundCredentialRecord {
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
  expires_at: string;         // ISO datetime — server tự refresh khi hết hạn lúc Import (mục 2.11)
  freesound_username: string;
}

// Quota theo ngày, dùng chung shape cho mọi loại quota cá nhân (Freesound Import, AI Background Generate).
// Reset theo lịch server (UTC, đầu ngày) — KHÔNG phải rolling 24h.
export interface DailyQuota {
  limit: number;
  used: number;
  reset_at: string;   // ISO datetime — thời điểm quota kế tiếp được reset
}

export interface AppUser {
  id: string;
  email: string;
  name?: string;
  image?: string;
  role: Role;
  freesound_connection: FreesoundConnectionStatus;   // luôn có; chưa connect = { connected: false }
  freesound_import_quota: DailyQuota;                 // mục 2.11 — chỉ trừ khi Import, không trừ khi Search/Preview
  ai_background_quota: DailyQuota;                    // mục 2.11 — chỉ trừ khi Generate, không trừ khi Commit
  created_at: string;
}
```
> **Role là cấp bậc, không loại trừ lẫn nhau:** `author` làm được mọi việc của `reader`, `admin` làm được mọi việc của `author`. Check quyền theo thứ bậc `reader(1) < author(2) < admin(3)`, không so bằng chuỗi.
> User mới mặc định `reader`, tự nâng lên `author` ngay khi tạo truyện đầu tiên (không cần admin duyệt bước đổi role). Nhưng **truyện họ tạo vẫn phải qua kiểm duyệt admin trước khi publish công khai** — mục 2.7.
> `freesound_connection`, `freesound_import_quota`, `ai_background_quota` chỉ có ý nghĩa/hiệu lực từ Phase 3 (cùng lý do `AppUser` "CHƯA dùng ở Phase 1–2" ở trên) — nhưng định nghĩa sẵn trong shape để không phải đổi DTO giữa chừng. `AppUser` là allowlist client-safe: mapper chỉ chiếu trạng thái kết nối/tên Freesound và quota đã chuẩn hóa; credential mã hóa chỉ tồn tại phía server. Chi tiết luồng dùng 2 quota này ở mục 2.11 và `08-effects-and-scenes.md` mục 8.9 → 8.10.

## 2.6. Effect Library — technical manifest + admin overlay

`EffectType` (mục 2.1), renderer và constraint kỹ thuật vẫn là **nguồn chân lý trong code**. Phase 3 không biến DB thành nơi định nghĩa renderer. Contract được tách thành hai lớp:

```typescript
// lib/effects/effect-manifest.ts — CODE ONLY, không phải bảng DB
export interface EffectTechnicalDefinition {
  id: EffectType;
  category: EffectCategory;
  icon_key: string;                         // map sang lucide-react trong code
  allowed_scopes: Array<"block" | "scene">;
  defaults: {
    intensity: number;
    duration_ms: number;
    delay_ms: number;
    loop: boolean;
  };
}

// types/effect-admin.ts — DB overlay do admin quản lý
export interface EffectDefinition {
  effect_id: EffectType;                    // PK; phải tồn tại trong technical manifest
  label: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EffectKeywordSuggestion {
  id: string;
  keyword: string;                          // text admin nhập, VD "mưa rơi"
  normalized_keyword: string;               // NFKC + lowercase vi-VN + trim + collapse whitespace
  effect_id: EffectType;
  weight: number;                           // integer 1..100; số lớn ưu tiên hơn
}

// Projection cho Author/Admin UI sau khi service merge manifest + DB overlay
export interface ManagedEffectDefinition
  extends EffectTechnicalDefinition,
    Omit<EffectDefinition, "effect_id"> {}
```

Quy tắc bất biến:

- Admin chỉ sửa `label`, `description`, `is_active` và keyword/weight; **không** tạo `EffectType`, đổi ID/category/icon/renderer, chỉnh default slider hoặc visibility riêng từng picker.
- `(effect_id, normalized_keyword)` là unique. Migrate dictionary Phase 2 bằng `weight = round(baseConfidence * 100)`; không để song song hai cách chấm điểm.
- Author catalog/suggestion chỉ dùng effect `is_active = true`. Danh sách này được load một lần trong editor aggregate, không fetch riêng theo từng block.
- Reader render `EffectConfig` đã lưu qua manifest/`EffectRegistry` và **không kiểm tra `is_active`**; tắt effect không hồi tố nội dung cũ.
- Deployment chạy manifest sync idempotent: tạo overlay còn thiếu, báo lỗi nếu DB có ID không tồn tại trong manifest. Test phải chứng minh tập ID của `EffectType`, manifest và registry khớp nhau.

## 2.7. Kiểm duyệt truyện (admin duyệt/publish — hiệu lực từ Phase 3)

```
draft ──(tác giả bấm "Gửi duyệt")──▶ pending_review ──(admin duyệt)──▶ published
                                            │
                                            └──(admin từ chối)──▶ rejected ──(tác giả sửa, gửi lại)──▶ pending_review
published ──(admin/tác giả gỡ)──▶ archived
```

Field bổ sung ở tầng DB (Phase 3, Prisma `11-phase3-technical-roadmap.md` mục 9.4): `submitted_at`, `reviewed_at`, `reviewed_by` (userId admin), `rejection_reason`.

> Phase 1–2: **không có bước duyệt** — mọi truyện coi như `status: "published"` ngay (chưa có admin/auth thật). Field `status` vẫn nên có mặt từ Phase 1 (mặc định `"published"`) để Phase 3 không phải thêm field mới vào dữ liệu cũ.
>
> **Quan hệ với `Chapter.status` (mục 2.1, chi tiết luồng ở `12-auth-and-author-management.md` mục 12.7.3):** khi admin duyệt (`pending_review → published`), toàn bộ `Chapter` thuộc truyện tự động chuyển `status → "published"`, bất kể trạng thái author tự toggle trước đó. Sau thời điểm này, author có thể tự unpublish riêng từng chương mà không ảnh hưởng `Story.status`, miễn luôn giữ ≥ 1 chương `published` khi truyện đang `published`.

## 2.8. (Dự trữ — chưa implement) Rating & Comment

**Chưa xây ở Phase 3**, để làm sau. Ghi lại để khi cần, schema không xung đột với phần đã có:

```typescript
// types/social.ts — DỰ TRỮ, KHÔNG nằm trong scope hiện tại
export interface Rating {
  user_id: string;
  story_id: string;
  score: 1 | 2 | 3 | 4 | 5;
  created_at: string;
}

export interface Comment {
  id: string;
  user_id: string;
  story_id: string;
  chapter_id?: string;   // optional: bình luận theo cả truyện hoặc riêng từng chương
  parent_id?: string;    // optional: cho phép reply lồng nhau
  content: string;
  created_at: string;
}
```
> **Không tạo bảng/route/UI cho 2 model này trong scope hiện tại.** Chỉ ghi chú kiến trúc để sau này triển khai, tên field/quan hệ khớp sẵn với `User`/`Story`/`Chapter`. Xem thêm `10-out-of-scope.md`.

## 2.9. Scene — catalog model và runtime snapshot

`EffectConfig` chỉ mô tả hiệu ứng chấm phá của một block. Scene là bối cảnh cho một dải block và dùng **runtime snapshot**, không giữ live reference tới Background/Palette catalog.

```typescript
// types/scene.ts
export type CatalogStatus = "draft" | "active" | "archived";
export type BackgroundScope = "global" | "personal";
export type BackgroundSource = "admin_upload" | "author_upload" | "ai_generated";

export type BackgroundRenderData =
  | { kind: "image"; media_url: string }
  | { kind: "video"; media_url: string }
  | {
      kind: "gradient";
      angle_deg: number;
      stops: Array<{ color: string; position: number }>;
    }
  | {
      kind: "particle_composition";
      composition_key: string;               // phải có trong ParticleCompositionRegistry
      config: Record<string, unknown>;        // validate theo schema của composition_key
    }
  | {
      kind: "radial_gradient";
      shape: "circle" | "ellipse";
      center: { x: number; y: number };        // tọa độ chuẩn hóa 0..1
      stops: Array<{ color: string; position: number }>;
    };

export type BackgroundType = BackgroundRenderData["kind"];

export interface BackgroundRenderSnapshot {
  render_data: BackgroundRenderData;
  motion: "static" | "looping";
  poster_frame?: string;                     // bắt buộc nếu motion === "looping"
}

export interface PaletteRenderSnapshot {
  primary: string;
  secondary: string;
  accent: string;
  background_tint: {
    color: string;
    opacity: number;                         // 0..1; mặc định gợi ý 0.35
  };
}

export interface SceneRenderConfig {
  schema_version: 1;
  background: BackgroundRenderSnapshot;
  palette: PaletteRenderSnapshot;
  ambient_effects: EffectConfig[];
}

export interface BackgroundAsset {
  id: string;
  label: string;
  render: BackgroundRenderSnapshot;
  mood_tags: string[];
  status: CatalogStatus;
  activated_at?: string;                     // set một lần khi active lần đầu; không reset
  scope: BackgroundScope;
  owner_id?: string;                         // bắt buộc nếu scope === "personal"
  source: BackgroundSource;
  generation_prompt?: string;                // chỉ ai_generated; lưu prompt gốc
}

export interface ColorPalette {
  id: string;
  label: string;
  colors: PaletteRenderSnapshot;
  mood_tags: string[];
  status: CatalogStatus;
  activated_at?: string;
}

export interface ScenePreset {
  id: string;
  label: string;
  description?: string;
  thumbnail_url?: string;
  mood_tags: string[];
  status: CatalogStatus;
  activated_at?: string;
  render_config: SceneRenderConfig;          // curated snapshot do developer seed/import
}

export interface Scene {
  id: string;
  chapter_id: string;
  start_block_id: string;
  end_block_id: string;
  based_on_preset_id?: string;               // provenance only; nullable/onDelete SetNull
  render_config: SceneRenderConfig;          // runtime source of truth
}
```

Quy tắc bất biến:

- Custom ScenePicker resolve Background + Palette + ambient effects/audio thành `SceneRenderConfig`; curated `ScenePreset` đã chứa sẵn cùng contract. Cả hai đường đều tạo `Scene.render_config` bằng deep copy.
- Reader chỉ dùng `Scene.render_config`, không fetch toàn bộ `/api/scene-library` và không resolve `background_id`/`palette_id` lúc runtime.
- `SceneRenderConfig.ambient_effects` chỉ nhận effect có `allowed_scopes` chứa `scene`; tối đa một audio ambient, không trùng `EffectType`, và audio ambient phải `loop: true`.
- Media URL trong snapshot dùng object key bất biến. Replace upload tạo key mới; archive/xóa record catalog không được xóa object còn được snapshot sử dụng.
- Author picker chỉ thấy catalog `active`; Reader vẫn render snapshot của Scene cũ dù nguồn đã archived.
- Personal Background chuyển thẳng `active` sau khi upload/AI commit thành công (không qua admin draft/review), chỉ owner nhìn thấy; admin global catalog không quản lý lifecycle của nó.
- `ScenePreset` mới chỉ được developer seed/import bằng script. Admin được Preview, sửa metadata/thumbnail/status và remove khỏi catalog; admin **không** có preset builder.
- Background global và Palette có vòng đời `draft → active → archived`. “Remove” là archive mặc định; hard-delete record chỉ khi `activated_at = null`. Storage cleanup vẫn phải reference-audit riêng.
- Background theo kind phải validate bằng discriminated schema. Không nhận raw CSS hoặc particle JSON tùy ý; particle dùng `composition_key` đã đăng ký trong code.
- Gradient tuyến tính giữ `kind: "gradient"` + `angle_deg`. Radial dùng `kind: "radial_gradient"`, `shape`, `center` và ≥2 stops có position tăng không giảm trong 0..1; extent cố định `farthest-corner`. Đây là bổ sung đã được duyệt ngày 2026-09-05 để giữ bốn nền radial legacy, thuộc schema version 1 trước khi có dữ liệu snapshot production.
- Các Scene trong cùng Chapter không chồng lấn. Repository/service nhận cả `storyId` và `chapterId`; không tin `chapterId` đơn lẻ từ client.

Chi tiết render/admin/phân kỳ ở `08-effects-and-scenes.md` mục 8.3 → 8.8; UI ở `04b-page-layouts.md` mục 8. Prisma mapping ở `11-phase3-technical-roadmap.md` mục 9.4b.

## 2.10. (Dự trữ — chưa xây UI) Story Stats cho Author

Cùng nguyên tắc dự trữ như Rating/Comment (mục 2.8): **chỉ chốt shape dữ liệu trước**, chưa build trang thống kê (`10-out-of-scope.md`, `12-auth-and-author-management.md` mục 12.8). Không tạo bảng analytics/event-log riêng — toàn bộ tính bằng query trên dữ liệu đã có sẵn (`Story.view_count`, `Chapter.view_count` mục 2.1, `Bookmark` mục 2.4, `ReadingProgress` mục 2.3):

```typescript
// types/story-stats.ts — DỰ TRỮ, tính "on the fly" ở API Route Phase 3, KHÔNG lưu bảng riêng
export interface StoryStats {
  story_id: string;
  total_views: number;                     // = Story.view_count
  chapter_views: Record<string, number>;   // chapterId → Chapter.view_count
  bookmark_count: number;                  // COUNT(Bookmark WHERE story_id = ...)
  reader_count: number;                    // COUNT(DISTINCT ReadingProgress.user_id WHERE story_id = ...)
  completed_count: number;                 // COUNT(ReadingProgress WHERE story_id = ... AND status = "completed")
  completion_rate: number;                 // completed_count / reader_count, 0 nếu reader_count === 0
}
```
> **Không tạo route/trang UI cho `StoryStats` trong scope hiện tại.** Khi có yêu cầu tường minh xây trang thống kê tác giả, gắn trực tiếp vào `/author` (`StoryManageCard`) — không tách trang riêng biệt khỏi luồng quản lý truyện. Xem thêm `10-out-of-scope.md`.

## 2.11. Audio Asset — Thư viện âm thanh cá nhân của Author (hiệu lực từ Phase 3)

Bổ sung nguồn cho `EffectConfig.audio_src` và `SceneRenderConfig.ambient_effects` dạng audio: ngoài preset có sẵn author có thể **import sound từ Freesound** hoặc **upload file từ thiết bị**, lưu thành asset cá nhân tái sử dụng được ở mọi block/scene/chapter/story của chính mình. Toàn bộ luồng UI, quota, OAuth chi tiết ở `08-effects-and-scenes.md` mục 8.9 — mục này chỉ chốt shape dữ liệu.

```typescript
// types/audio-asset.ts — hiệu lực từ Phase 3 (cần owner_id thật)
export type AudioAssetSource = "freesound" | "upload";

export interface AudioAsset {
  id: string;
  owner_id: string;             // authorId sở hữu — asset CÁ NHÂN, không phải thư viện global
  source: AudioAssetSource;
  title: string;
  url: string;                  // luôn trỏ về file đã lưu ở R2/Supabase Storage — KHÔNG bao giờ trỏ thẳng domain Freesound
  duration_ms: number;
  freesound_id?: string;        // chỉ có khi source === "freesound", dùng để tránh import trùng 1 sound 2 lần
  license?: string;              // VD "cc0" | "cc-by" | "cc-by-nc" — chỉ có khi source === "freesound"
  attribution?: {                // chỉ có khi license yêu cầu ghi nguồn (khác "cc0")
    author_name: string;
    source_url: string;
    license_name: string;
  };
  created_at: string;
}
```
> **Ranh giới quan trọng:** `AudioAsset` là asset **cá nhân** (`owner_id`), khác hoàn toàn với `EffectDefinition`/`EffectKeywordSuggestion` (mục 2.6, admin quản lý, dùng chung toàn hệ thống). Asset cá nhân của 1 author **không** tự động xuất hiện với author khác, và admin **không** quản lý/duyệt danh sách này — xem thêm `10-out-of-scope.md`.
> Nơi tham chiếu `AudioAsset.id` từ `EffectConfig`: dùng field `audio_asset_id` (mục 2.1) — luồng chọn từ thư viện cá nhân/Freesound/upload mô tả đầy đủ ở `08-effects-and-scenes.md` mục 8.9.

---
← Về `00-INDEX.md` | Trước: `01-tech-stack.md` | Tiếp theo: `03-file-structure.md` (xem thêm `08-effects-and-scenes.md` để biết đầy đủ về Scene)
