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

export type PublicStoryListItem = Pick<
  Story,
  "id" | "title" | "author" | "description" | "cover_image" | "cover_position" | "genre"
>;

export interface PublicStoryListQuery {
  q: string;                 // raw query đã trim/collapse, "" = catalog mặc định
  genre: string | null;      // single-select exact facet; AND với q, không nhập search document
  cursor: string | null;     // opaque, chỉ hợp lệ với đúng q/genre/sort hiện tại
  limit: number;
}

export interface PublicGenreFacet {
  genre: string;             // label đã trim lấy từ Story public, đồng thời là URL value
  storyCount: number;        // đếm DISTINCT Story public; UI có thể chỉ dùng để xếp hạng
}

export interface CursorPage<T> {
  items: T[];
  total: number;
  nextCursor: string | null;
}

export interface StoryRepository {
  // ─── Nhóm "public" — dùng ở trang công khai: Trang chủ (US-1.1), /stories/[storyId], Reader ───
  // Read-model đích cho Home: luôn filter public ở DB, select card fields, search/paginate server-side.
  listPublicStories(input: PublicStoryListQuery): Promise<CursorPage<PublicStoryListItem>>;
  // Quick filters của Home; projection/aggregate genre-only, không tải Story aggregate.
  listPublicGenreFacets(limit: number): Promise<PublicGenreFacet[]>;
  // Compatibility cho library/consumer aggregate cũ; Home Phase 3 không dùng method này.
  // Phase 1–2: trả toàn bộ (mọi Story đều status "published" theo mục 2.7). Phase 3: CHỈ trả Story.status === "published".
  getAllPublic(): Promise<Story[]>;
  // Phase 1–2: hành vi như getById (chưa có gì để lọc).
  // Phase 3: trả null nếu Story.status !== "published"; nếu có, `chapters` trả về đã được lọc chỉ còn Chapter.status === "published"
  //   — đúng công thức "12-auth-and-author-management.md" mục 12.7.4. KHÔNG được để page tự lọc lại lần nữa.
  getPublicById(storyId: string): Promise<Story | null>;

  // Phase 3: read-model chuyên biệt cho /stories/[storyId]/[chapterId].
  getPublicChapter(
    storyId: string,
    chapterId: string
  ): Promise<PublicChapterReaderData | null>;

  // ─── Nhóm "full" — dùng cho editor, moderation và rule cần đọc nội dung đầy đủ ───
  getById(storyId: string): Promise<Story | null>;
  // LUÔN trả đầy đủ, KHÔNG lọc theo status dưới bất kỳ hình thức nào — author bắt buộc phải thấy được
  //   chương đang "draft" của chính mình để sửa, admin phải thấy truyện "pending_review" để duyệt.
  getAllForAuthor(authorId: string): Promise<Story[]>;
  // Phase 3 only (chưa có `authorId` thật ở Phase 1–2) — full aggregate cho consumer nội bộ
  // thật sự cần content; `/author` dashboard dùng management projection riêng (mục 12.4).

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
  updateStoryMetadata(input: UpdateStoryMetadataCommand): Promise<CommandResult<ManagedStory>>;
  replaceChapterContent(input: ReplaceChapterContentCommand): Promise<CommandResult<Chapter>>;
  submitForReview(input: SubmitStoryCommand): Promise<CommandResult<ManagedStory>>;
  cancelReview(input: StoryCommandContext): Promise<CommandResult<ManagedStory>>;
  archiveStory(input: StoryCommandContext): Promise<CommandResult<ManagedStory>>;
  restoreStory(input: StoryCommandContext): Promise<CommandResult<ManagedStory>>;
  deleteStory(input: StoryCommandContext): Promise<CommandResult<null>>;
  setChapterPublication(input: SetChapterPublicationCommand): Promise<CommandResult<ManagedChapter>>;
}

export interface ChapterCommandService {
  createChapter(input: CreateChapterCommand): Promise<CommandResult<ManagedChapter>>;
  updateChapterMetadata(input: UpdateChapterMetadataCommand): Promise<CommandResult<ManagedChapter>>;
  reorderChapters(input: ReorderChaptersCommand): Promise<CommandResult<ChapterOrder[]>>;
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

P3-10 tách read model owner/admin khỏi aggregate Editor: `ManagedStory` chỉ chứa metadata
Story và `ManagedChapter[]`; mỗi `ManagedChapter` chỉ có `id/title/order/status` cùng
`blockCount`/`effectCount`. Prisma `select` lấy count cần thiết nhưng không lấy text block,
Effect config hoặc Scene; `/author` và `GET /api/stories/[storyId]/manage` chỉ serialize
projection này xuống client. Full `Story/Chapter` vẫn dành cho Editor aggregate và các
nghiệp vụ thật sự cần nội dung.

### 9.2.1. Lộ trình tách read-model cho trang đọc chương

- **Phase 1–2:** `/stories/[storyId]/[chapterId]/page.tsx` tiếp tục dùng `getPublicById(storyId)`. JSON đang lưu nguyên Story trong một file nên tách method sớm không giảm disk I/O/JSON parse đáng kể.
- **Phase 3, ngay khi có `PrismaStoryRepository`:** đổi Reader route trên sang `getPublicChapter(storyId, chapterId)`. Trang chi tiết `/stories/[storyId]` vẫn dùng `getPublicById()`; library tạm giữ `getAllPublic()`, còn Home chuyển sang `listPublicStories()` theo §9.2.2.
- `getPublicChapter()` phải fail-closed và trả `null` nếu Story không `published`, Chapter không `published`, Chapter không thuộc Story trong URL, hoặc bất kỳ status bắt buộc nào bị thiếu/không hợp lệ.
- `previousChapterId`/`nextChapterId` chỉ tính trên các Chapter `published`, sắp theo `order`; vì vậy navigation không bao giờ đi qua chapter draft.
- Prisma implementation phải dùng `where/select` hạn chế payload: chỉ metadata Story cần cho header, Chapter hiện tại, Scene snapshot của chapter và metadata điều hướng. Không load blocks/effects/Scene của chapter khác như `getPublicById()`.
- **Editor không bao giờ dùng method này.** `/author/stories/[storyId]/[chapterId]`, editor aggregate API và `editorService` tiếp tục dùng `getById()` + kiểm tra ownership/role, nếu không author sẽ mất khả năng mở chapter draft.
- Thực hiện theo strangler pattern: khi bắt đầu Bước 4 Phase 3, thêm method vào interface, implement cho cả JSON bridge lẫn Prisma + test trước, chuyển Reader route sau, giữ `getPublicById()` cho các consumer cũ. Không đổi return type của `getPublicById()`.

### 9.2.2. Ranh giới search/list — picker local và Story server-side

**Không có một search engine dùng chung cho mọi bề mặt.** Chỉ dùng chung các primitive đúng tầng:

| Tầng | Sở hữu | Không được sở hữu |
|---|---|---|
| `SearchInput` | field/clear/focus/label/accessibility | normalize, debounce, URL, fetch, repository, lọc mảng |
| `lib/search/text-search.ts` | normalize/tokenize/build document và matcher thuần, chạy được cả client/server | React, router, DB, auth |
| Picker Effect/Scene/combobox | state tạm + lọc ngay catalog đầy đủ đã tải | URL, cursor, request theo từng phím |
| Home/Admin Story list | URL query/filter → Server Component/DAL/repository → projection phân trang | tải `Story[]` aggregate rồi `.filter()` ở client |

`SearchInput` phải nhận/passthrough tối thiểu `id`, `name`, label/`aria-labelledby`,
`disabled`, controlled `value/onChange` hoặc `defaultValue` cho GET form và clear callback.
Controller từng page sở hữu Enter, pending, IME composition và commit URL; input không có
prop `mode="local|server"`.

`normalizeSearchText()` là contract deterministic: NFD → bỏ combining marks → `đ/Đ`
thành `d` → lowercase → ký tự không phải Unicode letter/number thành một space →
trim/collapse. `buildSearchDocument(title, authorDisplayName)` ghép bản normalized có
space và alias bỏ space; vì vậy `dem giong` và `demgiong` đều match `Đêm Giông`.
Matcher hiện tại là **accent/case-insensitive AND-token substring**, không phải fuzzy,
không sửa typo, autocomplete hoặc relevance ranking. Mỗi picker gọi matcher một lần với
toàn bộ label/description/tags cần tìm để token có thể match xuyên field.

Story search dùng cùng normalization nhưng khác execution boundary:

- URL giữ raw `q` dễ đọc sau trim/collapse, tối đa **100 Unicode code point**; normalized text chỉ dùng nội bộ. `q` rỗng bị bỏ khỏi URL và nghĩa là catalog mặc định. Repeated/invalid param được Zod parser canonicalize hoặc từ chối nhất quán.
- Baseline chỉ tìm trong `title + authorDisplayName`; không tìm email, description, genre, chapter/block content. Mọi token phải xuất hiện trong `Story.searchTextNormalized`. Sort của từng bề mặt giữ nguyên và luôn có tie-breaker ổn định; search chỉ là filter, không tự thêm relevance.
- Home có thêm đúng một `genre` URL filter, lấy từ facet public và match **exact label đã trim** trong `Story.genre`; đây là filter độc lập, không ghép genre vào `q`/`searchTextNormalized`. `q + genre` kết hợp AND. “Tất cả thể loại” bỏ `genre`; clear ô tìm kiếm chỉ bỏ `q`; cả hai giữ param còn lại và xóa cursor.
- `listPublicGenreFacets(6)` chỉ aggregate `Story.status = published`, đếm DISTINCT Story cho mỗi label, bỏ label rỗng rồi sort `storyCount DESC → normalizeSearchText(genre) ASC → genre ASC`. Prisma aggregate/`unnest` ngay trong DB (raw query phải tagged/parameterized nếu Prisma không biểu diễn được); JSON bridge chỉ scan seed public, rồi dùng chung sort để contract parity. UI không bắt buộc hiện count. Đây là quick-filter động, không thêm bảng taxonomy, không suy facet từ page kết quả hiện tại và không tải full Story aggregate.
- Thay `q`, `genre`, status/filter hoặc sort phải xóa cursor. Cursor opaque và gắn với đúng query/filter/sort; không nhận lại cursor của state khác. `limit` có default theo page và cap server-side.
- Home `page.tsx` nhận `searchParams: Promise<...>`, parse `q/genre/cursor` rồi gọi `listPublicStories()` và `listPublicGenreFacets()` trực tiếp trong Server Component; không self-fetch Route Handler nội bộ. Repository áp `Story.status = published` trong chính query và chỉ trả `PublicStoryListItem` + count/cursor hoặc facet projection, không chapter/block/effect/Scene.
- Admin page gọi `StoryDataAccess` admin-only; `/api/admin/stories` nếu dùng cho client cũng gọi cùng DAL. Public và moderation có DTO, auth, status/sort/cursor riêng; tuyệt đối không nhận một cờ `scope/includeDrafts` từ client để đổi visibility.
- Home dùng GET form/Enter hoặc nút “Tìm kiếm” (không request từng phím); genre chip là link GET giữ `q`, đổi `genre` và xóa cursor. Admin toolbar live-search debounce khoảng `300ms`; Enter/Clear commit ngay, không navigate khi IME đang composition, dùng URL replace không scroll để history không chứa từng keystroke. Kết quả có loading boundary riêng.

`Story.searchTextNormalized` là cột hạ tầng, không thêm vào domain `Story` hoặc DTO.
Create/update/import/backfill đều phải gọi đúng một `buildStorySearchText()`; JSON bridge
tính khi đọc. Migration theo expand → backfill → verify không còn blank/mismatch →
`NOT NULL`, rồi mới dùng query mới. Prisma dùng predicate có tham số; không fetch toàn bộ
row để giả lập bỏ dấu.

Không dùng PostgreSQL full-text Preview hoặc `unaccent()` raw expression làm baseline vì
chúng đổi/couple semantics đang có. Trước khi thêm `pg_trgm` + GIN, ghi lại dataset,
`EXPLAIN (ANALYZE, BUFFERS)` và p95; chỉ thêm bằng customized migration khi phép đo cho
thấy substring scan là bottleneck. `pg_trgm` vẫn là đường nâng cấp lexical tương thích,
không phải điều kiện để triển khai đúng contract ban đầu.

**Seam tương lai:** chưa tạo AI provider, embedding/vector schema, job index hoặc score
trong DTO. Nếu sau này có lexical/semantic/hybrid engine, nó chỉ trả candidate ID/order ở
server; repository vẫn hydrate và áp lại public visibility hoặc admin authorization trước
khi trả kết quả. Local picker không tự chuyển sang AI/server search.

Tham chiếu implementation: [Next.js URL search/pagination](https://nextjs.org/learn/dashboard-app/adding-search-and-pagination), [`<Form>` GET navigation](https://nextjs.org/docs/app/api-reference/components/form), [Page `searchParams`](https://nextjs.org/docs/app/api-reference/file-conventions/page), [direct Server Component data access](https://nextjs.org/docs/app/guides/backend-for-frontend), [Prisma case sensitivity](https://www.prisma.io/docs/orm/v7/prisma-client/queries/case-sensitivity), [PostgreSQL `pg_trgm`](https://www.postgresql.org/docs/17/pgtrgm.html), [WAI form labels](https://www.w3.org/WAI/tutorials/forms/labels/) và [ARIA status](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22).

### 9.2.3. Home hero media và theme trước first paint

Home dùng **ba art-directed asset riêng**, không dùng một ảnh rồi `filter`/`hue-rotate`:
`home-hero-dark.png` (đêm/trăng), `home-hero-light.png` (ngày/mặt trời) và
`home-hero-sepia.png` (giấy ấm). Ba ảnh cùng `2172×724` nhưng khác ánh sáng/nội dung;
trước khi nối UI phải chuẩn hóa đúng ba tên trên theo **nội dung ảnh**, không suy từ tên tạm.

- `HomeHeroArtwork` là client leaf nằm tuyệt đối trong Hero; nội dung Hero/search/genre vẫn ở DOM phía trên. Render bằng `next/image` local, `fill`, `object-cover`, `object-position: center top`, `alt=""`; khung cha có nền semantic, kích thước content-driven + `min-height` dành sẵn, scrim trung tâm và fade đáy về `--color-background`. Không dùng raw PNG làm CSS background, không đưa ảnh vào accessibility tree và không để media nhận pointer event.
- Initial HTML có ba theme layer nhưng CSS `[data-theme]` chỉ `display` đúng layer hiện hành. Giữ native lazy loading và `fetchPriority="high"`; không gắn `preload`, `loading="eager"` hoặc legacy `priority` cho cả ba vì sẽ tranh băng thông/tải nhiều variant. Public PNG nguồn gần 5.9 MiB phải đi qua optimizer; chỉ active variant được phép nằm trên critical path.
- Khi theme đổi, layer cũ vẫn hiện; mount/hiện target ở opacity `0`, chờ `load` + `HTMLImageElement.decode()`, rồi crossfade opacity ngắn **150–220 ms**. Không animate `background-image`. Variant đã tải được giữ cache; chỉ warm variant còn lại sau active image/LCP ở idle hoặc khi mở theme control, tuần tự và bỏ qua khi Save-Data. `prefers-reduced-motion` bỏ crossfade nhưng vẫn chờ decode rồi mới swap, nên không có frame trắng/trong suốt.
- Theme SSR hiện mặc định Dark nhưng setting được resolve sau hydration. Thêm allowlist `dark|light|sepia` + presentation hint local `story_theme_hint_v1`: script nhỏ trong `<head>` đọc hint trước first paint, fallback đọc `story_reader_settings.theme` của guest cũ rồi Dark, và set `data-theme`. Hint chỉ chống FOUC, không sync DB/import và **không** là settings store thứ hai; khi sync chưa ready, `ThemeProvider` không được reset DOM về default. Khi ready, Provider dùng layout effect để áp setting authoritative; `setTheme` gọi `settingsStore` trước rồi áp DOM/hint ngay từ giá trị store chấp nhận. `settingsStore` vẫn là authority duy nhất; không đưa `next-themes` vào luồng này.
- Ảnh rộng 3:1 được coi là atmosphere: mobile được phép crop sách/núi hai cạnh để giữ safe zone giữa cho chữ; không kéo méo hoặc cố nhồi hai motif. Nếu sau này bắt buộc giữ cả hai motif ở portrait thì cần asset art-direction riêng. `sizes` phải được tính theo **chiều rộng bitmap thực sau `object-cover` và chiều cao Hero**, không mặc định `100vw` ở mobile; kiểm request `_next/image`, độ nét 375/768/1024/1440/ultrawide và không upscale vô ích quá nguồn.

Tham chiếu implementation: [Next.js Image/theme detection](https://nextjs.org/docs/app/api-reference/components/image), [`HTMLImageElement.decode()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode), [CSS background là transition rời rạc](https://developer.mozilla.org/en-US/docs/Web/CSS/background-image) và [WAI contrast trên ảnh nền](https://www.w3.org/WAI/WCAG22/Techniques/general/G18.html).

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
  mediaUploads    MediaUpload[]
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
  searchTextNormalized String   // hạ tầng search title+byline; không map vào domain/public DTO — §9.2.2
  description     String
  coverUrl        String?
  coverPositionX  Float        @default(50) // phần trăm 0..100; DB migration có CHECK range
  coverPositionY  Float        @default(50) // legacy/default = chính giữa
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
- `render.poster_frame` bắt buộc khi `render.motion = looping`; personal upload nhận image/static hoặc video/looping + poster, còn AI chỉ tạo image/static; global admin query không bao giờ trả personal asset.
- Personal upload/AI commit service tạo `status = ACTIVE` ngay sau khi storage verify thành công; `DRAFT` mặc định chủ yếu dành cho global Admin catalog/import.
- `activatedAt` được set lần đầu khi chuyển Active và không xóa lại. “Remove” chuyển Archived; hard delete record yêu cầu `activatedAt = null`. Object storage cleanup vẫn cần reference audit riêng.
- Media key bất biến; DB delete và object cleanup là hai operation tách biệt.
- Migration legacy resolve `background_id`/`palette_id`/`effects` thành snapshot. Missing ID/media/checksum làm verify fail, không âm thầm fallback.

## 9.4c. Prisma schema mở rộng — Media upload intents & Personal Media Assets (xem `08-effects-and-scenes.md` mục 8.9 → 8.10)

> Map từ `types/audio-asset.ts` (`02-data-schema.md` mục 2.11), phần mở rộng `scope`/`ownerId`/`source`/`generationPrompt` trên `BackgroundAsset` ở mục 9.4b và upload intent bền vững của P3-09. Personal asset có `ownerId` bắt buộc; upload intent cũng có owner kể cả global Admin upload để complete/cancel không thể bị user khác chiếm.

```prisma
enum MediaUploadStatus {
  PENDING
  PROCESSING
  COMPLETED
  CLAIMED
  CANCELLED
  EXPIRED
  REJECTED
}

model MediaUpload {
  id                 String            @id @default(cuid())
  ownerId            String
  owner              User              @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  purpose            String            // story_cover | personal_audio | personal_background | global_background
  mediaKind          String            // image | audio | video
  videoSlot          Int?              // 1..10 chỉ cho personal background video; giữ tới physical cleanup
  objectKey          String            @unique
  contentType        String
  expectedSize       Int
  posterObjectKey    String?           @unique
  posterContentType  String?
  posterExpectedSize Int?
  status             MediaUploadStatus @default(PENDING)
  result             Json?             // validated URL/size/dimension/duration projection; parse bằng Zod
  expiresAt          DateTime
  completedAt        DateTime?
  claimedAt          DateTime?
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt

  @@index([ownerId, status, expiresAt])
  @@index([ownerId, purpose, mediaKind, status])
  @@unique([ownerId, videoSlot])
}

model AudioAsset {
  id            String   @id @default(cuid())
  ownerId       String
  owner         User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  source        String   // "freesound" | "upload"
  title         String
  url           String   // luôn trỏ về file đã lưu ở R2 — KHÔNG bao giờ trỏ thẳng domain Freesound
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

`MediaUpload` là intent nội bộ, không phải public asset/catalog record. Presign tạo row `PENDING` trước khi trả bearer URL 10 phút; key server-generated theo `{env}/{purpose}/{owner-or-global}/{uuid}.{ext}`. PUT ký `Content-Type` và `If-None-Match: *` để URL reuse không overwrite key. `complete` conditional-transition `PENDING → PROCESSING` trước khi đọc object để không race với cancel; lỗi tạm thời/incomplete trả về `PENDING`, còn validation pass mới thành `COMPLETED`. Video bundle phải có cả primary và poster hợp lệ. Domain service P3-10/13/15/16 claim `COMPLETED → CLAIMED` cùng transaction tạo/cập nhật Story/AudioAsset/BackgroundAsset; không nhận URL tùy ý từ client.

Focal point ảnh bìa thuộc aggregate `Story`, không thuộc `MediaUpload.result`: domain/API dùng
`cover_position: { x, y }` theo phần trăm `0..100`, Prisma dùng hai cột
`coverPositionX/coverPositionY` non-null, mặc định `50` và có DB CHECK range. JSON legacy
thiếu field được đọc như `{50,50}`; Prisma projection có thể omit đúng giá trị mặc định để
giữ compatibility. Đây là metadata trình bày không phá hủy: không crop/recompress object R2.
Mọi consumer cover phải render `aspect-ratio: 16/9`, `object-fit: cover` và cùng
`object-position`, nếu không không thể bảo đảm vùng author chọn giống nhau.

Quota video Author cấp một `videoSlot` 1..10 trong transaction/serializable boundary; unique `(ownerId, videoSlot)` chặn race giữa các request `PENDING`. Slot được giữ qua `COMPLETED`/`CLAIMED` và chỉ set null sau best-effort physical delete hoặc cleanup audit cho `CANCELLED`/`EXPIRED`/`REJECTED`. Không dùng daily quota fields cho limit storage này.

## 9.5. Auth, Settings sync, Phân quyền

- **Auth.js:** cấu hình OAuth (Google/GitHub) sau Prisma foundation. Đọc truyện không bắt buộc đăng nhập.
- **Authorization thực:** DAL/service/Route Handler gọi `requireSession`, role rank, owner/admin guard và `requireChapterInStory`. Proxy/middleware chỉ redirect sớm, không phải security boundary.
- **Mutation:** Zod + command service method hẹp; kiểm state/concurrency trong transaction. Không gọi generic repository `save()` trực tiếp từ route.
- **P3-06 DAL/commands:** `StoryDataAccess` kiểm role/owner/membership trước read; Editor dùng full aggregate, còn dashboard/manage P3-10 dùng `ManagedStory` count projection nêu ở §9.2. `PrismaStoryCommandRepository` mở rộng `PrismaStoryRepository` trong transaction; các service dùng chung `StoryCommandTransactions` với isolation `Serializable`. Actor được đọc lại từ DB, không nhận role/owner từ HTTP body.
- **P3-10 cover metadata:** create/update nhận optional `metadata.cover_position` đã strict-validate `0..100`. Create thiếu vị trí dùng `{50,50}`. Update không gửi vị trí thì giữ vị trí cũ; ngoại lệ khi có `coverUploadId` mới mà thiếu vị trí là reset về giữa để không mang crop của ảnh cũ sang ảnh mới. Chỉ đổi vị trí không cần upload/claim lại; đổi URL + vị trí vẫn commit/rollback cùng transaction và aggregate revision.
- **P3-10 chapter insertion:** `POST /api/stories/[storyId]/chapters` nhận optional `afterChapterId`. Command kiểm anchor thuộc chính Story rồi create + normalize order trong cùng transaction/revision; anchor ngoài Story trả `404`. Client không append rồi gọi reorder bằng request thứ hai.
- **P3-10 chapter reorder:** command bắt buộc nhận đúng một lần toàn bộ chapter ID hiện tại của Story, kiểm duplicate/membership bằng `Set`, rồi ghi order bằng một batch statement có tham số trong cùng transaction/revision thay vì tuần tự N lệnh `update`. Create-at-gap, delete và reorder trực tiếp dùng chung primitive normalize này. Response strict chỉ là `ChapterOrder[]` (`{ id, order }`), không đọc/serialize lại block/effect payload; client merge order vào `ManagedChapter` đang có.
- **Concurrency:** mọi command sửa aggregate nhận `expectedUpdatedAt` (ISO từ `meta.updatedAt` của full Story/editor read hoặc command trước). So sánh rồi conditional-update `Story.updatedAt` trong cùng transaction; mỗi mutation Chapter/Scene cũng tăng mốc Story, tối thiểu 1ms. Các thao tác trên hai chương cùng Story có thể conflict; client phải reload khi `409`. Không cần thêm version/timestamp vào Chapter. Kết quả `CommandResult<T>` chứa revision của chính transaction vừa commit, không đọc lại revision sau commit.
- **Authorization errors:** chưa đăng nhập `401`; thiếu role tối thiểu `403`; Story không tồn tại/khác owner hoặc Chapter không thuộc Story đều `404` với cùng envelope. Admin được override ownership và khóa pending-review dành cho author, nhưng vẫn tuân thủ state machine, concurrency và rule chương cuối. Truyện archived cần restore về draft trước khi sửa.
- **P3-11A public discovery:** thêm `listPublicStories()` + `PublicStoryListItem`, `listPublicGenreFacets()`, normalized search field/backfill và Home URL `q/genre` theo §9.2.2; thêm Hero media/theme paint boundary theo §9.2.3. Home không còn tải aggregate bằng `getAllPublic()`; library chưa đổi trong stage này.
- **P3-11B moderation reads:** `StoryDataAccess` thêm admin-only projections: queue summary/counts (`q/status/cursor`) dùng text contract §9.2.2 nhưng auth/status/sort riêng, detail có author email + chapter/effect counts, và full single-chapter preview. List/detail không serialize block/effect/Scene payload; preview mới đọc full aggregate và reuse Reader renderer nhưng tuyệt đối không gọi/nới public repository. Mọi response dùng envelope chuẩn; detail/preview xác minh Story–Chapter membership và trả `meta.updatedAt`.
- **P3-11 moderation commands:** `POST /api/admin/stories/[storyId]/approve|reject` gọi `StoryModerationService`, đọc lại actor role và kiểm `pending_review` + `expectedUpdatedAt` trong transaction Serializable. Approve ghi review metadata, clear reason và publish Story + mọi Chapter; reject trim/validate reason `5..2000` rồi ghi review metadata + status/reason. `409` buộc client reload, không auto-retry; không nhận status/reviewer/timestamp/chapter IDs từ client.
- **Editor aggregate:** `replaceEditor` nhận blocks + Scene snapshots và lưu cả hai trong một transaction. Lệnh chỉ thay blocks phải giữ Scene hiện có và kiểm range lại; nếu xóa boundary làm Scene không hợp lệ thì từ chối, không tự drop Scene. Các command giữ snapshot/provenance đã lưu dù nguồn archived; tham chiếu mới tới preset phải active, audio cá nhân phải đúng actor và URL đã lưu. Catalog lifecycle/media integration đầy đủ thuộc các stage tương ứng.
- **HTTP boundary:** routes P3-06 dùng strict Zod input/output và `{ data, meta: { updatedAt } }` / `{ error: { code, message, fieldErrors? } }`; chapter DELETE trả `data: null`. Mutation cookie-auth yêu cầu Origin khớp `AUTH_URL`. JSON body tối đa 4,000,000 bytes (đếm bytes thực từ stream); quá giới hạn `413`. Error mapper hỗ trợ `400/401/403/404/409/413/429/503`; `429` dành cho nguồn rate-limit khi được tích hợp, không thêm bộ đếm in-memory giả làm distributed rate limiter.
- **Write gate:** mặc định write flag `json` từ P3-06 nghĩa là chặn runtime content write (`503` cho command hợp lệ), không fallback ghi JSON. Cho phép `prisma` khi cả Story/Scene read flags là `prisma` và DB được cấu hình; chỉ bật trong môi trường kiểm thử đã kiểm soát trước P3-07. Production cutover, client editor snapshot/envelope và Reader transition vẫn thuộc P3-07.
- **Settings/Progress/Bookmark (P3-08, quyết định 2026-09-09):** guest giữ localStorage; logged-in dùng DB source + cache riêng theo user. Chỉ import guest một lần khi khởi tạo đồng bộ tài khoản. `UserSettings` là dấu mốc bền vững: tạo settings và import trong cùng transaction; các record DB có sẵn luôn thắng. Những lần sau DB thắng toàn bộ, kể cả danh sách rỗng; không bổ sung lại từ thiết bị khác. Không tự tạo `UserSettings` bằng server defaults trước bootstrap: client gửi settings đã tính `prefers-reduced-motion` nếu chưa có override; DB settings hiện hữu giữ nguyên.
- **Theme paint hint:** `story_theme_hint_v1` chỉ cache enum theme cuối trên browser để root bootstrap áp `data-theme` trước first paint (§9.2.3). Nó không tham gia guest import, account cache, conflict resolution hay API/DB; `settingsStore` vẫn là authority. Khi identity sync chưa ready, Provider giữ paint hint thay vì ghi đè bằng default Dark; sau khi ready, setting guest/DB thắng và cập nhật lại hint. Account switch có thể tạm dùng hint gần nhất rồi được sync sửa, không đổi root request thành session/DB theme lookup chỉ để triệt edge case này.
- **Sync isolation/concurrency:** cache tài khoản không trở thành guest data khi logout/switch. Sau bootstrap thành công, client tiêu thụ guest snapshot đã gửi (chỉ xóa giá trị chưa thay đổi), không tái import snapshot đó vào tài khoản kế tiếp. API lấy actor từ session; `expectedUserId` chỉ kiểm session chưa đổi. `UserSettings.updatedAt` là revision chung cho settings/progress/bookmark; transaction Serializable và conditional-update trả `409` khi stale. Client tải lại DB, không tự phát lại stale mutation. Bookmark ghi trạng thái mong muốn (lưu/bỏ lưu), không toggle phía server. Cache chỉ lưu kết quả DB đã xác nhận; lỗi mạng không được thông báo là đã đồng bộ.
- **Resume compatibility:** tài khoản dùng `ReadingProgress` DB làm nguồn vị trí; `ResumeReading` chỉ là projection/cache tương thích, không có bảng riêng và không được ưu tiên hơn DB. Trước khi trả sync snapshot, đối chiếu Story/Chapter public qua `StoryRepository`: xóa target đã mất public, block đã mất fallback đầu chapter; bookmark không tạo link tới Story không public. Không dùng content write flag để chặn dữ liệu đọc cá nhân.

## 9.6. Storage, Admin catalog, integrations, CI/CD

- **Storage:** cover/audio/background upload qua `MediaStorageProvider`, R2 Standard là implementation mặc định. File lớn dùng conditional presigned PUT 10 phút; server quyết định owner/purpose/key/MIME/limit. Object key immutable; public read dùng custom domain. Image/poster 5 MiB, audio 8 MiB/5 phút, background video 50 MiB dùng chung Admin/Author; Author video có poster và trần 10 intent complete/chưa cleanup.
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
