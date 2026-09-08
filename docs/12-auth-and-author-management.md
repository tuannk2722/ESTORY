# 12 — Auth UI, Author Onboarding & Quản Lý Truyện (Phase 3)

> Xem `00-INDEX.md` để biết thứ tự ưu tiên và điều hướng. File này thuộc nhóm **User Stories** về mặt luồng nghiệp vụ (ưu tiên #3), nhưng có phần đụng tới **Data Schema** (`02-data-schema.md` mục 2.1, 2.10) và **Constraints** (`10-out-of-scope.md`) — khi mâu thuẫn, vẫn theo đúng thứ tự ưu tiên ở `00-INDEX.md`.
>
> File này mô tả **luồng nghiệp vụ & rule**, không lặp lại wireframe (xem `04b-page-layouts.md` mục 6–7), không lặp lại route/component (xem `03-file-structure.md`), không lặp lại acceptance criteria dạng checklist (xem `07-user-stories-phase3.md` US-3.14 → US-3.17).

---

## 12.0. Phạm vi & Phase

Toàn bộ nội dung file này thuộc **Phase 3**, vì đều cần danh tính người dùng thật (`AppUser`, `Role`) và quyền sở hữu truyện (`authorId`) — những thứ **chưa tồn tại** ở Phase 1–2 (`02-data-schema.md` mục 2.5: `types/user.ts` "CHƯA dùng ở Phase 1–2"). 

**Không tự ý lùi các trang mô tả dưới đây về Phase 1–2** — nếu 1 task yêu cầu làm sớm hơn (VD: demo UI tĩnh không cần auth thật), phải hỏi lại trước khi code, vì đây là quyết định ảnh hưởng kiến trúc.

---

## 12.1. Navbar theo trạng thái đăng nhập

Khớp `AuthMenu.tsx` (`03-file-structure.md`), wireframe 2 trạng thái ở `04b-page-layouts.md` mục 6.1.

| Trạng thái | Hiển thị trên `AppHeader` |
|---|---|
| **Guest** (chưa đăng nhập) | ... [🌗 Theme]  [ Đăng nhập ] (mở OAuth Google/GitHub qua Auth.js) |
| **Logged-in, role = `reader`** | ... [🌗 Theme]  [ ✍️ Viết truyện ]  (Avatar) → mở `ProfileModal`. Nút **"✍️ Viết truyện"** (dẫn thẳng `/author/stories/new`) |
| **Logged-in, role = `author`/`admin`** | ... [🌗 Theme]  [ 📚 Truyện của tôi ]  (Avatar) → mở `ProfileModal`. Việc kết nối Freesound chỉ nằm trong `IntegrationsSection` của modal hoặc CTA theo ngữ cảnh trong picker; không thêm nút Freesound riêng trên navbar. |
| **Logged-in, role = `admin`** | Thêm mục "Quản trị" trong `ProfileModal` dẫn `/admin` (redirect `/admin/stories`); Admin shell có Stories, Effects, Scene Library theo `04b-page-layouts.md` mục 8 |

- Đọc truyện **không** yêu cầu đăng nhập (giữ nguyên US-3.3). Nút "Viết truyện"/"Truyện của tôi" chỉ hiện khi đã login.
- Nút navbar là **context-aware theo role**, không tồn tại song song 2 nút — tránh rối UI. Trang `/author` (dashboard) sẽ có nút riêng "+ Tạo truyện mới" để tạo thêm truyện tiếp theo, navbar chỉ giữ 1 điểm vào duy nhất phù hợp với trạng thái hiện tại.

---

## 12.2. Trở thành Author — luồng nâng role

**Nguyên tắc đã chốt ở `02-data-schema.md` mục 2.5, không đổi:** role tự nâng `reader → author` **ngay khi tạo truyện đầu tiên thành công**, không cần bước "xin làm tác giả" hay admin duyệt riêng.

Luồng cụ thể:
1. User (role `reader`) bấm "✍️ Viết truyện" trên navbar → vào wizard `/author/stories/new` (mục 12.5).
2. User điền xong Bước 1 + Bước 2, bấm "Lưu" → Route Handler gọi `StoryCommandService.createStoryWithChapters()` để tạo `Story` (status `draft`, `authorId` = user hiện tại, `authorDisplayName` = byline được xác định theo mục 12.5) + các `Chapter` liên quan. Không dùng email làm byline public; đổi tên profile không tự sửa hồi tố truyện đã có.
3. **Chỉ khi lưu THÀNH CÔNG** (record đã tồn tại trong DB), server-side đổi `User.role` từ `reader` → `author` trong cùng transaction. Nếu user rời trang giữa chừng mà chưa lưu → role giữ nguyên `reader`.
4. Sau khi lưu, redirect tới `/author/stories/[storyId]` (không phải `/author` dashboard) để user tiếp tục thêm nội dung ngay — dashboard chỉ cần khi có ≥ 2 truyện trở lên.
5. Từ lần sau, navbar tự hiển thị "📚 Truyện của tôi" vì `session.user.role === "author"`.

---

## 12.3. Profile Modal

Khớp `ProfileModal.tsx` (`03-file-structure.md`), wireframe ở `04b-page-layouts.md` mục 6.2. Thay thế `UserMenu` cũ (giữ nguyên phần Theme Switcher đã có, bổ sung thêm phần tài khoản).

Nội dung modal (top-down):
1. Avatar + tên + email.
2. Badge vai trò: chỉ hiện khi `role !== "reader"` (VD: "Tác giả", "Quản trị viên") — reader thường không cần thấy badge "Reader" gây rối mắt.
3. Theme Switcher (Dark/Light/Sepia) — giữ nguyên hành vi cũ.
4. `IntegrationsSection.tsx` — khối "Liên kết tài khoản": chỉ hiện khi `role >= author`. Hiện trạng thái Freesound (đã kết nối/chưa) + nút tương ứng — chi tiết luồng ở mục 12.9.
5. Menu liên kết theo role:
   - `role >= author`: "📚 Truyện của tôi" → `/author`.
   - `role === admin`: "🛠️ Trang quản trị" → `/admin`.
6. Nút "Đăng xuất".

---

## 12.4. Author Dashboard — `/author`

Wireframe ở `04b-page-layouts.md` mục 7.1. Chỉ truy cập được khi `role >= author` (middleware chặn `reader` — redirect về `/` hoặc hiện thông báo).

- Header trang: "Truyện của tôi" + nút chính "+ Tạo truyện mới" (→ `/author/stories/new`).
- Tabs lọc theo `StoryStatus`: Tất cả / Nháp (`draft`) / Chờ duyệt (`pending_review`) / Đã xuất bản (`published`) / Bị từ chối (`rejected`) / Lưu trữ (`archived`).
- Mỗi truyện hiển thị qua `StoryManageCard`:
  - Cover, title, badge `StoryStatus` (màu theo trạng thái: `draft` = xám, `pending_review` = vàng cảnh báo, `published` = xanh thành công, `rejected` = đỏ, `archived` = xám mờ).
  - Số chương: "`X`/`Y` chương đã publish" (X = chương `status: "published"`, Y = tổng số chương).
  - Nếu có dữ liệu thống kê (mục 12.8): lượt xem, số bookmark — hiện dạng số nhỏ kèm icon, ẩn nếu Phase 3 chưa build phần này.
  - Nếu `status === "rejected"`: hiện dòng lý do từ chối rút gọn (`line-clamp-1`), click card để xem đầy đủ.
  - Actions: "Sửa" (→ `/author/stories/[storyId]`), menu `⋮` chứa hành động phụ theo trạng thái (mục 12.7).
- Empty state (chưa có truyện nào): icon + "Bạn chưa có truyện nào" + CTA "+ Tạo truyện đầu tiên".

---

## 12.5. Luồng tạo truyện mới — `/author/stories/new` (wizard 2 bước)

Wireframe ở `04b-page-layouts.md` mục 7. Component chính: `StoryForm.tsx` (bước 1) + `ChapterListManager.tsx` (bước 2), điều phối bởi `EditorClient`-style state ở trang wizard (giữ state 2 bước trong 1 `useReducer`/state cục bộ, chưa ghi DB cho tới khi bấm Lưu ở cuối bước 2).

### Bước 1 — Thông tin cơ bản truyện
Field bắt buộc (không field nào được để trống khi bấm "Lưu" ở bước 2):
- `title` (text)
- `description` (textarea)
- `cover_image` (server presign purpose/key → client upload trực tiếp R2/Supabase → complete endpoint verify, dùng chung service US-3.6; hiện local preview ngay sau khi chọn file)
- `genre` (chọn ≥ 1 tag, multi-select)

Form có thêm ô `byline`, nhãn **"Tên tác giả / Bút danh hiển thị"**:

- Điền sẵn `User.name` khi khởi tạo form; tác giả được giữ nguyên hoặc nhập bút danh khác. Không tự ghi đè giá trị tác giả đang nhập khi session/profile cập nhật.
- Khi tạo truyện, server trim `byline`; nếu không gửi, rỗng hoặc chỉ có khoảng trắng thì fallback sang `User.name` đã trim của actor lấy từ DB trong transaction tạo truyện. Không tin tên profile/owner do client gửi thay cho dữ liệu này.
- Nếu cả hai đều trống, trả lỗi validation cho field `byline`: **"Vui lòng nhập tên tác giả / bút danh hiển thị."** Không tạo Story/Chapter và không nâng role khi validation thất bại.
- Lưu tên đã xác định vào `Story.authorDisplayName`; public DTO tiếp tục dùng `Story.author`. `byline` là input của command tạo truyện, không phải cột DB mới và không xác định ownership.
- Fallback profile chỉ áp dụng lúc tạo; sửa metadata hoặc gửi duyệt truyện đã tồn tại giữ tên tác giả đã lưu, không tính lại từ profile của owner/admin.

Bấm "Tiếp tục" chỉ enable khi đủ 4 field trên và có tên tác giả hợp lệ sau fallback — validate client-side ngay, server kiểm tra lại khi Lưu ở bước 2.

### Bước 2 — Thêm chương
- Danh sách chương dạng list, mỗi dòng: `order` (tự động theo vị trí), input `title`, nút xóa dòng.
- Nút "+ Thêm chương" thêm 1 dòng trống.
- Sắp xếp lại thứ tự bằng kéo-thả (tái dùng pattern HTML5 Drag & Drop đã có ở `BlockEditor.tsx`, không cần logic mới) hoặc nút mũi tên lên/xuống cho thao tác đơn giản trên mobile.
- **Ở bước này chỉ nhập `title` chương** — nội dung block/effect/scene được viết sau, trong `/author/stories/[storyId]/[chapterId]` đã có sẵn (US-2.1 → US-2.9), **không** nhồi form soạn nội dung vào wizard này.
- Chapter mới tạo mặc định `status: "draft"` (`02-data-schema.md` mục 2.1 cập nhật, xem mục 12.7 dưới).
- Yêu cầu tối thiểu **1 chương** để bấm "Lưu" (khớp yêu cầu người dùng: "mỗi bộ truyện đều bắt buộc phải có đầy đủ các field và tối thiểu 1 chương").

### Lưu (kết thúc wizard)
- Nút "Lưu" ở cuối bước 2 gọi `POST /api/stories` (route mới, xem `03-file-structure.md`); DTO gồm `metadata`, `byline` và `chapters`. Route lấy actor từ session, validate DTO rồi gọi `StoryCommandService.createStoryWithChapters()` để xác định byline và tạo `Story` (`status: "draft"`) + toàn bộ `Chapter` cùng lúc (transaction).
- Thành công → nâng role nếu cần (mục 12.2) → redirect `/author/stories/[storyId]` kèm toast xác nhận.
- Thất bại (network/validate server-side) → giữ nguyên state wizard, không mất dữ liệu đã nhập, hiện toast lỗi.

---

## 12.6. Quản lý truyện — `/author/stories/[storyId]`

- Dùng lại 2 component `StoryForm.tsx` + `ChapterListManager.tsx` của wizard, nhưng **không chia bước** — hiển thị cùng lúc trên 1 trang dài (section "Thông tin truyện" phía trên, section "Danh sách chương" phía dưới), dữ liệu prefill từ `StoryRepository.getById()` (method "full", trả cả chương `draft` — không dùng `getPublicById()` ở đây, xem `11-phase3-technical-roadmap.md` mục 9.2).
- Chỉ chủ sở hữu (`authorId === session.user.id`) hoặc `admin` mới vào được trang này — kiểm tra qua `layout.tsx` tại `/author/stories/[storyId]/` (`03-file-structure.md`, dùng chung cho cả trang này lẫn trang editor nội dung ở mục 12.9), cộng middleware chung ở tầng API theo US-3.5.
- Banner trạng thái đầu trang hiển thị `StoryStatus` hiện tại + hành động phù hợp (mục 12.7). Nếu `rejected`, hiện đầy đủ `rejection_reason`.
- Trong `ChapterListManager.tsx` ở trang này (khác wizard):
  - Mỗi chương có thêm: nút "Sửa nội dung" (→ `/author/stories/[storyId]/[chapterId]`), badge số block/effect đã có, và **toggle publish/unpublish riêng chương đó** (mục 12.7).
  - Vẫn giữ chức năng thêm/xóa/sắp xếp chương như wizard, xóa chương có nội dung phải qua `Popconfirm` (tái dùng pattern `Popconfirm` đã có ở `06-user-stories-phase2.md` US-2.1/US-2.6).
  - Không cho xóa nếu chỉ còn đúng 1 chương (đồng bộ rule "tối thiểu 1 chương" ở mục 12.5).
- Lưu thông tin truyện gọi `PUT /api/stories/[storyId]` và đi qua `StoryCommandService.updateStoryMetadata()`. Thêm/đổi tên/sắp xếp/xóa chương đi qua các method hẹp của `ChapterCommandService`; nếu UI gửi một batch từ nút "Lưu", application service điều phối các command đó trong **một transaction**. Phase-3 Route Handler tuyệt đối không gọi generic `StoryRepository.save()`.
- P3-06 cung cấp full read `GET /api/stories/[storyId]/manage` và editor aggregate GET, có `meta.updatedAt`; client gửi lại `expectedUpdatedAt` khi mutate và dùng revision mới trong response. `409` yêu cầu reload/đối chiếu, không tự gửi lại với revision mới để ghi đè. Chi tiết DAL/transaction tại `11` §9.5; tích hợp editor client thuộc P3-07, management UI thuộc P3-10.

---

## 12.7. Trạng thái truyện & chương — rule publish/unpublish

### 12.7.1. Vòng đời `Story.status` (không đổi so với `02-data-schema.md` mục 2.7)
```
draft ──(author bấm "Gửi duyệt")──▶ pending_review ──(admin duyệt)──▶ published
                                          │
                                          └──(admin từ chối)──▶ rejected ──(sửa, gửi lại)──▶ pending_review
published ──(author/admin gỡ)──▶ archived
```

### 12.7.2. Điều kiện bấm "Gửi duyệt" (`draft`/`rejected` → `pending_review`)
Nút chỉ **enable** khi:
- Đủ 4 field bắt buộc ở Bước 1 và `authorDisplayName` đã lưu không rỗng (re-validate dữ liệu hiện tại; không fallback lại tên profile khi gửi duyệt).
- Có ≥ 1 chương.
- Có ≥ 1 chương chứa **nội dung thật** (`blocks.length > 0`) — tránh gửi duyệt 1 truyện toàn chương trống. Nếu chưa đủ, hiện tooltip giải thích lý do nút bị disable thay vì ẩn nút.
- Trạng thái publish/unpublish của từng chương (mục 12.7.3) **không** là điều kiện chặn gửi duyệt — admin duyệt trên nội dung, không quan tâm chương nào author đang bật/tắt.
- Khi `Story.status === "pending_review"`, **author không được mutate nội dung** (chapter content / chapter status) để tránh race với bản admin đang xem/duyệt. Trong trường hợp này, UI của `ChapterListManager` hiển thị trạng thái read-only và cung cấp action "Hủy gửi" (để quay về `draft` và mở lại quyền mutate) thay vì nút toggle publish/unpublish.

### 12.7.3. `Chapter.status` — publish/unpublish riêng từng chương
Bổ sung field mới vào `Chapter` (`02-data-schema.md` mục 2.1, xem bản cập nhật) — độc lập với `Story.status`, theo đúng lựa chọn đã chốt:

- Mặc định `"draft"` khi chương mới được tạo (cả ở wizard lẫn khi thêm chương sau này).
- Author có thể tự toggle `draft ⇄ published` bất cứ lúc nào trong `ChapterListManager.tsx` (trang edit) — **kể cả khi `Story.status` chưa `published`**, nhưng lúc đó toggle chỉ có ý nghĩa nội bộ (đánh dấu "chương này tôi coi là xong"), **chưa hiển thị gì cho reader** vì bản thân truyện chưa public.
- **Khi admin duyệt truyện (`Story.status → published`):** toàn bộ `Chapter` của truyện đó tự động set `status = "published"`, bất kể trạng thái toggle trước đó của từng chương (khớp yêu cầu: "publish thì các chương cũng tự động được publish theo luôn").
- **Sau khi `Story.status === "published"`:** author có thể tự unpublish riêng 1 chương (VD: đang sửa lại nội dung) mà **không** ảnh hưởng `Story.status` — truyện vẫn `published`, chỉ chương đó tạm biến mất khỏi mục lục phía reader.
- **Rule bắt buộc:** không cho phép unpublish nếu đó là chương `published` **cuối cùng** của 1 `Story.status === "published"` — phải luôn giữ ≥ 1 chương hiển thị cho reader khi truyện đang public. Toggle bị chặn kèm thông báo giải thích.
- Khi `Story.status` là `draft`/`pending_review`/`rejected`/`archived`: **không hiển thị bất kỳ chương nào** cho reader dù `Chapter.status` là gì — `Chapter.status` chỉ có hiệu lực thực tế khi `Story.status === "published"` (đúng nguyên tắc "2 lớp điều kiện lồng nhau": Story cổng ngoài, Chapter cổng trong).

### 12.7.4. Reader-facing: điều kiện 1 chương thực sự hiển thị
```
hiển thị cho reader  ⟺  Story.status === "published"  AND  Chapter.status === "published"
```
Mọi trang reader-facing phải gọi nhóm public của `StoryRepository` — **không được gọi `getById()`/`getAllForAuthor()`** (các method full luôn trả cả draft, chỉ dành cho author/admin). Cụ thể:

- **Phase 1–2:** `/stories/[storyId]` và `/stories/[storyId]/[chapterId]` dùng `getPublicById()`; home/library dùng `getAllPublic()`.
- **Phase 3:** `/stories/[storyId]/[chapterId]` chuyển sang `getPublicChapter(storyId, chapterId)` theo `11-phase3-technical-roadmap.md` mục 9.2.1; `/stories/[storyId]` vẫn dùng `getPublicById()`.
- Việc kiểm tra Story/Chapter status và quan hệ Chapter thuộc đúng Story phải nằm trong Repository; page không tự lọc lại. Public boundary luôn fail-closed khi thiếu/sai status.
- `ReadingProgress`/`ResumeReading` lưu từ trước phải được đối chiếu với public chapters hiện tại trước khi tạo link. Chapter đã unpublish/xóa thì bỏ vị trí lưu; block đã xóa nhưng chapter còn public thì fallback về đầu chapter, không dẫn reader tới 404/hash hỏng.

### 12.7.5. Các hành động khác theo trạng thái (`StoryManageCard` menu `⋮`)
| `Story.status` | Hành động khả dụng |
|---|---|
| `draft` | Sửa, Gửi duyệt (nếu đủ điều kiện 12.7.2), Xóa truyện (kèm `ConfirmModal`) |
| `pending_review` | Rút lại về `draft` |
| `published` | Sửa (áp dụng ngay, không cần duyệt lại — personal project, admin không re-review mỗi lần sửa nhỏ), Gỡ truyện (→ `archived`, kèm `ConfirmModal`) |
| `rejected` | Xem lý do từ chối, Sửa, Gửi lại duyệt (→ `pending_review`) |
| `archived` | Khôi phục (→ `draft`), Xóa vĩnh viễn (kèm `ConfirmModal` mức cảnh báo cao nhất) |

---

## 12.8. Chuẩn bị schema thống kê cho Author (dự trữ — build UI sau)

Theo đúng nguyên tắc "dự trữ schema, chưa build UI" đã áp dụng cho Rating/Comment (`02-data-schema.md` mục 2.8, `10-out-of-scope.md`): 4 chỉ số đã được chốt phạm vi cần chuẩn bị — **tổng lượt xem, lượt xem theo chương, số bookmark, tỉ lệ đọc hoàn thành**. Toàn bộ dùng cách tiếp cận **query trực tiếp**, không tạo bảng analytics/event-log riêng (tránh over-engineering cho personal project) — xem chi tiết field/type mới ở `02-data-schema.md` mục 2.10.

- **Chưa xây trang `/author/stats` hoặc `/author/stories/[storyId]/stats` trong scope hiện tại** — chỉ chuẩn bị field (`Chapter.view_count`) và shape dữ liệu (`StoryStats`) để khi có task cụ thể, không phải sửa schema giữa chừng.
- Khi trang thống kê được yêu cầu về sau, gắn vào `StoryManageCard`/trang chi tiết truyện trong `/author` — không phải trang độc lập tách khỏi luồng quản lý truyện.

---

## 12.9. Liên kết tài khoản Freesound (dùng cho luồng Import — mục 8.9)

Khớp `IntegrationsSection.tsx` (`03-file-structure.md`), hiện trong `ProfileModal` (mục 12.3). Đây là luồng **liên kết tài khoản bên thứ 3**, khác với luồng đăng nhập chính của app (Auth.js, mục 12.1) — 1 user có thể đã login app (Google/GitHub) nhưng chưa từng connect Freesound.

- **Vì sao cần luồng riêng:** Search/Preview sound trong Editor dùng app token chung của hệ thống, không cần danh tính Freesound của author (`08-effects-and-scenes.md` mục 8.9.1). Chỉ khi author muốn **Import** (tải sound thật về thư viện cá nhân) mới cần token cá nhân để tuân thủ rate-limit/quota phía Freesound theo đúng user thật.
- **Kết nối:** Author bấm "Kết nối" trong `IntegrationsSection` (hoặc CTA tương tự bật lên trực tiếp từ `FreesoundSearchPanel` khi bấm "Dùng sound này" mà chưa connect) → `GET /api/integrations/freesound/connect` → redirect qua trang authorize của Freesound → callback `GET /api/integrations/freesound/callback` lưu token dạng ciphertext + `expires_at` trong credential record **server-only** → redirect về lại vị trí đang thao tác trong Editor (không mất context đang soạn). Session/API chỉ nhận `AppUser.freesound_connection: { connected, freesound_username? }`, không nhận token.
- **Ngắt kết nối:** Author bấm "Ngắt kết nối" → `POST /api/integrations/freesound/disconnect` → xoá toàn bộ credential ciphertext/expiry phía server; projection tiếp theo trả `connected: false`. Các `AudioAsset` **đã import trước đó vẫn giữ nguyên** (đã copy file về R2/Supabase, không phụ thuộc kết nối còn hiệu lực hay không) — chỉ chặn Import sound mới cho tới khi connect lại.
- **Tự refresh token:** Server tự gọi refresh flow (`lib/integrations/freesound/oauth.ts`) ngay trước mỗi lượt Import nếu `expires_at` đã qua — author không cần thao tác gì, không bị văng ra ngoài luồng đang soạn.
- **Không có bước "xin phê duyệt" nào khác:** không giống luồng "trở thành author" (mục 12.2, tự nâng role), connect Freesound là hành động app-level đơn thuần, không ảnh hưởng `Role`.

---
← Về `00-INDEX.md` | Trước: `11-phase3-technical-roadmap.md`
