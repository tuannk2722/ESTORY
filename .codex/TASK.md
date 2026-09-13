# Current Task — P3-10

## Goal and scope
Hoàn thiện Auth UI và Author management theo runbook P3-10: navbar/profile/auth,
wizard tạo Story đầu tiên, Author dashboard, trang quản lý Story/Chapter, state actions,
Story cover claim và owner/admin guards. Giữ nguyên Reader/Editor đã cut over ở P3-07.

## Sources
AGENTS.md; docs/00-INDEX.md; ../phase3-execution-plan.md P3-10; docs/01 §1.2–1.3;
docs/02 §2.1/2.5/2.7; docs/03 Phase-3 paths; docs/04 và 04b §6–7;
docs/07 US-3.14–3.17; docs/09/10; docs/11 §9.2/9.5–9.7;
docs/12 §12.1–12.7; verification P3-06/P3-07/P3-09.

## Starting state
HEAD `2315fee` trên branch `phase3`, working tree sạch. User xác nhận P3-09 baseline,
GitHub Actions và Vercel preview xanh. Local audit đầu P3-10: `pnpm test`,
`pnpm typecheck` và `git diff --check` pass. Auth.js/guards, Story/Chapter commands,
Prisma reads, editor transport và R2 upload intents đã có; Author UI còn thiếu và
`UserMenu` vẫn là mock guest.

## Decisions confirmed by user
- Create/update nhận `coverUploadId`; server resolve URL từ completed `story_cover`
  intent đúng owner/purpose và claim trong cùng transaction Story. Không tin cover URL
  từ client; update không có upload mới giữ cover hiện tại.
- P3-10 chỉ chuẩn bị boundary `IntegrationsSection`; không hiển thị hoặc triển khai
  Freesound action trước P3-15.
- P3-10 tạo protected `/admin` landing tối thiểu để Profile link không 404;
  moderation vẫn thuộc P3-11.

## Scope boundary
Không triển khai Freesound/quota/personal audio, moderation, Effect/Scene Admin,
personal/AI background hoặc Author stats. Story delete không xóa vật lý R2 object;
storage cleanup vẫn cần reference audit riêng.

## Completed locally
- Auth/Profile/theme UI, role CTA, protected `/admin` landing và structural-only
  `IntegrationsSection` boundary.
- Wizard hai bước, direct cover upload/cancel/retry, atomic `coverUploadId` claim +
  Story/Chapters + reader→author; Author dashboard/management/chapter/state/delete UI.
- Management/list/delete API + DAL/repository projection và owner/admin/read-only guards;
  editor quay lại trang quản lý author.
- Unit, production build, DB/HTTP, auth/media/read regression và Edge headless browser gate
  đều pass; chi tiết tại `docs/verification/p3-10.md`.

## Completed UI follow-up
- Sửa lifecycle local cover preview khi wizard bước 1 bị unmount/remount.
- Thêm focal position ảnh bìa chuẩn hóa theo phần trăm, lưu qua Story command/Prisma và
  dùng cùng khung 16:9 ở wizard, Author card và Home card.
- Giữ byline chỉ chỉnh khi tạo theo docs §12.5–12.6; sửa switch chương và contrast badge.
- Dùng chung reorder engine giữa Block/Chapter; thêm gap insertion có keyboard/touch
  alternative. Trang manage tạo chương tại gap bằng một transaction, không nối hai request.
- Migration `20260910000000_story_cover_position` đã áp dụng trên Neon dev; status và
  schema diff sạch. Unit/lint/type/build/client-bundle, migration/read/command/auth/media DB,
  production HTTP và Edge browser smoke đều pass; bằng chứng ở `docs/verification/p3-10.md`.
- Public follow-up: Story detail dùng cover `16:9` làm hero full-bleed ở desktop và media
  surface thích ứng ở mobile; Home StoryCard trở lại `16:9`, ngắn gọn hơn, dùng surface/shadow
  theo Dark/Light/Sepia và hover ổn định không scale/translate toàn card.
- Tối ưu `CoverUploader`: preview mới và cover đã lưu luôn căn được bằng chạm/click, drag hoặc
  phím mũi tên khi form không bị khóa.
- Follow-up chapter reorder: xác nhận phép tính index cũ đúng nhưng drag lifecycle có race do
  chỉ dựa vào React state, gap 44 px bị unmount làm layout co, và auto-scroll bị chặn trước
  listener `window`. Shared hook dùng synchronous ref/capture listener; chapter giữ gap/drop
  zone ổn định. Unit test phủ toàn bộ cặp đầu/giữa/cuối; browser scenario kéo chapter giữa ở
  wizard/management đã pass trong gate Edge ngày 2026-09-11.
- Follow-up live StoryCard: tách `StoryCardVisual` dùng chung, giữ `StoryCard` public sở hữu
  Link/settings/bookmark và thêm preview inert từ controlled form ở create Bước 1 + edit
  metadata. Desktop `xl` dùng cột preview `22rem` sticky, viewport nhỏ xếp dọc; Step 2 và
  chapter/status/danger flow giữ nguyên. Mapper có placeholder, ưu tiên blob local rồi cover
  persisted và dùng chung focal point. Unit/static/build/client-bundle + HTTP/Edge 375/1440
  và Dark/Light/Sepia đều pass; bằng chứng cập nhật ở `docs/verification/p3-10.md`.
- Follow-up tối ưu Chapter management: `InsertGapButton` tiếp tục ẩn visual khi nghỉ/hiện khi
  hover, bổ sung feedback `focus-visible`/touch press và disabled/reduced-motion; Block Editor
  giữ gap/drop geometry bằng placeholder + indicator absolute trong lúc drag. Dashboard/manage
  dùng `ManagedStory`/`ManagedChapter` summary với `blockCount`/`effectCount`, không serialize
  text block/effect/Scene. Reorder kiểm tập ID, batch-write order và chỉ trả `{ id, order }[]`
  để client merge vào state hiện hữu. Title row đồng bộ response chuẩn hóa từ server; xóa row
  chuyển focus theo stable ID; management chỉ dùng Sonner làm live feedback, tránh announcement
  lặp. Lint/type/unit/build/client-bundle/DB/production HTTP + Edge browser regression đều pass
  ngày 2026-09-11; chi tiết ở `docs/verification/p3-10.md`.
- Follow-up add-chapter UX: manage list không còn render form cuối danh sách thường trực. Nút
  thêm cuối và divider giữa chapter cùng mở một draft row `Chương N · Chưa lưu`, dùng chung
  state/validation/submit; chỉ persist sau submit hợp lệ, Hủy/Escape trả focus về trigger và
  create thành công focus title row mới. API `afterChapterId`, reorder engine và Block Editor
  giữ nguyên. Lượt refactor tiếp theo chuyển title/error về đúng draft form, bỏ state/ref/props
  trung gian và component nút một-lần-dùng, giảm `ChapterListManager.tsx` từ 652 xuống 596 dòng
  mà không tách code sang file khác; chi tiết contract ở `docs/04b-page-layouts.md` và
  `docs/12-auth-and-author-management.md`.

## Remaining external gates
Push changeset rồi xác nhận GitHub Actions và Vercel preview P3-10 xanh. Preview Story
upload smoke chỉ chạy với R2 preview bucket/prefix/CORS tách biệt. Không deploy/push trong
task local này.

## Pre-P3-11 spec refresh
Đã bổ sung Admin shell + moderation UI vào nguồn canonical ở `docs/04b` §8.0–8.1;
contract liên quan nằm ở `02`/`03`/`07`/`09`/`10`/`11`/`12` và runbook P3-11.
Đã chốt tiếp search boundary ở `11` §9.2.2: `SearchInput` chỉ trình bày, picker
lọc local catalog đã tải, còn Home/Admin Story list query server-side qua URL + read-model
gọn. P3-11 chia P3-11A discovery/Home rồi P3-11B moderation; không renumber stage sau.
Home P3-11A tiếp tục dùng `q + genre` server-side/facet public động theo `11` §9.2.2 và
ba Hero artwork Dark/Light/Sepia + paint-hint/load-decode-crossfade theo `11` §9.2.3;
layout/AC/gate đã nối ở `04b` §1, `07` US-3.20, `09` và runbook P3-11.
Không tạo spec riêng và chưa bắt đầu implementation P3-11.

## Constraints
Node 24 qua `../.tools/node-v24.20.0-win-x64`; pnpm 10.33.0. Không secrets trong
log/test/docs, không deploy/push hay đổi persistent environment nếu chưa được giao.
