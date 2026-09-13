# 08 — Effects & Scene System (Hiệu Ứng Chấm Phá & Bối Cảnh Trải Dài)

> Xem `00-INDEX.md` cho thứ tự ưu tiên & điều hướng. File này **thay thế** 2 file cũ `08-effects-library.md` và `13-scene-system.md` (đã gộp). Dùng cùng `02-data-schema.md` mục 2.1 (`EffectConfig`) và 2.9 (Scene), `03-file-structure.md` (vị trí file).

---

## 8.1. Mô hình 2 tầng: Block Effects vs Scene Ambient Effects

Mọi hiện tượng hình ảnh/âm thanh khi đọc đều rơi vào 1 trong 2 tầng sau, **tồn tại song song, không thay thế nhau**:

| | **Block Effects** (Chấm phá / Cao trào) | **Scene Ambient Effects** (Không gian / Môi trường) |
|---|---|---|
| **Phạm vi** | 1 block cụ thể | 1 dải block liên tiếp (author tự chọn) |
| **Vòng đời** | Trigger ngắn khi block vào viewport, rồi tắt | Giữ nguyên xuyên suốt dải, crossfade (~800ms) khi sang Scene kế tiếp |
| **Tần suất đổi** | Cao — đổi theo từng câu chữ, bám sát nhịp điệu cao trào | Thấp — duy trì không gian tĩnh lặng, chỉ đổi khi sang phân cảnh mới |
| **Đặc tính trải nghiệm** | **Đa dạng, biến ảo, kịch tính:** Rung màn hình (`screen_shake`), chớp sét (`lightning_flash`), chữ phóng to (`text_grow`), SFX tiếng nổ chớp nhoáng... | **Nhẹ nhàng, êm dịu, tĩnh lặng:** Nhạc nền du dương (`type: "audio"`, `loop: true`), hạt mưa rả rích (`particle_rain`), tuyết phủ (`particle_snow`), đom đóm (`particle_fireflies`), bụi vàng (`particle_gold`), lá bay (`particle_leaves`), sương mờ (`particle_smoke`)... Giúp người đọc tập trung vào câu chuyện mà không bị xao nhãng hay chói mắt. |
| **Cấu thành** | `StoryBlock.effects: EffectConfig[]` | `Scene.render_config`: background snapshot + palette snapshot + `ambient_effects` |
| **Định nghĩa type** | `02-data-schema.md` mục 2.1 (`EffectConfig`) | Mục 8.3 bên dưới (`Scene`) |
| **Render** | Nằm **chồng lên trên** Scene đang active | Nền phía dưới, full-viewport |

**Quy tắc vàng khi phân loại 1 yêu cầu mới:** nếu hiệu ứng phải lặp lại/đổi theo từng đoạn văn cụ thể → Block Effect. Nếu nó là "không khí chung" giữ nguyên qua nhiều đoạn (dù bản thân nó có tự chuyển động — xem mục 8.3) → Scene Ambient Effect.

---

## 8.2. Effect — Thư viện ban đầu (bắt buộc có ở Phase 1)

| EffectType | Category | Cách implement gợi ý |
|---|---|---|
| `bg_color_shift` | visual | Tailwind transition trên `background-color` của container cha, dùng CSS variable + Framer Motion `animate` |
| `particle_rain` | visual | CSS particles với CSS variables, giới hạn particle count thấp (~30-40) để nhẹ và êm |
| `particle_snow` | visual | Hạt tuyết rơi nhẹ nhàng, lơ lửng |
| `particle_fireflies` | visual | Đom đóm / lân tinh đốm sáng lập lòe |
| `particle_gold` | visual | Bụi kim tuyến châu báu lấp lánh |
| `particle_leaves` | visual | Cánh hoa / lá rụng theo làn gió |
| `particle_smoke` | visual | Lớp sương khói mờ ảo |
| `sunbeam` | visual | Vệt nắng xiên qua kẽ lá, tia sáng hoàng hôn thở nhẹ nhàng mềm mại |
| `candle_flicker` | visual | Ánh nến bập bùng, quầng lửa nến ấm áp lung linh ở góc khung cảnh |
| `floating_clouds` | visual | Dải mây trắng và sương sớm bồng bềnh trôi ngang qua cảnh vật |
| `water_ripple` | visual | Ánh trăng / mặt nước gợn sóng lấp lánh phản quang êm đềm |
| `wind_gust` | motion | Luồng gió cuộn cát bụi nhẹ nhàng |
| `glow_shimmer` | visual | Hào quang ngũ sắc ngọc báu rực rỡ |
| `lightning_flash` | visual | Framer Motion: flash trắng opacity 0→0.8→0 trong `duration_ms`, kèm optional audio thunder |
| `text_shake` | visual | Framer Motion `animate` với `x`/`y` dao động nhỏ biên độ theo `intensity` |
| `particle_fire` | visual | Đốm lửa và tàn tro bốc lên rực cháy cuồn cuộn |
| `screen_blur` | visual | Màn hình mờ dần tạo cảm giác choáng váng, hoa mắt |
| `text_grow` | visual | Chữ phồng to đột ngột nhấn mạnh âm thanh khủng khiếp |
| `text_fade_flashback` | visual | Nhuộm sắc sepia mờ ảo và vignette hoài niệm ký ức |
| `typewriter` | visual | Hiệu ứng nhịp gõ máy chữ và con trỏ nhấp nháy cổ điển |
| `vibration` | motion | Haptic Vibration API trên mobile kèm rung viền màn hình |
| `transition_fade` | transition | Framer Motion `AnimatePresence` khi chuyển chapter |
| `transition_page_tear` | transition | Hiệu ứng lật trang và xé mép giấy chuyển chương |
| `audio` (SFX hoặc BGM loop) | audio | Howler.js, mỗi block audio effect có `audio_src` và tùy chọn `loop`, dùng chung 1 Howler instance pool tránh leak |
| `screen_shake` | motion | Rung toàn viewport trong thời gian ngắn; biên độ theo `intensity`, không animate layout property |

> Toàn bộ **25 loại hiệu ứng** hiện có được cài đặt thành component độc lập trong `/components/effects/visual|audio/` và đăng ký trong `EffectRegistry.ts`. Tập ID giữa `EffectType`, technical manifest và registry phải được kiểm tra tự động; không duy trì con số này bằng phỏng đoán.

> **Quy tắc về `loop` & `delay_ms`:**
> - `loop?: boolean`: Áp dụng cho **mọi effect** (cả visual, motion và audio). Khi `loop: true`, hiệu ứng sẽ chuyển động/phát liên tục không tự ngắt sau `duration_ms` (rất hữu ích cho các hạt không gian và ánh sáng trong Scene hoặc đoạn văn kéo dài).
> - Khi `loop: false`, effect/audio chỉ chạy **một lần**. Riêng audio, `duration_ms` là **giới hạn phát tối đa**: nếu file ngắn hơn thì audio kết thúc tự nhiên; nếu file dài hơn thì runtime dừng tại giới hạn. Trường này không kéo dài hoặc lặp lại file âm thanh.
> - `delay_ms?: number`: Dùng để **phối hợp chuỗi hiệu ứng nối tiếp (Choreography)** trong cùng 1 câu văn (ví dụ: Chớp sáng nổ ở 0ms $\rightarrow$ Sấm rền ở 400ms $\rightarrow$ Rung màn hình ở 600ms). Với Scene, `delay_ms` mặc định là 0.

---

## 8.3. Scene — một runtime contract, hai đường tạo

Schema canonical của `BackgroundAsset`, `ColorPalette`, `ScenePreset`, `SceneRenderConfig` và `Scene` nằm ở `02-data-schema.md` mục 2.9. Luồng dữ liệu đã chốt:

```text
Custom ScenePicker
  -> resolve Background + Palette + ambient effects/audio
  -> SceneRenderConfig snapshot
                                          -> Scene.render_config -> SceneLayer
Curated ScenePreset
  -> SceneRenderConfig có sẵn
```

**Copy-not-live phải copy dữ liệu render, không copy ID.** `Scene.render_config` chứa background/palette/effect snapshot hoàn chỉnh. `based_on_preset_id` chỉ để truy vết và được phép `null`; Reader không dùng field này để render. Vì vậy admin sửa/archive Background, Palette hoặc Preset chỉ ảnh hưởng lần chọn sau, không hồi tố Scene đã lưu.

`ScenePreset` là curated reusable package do developer seed/import. Nó có thể chứa media riêng không expose trong Background library. Admin không dựng preset bằng bốn bước của Custom ScenePicker; admin chỉ quản lý metadata/catalog và Preview.

**"Giữ nguyên" khi background tự chuyển động:** Scene giữ cùng một `render_config` suốt dải block. Video/particle bên trong có thể looping liên tục nhưng không restart mỗi khi block active thay đổi trong cùng Scene.

### 8.3.1. Validation trước khi tạo snapshot

- Background dùng discriminated schema theo `kind`; gradient tuyến tính (`gradient`) và radial (`radial_gradient`) dùng typed fields theo `02-data-schema.md` mục 2.9, không nhận raw CSS; particle không nhận raw JSON mà dùng `composition_key` đã đăng ký.
- `motion: "looping"` bắt buộc `poster_frame`.
- Palette tint lưu cả `color` và `opacity`; mọi màu phải parse được và Preview đạt contrast theo `09-non-functional-requirements.md`.
- Ambient effect phải active ở thời điểm chọn và technical manifest cho phép scope `scene`; tối đa một audio ambient, không trùng type, audio phải `loop: true`.
- `SceneRenderConfig.schema_version` bắt đầu ở `1`; mapper chịu trách nhiệm nâng legacy snapshot khi đọc/migrate.
- Media object key là immutable. Thay file tạo key mới; không overwrite key đã nằm trong snapshot.

---

## 8.4. Quy tắc hiển thị & Thứ tự xếp lớp (Text-First Visual Rendering Stack)

```
Chapter
 └─ Scene A (block 1-14): nền rừng núi tĩnh lặng, tông xanh lam, effects: [nhạc rừng đêm loop, đom đóm trôi]
 └─ Scene B (block 15-22): nền lễ hội (video loop), tông vàng ấm, effects: [nhạc lễ hội loop]
     └─ Block 18 có thêm Block Effect "text_grow" + SFX trống khi tới câu "Tiếng trống vang lên!"
 └─ Scene C (block 23-30): nền biển sâu, tông xám tối, effects: [nhạc biển sâu loop, hạt mưa rả rích]
```

### Thứ tự các lớp hiển thị chuẩn mực (Z-Index Hierarchy):

```
[MẶT TRÊN CÙNG: MẮT NGƯỜI ĐỌC]
  ▲
  │  LỚP 5 [z-20]: 📖 KHUNG ĐỌC TRUYỆN CHÍNH (Story Text Layer - CAO NHẤT)
  │                - Tiêu đề chương, Chữ thân truyện (#F8FAFC), Drop Cap, Khung đối thoại dialogue-box.
  │                - Chữ luôn nổi bật 100%, sắc nét, không bị hạt hoặc màu nền che mờ.
  │
  │  LỚP 4:        🎵 ÂM THANH MÔI TRƯỜNG & HIỆU ỨNG (Howler.js Instance Pool)
  │                - Nhạc nền không gian Scene (Ambient Audio Loop, fade in/out ~800ms)
  │                - Âm thanh chấm phá Block (SFX tiếng sấm, tiếng nổ, tiếng gõ)
  │
  │  LỚP 3 [z-[5]]: ✨ TẤT CẢ HIỆU ỨNG THỊ GIÁC (Atmospheric & Block Particle Effects)
  │                - Hiệu ứng môi trường Scene: Mưa, tuyết, khói, mây trôi, đom đóm, bụi vàng...
  │                - Hiệu ứng gắn theo Block: Ánh nến, vệt nắng xiên, gợn sóng nước, lá rụng, đổi màu...
  │                - Trôi êm đềm ở tầng DƯỚI con chữ. 100% có `pointer-events-none` (không chặn click/chọn chữ).
  │
  │  LỚP 2 [z-0] : 🎨 NHUỘM MÀU KHÍ QUYỂN (Color Palette 3-Tier Grading)
  │                - 2a. Color Wash (`mix-blend-mode: color`, opacity 0.45)
  │                - 2b. Atmospheric Gradient & Radial Depth Tint (`background_tint`, opacity 0.88)
  │                - 2c. Ambient Lighting Aura (Viền sáng primary/secondary trên/dưới)
  │
  │  LỚP 1 [z-0] : 🖼️ BỐI CẢNH NỀN GỐC (SceneBackground - Image / Gradient / Video loop)
  │
[ĐÁY DƯỚI CÙNG]
```

> **Lưu ý về các hiệu ứng chuyển cảnh toàn màn hình (`z-30 → z-50`)**: Các hiệu ứng như Chớp sét (`lightning_flash`), Mờ ảo (`screen_blur`), Xé trang (`transition_page_tear`) hay Chuyển cảnh mờ (`transition_fade`) kích hoạt tạm thời trên toàn viewport trong thời gian rất ngắn (~0.2s - 0.8s) rồi tự ngắt, có `pointer-events-none`.

### Các quy tắc cốt lõi:
- Background/màu/effects giữ nguyên khi cuộn qua dải block; **crossfade ~800ms** (Framer Motion `AnimatePresence`, không giật cục) khi sang Scene kế tiếp.
- **Màu chữ chính (Body Story Text):** Luôn giữ cố định 100% theo Theme Dark, không bị Scene ghi đè để đảm bảo thị giác đọc thoải mái, đồng nhất. `ColorPalette` chỉ áp dụng lên các điểm nhấn (accent, primary, viền card, Drop Cap) và lớp phủ nền (`background_tint`).
- **Khung đọc văn bản chính (Prose Container):** Luôn giữ vị trí cố định ở trung tâm (`max-w-2xl mx-auto`), ổn định và thanh lịch; không đổi layout đột ngột giữa các scene để giữ mắt đọc không bị mỏi.
- **`prefers-reduced-motion` / `reduced_motion` bật:** mọi `BackgroundAsset.render.motion === "looping"` phải render `poster_frame` tĩnh thay vì phát video; các visual/motion/transition động không được mount, còn text và audio vẫn khả dụng.
- **Preview policy:** Full Editor Preview và Scene Preview mặc định dùng đúng Reader Settings. Quick Effect Preview 5 giây là ngoại lệ có chủ đích: luôn bỏ qua Reader Settings để kiểm thử chính xác effect và thông số đang chỉnh.
- **Performance:** video/particle background chỉ load khi dải block chứa Scene đó sắp vào viewport (dùng chung cơ chế `rootMargin` của Intersection Observer).

---


## 8.5. Admin quản lý Effect & Scene catalog

UI canonical ở `04b-page-layouts.md` mục 8; acceptance criteria ở `07-user-stories-phase3.md` US-3.12 → US-3.13.

### 8.5.1. Effect catalog

- Technical manifest trong code sở hữu ID/category/icon/defaults/renderer/allowed scope.
- DB overlay sở hữu label/description/is_active/keyword/weight.
- Admin không tạo effect type, không đổi technical field và không chỉnh default slider.
- `is_active = false` ẩn effect khỏi mọi lựa chọn/gợi ý mới nhưng Reader vẫn render effect đã lưu.
- Dictionary normalize Unicode trước khi unique/match; editor nhận dictionary một lần trong aggregate payload.

### 8.5.2. Scene catalog

Admin xây thư viện dùng chung, không soạn Scene cho từng truyện:

| Tab | Admin làm gì | Không làm |
|---|---|---|
| **Backgrounds** | Add/edit/Preview/archive global image, video loop, typed gradient hoặc registered particle composition; looping bắt buộc poster; mood tags/status | Không hiển thị/sửa personal background; không nhập raw CSS/JSON |
| **Palettes** | Add/edit/Preview/archive bốn kênh màu; tint gồm color + opacity; mood tags/status | Không đổi màu chữ body Reader |
| **Scene Presets** | Preview, sửa metadata/thumbnail/status, remove khỏi catalog | Không có builder; không tạo preset mới từ UI |

Preset mới được developer seed/import bằng script idempotent. Importer validate `SceneRenderConfig`, khởi tạo metadata khi tạo mới và không ghi đè metadata admin đã sửa trong lần sync sau nếu không có cờ explicit.

### 8.5.3. Lifecycle, dependency và media

- `draft`: chỉ admin thấy; `active`: Author picker được dùng; `archived`: không còn dùng cho lựa chọn mới.
- “Remove khỏi catalog” là archive mặc định. Hard delete chỉ dành cho item có `activated_at = null`; Preset import không được resolve từ draft ingredient.
- ConfirmModal phải nêu rõ ảnh hưởng và nói Scene cũ không đổi; Preset có thể hiện số Scene giữ provenance.
- Replace upload tạo object key mới. Xóa record DB không tự xóa media; cleanup storage là job riêng sau khi chứng minh không còn snapshot nào giữ URL.
- Không tạo global AudioAsset library thứ tư. Ambient audio trong curated preset đi cùng import package; Custom Scene dùng nguồn audio cá nhân/preset đã được quy định cho Author.

> `/admin/scene-library` chỉ query `BackgroundAsset.scope = "global"`. Personal background không được leak vào admin response, log dependency hay picker global.

---

## 8.6. Lộ trình theo Phase

- **Phase 2 (legacy hiện tại):** Scene dùng trong editor; library/scenes là JSON và `Scene` còn giữ `background_id`/`palette_id`. Đây là shape cần migrate, không phải contract đích.
- **Phase 3 migration bridge:** resolve từng legacy ID thành `SceneRenderConfig`; fail migration nếu thiếu asset/media. JSON bridge có thể đọc cả shape cũ và mới trong thời gian chuyển tiếp.
- **Phase 3 target:** DB lưu snapshot; Reader read-model trả Scene của chapter trực tiếp và không fetch toàn bộ Scene library. Admin UI quản lý Effect/Scene catalog theo mục 8.5.

---

## 8.7. Repository pattern

```typescript
// lib/repositories/scene-repository.ts
export interface SceneLibraryRepository {
  getActiveGlobalBackgrounds(): Promise<BackgroundAsset[]>;
  getActivePalettes(): Promise<ColorPalette[]>;
  getActiveScenePresets(): Promise<ScenePreset[]>;
}

export interface SceneRepository {
  getByChapter(storyId: string, chapterId: string): Promise<Scene[]>;
}

// Mutation đi qua SceneCommandService sau requireChapterInStory + owner/admin guard.
export interface SceneCommandService {
  replaceChapterScenes(input: {
    actorId: string;
    storyId: string;
    chapterId: string;
    expectedUpdatedAt: string; // revision của Story aggregate
    scenes: Scene[];
  }): Promise<{ data: Scene[]; meta: { updatedAt: string } }>;
}

// Phase 3 only — quản lý asset CÁ NHÂN của author, tách biệt hoàn toàn khỏi SceneLibraryRepository (global).
// lib/repositories/background-asset-repository.ts
export interface BackgroundAssetRepository {
  getActivePersonalByOwner(ownerId: string): Promise<BackgroundAsset[]>;
}

// lib/repositories/audio-asset-repository.ts (mục 8.9)
export interface AudioAssetRepository {
  getByOwner(ownerId: string): Promise<AudioAsset[]>;
  getById(id: string): Promise<AudioAsset | null>;
}

// lib/repositories/json-scene-repository.ts        → Phase 2, đọc /content/scene-library/*.json
// lib/repositories/prisma-scene-repository.ts       → Phase 3, thêm khi swap sang DB
// lib/repositories/prisma-background-asset-repository.ts → Phase 3 only, chưa có bản JSON (tính năng chỉ tồn tại từ Phase 3)
// lib/repositories/prisma-audio-asset-repository.ts      → Phase 3 only, tương tự
```

**Ranh giới truy cập Scene bắt buộc:** Reader Phase 3 nhận `scenes` ngay trong `getPublicChapter(storyId, chapterId)`; không còn client fetch `/api/scenes` hoặc `/api/scene-library` để render. Repository query phải ràng buộc đồng thời Story public, Chapter public và quan hệ Story–Chapter.

Editor aggregate xác minh full Story + ownership/role rồi mới gọi `getByChapter(storyId, chapterId)`. Mọi mutation qua command service; không expose generic `save(scene)` cho Route Handler.
Component/page chỉ gọi qua các interface trên, không đọc JSON/Prisma trực tiếp — kể cả ở Phase 2. Vị trí file: `03-file-structure.md`.

**Search trong picker:** Effect/Background/Palette/Preset/AudioAsset đã thuộc catalog
được tải theo aggregate/owner một lần, nên lọc tức thì ở client bằng matcher thuần tại
`lib/search/text-search.ts`. Query state chỉ sống trong picker; không URL, debounce hoặc
request theo từng phím. Gọi matcher một lần với toàn bộ field/tags searchable để nhiều
token có thể match xuyên field. Việc cắt `visibleCount`/“Xem thêm” là batching render,
không phải server pagination. Freesound search là upstream proxy riêng theo §8.9.1.

---

## 8.8. Ví dụ minh họa — "Sơn Tinh Thủy Tinh"

1. Editor, Timeline sidebar (`Timeline.tsx`): author kéo chọn block 15→22 (đoạn "rước Mị Nương").
2. Bấm "Tạo Scene" → `ScenePicker` hiện lưới `ScenePreset` (thumbnail nền + swatch màu + hạt lân tinh + nghe thử nhạc). Chọn "Lễ rước dâu" (background video loop đèn hoa, nhạc nền du dương, đom đóm lấp lánh).
3. Cả dải block 15–22: nền video lễ hội chuyển động liên tục phía sau, tông vàng ấm, nhạc lễ hội êm dịu phát nền — **không đổi** trong suốt 8 block.
4. Author click riêng block 18 ("Tiếng trống vang lên") → gắn thêm Block Effect `text_grow` + SFX trống (chớp nhoáng rồi tắt).
5. Preview (`ReaderPane`): cuộn qua 8 block thấy nền/màu/nhạc nhất quán, không gian đọc êm ái; riêng block 18 chữ phồng to + trống vang chớp nhoáng rồi tắt, Scene vẫn tiếp tục duy trì êm ả.

---

## 8.9. Nguồn âm thanh cá nhân của Author — Freesound Search/Import & Upload (hiệu lực từ Phase 3)

Bổ sung nguồn cho **cả 2 nơi** hiện đang chỉ có "preset có sẵn / dán URL thủ công": tab Âm Thanh trong `EffectPicker.tsx` (US-2.2) và bước 4 "Cấu hình nhạc nền môi trường" trong `ScenePicker.tsx` Tab 2 (US-2.8). Từ Phase 3, cả 2 nơi này có thêm 2 tab con:

- **"Thư viện của tôi"** — danh sách `AudioAsset` (`02-data-schema.md` mục 2.11) đã import/upload trước đó, tái sử dụng ngay không cần làm lại.
- **"Tìm trên Freesound"** — search + preview trực tiếp trong Editor.

Component: `SoundSourcePicker.tsx` (sub-panel dùng chung ở cả 2 nơi trên) chứa `FreesoundSearchPanel.tsx` — vị trí file ở `03-file-structure.md`.

### 8.9.1. Search & Preview — KHÔNG cần connect, KHÔNG tốn quota
1. Author gõ từ khóa → debounce ~600ms trước khi gọi API, tránh gọi dồn dập theo từng phím gõ.
2. Server (`GET /api/integrations/freesound/search`) gọi Freesound APIv2 bằng **app token chung của hệ thống** (không phải token cá nhân của author) — vì đây là thao tác đọc công khai, không cần danh tính Freesound của author.
3. Server cache kết quả theo query key trong thời gian ngắn (~10 phút) và áp rate-limit theo author (VD token-bucket vài request/phút) để giữ headroom dưới giới hạn upstream của Freesound — đây là hành vi bắt buộc dù không tốn quota cá nhân, xem thêm `09-non-functional-requirements.md`.
4. Preview: phát trực tiếp file preview (mp3 nén sẵn) do Freesound trả về — client phát thẳng từ URL đó, **không** tải về server, **không** qua `AudioImportService`.
5. Search/Preview hoạt động được **kể cả khi author chưa từng connect Freesound**.

### 8.9.2. Import — BẮT BUỘC connect, tốn quota
1. Author bấm nút "Dùng sound này" trên 1 kết quả search.
2. Client kiểm tra projection client-safe `AppUser.freesound_connection.connected`:
   - **Chưa connect** → nút ở trạng thái disable, hiện dòng lý do ngắn + CTA "Kết nối Freesound" (mở luồng OAuth, mô tả ở `12-auth-and-author-management.md` mục 12.9).
   - **Đã connect** → gọi `POST /api/integrations/freesound/import { freesound_sound_id }`.
3. Server, trong 1 request:
   - `quota-service.reserve(userId, "freesound_import")` — tăng `used` ngay; nếu đã chạm `limit` → trả lỗi kèm `reset_at` để client hiện thông báo, **không** gọi Freesound.
   - Server đọc `FreesoundCredentialRecord.expires_at` — nếu hết hạn, tự refresh và thay thế ciphertext qua `oauth.ts` trước khi tiếp tục (không yêu cầu author đăng nhập lại Freesound). Credential này không đi qua client.
   - `audio-import-service.ts`: download file gốc từ Freesound (dùng access token cá nhân của author, đây là bước duy nhất cần token cá nhân) → chuẩn hoá thành định dạng phát được trên mọi trình duyệt (mp3/ogg, bitrate vừa phải) → upload lên R2 → insert `AudioAsset` (`source: "freesound"`, `owner_id`, `freesound_id`, `license`, `attribution` nếu license khác `cc0`).
   - Bất kỳ bước nào lỗi (download/transcode/upload thất bại) → **refund quota ngay trong catch block** trước khi trả lỗi cho client.
4. Thành công → `AudioAsset` mới xuất hiện ngay trong tab "Thư viện của tôi", dùng được ngay cho block/scene hiện tại và mọi chapter/story khác của cùng author — **không** tự động lên thư viện dùng chung cho author khác (xem ranh giới ở mục 2.11 và `10-out-of-scope.md`).

### 8.9.3. Ghi nguồn (Attribution)
- Cuối mỗi chapter, `AttributionFooter.tsx` duyệt qua block effects và `Scene.render_config.ambient_effects` có `audio_asset_id` trỏ tới `AudioAsset.attribution` khác `null` → hiển thị tên, link nguồn và giấy phép.
- Danh sách này **tính động lúc render**, không lưu bảng riêng — đúng nguyên tắc suy ra từ dữ liệu đã có, tương tự cách trang "Đang đọc" suy ra từ `ReadingProgress` (`02-data-schema.md` mục 2.3).
- Sound có `license: "cc0"` không cần attribution, không xuất hiện trong danh sách này.

### 8.9.4. Upload từ thiết bị
- Cùng 1 tab "Tải lên" bên cạnh "Thư viện của tôi"/"Tìm trên Freesound". Upload dùng `/api/upload/presign` → direct storage PUT → `/api/upload/complete`, tạo `AudioAsset` (`source: "upload"`, không có `license`/`attribution`).
- **Định mức chấp nhận** (áp dụng thống nhất cho mọi nơi upload audio trong dự án): định dạng `mp3`/`wav`/`ogg`, dung lượng tối đa **8 MiB**, thời lượng tối đa **5 phút** — đủ cho SFX chấm phá và nhạc nền loop ngắn, tránh phình storage free-tier cho 1 personal project (khớp tinh thần Performance NFR ở `09-non-functional-requirements.md`). Validate cả client (chặn sớm) lẫn server (nguồn tin cậy).
- Upload **không** tốn `freesound_import_quota` (quota đó chỉ áp dụng cho luồng Import từ Freesound) và **không** yêu cầu connect Freesound.

---

## 8.10. Nguồn bối cảnh cá nhân của Author — Upload ảnh/video & AI Generate Background (hiệu lực từ Phase 3)

Bổ sung nguồn cho **bước 1 "Chọn bối cảnh nền"** trong `ScenePicker.tsx` Tab 2 (US-2.8) — hiện tại chỉ chọn được `BackgroundAsset` do admin quản lý (`scope: "global"`). Từ Phase 3, bước 1 có thêm 2 tab con bên cạnh "Thư viện Preset": **"Tải lên"** (ảnh hoặc video) và **"Tạo bằng AI"**. Component: `BackgroundSourcePicker.tsx` / `AIBackgroundGeneratePanel.tsx` — vị trí file `03-file-structure.md`.

> Upload từ thiết bị tạo static image hoặc looping video; video bắt buộc poster. AI Generate vẫn chỉ tạo `BackgroundAsset.render` với `render_data.kind: "image"` và `motion: "static"`, không AI-generate video.
> Personal asset chuyển `active` ngay sau upload/AI commit thành công, không cần admin duyệt; mọi query vẫn filter đúng `owner_id`.

### 8.10.1. Tải ảnh hoặc video lên

1. Author chọn file chính. Client phân loại theo MIME/extension chỉ để phản hồi sớm; server vẫn là nguồn tin cậy, đối chiếu MIME với extension filename khai báo, tự sinh extension object rồi kiểm magic bytes và metadata khi complete.
2. Nếu là ảnh: nhận `jpg`/`png`/`webp` tối đa **5 MiB**, tạo `kind: "image"`, `motion: "static"`.
3. Nếu là video: nhận `mp4`/`webm` tối đa **50 MiB**. UI lập tức hiện field poster bắt buộc; poster nhận `jpg`/`png`/`webp` tối đa **5 MiB**. Chỉ cho upload khi đủ hai file; complete atomic theo bundle và tạo `kind: "video"`, `motion: "looping"`, `poster_frame` là URL poster. Playback luôn muted; không tin audio track của file.
4. Ảnh/poster khuyến nghị tối thiểu **1280×720** để đủ nét khi phủ full viewport ở desktop; nhỏ hơn vẫn nhận nhưng cảnh báo mờ trước khi xác nhận. UI giữ vùng preview/error ổn định, hiển thị progress cho từng part, Cancel/Retry và error gắn đúng field.
5. Upload dùng presign/direct PUT/complete của US-3.6 → tạo personal `BackgroundAsset` với owner hiện tại; client không được tự chọn object key/owner. Video và poster dùng hai immutable key trong cùng server upload intent; thiếu/hỏng một part thì không tạo asset.
6. Giới hạn **10 personal video upload đã complete và chưa physical-cleanup cho mỗi author**. Pending intent chưa hết hạn cũng reserve slot để hai request đồng thời không vượt 10. Cancel/expired/rejected chỉ release sau best-effort delete; archive/ẩn record không tự release vì Scene snapshot có thể còn giữ URL. Admin dùng cùng giới hạn 50 MiB/video nhưng không có count limit.

Upload image/video không tốn `ai_background_quota`. Image không có count/day quota; quota 10 ở trên chỉ bảo vệ dung lượng video R2.

**Lý do chốt limit (2026-09-09):** R2 Standard có free tier 10 GB-month và Cloudflare khuyến nghị single PUT cho file nhỏ/trung bình dưới khoảng 100 MB. 50 MiB × 10 giữ trần video danh nghĩa khoảng 500 MiB/author, vẫn dùng direct single PUT, không đi qua body Vercel. Nguồn: [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [upload objects](https://developers.cloudflare.com/r2/objects/upload-objects/), [presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).

### 8.10.2. Tạo bằng AI (Cloudflare Workers AI)
Nguyên tắc: **preview trước, lưu sau** — ảnh preview chưa từng chạm storage cho tới khi author chủ động chọn.

1. Ô prompt **prefill sẵn** dựa trên `Story.genre` + `mood_tag` của block/scene đang soạn (build ngay ở client từ dữ liệu editor đã có sẵn, không cần gọi server) — author sửa tự do trước khi tạo, không bắt đầu từ ô trống.
2. Bấm "Tạo ảnh" → `POST /api/ai/background/sessions`:
   - xác minh owner Story/Chapter, validate prompt;
   - `quota-service.reserve(userId, "ai_background")`; hết quota trả `reset_at`, không gọi provider;
   - tạo `AiBackgroundGenerationSession` có hai seed, expiry ngắn và không chứa image bytes.
3. Client gọi tuần tự/giới hạn concurrency `POST /api/ai/background/sessions/[id]/variants/0` và `/1`:
   - server enrich prompt rồi gọi `ImageGenerationProvider` đúng một inference cho variant;
   - normalize/cap encoded response dưới ngưỡng an toàn; lưu hash của bytes vào session, **không** lưu preview vào R2/DB;
   - chống gọi lặp cùng index và chỉ trả một preview mỗi response.
4. Khi đủ hai hash, session chuyển `ready` và commit quota. Author thấy đúng hai ảnh cạnh nhau, mỗi ảnh có nút "Dùng ảnh này".
5. Bấm "Dùng ảnh này" → `POST /api/ai/background/sessions/[id]/commit { selected_index, image_bytes }`:
   - verify owner/expiry/index/hash và idempotency;
   - chỉ lúc này upload ảnh chọn lên R2, tạo personal `BackgroundAsset` static/image với `generation_prompt` = prompt gốc;
   - ảnh còn lại không chạm storage; commit không trừ quota lần hai.
6. Lỗi hệ thống/provider khiến không thể đủ hai preview → mark failed và refund. Session bị bỏ dở được cleanup theo policy: chưa gọi provider thì refund; đã phát sinh provider cost thì expire/commit quota để tránh abuse.
7. `ai_background_quota.limit` là số lượt, mỗi lượt = đúng hai preview. Con số cụ thể chốt sau benchmark model/cost.

> **Payload constraint:** Vercel Function giới hạn request và response 4.5 MB. Không trả hai base64 image trong một response. Mỗi variant/commit phải cap encoded body (target dưới 4.0 MB) và có test boundary. Chỉ được đơn giản hóa thành một response nếu spike đo được worst-case/p95 an toàn và quyết định được ghi lại.

---
← Về `00-INDEX.md` | Trước: `07-user-stories-phase3.md` | Tiếp theo: `09-non-functional-requirements.md`
