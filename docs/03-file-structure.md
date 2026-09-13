# 03 — File/Folder Structure

> Xem `00-INDEX.md` cho thứ tự ưu tiên & điều hướng. Dùng khi tạo file/thư mục mới hoặc cần biết code nên đặt ở đâu.
>
> **Quy ước đường dẫn:** codebase hiện dùng `src/`. Mọi path `/app`, `/components`, `/lib`, `/services`, `/types` bên dưới được hiểu là `/src/app`, `/src/components`, `/src/lib`, `/src/services`, `/src/types`; `/content`, `/public`, `/prisma`, `/scripts`, `/docs`, `/.codex` nằm ở project root.
>
> Cây dưới đây gồm cả file hiện có và vị trí dự kiến theo phase, không phải inventory. Trước khi tạo/move file, dùng `rg --files src` để tìm implementation thật (editor đã chia các thư mục `blocks/`, `effects/`, `scenes/`, `timeline/`). Trạng thái đã triển khai xem `docs/verification/`; không tạo lại file chỉ vì tên/vị trí trong sơ đồ khác code.

---

## 3.1. Cấu trúc áp dụng từ Phase 1 & 2 (bắt buộc — kể cả trước khi có DB)

```
/app
  /page.tsx                        → Home Server Component; Phase 3 parse `q/genre/cursor`, gọi public list/facet repository trực tiếp và ghép Hero + grid, không self-fetch API
  /stories/[storyId]/page.tsx      → Trang chi tiết truyện (mục lục chương, resume modal)
  /stories/[storyId]/[chapterId]/page.tsx  → Reader screen (màn hình đọc chính)
  /author
    /page.tsx                      → (Phase 3) Author Dashboard — danh sách truyện của tôi, xem `12-auth-and-author-management.md` mục 12.4
    /stories
      /new/page.tsx                → (Phase 3) Wizard tạo truyện mới 2 bước, mục 12.5
      /[storyId]
        layout.tsx                 → (Phase 3) Fetch `Story` 1 lần + verify quyền sở hữu (`authorId === session.user.id` hoặc `admin`) — dùng chung cho 2 trang con bên dưới, tránh lặp code kiểm tra quyền. Xem `12-auth-and-author-management.md` mục 12.6
        page.tsx                   → (Phase 3) Quản lý truyện: sửa thông tin + danh sách chương. Mục 12.6
        [chapterId]/page.tsx       → (Phase 2) Content editor — soạn block/effect/scene của 1 chương. Route trước đây là `/editor/[storyId]/[chapterId]`, đổi tên ngay từ Phase 2 để không phải move file khi lên Phase 3 (strangler pattern, `01-tech-stack.md` mục 1.3). Ở Phase 2 chưa có `layout.tsx` guard (chưa có auth thật), Phase 3 mới thừa hưởng guard ở trên
  /library/reading/page.tsx        → Danh sách truyện đang đọc dở
  /library/bookmarks/page.tsx      → Danh sách truyện đã đánh dấu lưu
  /layout.tsx                      → Root Layout (tải font Google, Theme Provider)
  /globals.css                     → Tailwind base + design tokens + custom keyframes

/components
  /ui                              → AppHeader, Popconfirm, Modal, Button dùng chung
    SearchInput.tsx                → field trình bày controlled/uncontrolled + label/clear/focus; không chứa matcher, debounce, URL hay fetch
    ConfirmModal.tsx               → global `useConfirm`, dialog z-[100] dùng chung Reader/Author/Admin
    ThemeBootstrapScript.tsx       → script trước first paint chỉ áp theme presentation hint đã allowlist; không đọc/ghi settings thay `settingsStore`
    ThemeSwitcher.tsx              → UI theme dùng `settingsStore`, Admin reuse thay vì tạo state riêng
    StoryStatusBadge.tsx           → vị trí shared đích của Author `StatusBadge`; Author/Admin dùng chung khi P3-11 nối UI
    AuthMenu.tsx                   → (Phase 3) Nút "Đăng nhập" (guest) hoặc nút context-aware "Viết truyện"/"Truyện của tôi" (logged-in) — 12-auth-and-author-management.md mục 12.1
    ProfileModal.tsx               → (Phase 3) avatar/tên/email, badge role, Theme Switcher, menu điều hướng theo role, Đăng xuất — mục 12.3
    IntegrationsSection.tsx        → boundary trong `ProfileModal`; P3-10 chưa render action, P3-15 nối trạng thái Freesound + Kết nối/Ngắt kết nối — `12-auth-and-author-management.md` mục 12.9
  /story                           → StoryCard/StoryCardVisual nhận shape tương thích `PublicStoryListItem`, không bắt full Story aggregate; thêm StoryCoverImage, StoryDetailActions, ChapterList
    StorySearchForm.tsx            → Home GET form (`q`) + submit/clear/pending; không filter dữ liệu ở client
  /home
    HomeHero.tsx                   → bố cục Hero/search/genre trong safe zone; Story grid vẫn là section riêng
    HomeHeroArtwork.tsx            → client leaf cho 3 `next/image` theme layer, load/decode/crossfade/reduced-motion theo `11` §9.2.3
    HomeGenreFilters.tsx           → quick-filter link `genre`, giữ `q` và reset cursor; nhận facet public từ server
  /library                         → ReadingListClient, BookmarksListClient
  /author (Phase 3)
    AuthorDashboard.tsx            → Danh sách StoryManageCard + tabs lọc StoryStatus — mục 12.4
    StoryManageCard.tsx            → Card 1 truyện: cover, badge status, số chương published/tổng, menu hành động — mục 12.4, 12.7.5
    StoryForm.tsx                  → Form thông tin cơ bản (title/description/cover upload/genre), thêm byline khi tạo theo mục 12.5 — dùng chung cho wizard (Bước 1) và trang quản lý truyện — mục 12.5, 12.6
    LiveStoryCardPreview.tsx       → projection trực quan, không tương tác, của StoryForm lên surface StoryCard dùng chung; create Bước 1 và section metadata edit — mục 12.5, 12.6
    storyPreview.ts                → mapper thuần từ StoryFormValue sang dữ liệu hiển thị StoryCard, gồm placeholder và cover persisted/local
    ChapterListManager.tsx         → Thêm/xóa/sắp xếp chương; ở trang quản lý truyện có thêm nút "Sửa nội dung" (→ `/author/stories/[storyId]/[chapterId]`) và toggle publish/unpublish từng chương — mục 12.5, 12.6, 12.7.3
    PublishStoryButton.tsx         → Nút "Gửi duyệt" (draft/rejected → pending_review), disable + tooltip lý do khi chưa đủ điều kiện — mục 12.7.2
    types.ts                       → state/props chỉ dùng trong Author UI; DTO quản lý dùng trực tiếp từ `/types/story-management.ts`, không re-export qua feature
  /reader
    ReaderPane.tsx                 → Container chính, quản lý Intersection Observer & Scrollytelling
    ReaderScreenHeader.tsx         → Header mini sticky trên màn hình đọc
    StoryBlock.tsx                 → Render 1 block text (Text-First z-20) + trigger effect khi vào viewport
    SettingsPanel.tsx              → Bảng điều khiển cài đặt đọc (Theme, Font, Cỡ chữ, Effect toggles)
    ProgressBar.tsx                → Thanh tiến độ cuộn trang (fixed top-0, z-50 trên Reader header)
    ChapterNav.tsx                 → Điều hướng chuyển chương trước/sau
    ResumeReadingModal.tsx         → Modal gợi ý tiếp tục chương đang đọc dở
    AttributionFooter.tsx          → (Phase 3) Cuối mỗi chapter, liệt kê "Nguồn âm thanh" — tính động từ AudioAsset.attribution của các sound đang dùng trong chương, không lưu bảng riêng — `08-effects-and-scenes.md` mục 8.9.3
  /effects
    EffectLayer.tsx                → Wrapper, nhận EffectConfig[] và render đúng component effect (z-[5])
    visual/                        → ParticleRain, LightningFlash, Sunbeam, CandleFlicker, BgColorShift... (z-[5])
    audio/
      AudioEffectPlayer.tsx        → Wrap Howler.js cho âm thanh từng block
    EffectRegistry.ts              → Map EffectType → component tương ứng
  /editor (Phase 2 — component soạn nội dung 1 chương, dùng ở route `/author/stories/[storyId]/[chapterId]`)
    EditorClient.tsx               → Điều phối trung tâm màn hình soạn thảo 3 cột
    ScenePanel.tsx                 → Cột 1: Quản lý bối cảnh (thu gọn/mở rộng, mini badges, chọn dải)
    BlockEditor.tsx                → Cột 2: Soạn thảo block, kéo thả HTML5 RAF, gợi ý từ khóa onBlur
    Timeline.tsx                   → Cột 3: Timeline toàn cảnh, Scene ribbon, jump cuộn mượt
    PreviewToggle.tsx              → Bộ gạt chế độ Soạn thảo / Xem trước
    EffectPicker.tsx               → Modal cấu hình effect z-[80] + Live Preview portal z-[90]. Tab "Âm Thanh" nhúng `SoundSourcePicker.tsx` (Phase 3) — mục 8.9
    ScenePicker.tsx                → Modal phối bối cảnh z-[80] + Full Live Preview overlay z-[90]. Tab 2 bước 1 nhúng `BackgroundSourcePicker.tsx`, bước 4 nhúng `SoundSourcePicker.tsx` (Phase 3) — mục 8.9, 8.10
    SoundSourcePicker.tsx          → (Phase 3) Sub-panel chọn nguồn âm thanh, dùng chung ở `EffectPicker` (tab Âm Thanh) & `ScenePicker` (bước 4): 3 tab con "Thư viện của tôi" / "Tải lên" / "Tìm trên Freesound" — `08-effects-and-scenes.md` mục 8.9
    FreesoundSearchPanel.tsx       → (Phase 3) Ô tìm kiếm debounce + danh sách kết quả + preview phát trực tiếp + nút "Dùng sound này" (disable kèm CTA connect nếu chưa liên kết Freesound) — mục 8.9.1, 8.9.2
    BackgroundSourcePicker.tsx     → (Phase 3) Sub-panel chọn nguồn bối cảnh ở bước 1 `ScenePicker` Tab 2: 3 tab con "Thư viện Preset" (global) / "Tải lên" (ảnh hoặc video + poster bắt buộc) / "Tạo bằng AI" — mục 8.10
    AIBackgroundGeneratePanel.tsx  → (Phase 3) Ô prompt prefill sẵn theo genre/mood (editable), nút "Tạo ảnh", hiển thị đúng 2 ảnh preview kèm nút "Dùng ảnh này" từng ảnh, hiển thị số lượt còn lại/ngày — mục 8.10.2
  /scenes                          → Render tầng bối cảnh (Phase 2)
    SceneLayer.tsx                 → Wrapper bối cảnh, 3-tier color grading, Howler audio ambient (z-0)
    SceneBackground.tsx            → Render BackgroundAsset (image/gradient/particle_composition/video)
    SceneAmbientAudio.tsx          → Wrap Howler.js cho nhạc nền bối cảnh (loop nền êm dịu)

/content
  /stories/*.json                  → Dữ liệu truyện (Phase 1–2). Ở Phase 3 dùng làm seed data / migrate nguồn
  /scene-library/*.json            → (Phase 2) Seed tĩnh cho BackgroundAsset/ColorPalette/ScenePreset — xem `08-effects-and-scenes.md` mục 8.6. Ở Phase 3 dùng làm seed data / migrate nguồn tương tự /stories

/lib
  /repositories                    → THÊM MỚI ngay từ Phase 1, xem `11-phase3-technical-roadmap.md` mục 9.2
    story-repository.ts            → StoryRepository; Phase 3 thêm `getPublicChapter()` (§9.2.1), `listPublicStories()` và `listPublicGenreFacets()` (§9.2.2)
    json-story-repository.ts       → implementation dùng file JSON (Phase 1–2)
    prisma-story-repository.ts     → implementation dùng Prisma (thêm ở Phase 3, chưa tạo ở Phase 1)
    scene-repository.ts            → (Phase 2) interface SceneLibraryRepository + SceneRepository — xem `08-effects-and-scenes.md` mục 8.7
    json-scene-repository.ts       → (Phase 2) implementation dùng /content/scene-library/*.json
    prisma-scene-repository.ts     → implementation dùng Prisma (thêm ở Phase 3, chưa tạo ở Phase 2)
    index.ts                       → nơi chọn implementation đang active
  /search
    text-search.ts                 → pure normalize/tokenize/build document + local matcher; không import React/router/DB
  /theme
    theme-presentation.ts          → `ThemeId` allowlist + `story_theme_hint_v1`/DOM helper; chỉ presentation cache, authority vẫn là `settingsStore`
  effectSuggestion.ts               → (Phase 2) Gợi ý effect theo từ khóa trong text
  /reader
    publicReadingTarget.ts          → validate ResumeReading/ReadingProgress với public chapters; stale chapter bị bỏ, stale block fallback về đầu chapter
  settingsStore.ts                  → Interface trừu tượng cho ReaderSettings/ReadingProgress, Phase 1–2 implement bằng localStorage

/types
  story.ts
  story-search.ts                  → `PublicStoryListItem`, `PublicGenreFacet`, parsed `q/genre/cursor/limit` và `CursorPage`; không chứa Prisma/provider fields
  story-management.ts              → DTO gọn cho dashboard/quản lý Story + Chapter, dùng chung giữa server và Author UI
  story-moderation.ts              → admin-only queue/count/detail/chapter summary DTO; block-effect counts tách Scene, full content chỉ thuộc preview DAL
  settings.ts
  user.ts                          → định nghĩa trước, dùng thật từ Phase 3
  scene.ts                         → (Phase 2) BackgroundAsset, ColorPalette, ScenePreset, Scene — xem `08-effects-and-scenes.md` mục 8.3

/public
  /audio/*
  /covers/*
  /home-background-image/          → static decorative Home UI; không phải Scene `BackgroundAsset`, R2 upload hay Admin catalog
    home-hero-dark.png             → artwork đêm/trăng cho Dark
    home-hero-light.png            → artwork ngày/mặt trời cho Light
    home-hero-sepia.png            → artwork giấy ấm cho Sepia; ba tên phải map theo nội dung trước khi nối UI
  /scene-backgrounds/*             → (Phase 2) ảnh/video minh họa dùng cho BackgroundAsset (type "image"/"video"), trước khi có upload thật ở Phase 3

/.codex
  TASK.md                          → Quản lý trạng thái và tiến độ task tạm thời của AI assistant (xem `AGENTS.md`)

/docs
  00-INDEX.md                      → Điểm bắt đầu bắt buộc, điều hướng & thứ tự ưu tiên
  01-tech-stack.md                 → Stack công nghệ & ràng buộc kỹ thuật
  02-data-schema.md                → TypeScript domain model & data schema
  03-file-structure.md             → File này — cấu trúc thư mục & quy tắc đặt file
  ...                              → Các tài liệu còn lại theo 00-INDEX.md

/.agents/skills/ui-ux-pro-max/     → skill thiết kế (nằm ở workspace root `../.agents/`), xem `04-ui-ux-design.md`
```

## 3.2. Bổ sung ở Phase 3

```
/lib
  /effects
    effect-manifest.ts            → technical source: id/category/icon/defaults/allowed scopes; Reader dùng trực tiếp
    effect-catalog-service.ts     → merge technical manifest + admin DB overlay cho Author/Admin projection
  /repositories
    prisma-story-repository.ts     → implement StoryRepository bằng Prisma
    prisma-story-command-repository.ts → extension transaction-scoped của PrismaStoryRepository, persistence cho commands P3-06
    prisma-scene-repository.ts     → query Scene bằng cả storyId + chapterId; trả render_config snapshot
    effect-admin-repository.ts       → P3-05 read contract cho EffectDefinition overlay + keyword; P3-12 mở rộng mutation có guard
    prisma-effect-admin-repository.ts → Prisma implementation; không chứa renderer/defaults
    prisma-scene-catalog-repository.ts → global Background/Palette/curated Preset, filter lifecycle/scope
    prisma-background-asset-repository.ts → personal BackgroundAsset theo owner (mục 8.10)
    prisma-audio-asset-repository.ts      → implement AudioAssetRepository (mục 8.9) — `08-effects-and-scenes.md` mục 8.7
  /integrations/freesound
    client.ts                                → APIv2 search/download client; server-only app token
    oauth.ts                                 → authorization-code + refresh flow, tự refresh access token khi hết hạn
    mapper.ts                                → map Freesound metadata → AudioAsset draft (license/attribution)
  /integrations/ai-image
    provider.ts                    → interface `ImageGenerationProvider` (trừu tượng nhà cung cấp, cùng triết lý Repository pattern)
    cloudflare-workers-ai-provider.ts → implementation Phase 3; mỗi inference trả 1 variant, generation session điều phối đúng 2 ảnh/lượt
    prompt-enricher.ts             → ghép prompt gốc của author + hậu tố chất lượng/an toàn cố định + gợi ý style theo genre (bảng map tĩnh riêng) — chạy phía server, author không thấy
  /services
    auth.ts                        → cấu hình Auth.js
    upload.ts                      → upload intent + validation/complete/cancel cho cover, audio, background image/video + poster
    audio-import-service.ts        → orchestrator Freesound download → chuẩn hoá định dạng phát được trên browser → upload R2 → tạo AudioAsset — mục 8.9.2
    ai-background-service.ts       → orchestrator enrich prompt → gọi provider → trả preview tạm (chưa ghi storage) → commit() ghi thật khi author xác nhận — mục 8.10.2
    quota-service.ts               → generic reserve()/commit()/refund() cho quota theo ngày, dùng chung cho `freesound_import_quota` & `ai_background_quota` (`02-data-schema.md` mục 2.5)
    story-command-service.ts       → mutation hẹp + transaction/ownership/state machine; Route Handler không gọi generic save(story)
    story-moderation-service.ts    → admin-only approve/reject pending Story; review metadata + Chapter publish + concurrency cùng transaction
    chapter-command-service.ts     → create/rename/reorder/delete chapter với Story–Chapter membership + ownership guard
    scene-command-service.ts       → validate range + SceneRenderConfig rồi replace chapter scenes atomically
    prisma-story-command-service.ts / prisma-chapter-command-service.ts / prisma-scene-command-service.ts → implementations P3-06
    story-command-context.ts       → transaction + authorization + conditional revision update dùng chung
    story-dal.ts                   → full Story/editor read và moderation summary/detail/preview projections có quyền + revision trong cùng snapshot DB
    admin-effect-service.ts        → role guard, overlay/keyword mutation, manifest sync/read projection
    admin-scene-catalog-service.ts → lifecycle/dependency/media rules cho Background/Palette/Preset
    scene-preset-import-service.ts → validate/upsert curated SceneRenderConfig; không overwrite metadata admin ngoài cờ explicit
  /storage
    media-storage-provider.ts      → interface server-only cho presign/head/range/delete; không để Route/UI gọi SDK R2 trực tiếp
    r2-media-storage-provider.ts   → R2 S3 implementation; conditional presigned PUT, public custom-domain URL
    runtime-media-storage.ts       → ghép R2 provider + Prisma upload-intent store; thiếu cấu hình trả lỗi 503 an toàn
  /scenes
    scene-render-config.ts         → schema/version/mappers; resolve custom/preset thành runtime snapshot
    particle-composition-registry.ts → key + Zod schema + renderer cho particle composition được phép
  /validation
    story-command-schema.ts        → strict Zod DTO, command/result schemas và byline policy P3-06
    story-search-schema.ts         → parse/cap/canonicalize `q/genre/cursor/limit` cho public list; semantics ở `11` §9.2.2
    story-moderation-schema.ts     → q/status/cursor + approve/reject DTO; reason trim 5..2000 và expectedUpdatedAt
    story-schema.ts                → Zod schema cho API input/output
    audio-asset-schema.ts          → Zod schema cho upload/import audio (định dạng, dung lượng — `08-effects-and-scenes.md` mục 8.9.4)
    background-asset-schema.ts     → Zod schema cho upload/generate background (định dạng, dung lượng, prompt — mục 8.10)
    effect-admin-schema.ts         → label/description/active + keyword/weight 1..100/Unicode normalization
    scene-catalog-schema.ts        → discriminated Background, Palette tint opacity, lifecycle, preset metadata
    scene-render-config-schema.ts  → `schema_version: 1`, ambient scope/unique/audio constraints

/app/api
  /stories/route.ts                → GET danh sách quản lý của author hiện tại + POST createStoryWithChapters; đều protected. Home public đọc repository trực tiếp, không overload route này
  /stories/[storyId]/route.ts      → GET/PUT metadata qua StoryCommandService; PUT nhận optional `coverUploadId` khi replace và giữ cover cũ nếu thiếu; chapter batch qua ChapterCommandService trong cùng application transaction (mục 12.6) / DELETE draft hoặc archived có state guard
  /stories/[storyId]/submit-review/route.ts  → POST, đổi status draft/rejected → pending_review, validate điều kiện mục 12.7.2
  /stories/[storyId]/manage/route.ts → GET full owner/admin Story + meta.updatedAt (P3-06)
  /stories/[storyId]/cancel-review/route.ts → POST pending_review → draft (P3-06)
  /stories/[storyId]/archive/route.ts → POST published → archived (P3-06)
  /stories/[storyId]/restore/route.ts → POST archived → draft (P3-06)
  /stories/[storyId]/chapters/route.ts → POST tạo Chapter draft (P3-06)
  /stories/[storyId]/chapters/reorder/route.ts → PATCH danh sách chapterIds đầy đủ (P3-06)
  /stories/[storyId]/chapters/[chapterId]/route.ts       → PUT nội dung block/effect / PATCH title / DELETE (P3-06)
  /stories/[storyId]/chapters/[chapterId]/publish/route.ts  → PATCH toggle Chapter.status draft/published, validate rule "giữ ≥1 chương published" — mục 12.7.3
  /stories/[storyId]/chapters/[chapterId]/editor/route.ts → GET/PUT snapshot aggregate Chapter + Scenes; PUT nhận blocks/scenes/expectedUpdatedAt (P3-06)
  /stories/[storyId]/chapters/[chapterId]/scenes/route.ts → PUT replace Scene snapshots có membership/range validation (P3-06)
  /effect-catalog/route.ts         → GET active merged catalog + dictionary cho Author; Reader không dùng
  /scene-library/route.ts          → GET active global Background/Palette/curated Preset cho Author; Reader không dùng
  /admin/stories/route.ts          → GET moderation summary counts + paginated list/filter/search (admin only)
  /admin/stories/[storyId]/route.ts → GET moderation detail projection + revision; không trả blocks/effects của mọi chapter
  /admin/stories/[storyId]/approve/route.ts → POST pending→published + review metadata + publish mọi Chapter
  /admin/stories/[storyId]/reject/route.ts  → POST pending→rejected + trimmed reason + review metadata
  /admin/effects/route.ts          → GET merged list/filter; PATCH overlay (admin only)
  /admin/effects/[effectId]/keywords/route.ts → POST/PATCH/DELETE keyword (admin only)
  /admin/scene-library/backgrounds/route.ts → GET/POST global Background; typed validation
  /admin/scene-library/backgrounds/[id]/route.ts → PATCH/archive/hard-delete guard
  /admin/scene-library/palettes/route.ts → GET/POST Palette
  /admin/scene-library/palettes/[id]/route.ts → PATCH/archive/hard-delete guard
  /admin/scene-library/presets/route.ts → GET curated catalog; không có UI-create endpoint
  /admin/scene-library/presets/[id]/route.ts → PATCH metadata/status/archive; render_config read-only với admin
  /integrations/freesound
    /connect/route.ts              → GET, khởi tạo OAuth authorize redirect — `12-auth-and-author-management.md` mục 12.9
    /callback/route.ts             → GET, exchange code → lưu credential ciphertext server-only; AppUser chỉ nhận connection status
    /disconnect/route.ts           → POST, xoá credential ciphertext/expiry phía server
    /search/route.ts               → GET, proxy search bằng app token — cache + rate-limit, KHÔNG chạm quota — mục 8.9.1
    /import/route.ts               → POST, reserve quota → refresh token nếu cần → audio-import-service → commit/refund quota — mục 8.9.2
  /ai/background
    /sessions/route.ts             → POST, reserve quota + tạo session 2 seed/expiry, không lưu image bytes
    /sessions/[generationId]/variants/[index]/route.ts → POST, generate 1 preview, cap payload, lưu hash
    /sessions/[generationId]/commit/route.ts → POST, verify owner/expiry/hash rồi lưu đúng ảnh chọn vào R2
  /audio-assets/route.ts           → GET, thư viện AudioAsset cá nhân của author hiện tại; POST upload từ thiết bị — mục 8.9.4
  /background-assets/route.ts      → GET, thư viện BackgroundAsset cá nhân (scope personal) của author hiện tại; POST claim upload image hoặc video+poster đã complete — mục 8.10.1
  /upload/presign/route.ts         → POST, server cấp purpose-scoped immutable key + conditional signed PUT 10 phút; video trả thêm poster part
  /upload/complete/route.ts        → POST, verify toàn bộ intent/bundle metadata, magic bytes, size/dimension/duration trước khi cho domain claim URL
  /upload/[uploadId]/route.ts      → DELETE cancel pending intent đúng owner; best-effort xóa object/bundle
  /auth/[...nextauth]/route.ts

/app/admin (Phase 3)
  /layout.tsx                      → requireRole(admin) + AdminShell riêng, tuyệt đối không render AppHeader
  /loading.tsx                     → skeleton đúng shape trong admin shell
  /page.tsx                        → redirect `/admin/stories`
  /effects/page.tsx                → US-3.12, table/mobile cards + Effect detail drawer
  /scene-library/page.tsx          → US-3.13, tab state từ URL
  /stories/page.tsx                → US-3.11, kiểm duyệt truyện
  /stories/[storyId]/chapters/[chapterId]/preview/page.tsx → admin-only Reader renderer; full DAL, không public repository

/components/admin
  AdminShell.tsx                   → desktop main scroller + mobile document scroll
  AdminSidebar.tsx                 → shared nav config, desktop expanded/collapsed
  AdminMobileNav.tsx               → sticky Admin topbar + focus-trapped navigation sheet
  /stories
    ModerationStatusSummary.tsx
    ModerationFilters.tsx          → URL-backed status + live search debounce/IME-safe; đổi query/filter reset cursor, không chứa DB matcher
    StoryModerationTable.tsx
    StoryModerationCard.tsx
    StoryReviewDrawer.tsx
    RejectReasonModal.tsx
  /effects
    EffectTable.tsx
    EffectMobileCard.tsx
    EffectDetailDrawer.tsx
    EffectKeywordEditor.tsx
    EffectPreview.tsx              → reuse renderer thật, không tạo renderer admin riêng
  /scene-library
    SceneLibraryTabs.tsx
    BackgroundGrid.tsx
    BackgroundForm.tsx             → form phân nhánh theo kind
    PaletteGrid.tsx
    PaletteForm.tsx
    ScenePresetGrid.tsx
    ScenePresetMetadataDrawer.tsx  → không chứa builder
    SceneCatalogPreview.tsx        → reuse SceneLayer

/scripts
  sync-effect-manifest.ts          → idempotent seed/check DB overlay theo technical manifest
  import-curated-scene-presets.ts  → developer-only import; validate trước upsert
  verify-phase3-migration.ts       → count + snapshot/reference/media validation

/prisma
  schema.prisma                    → bao gồm mở rộng Scene System và Personal Media Assets, xem `11-phase3-technical-roadmap.md` mục 9.4b, 9.4c
  /migrations
```

**Quy tắc đặt file effect mới:** mỗi `EffectType` = 1 component riêng trong `/components/effects/visual|audio`, đăng ký vào `EffectRegistry.ts`. Không nhét nhiều effect logic vào 1 file lớn. Quy tắc này không đổi ở bất kỳ phase nào. Danh sách `EffectType` ở `02-data-schema.md` mục 2.1, thư viện effect ban đầu ở `08-effects-and-scenes.md` mục 8.2.

**Quy tắc đặt file Scene:** `/components/scenes` sở hữu shared renderer `SceneLayer`. Reader, Author Preview và Admin Preview đều reuse component này; khi hoàn tất P3-01, prop runtime của nó là `SceneRenderConfig` duy nhất. Giữ tên `SceneLayer` hiện có theo strangler pattern, không tạo thêm component renderer đồng nghĩa. Scene không có renderer riêng theo từng preset và Reader không fetch Scene library để resolve ID.

---
← Về `00-INDEX.md` | Trước: `02-data-schema.md` | Tiếp theo: `04-ui-ux-design.md` (xem thêm `08-effects-and-scenes.md` cho cấu trúc file Scene)
