# 07 — Phase 3: User Stories & Acceptance Criteria

Phase 3 là lộ trình chính thức, triển khai dần theo strangler pattern. Đọc [INDEX](00-INDEX.md), chọn US và đúng mục kỹ thuật trong [11 — Roadmap](11-phase3-technical-roadmap.md); thứ tự triển khai ở §9.7, không phải thứ tự số US.

Mỗi US phải đạt checklist **và các rule/validation trong mục được dẫn**; dẫn chiếu thay phần lặp, không làm yêu cầu thành optional. Checkbox là tiêu chí nghiệm thu; tiến độ có bằng chứng ở [verification/](verification/), đối chiếu code/git trước khi tiếp tục. Schema giữ tại `02`, render/catalog tại `08`, nghiệp vụ Author tại `12`, layout tại `04b`.

## US-3.1 — Repository pattern

Nguồn: [11](11-phase3-technical-roadmap.md) §9.2/9.2.1.

- [ ] `PrismaStoryRepository` implement contract hiện có; chọn implementation tại `src/lib/repositories/index.ts`, UI không biết JSON/DB.
- [ ] Giữ consumer cũ; riêng Reader chuyển read-model theo §9.2.1 khi cutover, chỉ thay data flow bắt buộc.

## US-3.2 — Database & migration

Nguồn: [11](11-phase3-technical-roadmap.md) §9.3–9.4c.

- [ ] Prisma + managed PostgreSQL (Neon/Supabase), schema map đúng domain.
- [ ] Migrate JSON không mất dữ liệu; dry-run/apply/verify, đối chiếu counts/block/effect và Scene/catalog snapshots theo roadmap.

## US-3.3 — Authentication

Nguồn: [11](11-phase3-technical-roadmap.md) §9.5; [12](12-auth-and-author-management.md) §12.1–12.3.

- [ ] Auth.js OAuth Google/GitHub; đọc public không cần login.
- [ ] Login khi vào `/author/**` hoặc đồng bộ đa thiết bị; quyền cụ thể theo role/ownership.

## US-3.4 — Settings/Progress sync

Nguồn: [02](02-data-schema.md) §2.3–2.5; [11](11-phase3-technical-roadmap.md) §9.5.

- [ ] Guest giữ localStorage; logged-in đọc/ghi DB + local cache.
- [ ] First-login chỉ import local khi DB chưa có record; đã có thì DB thắng.

## US-3.5 — Phân quyền

Nguồn: [02](02-data-schema.md) §2.5; [09](09-non-functional-requirements.md); [12](12-auth-and-author-management.md) §12.7.

- [ ] Role rank `reader < author < admin`; chỉ owner/admin sửa truyện.
- [ ] Proxy chỉ redirect sớm; Route Handler/DAL tự kiểm session, role, ownership, Story–Chapter membership gần data source trước mutation.

## US-3.6 — Media storage

Nguồn: [01](01-tech-stack.md) §1.2; [09](09-non-functional-requirements.md); [08](08-effects-and-scenes.md) §8.9.4/8.10.1 cho personal upload.

- [ ] Upload cover/audio/background theo quyền và loại asset đã chốt; server cấp key/purpose/limit, presigned PUT ngắn hạn tới R2/Supabase, complete endpoint verify object.
- [ ] File lớn không proxy qua Vercel Function body 4.5MB; replace tạo immutable key mới, archive/delete DB không xóa object còn trong snapshot.

## US-3.7 — API chuẩn hóa

Nguồn: [11](11-phase3-technical-roadmap.md) §9.2/9.5; contract hiện có: `src/types/api.ts`.

- [ ] Mọi Route Handler validate input/output bằng Zod, response/error nhất quán.

## US-3.8 — Testing & CI/CD

Nguồn: [09](09-non-functional-requirements.md); [10](10-out-of-scope.md) phần testing; [11](11-phase3-technical-roadmap.md) §9.6.

- [ ] Unit tests repository/service logic; không yêu cầu component UI coverage.
- [ ] GitHub Actions lint/typecheck/test khi push; deploy Vercel app + Neon/Supabase DB. Runtime/build gates theo [README](../README.md).

## US-3.9 — Hiệu ứng nâng cao (optional)

- [ ] Chỉ triển khai khi có effect cụ thể CSS/Canvas 2D không đáp ứng.
- [ ] `three.js` + `@react-three/fiber`, cô lập tại `src/components/effects/visual/webgl/`.

## US-3.10 — Personal effect preset (optional)

- [ ] Lưu tổ hợp effect trong DB (bảng riêng hoặc JSON trên User), áp dụng nhanh vào block từ EffectPicker.

## US-3.11 — Admin kiểm duyệt truyện

Nguồn: [02](02-data-schema.md) §2.7; [12](12-auth-and-author-management.md) §12.7.

- [ ] `/admin/stories` lọc status, pending review trước; admin xem chi tiết rồi approve/reject đúng state machine.
- [ ] Approve → published + `reviewed_at/reviewed_by`, toàn bộ chương published; reject bắt buộc reason.
- [ ] Author thấy status/rejection reason, sửa và gửi lại từ rejected.

## US-3.12 — Effect Admin

Nguồn: [02](02-data-schema.md) §2.6; [08](08-effects-and-scenes.md) §8.5.1; UI: [04b](04b-page-layouts.md) §8.0/8.1/8.4.

- [ ] Code manifest giữ technical ID/category/icon/defaults/renderer/scope. Admin chỉ sửa overlay `label/description/is_active` và keyword; không Create EffectType, sửa technical/default hay per-picker visibility.
- [ ] `/admin/effects`: search/category/status, desktop table/mobile cards, detail drawer; keyword CRUD inline, Preview renderer thật/reduced motion, dirty-close confirm theo layout.
- [ ] Keyword integer weight 1..100; unique `(effect_id, normalized_keyword)` sau NFKC/lowercase vi-VN/trim/collapse whitespace.
- [ ] Inactive ẩn khỏi picker/suggestion mới, Reader vẫn render effect đã lưu; editor load catalog/dictionary một lần trong aggregate, không per-block request.
- [ ] Manifest sync idempotent; test type/manifest/registry ID parity; technical ID lạ trong DB phải fail/report.

## US-3.13 — Scene Admin & snapshot integration

Nguồn: [02](02-data-schema.md) §2.9; [08](08-effects-and-scenes.md) §8.3–8.7; UI: [04b](04b-page-layouts.md) §8.2–8.4.

- [ ] `/admin/scene-library` có Backgrounds/Palettes/Scene Presets; Background chỉ global, typed kinds/registered particle, looping có poster, từ chối raw CSS/particle JSON. Palette đủ bốn kênh, tint color + opacity, sample Reader Preview.
- [ ] Lifecycle draft/active/archived; Author chỉ active, Remove = archive, hard-delete chỉ `activated_at = null`. Preset chỉ developer seed/import; Admin Preview/sửa label/description/mood/thumbnail/status/remove, không builder/Create.
- [ ] Custom/preset cùng deep-copy `SceneRenderConfig`; Reader không resolve background/palette ID hay fetch Scene library. Ambient chỉ scope scene, unique type, ≤1 audio loop.
- [ ] Replace key mới; archive/delete không xóa media đang dùng. ConfirmModal nêu dependency/impact và Scene cũ giữ nguyên; preset có thể hiện provenance count; cleanup storage riêng.
- [ ] Không personal background trong Admin response/UI, không global AudioAsset library. Nghiệm thu responsive 375px/keyboard/focus/error summary/AA/reduced motion và target size theo gate §8.4 của `04b`.

## US-3.14 — Navbar & Profile Modal

Nguồn: [12](12-auth-and-author-management.md) §12.1–12.3; UI: [04b](04b-page-layouts.md) §6.

- [ ] Guest có Login; reader đã login có “Viết truyện” → `/author/stories/new`; author/admin có “Truyện của tôi” → `/author`.
- [ ] Avatar mở ProfileModal: avatar/name/email, badge ẩn với reader, Theme Switcher, role links (author→Dashboard, admin→Admin), logout; integrations theo §12.3/12.9.

## US-3.15 — Nâng role khi tạo truyện đầu tiên

Nguồn: [12](12-auth-and-author-management.md) §12.2.

- [ ] Chỉ đổi reader→author trong transaction tạo Story thành công; vào wizard/bỏ dở/lưu lỗi không đổi role. Không có bước/nút xin làm author riêng.
- [ ] Navbar/Profile cập nhật ở render tiếp theo, không cần logout/login.

## US-3.16 — Author Dashboard

Nguồn: [12](12-auth-and-author-management.md) §12.4/12.7.5; UI: [04b](04b-page-layouts.md) §7.1.

- [ ] `/author` yêu cầu role ≥ author, chặn reader; `getAllForAuthor(session.user.id)` chỉ trả truyện sở hữu, tabs đủ StoryStatus.
- [ ] StoryManageCard có cover/status badge đúng màu/số chương published trên tổng/actions theo trạng thái.
- [ ] CTA tạo truyện → `/author/stories/new`; empty state có CTA tạo truyện đầu tiên.

## US-3.17 — Tạo/sửa truyện & publish chương

Nguồn: [12](12-auth-and-author-management.md) §12.5–12.7 **đầy đủ**; UI: [04b](04b-page-layouts.md) §7.2–7.3; schema: [02](02-data-schema.md) §2.1/2.7.

- [ ] Wizard hai bước: title/description/cover upload/genre ≥1 → thêm/reorder/xóa chương (chỉ title); Lưu khi đủ bốn field và ≥1 chương có title.
- [ ] Tạo Story + Chapters draft một transaction, redirect `/author/stories/[storyId]`.
- [ ] Trang quản lý chỉ owner/admin qua shared layout guard + API guards; banner status/rejection reason, reuse form/chapter components trong một trang, không wizard steps.
- [ ] Mỗi chương có Sửa nội dung → `/author/stories/[storyId]/[chapterId]` và publication toggle. Không xóa chương cuối, không unpublish chương published cuối của Story published; disable kèm giải thích.
- [ ] Gửi duyệt draft/rejected khi đủ bốn field, ≥1 chương, ≥1 chương có blocks; pending review khóa author mutation theo §12.7.2. Admin duyệt tự publish mọi chương; reader chỉ thấy khi cả Story và Chapter published.

## US-3.18 — Freesound & personal audio upload

Nguồn: [08](08-effects-and-scenes.md) §8.9 **đầy đủ**; [12](12-auth-and-author-management.md) §12.9; [02](02-data-schema.md) §2.5/2.11.

- [ ] Shared SoundSourcePicker tại EffectPicker Audio và ScenePicker bước 4: Thư viện của tôi / Tải lên / Tìm trên Freesound.
- [ ] Search/preview không cần connect, không quota; debounce + server cache/rate-limit. Chưa connect: “Dùng sound này” disabled + lý do/CTA kết nối từ client-safe connection status.
- [ ] Import: reserve quota → refresh token nếu hết hạn → download/normalize/browser-playable → storage → AudioAsset; lỗi bất kỳ bước nào refund + báo lỗi.
- [ ] Asset xuất hiện ngay thư viện cá nhân, reuse mọi block/scene/chapter/story cùng owner, không leak author khác.
- [ ] License khác cc0 có attribution ở “Nguồn âm thanh” cuối chapter, tính cả block/Scene ambient.
- [ ] Upload mp3/wav/ogg ≤8MB, ≤5 phút; tạo AudioAsset không connect/không quota.

## US-3.19 — Personal image upload & AI background

Nguồn: [08](08-effects-and-scenes.md) §8.10 **đầy đủ**; [02](02-data-schema.md) §2.5/2.9; [11](11-phase3-technical-roadmap.md) §9.4c; [09](09-non-functional-requirements.md).

- [ ] ScenePicker Custom bước 1 có upload jpg/png/webp ≤5MB → personal asset active đúng owner; AI panel prefill genre/mood, prompt editable.
- [ ] Generate reserve quota + session hai seed/expiry; client lấy variant 0/1 qua hai request, mỗi request một inference/preview dưới encoded-size cap. DB chỉ hash/status, preview không storage.
- [ ] Đúng hai preview; lỗi không đủ cặp refund, bỏ dở xử lý policy chống abuse §8.10.2.
- [ ] Chọn ảnh gửi index + bytes; verify owner/expiry/hash rồi lưu đúng một ảnh + personal static/image asset + prompt gốc. Ảnh kia không storage; commit không trừ quota lần hai.
- [ ] Preview/commit có request/response cap + test 413, không trả hai base64 trong một Vercel response 4.5MB. Hết quota disable Generate + reset time, không gọi provider.
- [ ] Personal background không trong Admin catalog hoặc curated preset dùng chung.

## Definition of Done

| Mức nghiệm thu | Phạm vi |
|---|---|
| Phase 3 cơ bản | US-3.1–3.5: multi-user, dữ liệu bền vững; vẫn tuân thủ migration/authz/validation gates trong `11` §9.3 |
| Luồng Author + Admin | US-3.14–3.17 trước US-3.11; tiếp tới US-3.12/3.13 |
| Toàn bộ scope hiện tại | Mọi US trừ optional US-3.9/3.10; bao gồm media/API/testing, Freesound, AI, production hardening |

Không cần làm mọi US cùng lúc. Freesound/AI không phụ thuộc moderation/catalog Admin; triển khai khi Auth/authorization/quota/storage và điểm tích hợp Author sẵn sàng (`11` §9.6–9.7). Tạm hoãn không biến chúng thành optional. Rating/Comment/Stats UI vẫn ngoài scope theo [10](10-out-of-scope.md).

← [INDEX](00-INDEX.md) · [Phase 2](06-user-stories-phase2.md) · [Effects & Scenes](08-effects-and-scenes.md)
