# 07 — User Stories & Acceptance Criteria — PHASE 3 (Production Refactor)

> Xem `00-INDEX.md` để biết thứ tự ưu tiên và điều hướng. Phase 3 **không còn optional** — coi là lộ trình chính thức. Trước khi implement bất kỳ US-3.x nào, đọc đầy đủ `11-phase3-technical-roadmap.md` (chi tiết kỹ thuật, Prisma schema, thứ tự các bước).
>
> Nguyên tắc: refactor dần theo **strangler pattern**, không viết lại từ đầu. Thứ tự dưới đây là thứ tự nên làm nếu triển khai từng phần theo thời gian rảnh.

---

**US-3.1 — Repository pattern hoàn chỉnh (thực chất đã bắt đầu từ Phase 1)**
> Là developer, tôi muốn lớp UI không biết dữ liệu đến từ JSON hay DB.
- [ ] `StoryRepository` interface đã tồn tại từ Phase 1 (`03-file-structure.md` mục 3.1) — Phase 3 chỉ cần thêm `PrismaStoryRepository` implement cùng interface
- [ ] Swap implementation ở `lib/repositories/index.ts` — không sửa bất kỳ component nào

**US-3.2 — Database & migrate dữ liệu**
> Là developer, tôi muốn chuyển dữ liệu truyện từ JSON sang Postgres mà không mất dữ liệu.
- [ ] Setup Prisma + Postgres (Neon/Supabase), schema theo `11-phase3-technical-roadmap.md` mục 9.4
- [ ] Viết script migrate `/content/stories/*.json` → DB, verify số lượng block/effect khớp trước/sau

**US-3.3 — Authentication**
> Là tác giả, tôi cần đăng nhập để chỉnh sửa truyện của mình; là người đọc, tôi vẫn đọc được không cần đăng nhập.
- [ ] Auth.js với OAuth (Google/GitHub)
- [ ] Đọc truyện **không** yêu cầu đăng nhập
- [ ] Chỉ yêu cầu đăng nhập khi vào các trang `/author/**` (dashboard, tạo/sửa truyện, editor nội dung chương) hoặc muốn đồng bộ tiến trình đọc đa thiết bị

**US-3.4 — Settings/Progress đồng bộ qua DB**
> Là người đọc đã đăng nhập, tôi muốn tiến trình đọc đồng bộ trên nhiều thiết bị.
- [ ] Nếu chưa login → vẫn dùng localStorage như cũ (không đổi hành vi)
- [ ] Nếu đã login → đọc/ghi DB (`ReadingProgress`, `UserSettings`), đồng thời cache vào localStorage giảm round-trip

**US-3.5 — Phân quyền**
> Là admin, tôi muốn chỉ tác giả sở hữu hoặc admin mới sửa được 1 truyện.
- [ ] Role `reader` / `author` / `admin` trong bảng `User`
- [ ] Proxy/middleware chỉ redirect sớm; mọi Route Handler/DAL tự kiểm session + role rank + ownership + Story/Chapter membership gần data source trước mutation

**US-3.6 — Media storage thật**
> Là tác giả, tôi muốn upload cover/audio/video nền thay vì phải tự thêm file vào `/public`.
- [ ] Server cấp object key/purpose/limit; file lớn upload trực tiếp R2/Supabase bằng presigned URL ngắn hạn rồi complete endpoint verify object. Không proxy video/ảnh lớn qua Vercel Function 4.5 MB
- [ ] Replace media luôn tạo immutable object key mới; DB archive/delete không tự xóa object còn nằm trong Scene snapshot

**US-3.7 — API chuẩn hóa**
> Là developer, tôi muốn mọi API đều validate input/output nhất quán.
- [ ] Toàn bộ Route Handler dùng Zod, format response/error nhất quán

**US-3.8 — Testing & CI/CD**
> Là developer, tôi muốn yên tâm khi refactor không phá vỡ chức năng cũ.
- [ ] Unit test cho `lib/repositories`, `lib/services` (logic thuần, không cần test UI)
- [ ] GitHub Actions: lint + type-check + test khi push
- [ ] Deploy: Vercel (app) + Neon/Supabase (DB)

**US-3.9 — Hiệu ứng nâng cao (tùy chọn)**
> Là người đọc, tôi muốn trải nghiệm hiệu ứng phức tạp hơn nếu cần (particle dày đặc, depth-based parallax).
- [ ] Chỉ implement khi có effect cụ thể không thể làm bằng CSS/Canvas 2D
- [ ] `three.js` + `@react-three/fiber`, cô lập trong `/components/effects/visual/webgl/`

**US-3.10 — Preset thư viện hiệu ứng cá nhân (tùy chọn)**
> Là tác giả, tôi muốn lưu tổ hợp effect hay dùng thành preset.
- [ ] Lưu preset trong DB (bảng riêng hoặc field JSON trên `User`), áp dụng nhanh vào block từ `EffectPicker`

**US-3.11 — Admin kiểm duyệt truyện**
> Là admin, tôi muốn duyệt hoặc từ chối truyện trước khi nó hiển thị công khai.
- [ ] Trang `/admin/stories` liệt kê truyện theo `status`, ưu tiên hiện `pending_review` lên đầu
- [ ] Admin xem chi tiết → bấm "Duyệt" (status → `published`, set `reviewed_at`/`reviewed_by`) hoặc "Từ chối" (status → `rejected`, bắt buộc nhập `rejection_reason`)
- [ ] Tác giả thấy được trạng thái + lý do từ chối (nếu có) trong trang quản lý truyện của họ, có thể sửa và gửi lại (`rejected` → `pending_review`)
- [ ] Đúng vòng đời trạng thái mô tả ở `02-data-schema.md` mục 2.7

**US-3.12 — Admin quản lý thư viện effect**
> Là admin, tôi muốn bật/tắt effect và chỉnh dictionary từ khóa gợi ý mà không cần sửa code.
- [ ] Technical manifest trong code là nguồn chân lý cho ID/category/icon/default slider/renderer/allowed scope; DB chỉ lưu admin overlay (`label`, `description`, `is_active`) và keyword (`02-data-schema.md` mục 2.6)
- [ ] Trang `/admin/effects` có search/filter category/status, desktop table và mobile cards; drawer chi tiết chỉ cho sửa `label`, `description`, `is_active`
- [ ] Keyword được thêm/sửa/xóa ngay trong drawer; `weight` là integer 1..100, unique theo `(effect_id, normalized_keyword)` sau NFKC/lowercase/trim/collapse whitespace
- [ ] Preview dùng renderer thật và hỗ trợ reduced motion; đóng drawer khi dirty phải xác nhận
- [ ] Effect có `is_active = false` sẽ **không** hiện trong `EffectPicker` (Phase 2) và không được gợi ý tự động, nhưng effect đã gắn sẵn vào block cũ vẫn tiếp tục hoạt động bình thường ở Reader (không hồi tố)
- [ ] Editor aggregate load catalog/dictionary một lần; không request suggestion dictionary theo từng block
- [ ] Manifest sync idempotent và test chứng minh tập ID giữa `EffectType`, manifest, registry khớp nhau; DB có technical ID lạ phải fail/report
- [ ] Admin **không** tạo EffectType, đổi technical ID/category/icon/renderer, chỉnh default slider hoặc per-picker visibility

**US-3.13 — Admin quản lý thư viện Scene**
> Là admin, tôi muốn quản lý global Background/Palette và curated ScenePreset catalog mà không làm thay đổi Scene đã lưu. Xem `02-data-schema.md` mục 2.9 và `08-effects-and-scenes.md` mục 8.3 → 8.5.
- [ ] Trang `/admin/scene-library` có 3 tab: **Backgrounds**, **Palettes**, **Scene Presets** (`08-effects-and-scenes.md` mục 8.5)
- [ ] Tab Backgrounds chỉ query `scope: "global"`; add/edit/Preview/archive image/video, typed gradient hoặc registered particle composition. Looping bắt buộc poster; raw CSS/particle JSON bị từ chối
- [ ] Tab Palettes add/edit/Preview/archive bốn kênh màu; `background_tint` gồm color + opacity và Preview trên sample Reader frame
- [ ] Ba loại catalog có lifecycle `draft | active | archived`; Author picker chỉ thấy `active`. “Remove” mặc định archive; hard delete chỉ khi `activated_at = null`
- [ ] Tab Scene Presets là curated catalog, **không có builder và không có Create**. Preset mới do developer seed/import; admin chỉ Preview, sửa label/description/mood tags/thumbnail/status và remove khỏi catalog
- [ ] Custom ScenePicker và curated preset đều tạo cùng `SceneRenderConfig`; `Scene.render_config` là deep snapshot. Reader không resolve background/palette ID và không fetch toàn bộ Scene library
- [ ] Scene snapshot chỉ chứa effect được manifest cho phép ở scope `scene`, tối đa một ambient audio loop và không trùng EffectType
- [ ] Replace media tạo immutable object key mới. Archive/xóa record catalog không xóa media còn nằm trong Scene snapshot; cleanup storage là quy trình riêng
- [ ] ConfirmModal mô tả dependency/impact, nói rõ item không còn dùng cho lựa chọn mới nhưng Scene đã lưu vẫn giữ nguyên; Preset có thể hiện số Scene lưu provenance
- [ ] Personal Background của author không xuất hiện trong admin response/UI; không tạo global AudioAsset library thứ tư
- [ ] Responsive 375px, keyboard/focus trap/error summary/44px target/WCAG AA/reduced motion đạt checklist mục 8.4 của `04b-page-layouts.md`

**US-3.14 — Navbar & Profile Modal theo trạng thái đăng nhập**
> Là người dùng, tôi muốn navbar phản ánh đúng trạng thái đăng nhập và vai trò của mình. Chi tiết luồng ở `12-auth-and-author-management.md` mục 12.1 → 12.3, wireframe ở `04b-page-layouts.md` mục 6.
- [ ] Guest thấy nút "Đăng nhập" (Auth.js OAuth); đọc truyện vẫn không yêu cầu đăng nhập (không đổi hành vi US-3.3)
- [ ] Đã login, `role === "reader"`: navbar hiện nút "✍️ Viết truyện" dẫn `/author/stories/new`
- [ ] Đã login, `role >= "author"`: nút navbar đổi thành "📚 Truyện của tôi" dẫn `/author`
- [ ] Click Avatar mở `ProfileModal` (không phải nút chính) — hiện avatar/tên/email, badge role (ẩn nếu `role === "reader"`), Theme Switcher, menu điều hướng theo role (`role >= author` → "Truyện của tôi"; `role === admin` → "Trang quản trị"), Đăng xuất

**US-3.15 — Trở thành Author gắn liền với tạo truyện đầu tiên**
> Là reader, khi tôi tạo thành công truyện đầu tiên, tôi tự động trở thành author mà không cần bước xin duyệt riêng. Chi tiết ở mục 12.2.
- [ ] Role chỉ đổi `reader → author` khi record `Story` đã lưu thành công trong DB (cùng transaction với việc tạo `Story`), không đổi khi mới vào trang wizard hoặc khi lưu thất bại
- [ ] Không có nút "Trở thành tác giả" độc lập không gắn với hành động tạo truyện thật
- [ ] Sau khi nâng role, navbar/`ProfileModal` cập nhật ngay ở lần render tiếp theo (không cần logout/login lại)

**US-3.16 — Author Dashboard (`/author`)**
> Là author, tôi muốn xem và quản lý tất cả truyện của mình ở một nơi. Chi tiết ở mục 12.4, wireframe `04b-page-layouts.md` mục 7.1.
- [ ] Trang `/author` chỉ vào được khi `role >= author`; `reader` bị chặn (redirect hoặc thông báo)
- [ ] Liệt kê truyện có `authorId === session.user.id` qua `StoryRepository.getAllForAuthor(authorId)` (`11-phase3-technical-roadmap.md` mục 9.2), có tabs lọc theo `StoryStatus` (Tất cả/Nháp/Chờ duyệt/Đã xuất bản/Bị từ chối/Lưu trữ)
- [ ] Mỗi `StoryManageCard` hiện: cover, badge status đúng màu, số chương `published`/tổng, và menu hành động đúng theo trạng thái (mục 12.7.5)
- [ ] Nút "+ Tạo truyện mới" dẫn `/author/stories/new`
- [ ] Empty state có CTA "+ Tạo truyện đầu tiên" khi chưa có truyện nào

**US-3.17 — Tạo & sửa truyện (wizard 2 bước + trang edit + publish/unpublish chương)**
> Là author, tôi muốn tạo truyện mới qua giao diện wizard rõ ràng, sửa lại thông tin/chương bất cứ lúc nào, và kiểm soát chương nào hiển thị công khai độc lập với trạng thái duyệt của cả truyện. Chi tiết đầy đủ ở mục 12.5 → 12.7, wireframe `04b-page-layouts.md` mục 7.2 → 7.3.
- [ ] `/author/stories/new`: Bước 1 (`title`, `description`, `cover_image` upload, `genre` ≥ 1) → Bước 2 (thêm/sắp xếp/xóa chương, chỉ nhập `title`) → nút "Lưu" chỉ enable khi đủ 4 field Bước 1 và ≥ 1 chương có `title`
- [ ] Lưu thành công tạo `Story` (`status: "draft"`) + `Chapter[]` (`status: "draft"` mỗi chương) trong 1 transaction, redirect `/author/stories/[storyId]`
- [ ] `/author/stories/[storyId]`: chỉ chủ sở hữu hoặc admin vào được (qua `layout.tsx` guard dùng chung, `03-file-structure.md`); hiện banner trạng thái + `rejection_reason` nếu có; sửa lại thông tin truyện và danh sách chương dùng chung component với wizard nhưng gộp 1 trang (không chia bước, không cần Next/Back)
- [ ] Mỗi chương trong trang quản lý có: nút "Sửa nội dung" (→ `/author/stories/[storyId]/[chapterId]`), toggle publish/unpublish riêng (`Chapter.status`, `02-data-schema.md` mục 2.1)
- [ ] Toggle unpublish bị chặn (kèm tooltip giải thích) nếu đó là chương `published` cuối cùng của 1 `Story.status === "published"`
- [ ] Không cho xóa chương nếu chỉ còn đúng 1 chương trong truyện
- [ ] Nút "Gửi duyệt" (`draft`/`rejected` → `pending_review`) chỉ enable khi: đủ 4 field Bước 1, ≥ 1 chương, và ≥ 1 chương có `blocks.length > 0`
- [ ] Khi admin duyệt truyện (US-3.11, `→ published`): toàn bộ `Chapter` của truyện tự động `status → "published"`, ghi đè trạng thái toggle trước đó
- [ ] Trang reader chỉ hiển thị 1 chương khi đồng thời `Story.status === "published"` VÀ `Chapter.status === "published"` (công thức đầy đủ mục 12.7.4)

**US-3.18 — Tìm & import sound từ Freesound vào thư viện cá nhân**
> Là tác giả, tôi muốn tìm và nghe thử sound từ Freesound ngay trong Editor, rồi import vào thư viện của riêng mình để dùng cho block/scene. Chi tiết đầy đủ ở `08-effects-and-scenes.md` mục 8.9.
- [ ] Tab "Tìm trên Freesound" trong `SoundSourcePicker.tsx` (dùng chung ở `EffectPicker` tab Âm Thanh và `ScenePicker` bước 4) cho search + preview **không cần connect Freesound, không trừ `freesound_import_quota`**
- [ ] Search có debounce, server cache kết quả ngắn hạn và rate-limit theo author để giữ headroom dưới giới hạn upstream Freesound
- [ ] Nút "Dùng sound này" disable kèm dòng lý do + CTA "Kết nối Freesound" nếu projection client-safe `AppUser.freesound_connection.connected !== true`
- [ ] Khi đã connect: bấm "Dùng sound này" → server `reserve` quota trước, tự refresh access token nếu hết hạn, gọi `audio-import-service` (download → chuẩn hoá định dạng phát được → upload R2/Supabase → tạo `AudioAsset`)
- [ ] Import lỗi ở bất kỳ bước nào → `refund` quota đã reserve, hiện lỗi rõ ràng cho author
- [ ] `AudioAsset` sau import xuất hiện ngay trong tab "Thư viện của tôi", tái sử dụng được ở mọi block/scene/chapter/story khác của cùng author, **không** tự động xuất hiện với author khác
- [ ] Sound có license yêu cầu attribution (khác `cc0`) hiển thị đầy đủ ở mục "Nguồn âm thanh" cuối chapter đang dùng sound đó (`AttributionFooter.tsx`)
- [ ] Tab "Tải lên" trong cùng `SoundSourcePicker.tsx` cho phép upload file từ thiết bị (mp3/wav/ogg, tối đa 8MB, tối đa 5 phút), tạo `AudioAsset` không cần connect/không trừ quota

**US-3.19 — Upload ảnh / tạo bối cảnh bằng AI cho Scene**
> Là tác giả, tôi muốn tải ảnh từ thiết bị hoặc tạo ảnh bối cảnh bằng AI ngay trong `ScenePicker`, dùng cho Scene của riêng mình. Chi tiết đầy đủ ở `08-effects-and-scenes.md` mục 8.10.
- [ ] Bước 1 "Backgrounds" của `ScenePicker.tsx` Tab 2 có thêm tab con "Tải ảnh lên" (jpg/png/webp, tối đa 5MB) tạo personal `BackgroundAsset` `status: "active"` cho đúng owner
- [ ] Tab con "Tạo bằng AI" (`AIBackgroundGeneratePanel.tsx`): ô prompt prefill sẵn từ `Story.genre` + `mood_tag` của block/scene đang soạn, author sửa tự do trước khi tạo
- [ ] Bấm "Tạo ảnh" → server reserve quota và tạo generation session có 2 seed/expiry, không lưu image bytes; client lấy variant 0 và 1 bằng hai request riêng, mỗi request gọi một inference và trả một preview dưới encoded-size cap
- [ ] Chỉ lưu hash/status trong generation session; đúng 2 preview đều **không ghi storage**. Lỗi hệ thống khiến không thể đủ cặp thì refund; session bỏ dở xử lý theo policy chống quota abuse ở `08-effects-and-scenes.md` mục 8.10.2
- [ ] Author bấm "Dùng ảnh này" → gửi selected index + bytes; server verify owner/expiry/hash rồi mới ghi đúng ảnh chọn vào R2/Supabase và tạo personal `BackgroundAsset` static/image với prompt gốc. Ảnh còn lại không chạm storage, không trừ quota lần hai
- [ ] Request/response preview và commit có encoded-size cap/test 413; không trả hai base64 trong một Vercel Function response (giới hạn 4.5 MB)
- [ ] Hết quota ngày → nút "Tạo ảnh" disable kèm thời điểm reset, không gọi Cloudflare
- [ ] `BackgroundAsset` cá nhân (`scope: "personal"`) không hiện trong `/admin/scene-library` và không dùng để ghép `ScenePreset` dùng chung

---

## Definition of Done — Phase 3

Không bắt buộc hoàn thành mọi US-3.x cùng lúc — làm theo thứ tự ưu tiên ở `11-phase3-technical-roadmap.md` mục 9.7. Coi là "xong Phase 3 cơ bản" khi hoàn thành US-3.1 → US-3.5 (Repository → DB → Auth → Settings sync → Phân quyền), tức là hệ thống chạy được multi-user thật với dữ liệu bền vững. US-3.14 → US-3.17 (Navbar/Auth UI, trở thành author, Author Dashboard, wizard tạo/sửa truyện) nên làm **ngay sau** nhóm cơ bản và **trước** US-3.11 (kiểm duyệt) — vì admin không có gì để duyệt nếu chưa có luồng để author tạo truyện qua UI thật (Phase 1–2 chỉ seed JSON thủ công). Sau đó tới US-3.11 (kiểm duyệt), US-3.12 (quản lý effect) và US-3.13 (quản lý Scene library) — đây là các chức năng admin cốt lõi theo yêu cầu, không thuộc nhóm "tùy chọn" như US-3.9/3.10. US-3.18 (Freesound) và US-3.19 (AI Background) chỉ cần Auth + quota cá nhân (không phụ thuộc US-3.11 → 3.13), nên có thể làm bất kỳ lúc nào sau US-3.5 (phân quyền) — không thuộc nhóm "tùy chọn", nhưng cũng không chặn đường các US khác nếu tạm hoãn.

---
← Về `00-INDEX.md` | Trước: `06-user-stories-phase2.md` | Tiếp theo: `08-effects-and-scenes.md` (xem thêm mục 8.5 cho US-3.13)
