# 11 — Chi Tiết Kỹ Thuật: Lộ Trình Refactor Lên Production (Phase 3)

> Xem `00-INDEX.md` để biết thứ tự ưu tiên và điều hướng. Đọc kèm `07-user-stories-phase3.md` (acceptance criteria tương ứng từng bước) và `02-data-schema.md` (TypeScript domain model mà Prisma schema dưới đây map tới).

---

## 9.1. Vì sao chọn Next.js full-stack thay vì tách backend riêng

Đây vẫn là personal project. **Next.js Route Handlers + Prisma** đủ dùng, tránh over-engineering. Chỉ cân nhắc tách backend riêng nếu phát sinh nhu cầu thực sự (nhiều client khác nhau dùng chung API, team lớn hơn).

## 9.2. Bước 1 — Repository pattern (đã bắt buộc từ Phase 1, không phải chờ tới Phase 3)

```typescript
// lib/repositories/story-repository.ts
export interface PublicChapterReaderData {
  story: Pick<Story, "id" | "title">;
  chapter: Chapter;
  scenes: Scene[]; // chỉ Scene thuộc đúng chapter; mỗi Scene đã có render_config snapshot
  previousChapterId: string | null;
  nextChapterId: string | null;
  isLastChapter: boolean;
}

export interface StoryRepository {
  // ─── Nhóm "public" — dùng ở trang công khai: Trang chủ (US-1.1), /stories/[storyId], Reader ───
  getAllPublic(): Promise<Story[]>;
  // Phase 1–2: trả toàn bộ (mọi Story đều status "published" theo mục 2.7). Phase 3: CHỈ trả Story.status === "published".
  getPublicById(storyId: string): Promise<Story | null>;
  // Phase 1–2: hành vi như getById (chưa có gì để lọc).
  // Phase 3: trả null nếu Story.status !== "published"; nếu có, `chapters` trả về đã được lọc chỉ còn Chapter.status === "published"
  //   — đúng công thức "12-auth-and-author-management.md" mục 12.7.4. KHÔNG được để page tự lọc lại lần nữa.

  // Phase 3: read-model chuyên biệt cho /stories/[storyId]/[chapterId].
  getPublicChapter(
    storyId: string,
    chapterId: string
  ): Promise<PublicChapterReaderData | null>;

  // ─── Nhóm "full" — dùng ở trang quản lý của author/admin: /author/stories/[storyId], [chapterId] editor, /admin/stories ───
  getById(storyId: string): Promise<Story | null>;
  // LUÔN trả đầy đủ, KHÔNG lọc theo status dưới bất kỳ hình thức nào — author bắt buộc phải thấy được
  //   chương đang "draft" của chính mình để sửa, admin phải thấy truyện "pending_review" để duyệt.
  getAllForAuthor(authorId: string): Promise<Story[]>;
  // Phase 3 only (chưa có `authorId` thật ở Phase 1–2) — toàn bộ truyện của 1 author bất kể status, dùng cho `/author` dashboard (mục 12.4)

  // Legacy Phase 1–2 adapter only. Phase-3 Route Handler không được gọi generic save(story).
  save(story: Story): Promise<void>;
}

// lib/repositories/json-story-repository.ts
export class JsonStoryRepository implements StoryRepository { /* Phase 1–2; public methods fail-closed theo status đã seed. Khi bắt đầu Bước 4 Phase 3, implement thêm getPublicChapter() làm bridge trước khi swap sang Prisma. */ }

// lib/repositories/prisma-story-repository.ts (viết ở Phase 3)
export class PrismaStoryRepository implements StoryRepository { /* triển khai đúng phần lọc status ở nhóm "public" như mô tả trên */ }

// Phase 3 mutation boundary: method hẹp + actor/context, transaction ở service.
export interface CommandResult<T> { data: T; meta: { updatedAt: string } }

export interface StoryCommandService {
  createStoryWithChapters(input: CreateStoryWithChaptersCommand): Promise<CommandResult<Story>>;
  updateStoryMetadata(input: UpdateStoryMetadataCommand): Promise<CommandResult<Story>>;
  replaceChapterContent(input: ReplaceChapterContentCommand): Promise<CommandResult<Chapter>>;
  submitForReview(input: SubmitStoryCommand): Promise<CommandResult<Story>>;
  cancelReview(input: StoryCommandContext): Promise<CommandResult<Story>>;
  archiveStory(input: StoryCommandContext): Promise<CommandResult<Story>>;
  restoreStory(input: StoryCommandContext): Promise<CommandResult<Story>>;
  setChapterPublication(input: SetChapterPublicationCommand): Promise<CommandResult<Chapter>>;
}

export interface ChapterCommandService {
  createChapter(input: CreateChapterCommand): Promise<CommandResult<Chapter>>;
  updateChapterMetadata(input: UpdateChapterMetadataCommand): Promise<CommandResult<Chapter>>;
  reorderChapters(input: ReorderChaptersCommand): Promise<CommandResult<Chapter[]>>;
  deleteChapter(input: DeleteChapterCommand): Promise<CommandResult<null>>;
}
```

Trong HTTP/domain boundary, `storyId` luôn là slug công khai (`Story.id` trong TypeScript), không phải khóa chính Prisma. `PrismaStoryRepository` resolve slug sang `Story.id` nội bộ gần data source; route param và DTO không được expose hoặc chấp nhận khóa chính này thay cho slug.

Public byline cũng tách khỏi ownership: repository map Prisma
`Story.authorDisplayName → Story.author`; `authorId` chỉ phục vụ
`getAllForAuthor`/DAL/authz và không được dùng thay byline. Legacy migration backfill
byline từ JSON thay vì suy từ `User.name`. Command tạo Story mới nhận `byline?: string`
cạnh `metadata` và `chapters`; resolve theo `12-auth-and-author-management.md` mục 12.5
với tên actor lấy từ DB trong transaction, ghi snapshot không rỗng vào `authorDisplayName`.
Không dùng email làm fallback public; các command cập nhật không tính lại byline từ profile.

### 9.2.1. Lộ trình tách read-model cho trang đọc chương

- **Phase 1–2:** `/stories/[storyId]/[chapterId]/page.tsx` tiếp tục dùng `getPublicById(storyId)`. JSON đang lưu nguyên Story trong một file nên tách method sớm không giảm disk I/O/JSON parse đáng kể.
- **Phase 3, ngay khi có `PrismaStoryRepository`:** đổi **riêng** Reader route trên sang `getPublicChapter(storyId, chapterId)`. Trang chi tiết `/stories/[storyId]` vẫn dùng `getPublicById()`; trang home/library vẫn dùng `getAllPublic()`.
- `getPublicChapter()` phải fail-closed và trả `null` nếu Story không `published`, Chapter không `published`, Chapter không thuộc Story trong URL, hoặc bất kỳ status bắt buộc nào bị thiếu/không hợp lệ.
- `previousChapterId`/`nextChapterId` chỉ tính trên các Chapter `published`, sắp theo `order`; vì vậy navigation không bao giờ đi qua chapter draft.
- Prisma implementation phải dùng `where/select` hạn chế payload: chỉ metadata Story cần cho header, Chapter hiện tại, Scene snapshot của chapter và metadata điều hướng. Không load blocks/effects/Scene của chapter khác như `getPublicById()`.
- **Editor không bao giờ dùng method này.** `/author/stories/[storyId]/[chapterId]`, editor aggregate API và `editorService` tiếp tục dùng `getById()` + kiểm tra ownership/role, nếu không author sẽ mất khả năng mở chapter draft.
- Thực hiện theo strangler pattern: khi bắt đầu Bước 4 Phase 3, thêm method vào interface, implement cho cả JSON bridge lẫn Prisma + test trước, chuyển Reader route sau, giữ `getPublicById()` cho các consumer cũ. Không đổi return type của `getPublicById()`.

## 9.3. DB/Auth/Migration/Cutover — thứ tự an toàn

1. **Schema contract + compatibility bridge:** thêm technical Effect manifest và `SceneRenderConfig`; JSON adapter đọc legacy Scene ID rồi resolve thành snapshot. App vẫn chạy JSON.
2. **PostgreSQL + Prisma:** tạo schema/migration nhưng chưa chuyển traffic. Dùng migration command đúng môi trường, không dùng `db push` cho production.
3. **Auth.js foundation + admin bootstrap:** Auth cần DB/adapter trước; bootstrap admin bằng allowlist environment idempotent, không có public “become admin”.
4. **Data migration:** migrate Story/Chapter/Block/Effect/Scene/catalog. Legacy Scene phải resolve `background_id`/`palette_id` thành `renderConfig`; missing asset/media làm dry-run fail. Seed Effect overlay/keyword qua manifest sync.
5. **Prisma read repositories phía sau feature flag:** contract/shadow-read test JSON vs Prisma; **chưa bật DB write**.
6. **DAL + authorization + Zod + command services:** mọi mutation có session/role/ownership/chapter-story membership và state machine gần data source.
7. **Controlled cutover:** bật DB read trước, quan sát, sau đó mới bật DB write. Không coi JSON là rollback source sau khi DB nhận write; rollback khi đó dùng DB backup/PITR hoặc forward fix. Không dual-write nếu chưa có idempotency/reconciliation design.

Public Reader cutover đồng thời bỏ client fetch toàn bộ `/api/scene-library`; `getPublicChapter()` trả đúng Scene snapshot của chapter. Đây là thay đổi Reader tối thiểu nhưng bắt buộc để đạt copy-not-live.

## 9.4. Prisma schema CHỐT (map từ `types/story.ts`, `types/user.ts`, `types/bookmark.ts`, `types/effect-admin.ts`)

> Đã bao gồm: Auth.js standard models (bắt buộc khi dùng Prisma Adapter cho login), Bookmark, kiểm duyệt truyện (`StoryStatus`), trạng thái đọc (`ReadingStatus`), thư viện effect do admin quản lý. **Không** bao gồm `Rating`/`Comment` — xem lý do ở `02-data-schema.md` mục 2.8 và `10-out-of-scope.md`.

```prisma
// ─── Auth.js (NextAuth) standard models — bắt buộc khi dùng Prisma Adapter ───
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ─── User & Role ───
model User {
  id              String   @id @default(cuid())
  email           String   @unique
  emailVerified   DateTime?
  name            String?
  image           String?
  role            Role     @default(READER)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // ─── Freesound credential SERVER-ONLY (ciphertext at-rest) & quota cá nhân — mục 2.5, 2.11 ───
  freesoundAccessTokenCiphertext  String?   // không expose qua AppUser/session/API/log
  freesoundRefreshTokenCiphertext String?   // không expose qua AppUser/session/API/log
  freesoundTokenExpiresAt   DateTime?
  freesoundUsername         String?
  freesoundImportQuotaLimit Int       @default(0)
  freesoundImportQuotaUsed  Int       @default(0)
  freesoundQuotaResetAt     DateTime?
  aiBackgroundQuotaLimit    Int       @default(0)
  aiBackgroundQuotaUsed     Int       @default(0)
  aiBackgroundQuotaResetAt  DateTime?

  accounts        Account[]
  sessions        Session[]
  stories         Story[]           @relation("StoryAuthor")
  reviewedStories Story[]           @relation("StoryReviewer")
  progress        ReadingProgress[]
  bookmarks       Bookmark[]
  settings        UserSettings?
  audioAssets     AudioAsset[]
  backgroundAssets BackgroundAsset[] @relation("PersonalBackgroundAssets")
  aiGenerationSessions AiBackgroundGenerationSession[]
}

enum Role {
  READER
  AUTHOR
  ADMIN
}

// ─── Story & Kiểm duyệt (Mục 2.7) ───
model Story {
  id              String       @id @default(cuid())
  slug            String       @unique
  title           String
  authorDisplayName String      // public byline snapshot; tách khỏi authorId ownership
  description     String
  coverUrl        String?
  genre           String[]
  viewCount       Int          @default(0)
  status          StoryStatus  @default(DRAFT)
  submittedAt     DateTime?
  reviewedAt      DateTime?
  rejectionReason String?

  authorId        String
  author          User         @relation("StoryAuthor", fields: [authorId], references: [id])
  reviewedById    String?
  reviewedBy      User?        @relation("StoryReviewer", fields: [reviewedById], references: [id])

  chapters        Chapter[]
  bookmarks       Bookmark[]
  progress        ReadingProgress[]

  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}

enum StoryStatus {
  DRAFT
  PENDING_REVIEW
  PUBLISHED
  REJECTED
  ARCHIVED
}

model Chapter {
  id        String        @id @default(cuid())
  storyId   String
  story     Story         @relation(fields: [storyId], references: [id])
  title     String
  order     Int
  status    ChapterStatus @default(DRAFT)  // độc lập với Story.status, chỉ có hiệu lực reader khi Story.status = PUBLISHED — 12-auth-and-author-management.md mục 12.7.3/12.7.4
  viewCount Int           @default(0)      // dự trữ cho StoryStats, 02-data-schema.md mục 2.10 — không bắt buộc có UI ngay
  blocks    StoryBlock[]
  scenes    Scene[]       // 1 chapter có nhiều Scene, dải block không chồng lấn — xem mục 9.4b
}

enum ChapterStatus {
  DRAFT
  PUBLISHED
}

model StoryBlock {
  id        String   @id @default(cuid())
  chapterId String
  chapter   Chapter  @relation(fields: [chapterId], references: [id])
  type      String   // "paragraph" | "dialogue" | "heading"
  text      String
  moodTag   String?
  order     Int
  effects   Effect[]
}

model Effect {
  id           String      @id @default(cuid())
  blockId      String
  block        StoryBlock  @relation(fields: [blockId], references: [id])
  type         String      // khớp EffectType (Mục 2.1) / EffectDefinition.effectId (Mục 2.6)
  category     String      // "visual" | "audio" | "motion" | "transition"
  intensity    Float
  durationMs   Int
  delayMs      Int?
  audioSrc     String?
  audioAssetId String?
  audioAsset   AudioAsset? @relation(fields: [audioAssetId], references: [id], onDelete: SetNull)
  loop         Boolean     @default(false)

  @@index([audioAssetId])
}

// ─── Bookmark & Reading Progress (Mục 2.3, 2.4) — 2 trang riêng biệt "Đang đọc" / "Đã lưu" ───
model Bookmark {
  id        String   @id @default(cuid())
  userId    String
  storyId   String
  user      User     @relation(fields: [userId], references: [id])
  story     Story    @relation(fields: [storyId], references: [id])
  createdAt DateTime @default(now())

  @@unique([userId, storyId])
}

model ReadingProgress {
  id        String        @id @default(cuid())
  userId    String
  user      User          @relation(fields: [userId], references: [id])
  storyId   String
  story     Story          @relation(fields: [storyId], references: [id])
  chapterId String
  blockId   String
  status    ReadingStatus @default(READING)
  updatedAt DateTime      @updatedAt

  @@unique([userId, storyId])
}

enum ReadingStatus {
  READING
  COMPLETED
}

model UserSettings {
  id                  String   @id @default(cuid())
  userId              String   @unique
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  effectsEnabled      Boolean  @default(true)
  effectsByCategory   Json     @default("{\"visual\":true,\"audio\":true,\"motion\":true,\"transition\":true}") // parse thành Record<EffectCategory, boolean> bằng Zod
  intensityMultiplier Float    @default(1.0)
  reducedMotion       Boolean  @default(false)
  fontSize            String   @default("md")
  fontFamily          String   @default("cormorant")
  theme               String   @default("dark")
  updatedAt           DateTime @updatedAt
}

// ─── Effect Library do admin quản lý (Mục 2.6) ───
model EffectDefinition {
  effectId     String   @id  // khớp EffectType/technical manifest
  label        String
  description  String?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  keywords     EffectKeywordSuggestion[]
}

model EffectKeywordSuggestion {
  id                String           @id @default(cuid())
  keyword           String
  normalizedKeyword String
  effectId          String
  effect             EffectDefinition @relation(fields: [effectId], references: [effectId], onDelete: Cascade)
  weight            Int              @default(50) // service validate 1..100

  @@unique([effectId, normalizedKeyword])
  @@index([normalizedKeyword])
}

// ─── DỰ TRỮ — KHÔNG migrate ở Phase 3 hiện tại (xem Mục 2.8) ───
// model Rating { ... }
// model Comment { ... }
```

Quy tắc mapper bắt buộc:

- Không spread trực tiếp Prisma `User` vào session/API. Mapper `User -> AppUser` dùng allowlist, đổi casing theo `02-data-schema.md` và tuyệt đối loại các cột `*Ciphertext`/expiry nội bộ.
- `AppUser.freesound_connection.connected` chỉ là trạng thái suy ra: `true` khi credential record đầy đủ; username là metadata duy nhất được phép đi kèm. Connect/refresh/disconnect phải cập nhật toàn bộ credential fields nguyên tử để không tạo trạng thái nửa vời.
- `DailyQuota.reset_at` trong DTO luôn là ISO datetime hợp lệ. Nếu record DB cũ chưa có mốc reset, quota service phải khởi tạo/persist mốc UTC kế tiếp trước khi trả DTO, không trả `null` trái contract.

## 9.4b. Prisma schema mở rộng — Scene catalog + runtime snapshot

> Map từ contract canonical ở `02-data-schema.md` mục 2.9. Background/Palette là ingredient catalog; curated Preset và Scene đều lưu `SceneRenderConfig` snapshot. Không tạo foreign key runtime từ Scene sang Background/Palette.

```prisma
enum CatalogStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

model BackgroundAsset {
  id               String        @id @default(cuid())
  label            String
  render           Json          // BackgroundRenderSnapshot discriminated; validate bằng Zod/registry
  moodTags         String[]
  status           CatalogStatus @default(DRAFT)
  activatedAt      DateTime?     // null mới đủ điều kiện xét hard delete
  scope            String        @default("global") // global | personal
  source           String        @default("admin_upload")
  generationPrompt String?
  ownerId          String?
  owner            User?         @relation("PersonalBackgroundAssets", fields: [ownerId], references: [id], onDelete: Cascade)
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  @@index([scope, status])
  @@index([ownerId, status])
}

model ColorPalette {
  id                    String        @id @default(cuid())
  label                 String
  primary               String
  secondary             String
  accent                String
  backgroundTintColor   String
  backgroundTintOpacity Float         @default(0.35)
  moodTags              String[]
  status                CatalogStatus @default(DRAFT)
  activatedAt           DateTime?
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  @@index([status])
}

model ScenePreset {
  id             String        @id // stable ID do developer import package cung cấp
  label          String
  description    String?
  thumbnailUrl   String?
  moodTags       String[]
  status         CatalogStatus @default(DRAFT)
  activatedAt    DateTime?
  renderConfig   Json          // SceneRenderConfig schema_version=1; runtime source
  sourceVersion  Int           @default(1)
  sourceChecksum String
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  scenes         Scene[]       // provenance only

  @@index([status])
}

model Scene {
  id              String       @id @default(cuid())
  chapterId       String
  chapter         Chapter      @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  startBlockId    String
  endBlockId      String
  basedOnPresetId String?
  basedOnPreset   ScenePreset? @relation(fields: [basedOnPresetId], references: [id], onDelete: SetNull)
  renderConfig    Json         // deep snapshot; Reader không resolve catalog ID
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([chapterId])
}
```

Validation/service rules:

- `BackgroundAsset.render`/`ScenePreset.renderConfig`/`Scene.renderConfig` là JSON nhưng không phải free-form: parse bằng discriminated Zod schema và `schema_version` trước khi write/read.
- `SceneCommandService` xác minh Story–Chapter–Block membership, ownership và non-overlap trong transaction.
- `render.poster_frame` bắt buộc khi `render.motion = looping`; personal asset chỉ image/static; global admin query không bao giờ trả personal asset.
- Personal upload/AI commit service tạo `status = ACTIVE` ngay sau khi storage verify thành công; `DRAFT` mặc định chủ yếu dành cho global Admin catalog/import.
- `activatedAt` được set lần đầu khi chuyển Active và không xóa lại. “Remove” chuyển Archived; hard delete record yêu cầu `activatedAt = null`. Object storage cleanup vẫn cần reference audit riêng.
- Media key bất biến; DB delete và object cleanup là hai operation tách biệt.
- Migration legacy resolve `background_id`/`palette_id`/`effects` thành snapshot. Missing ID/media/checksum làm verify fail, không âm thầm fallback.

## 9.4c. Prisma schema mở rộng — Personal Media Assets (Freesound Audio & AI Background, xem `08-effects-and-scenes.md` mục 8.9 → 8.10)

> Map từ `types/audio-asset.ts` (`02-data-schema.md` mục 2.11) và phần mở rộng `scope`/`ownerId`/`source`/`generationPrompt` trên `BackgroundAsset` ở mục 9.4b. Toàn bộ asset ở đây là **cá nhân** (`ownerId` bắt buộc), tách biệt hoàn toàn khỏi 4 bảng thư viện global ở mục 9.4/9.4b.

```prisma
model AudioAsset {
  id            String   @id @default(cuid())
  ownerId       String
  owner         User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  source        String   // "freesound" | "upload"
  title         String
  url           String   // luôn trỏ về file đã lưu ở R2/Supabase — KHÔNG bao giờ trỏ thẳng domain Freesound
  durationMs    Int
  freesoundId   String?  // chỉ có khi source = "freesound", tránh import trùng
  license       String?  // "cc0" | "cc-by" | "cc-by-nc" ...
  attributionAuthorName  String?
  attributionSourceUrl   String?
  attributionLicenseName String?
  createdAt     DateTime @default(now())
  usedByEffects Effect[]

  @@unique([ownerId, freesoundId])
  @@index([ownerId, createdAt])
}

model AiBackgroundGenerationSession {
  id             String   @id @default(cuid())
  ownerId        String
  owner          User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  originalPrompt String
  seedA          Int
  seedB          Int
  hashA          String?
  hashB          String?
  status         String   // reserved | partial | ready | committed | failed | expired
  expiresAt      DateTime
  createdAt      DateTime @default(now())
  committedAt    DateTime?

  @@index([ownerId, status])
  @@index([expiresAt])
}
```
> `Effect.audioSrc` (mục 9.4) không đổi shape — khi author chọn từ `AudioAsset`, giá trị `AudioAsset.url` được **copy** vào `Effect.audioSrc` lúc lưu block/scene (đúng nguyên tắc "copy, không tham chiếu sống" ở `08-effects-and-scenes.md` mục 8.3). `Effect.audioAssetId` chỉ phục vụ attribution/đánh dấu "đã dùng" trong `SoundSourcePicker`; quan hệ dùng `onDelete: SetNull` và tuyệt đối không resolve lại `audioSrc` lúc runtime.

Command lưu effect phải xác minh `AudioAsset.ownerId` thuộc đúng author/admin actor trước khi chấp nhận `audioAssetId`; không được cho phép tham chiếu asset cá nhân của user khác dù client đã gửi một `audioSrc` hợp lệ.

`AiBackgroundGenerationSession` chỉ lưu metadata/hash, không lưu preview bytes. Mỗi variant được generate/trả ở request riêng để giữ request/response dưới giới hạn 4.5 MB của Vercel; server cap encoded body và chống generate lặp cùng index. Commit chỉ chấp nhận bytes có hash khớp session/owner/expiry.

## 9.5. Auth, Settings sync, Phân quyền

- **Auth.js:** cấu hình OAuth (Google/GitHub) sau Prisma foundation. Đọc truyện không bắt buộc đăng nhập.
- **Authorization thực:** DAL/service/Route Handler gọi `requireSession`, role rank, owner/admin guard và `requireChapterInStory`. Proxy/middleware chỉ redirect sớm, không phải security boundary.
- **Mutation:** Zod + command service method hẹp; kiểm state/concurrency trong transaction. Không gọi generic repository `save()` trực tiếp từ route.
- **P3-06 DAL/commands:** `StoryDataAccess` kiểm role/owner/membership trước full read. `PrismaStoryCommandRepository` mở rộng `PrismaStoryRepository` trong transaction; các service dùng chung `StoryCommandTransactions` với isolation `Serializable`. Actor được đọc lại từ DB, không nhận role/owner từ HTTP body.
- **Concurrency:** mọi command sửa aggregate nhận `expectedUpdatedAt` (ISO từ `meta.updatedAt` của full Story/editor read hoặc command trước). So sánh rồi conditional-update `Story.updatedAt` trong cùng transaction; mỗi mutation Chapter/Scene cũng tăng mốc Story, tối thiểu 1ms. Các thao tác trên hai chương cùng Story có thể conflict; client phải reload khi `409`. Không cần thêm version/timestamp vào Chapter. Kết quả `CommandResult<T>` chứa revision của chính transaction vừa commit, không đọc lại revision sau commit.
- **Authorization errors:** chưa đăng nhập `401`; thiếu role tối thiểu `403`; Story không tồn tại/khác owner hoặc Chapter không thuộc Story đều `404` với cùng envelope. Admin được override ownership và khóa pending-review dành cho author, nhưng vẫn tuân thủ state machine, concurrency và rule chương cuối. Truyện archived cần restore về draft trước khi sửa.
- **Editor aggregate:** `replaceEditor` nhận blocks + Scene snapshots và lưu cả hai trong một transaction. Lệnh chỉ thay blocks phải giữ Scene hiện có và kiểm range lại; nếu xóa boundary làm Scene không hợp lệ thì từ chối, không tự drop Scene. Các command giữ snapshot/provenance đã lưu dù nguồn archived; tham chiếu mới tới preset phải active, audio cá nhân phải đúng actor và URL đã lưu. Catalog lifecycle/media integration đầy đủ thuộc các stage tương ứng.
- **HTTP boundary:** routes P3-06 dùng strict Zod input/output và `{ data, meta: { updatedAt } }` / `{ error: { code, message, fieldErrors? } }`; chapter DELETE trả `data: null`. Mutation cookie-auth yêu cầu Origin khớp `AUTH_URL`. JSON body tối đa 4,000,000 bytes (đếm bytes thực từ stream); quá giới hạn `413`. Error mapper hỗ trợ `400/401/403/404/409/413/429/503`; `429` dành cho nguồn rate-limit khi được tích hợp, không thêm bộ đếm in-memory giả làm distributed rate limiter.
- **Write gate:** mặc định write flag `json` từ P3-06 nghĩa là chặn runtime content write (`503` cho command hợp lệ), không fallback ghi JSON. Cho phép `prisma` khi cả Story/Scene read flags là `prisma` và DB được cấu hình; chỉ bật trong môi trường kiểm thử đã kiểm soát trước P3-07. Production cutover, client editor snapshot/envelope và Reader transition vẫn thuộc P3-07.
- **Settings/Progress:** guest giữ localStorage; logged-in dùng DB source + local cache. First-login chỉ import local nếu DB chưa có record; nếu DB đã có thì DB thắng.

## 9.6. Storage, Admin catalog, integrations, CI/CD

- **Storage:** cover/audio/background upload qua provider service. File lớn dùng presigned PUT; server quyết định owner/purpose/key/MIME/limit. Object key immutable.
- **Effect admin:** manifest sync + DB overlay/keywords; active chỉ ảnh hưởng lựa chọn mới.
- **Scene admin:** typed Background/Palette catalog + curated Preset metadata. Preset mới đi qua developer import; không có admin builder.
- **Integrations:** Freesound và AI chạy sau Auth/authorization/storage/quota. AI dùng generation session/từng variant hoặc phương án khác chỉ sau payload spike chứng minh an toàn.
- **CI/CD:** dựng skeleton từ đầu; production gate gồm lint/typecheck/test/Prisma validate/build, migration verification, accessibility/security regression.

## 9.7. Thứ tự triển khai bắt buộc để giảm rework

1. Baseline/version/CI skeleton; pin Node 24 LTS + pnpm, một lockfile.
2. Domain/repository contract + technical manifest + Scene snapshot compatibility bridge.
3. PostgreSQL/Prisma foundation.
4. Auth.js + admin bootstrap.
5. Dry-run/apply/verify migration.
6. Prisma read repositories sau feature flag, contract/shadow tests; chưa DB write.
7. DAL/authorization/Zod/command services.
8. Controlled read cutover rồi write cutover; backup/PITR rollback.
9. Settings/progress/bookmark sync và media storage.
10. Auth/Author UI, moderation.
11. Effect Admin.
12. Background/Palette Admin.
13. Curated ScenePreset import/catalog + snapshot Reader cleanup.
14. Freesound, AI background.
15. Production hardening.

---
← Về `00-INDEX.md` | Trước: `10-out-of-scope.md` | Tiếp theo: `12-auth-and-author-management.md`
