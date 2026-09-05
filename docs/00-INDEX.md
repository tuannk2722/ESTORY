# 00-INDEX.md — Storytelling System with Content-Driven Effects

> **File này là điểm bắt đầu bắt buộc.** AI coding assistant (Claude Code, Cursor, v.v.) phải đọc file này trước, sau đó đọc các file liên quan tới task đang làm theo bảng điều hướng bên dưới. Không cần đọc hết toàn bộ tài liệu cho mọi task — chỉ đọc phần liên quan, nhưng **luôn đọc `01-tech-stack.md` và `02-data-schema.md` trước khi code bất kỳ thứ gì**, vì đây là 2 nguồn chân lý chung cho toàn bộ dự án.

---

## Thứ tự ưu tiên khi có mâu thuẫn giữa các phần

Nếu nội dung giữa các file mâu thuẫn nhau, ưu tiên theo thứ tự:

1. **Constraints** (`01-tech-stack.md` mục "Ràng buộc kỹ thuật quan trọng", `10-out-of-scope.md`)
2. **Data Schema** (`02-data-schema.md`)
3. **User Stories** (`05-user-stories-phase1.md`, `06-user-stories-phase2.md`, `07-user-stories-phase3.md`, `12-auth-and-author-management.md`)
4. Mô tả chung / các file còn lại

---

## Bản đồ tài liệu (đọc theo nhu cầu task)

| File | Nội dung | Khi nào cần đọc |
|---|---|---|
| `00-INDEX.md` | File này — tổng quan, điều hướng, quy tắc ưu tiên | Luôn đọc đầu tiên |
| `01-tech-stack.md` | Stack công nghệ Phase 1–2 và Phase 3, ràng buộc kỹ thuật xuyên suốt | Luôn đọc — áp dụng mọi task |
| `02-data-schema.md` | Toàn bộ domain model TypeScript (Story, Effect, Settings, Bookmark, User, Rating/Comment dự trữ, tham chiếu Scene) | Luôn đọc — áp dụng mọi task liên quan tới dữ liệu |
| `03-file-structure.md` | Cấu trúc thư mục/file chuẩn, quy tắc đặt file effect/scene mới | Khi tạo file/component mới, tổ chức code |
| `04-ui-ux-design.md` | Cách dùng skill `ui-ux-pro-max` để tra cứu màu sắc/font/UX | Khi làm bất kỳ task liên quan UI/UX |
| `04b-page-layouts.md` | Bố cục chi tiết từng trang/màn hình Phase 1–2 và Phase 3 (Auth/Author/Admin; mục 8 chốt UI Effect & Scene catalog) | Khi tạo/sửa UI trang cụ thể, dùng cùng lúc với `04` |
| `05-user-stories-phase1.md` | User stories & acceptance criteria — Phase 1 (Reader-only MVP) | Khi làm task thuộc Phase 1 |
| `06-user-stories-phase2.md` | User stories & acceptance criteria — Phase 2 (Author Editor) | Khi làm task thuộc Phase 2 |
| `07-user-stories-phase3.md` | User stories & acceptance criteria — Phase 3 (Production Refactor) | Khi làm task thuộc Phase 3 |
| `08-effects-and-scenes.md` | **Effect** (hiệu ứng chấm phá 1 block) + **Scene System** (bối cảnh trải dài nhiều block — nền/màu/layout/nhạc nền, nền có thể tự chuyển động dạng video/particle loop) — 2 tầng song song. Mục 8.9–8.10: nguồn âm thanh/bối cảnh **cá nhân** của author (Freesound import, AI background generate — Phase 3) | Khi tạo/sửa effect component, khi task liên quan bối cảnh/nền/màu/nhạc nền trải dài nhiều block, quản trị thư viện Scene, hoặc khi task liên quan Freesound/AI-generate background |
| `09-non-functional-requirements.md` | Performance, Accessibility, Responsive, Code style, Security | Áp dụng xuyên suốt — nên rà lại trước khi hoàn thành task |
| `10-out-of-scope.md` | Những gì KHÔNG được tự ý làm theo từng phase | Luôn kiểm tra trước khi thêm tính năng ngoài yêu cầu |
| `11-phase3-technical-roadmap.md` | Chi tiết kỹ thuật refactor lên production: Repository pattern, DB migrate, Prisma schema đầy đủ (bao gồm mở rộng Scene System) | Khi làm task thuộc Phase 3 (kỹ thuật sâu) |
| `12-auth-and-author-management.md` | Navbar theo trạng thái đăng nhập, luồng "trở thành author", Author Dashboard, wizard tạo/sửa truyện, rule publish/unpublish chương độc lập với duyệt truyện, dự trữ schema thống kê author | Khi task liên quan đăng nhập/navbar, quản lý truyện của tác giả (tạo mới, sửa, danh sách chương, gửi duyệt) |

---

## TL;DR dự án

Xây dựng một web app đọc truyện, nơi **hiệu ứng hình ảnh/âm thanh/chuyển động được kích hoạt theo đoạn văn đang hiển thị trong viewport**, cộng với một trình soạn thảo cho phép tác giả gắn hiệu ứng vào đoạn văn. Đây là **personal project**, trọng tâm là **UI/UX chất lượng cao**.

- **Stack:** Next.js (App Router) + TypeScript + Tailwind CSS.
- **Phase 1–2:** không có backend/database thật — dữ liệu lưu file JSON, settings lưu localStorage. Nhưng **ngay từ Phase 1**, lớp dữ liệu phải được viết qua **Repository pattern** (xem `03-file-structure.md` & `11-phase3-technical-roadmap.md`) để Phase 3 swap sang DB mà không phải sửa lại UI.
- **Phase 3:** nâng cấp lên production đầy đủ — PostgreSQL + Prisma, Auth.js, phân quyền, media storage, API chuẩn hóa. Đây **không phải optional** — coi là lộ trình chính thức khi dự án trưởng thành, chi tiết ở `11-phase3-technical-roadmap.md` mục 9.2.1.
- **Thiết kế UI/UX:** dùng skill `ui-ux-pro-max` (đã cài ở `.agents/skills/` tại workspace root) để tra cứu color palette/font pairing/UX guideline có căn cứ thay vì tự bịa — xem `04-ui-ux-design.md`.
- **Data schema đã chốt (`02-data-schema.md`):** "Đang đọc" và "Đã lưu" (bookmark) là **2 danh sách độc lập**. Rating/Comment **chưa** làm ở Phase 3. Effect admin dùng technical manifest trong code + metadata/keyword overlay trong DB. Scene dùng `SceneRenderConfig` snapshot; Reader không resolve live Background/Palette catalog.
- **Effect & Scene System (`08-effects-and-scenes.md`):** 2 tầng song song. Effect kỹ thuật vẫn do developer sở hữu; admin chỉ sửa metadata/active/keyword. Scene giữ `SceneRenderConfig` snapshot hoàn chỉnh. Custom ScenePicker resolve ingredient thành snapshot; curated ScenePreset do developer import đã có snapshot sẵn. Admin quản lý global Background/Palette và metadata/catalog của Preset, không có preset builder, không soạn Scene cho từng truyện.
- **Author Editor Architecture (`04b-page-layouts.md` mục 5, `06-user-stories-phase2.md`):** Bố cục 3 cột (`ScenePanel` ↔ `BlockEditor` ↔ `Timeline`), phân tầng hiển thị **Text-First** (`Story Text` tại `z-20` luôn nổi trên toàn bộ `Effects` tại `z-[5]`), `Floating Action Dock` tại `z-[60]`, các modal `EffectPicker`/`ScenePicker` tại `z-[80]`, live preview portal tại `z-[90]`, `ConfirmModal` tại `z-[100]`. Đây là nơi soạn **nội dung 1 chương** — việc **tạo truyện mới / quản lý danh sách chương / gửi duyệt** nằm ở luồng riêng, xem mục dưới.
- **Auth UI & Author Management (`12-auth-and-author-management.md`, Phase 3):** Navbar đổi theo trạng thái đăng nhập, role `reader → author` tự nâng ngay khi tạo truyện đầu tiên thành công (không có bước "xin làm tác giả" riêng). Author có Dashboard (`/author`) + wizard tạo truyện 2 bước (`/author/stories/new`: thông tin cơ bản → danh sách chương) + trang quản lý truyện (`/author/stories/[storyId]`). Trang soạn nội dung 1 chương nằm ngay dưới: `/author/stories/[storyId]/[chapterId]`. `Chapter` có `status` (draft/published) **độc lập** với `Story.status` (kiểm duyệt) — 1 chương chỉ hiện với reader khi cả 2 đều ở trạng thái công khai; khi admin duyệt cả truyện, mọi chương tự động published theo.
- **Asset cá nhân của Author — Freesound & AI Background (`08-effects-and-scenes.md` mục 8.9–8.10, Phase 3):** Trong `EffectPicker`/`ScenePicker`, author có thể tìm/nghe thử sound từ Freesound (không cần connect, không tốn quota) rồi import vào thư viện cá nhân (`AudioAsset`, cần connect Freesound + tốn `freesound_import_quota` theo pattern reserve/refund), hoặc tải ảnh lên/tạo ảnh bối cảnh bằng Cloudflare Workers AI (`BackgroundAsset` với `scope: "personal"`, mỗi lượt tạo trả đúng 2 ảnh preview, chỉ ghi storage khi author chọn dùng). Toàn bộ asset này **cá nhân** của từng author, tách biệt hoàn toàn với 4 thư viện global do admin quản lý (mục 8.5).

---

## Quy trình làm việc gợi ý cho AI assistant theo từng loại task

- **Task: tạo/sửa UI editor (`/author/stories/[storyId]/[chapterId]`)** → đọc `01`, `02`, `03`, `04`, `04b-page-layouts.md` mục 5, `06-user-stories-phase2.md`, `08-effects-and-scenes.md`, `09`.
- **Task: tạo/sửa UI reader** → đọc `01`, `02`, `03`, `04`, `04b` mục 3, `05-user-stories-phase1.md`, `08-effects-and-scenes.md`, `09`.
- **Task: tạo effect mới** → đọc `01`, `02` (mục EffectConfig/EffectType), `03` (quy tắc đặt file), `08-effects-and-scenes.md` mục 8.2.
- **Task: liên quan tới bối cảnh/nền/màu/nhạc nền trải dài nhiều block (Scene) — kể cả nền có chuyển động (video/particle loop) — hoặc admin quản lý thư viện Scene** → đọc `01`, `02` (mục 2.9), `08-effects-and-scenes.md` mục 8.3 → 8.8 đầy đủ, `06`/`07` (user stories tương ứng phase), `03` (vị trí file).
- **Task: admin Effect/Scene catalog** → đọc `01`, `02` mục 2.6/2.9, `04`, `04b` mục 8, `07` US-3.12/3.13, `08` mục 8.3 → 8.7, `09`, `10`, `11` mục 9.4b. Giữ đúng manifest/DB overlay, snapshot runtime, lifecycle và ranh giới global/personal.
- **Task: navbar/đăng nhập, "trở thành author", Author Dashboard, tạo/sửa truyện, publish-unpublish chương** → đọc `01`, `02` (mục 2.1 Chapter.status, 2.5 Role, 2.10 StoryStats), `12-auth-and-author-management.md` đầy đủ, `04b-page-layouts.md` mục 6–7, `07-user-stories-phase3.md` US-3.14 → US-3.17, `03` (vị trí file).
- **Task: sound cá nhân từ Freesound (search/import) hoặc bối cảnh cá nhân (upload ảnh/AI generate)** → đọc `01`, `02` (mục 2.1 EffectConfig.audio_asset_id, 2.5 quota/connection, 2.11 AudioAsset), `08-effects-and-scenes.md` mục 8.9 → 8.10 đầy đủ, `07-user-stories-phase3.md` US-3.18 → US-3.19, `12-auth-and-author-management.md` mục 12.9, `11-phase3-technical-roadmap.md` mục 9.4c, `03` (vị trí file), `09`/`10` (bảo mật/ranh giới ngoài scope).
- **Task: bất kỳ việc gì thuộc Phase 3 (DB, Auth, API...)** → đọc `01`, `02`, `07`, `11` đầy đủ trước khi code.
- **Task: không chắc có nằm trong scope không** → kiểm tra `10-out-of-scope.md` trước.

Xem chi tiết quy tắc vận hành ở `AGENTS.md`.
