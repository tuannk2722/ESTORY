# My Storytelling App

Ứng dụng đọc và soạn truyện với hiệu ứng theo đoạn văn, dùng Next.js App Router.
Đọc [docs/00-INDEX.md](docs/00-INDEX.md) trước khi thay đổi code.

## Môi trường

- Node.js **24 LTS**; `.nvmrc` và `package.json.engines` cùng pin major 24.
- pnpm **10.33.0**, được pin bằng `packageManager` trong `package.json`.
- Chỉ giữ `pnpm-lock.yaml`; không dùng npm/yarn/bun để cài dependencies.

Chọn Node 24 bằng trình quản lý Node đang dùng (`nvm install` rồi `nvm use`
nếu hỗ trợ `.nvmrc`), hoặc cài bản Node 24 LTS từ
[nodejs.org](https://nodejs.org/en/download).
Kiểm tra `node --version` và `pnpm --version` trước khi chạy:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Mở <http://localhost:3000>. Trên PowerShell, dùng `pnpm.cmd` nếu execution policy
chặn script `pnpm.ps1`.

## Kiểm tra

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm baseline:counts
pnpm build
```

`baseline:counts` chỉ đọc seed JSON, in số lượng và SHA-256 của từng file sau
khi chuẩn hóa JSON. Script không ghi dữ liệu hay hardcode counts vào runtime;
đây chưa phải bước validate/migrate dữ liệu Phase 3.

[GitHub Actions](.github/workflows/ci.yml) chạy trên push, pull request và khi
kích hoạt thủ công: kiểm tra một lockfile → frozen install
→ Prisma format/validate → lint/typecheck/test → seed counts → production build
→ browser bundle check. Job `PostgreSQL foundation` chạy migration và integration
test trên PostgreSQL 17 tạm của CI. Cả hai job phải xanh
trước khi merge; cấu hình required status check trong branch protection của
GitHub nếu repository chưa bật.

## Vercel

Import repository với thư mục chứa `package.json` này làm Root Directory.
`engines.node = ">=24 <25"` chọn Node 24 cho build/runtime theo
[quy tắc override của Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
Giữ Node.js Version trong Project Settings ở `24.x`. Bật
`ENABLE_EXPERIMENTAL_COREPACK=1` cho các môi trường deploy để Vercel dùng đúng
`pnpm@10.33.0` từ `packageManager`, theo
[hướng dẫn Corepack](https://vercel.com/docs/builds/configure-a-build#corepack).
Sau đó dùng install command `pnpm install --frozen-lockfile` và build command
`pnpm build`; xác nhận cả hai phiên bản trong build log của deployment.

Kết quả kiểm tra P3-00 được lưu ở
[docs/verification/p3-00.md](docs/verification/p3-00.md).

## PostgreSQL + Prisma (P3-02)

App hiện vẫn dùng JSON. Prisma 7.10.0 đã được pin; `install` và `build` tự generate
client, không tự chạy migration. Cấu hình Neon dev/preview/prod, lệnh migration,
kiểm tra database và rollback: [prisma/README.md](prisma/README.md).
Copy [.env.example](.env.example) sang `.env.local` để đặt connection strings.
Kết quả/gate còn thiếu: [docs/verification/p3-02.md](docs/verification/p3-02.md).

## Auth.js & bootstrap admin (P3-03)

Auth.js `5.0.0-beta.32` + Prisma adapter `2.11.3` dùng Google/GitHub và database
session. DB giữ user ID và role; session chỉ chiếu `id`, `role`, `email`, `name`,
`image`. Role mới có hiệu lực ở lần đọc session tiếp theo. Nội dung truyện/Scene
vẫn dùng JSON. Navbar/Profile và Author onboarding thuộc P3-10.

Thêm vào `.env.local` theo [.env.example](.env.example):

| Biến | Giá trị cần chuẩn bị |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Giữ cấu hình Neon P3-02; runtime Auth dùng `DATABASE_URL` |
| `AUTH_SECRET` | Sinh từ ít nhất 32 byte ngẫu nhiên; không dùng lại giữa môi trường |
| `AUTH_URL` | `http://localhost:3000` ở local; HTTPS origin của preview/production, không kèm path |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | OAuth client loại Web application của Google |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | Client ID/secret của GitHub OAuth App |
| `BOOTSTRAP_ADMIN_EMAILS` | Email tài khoản admin, nhiều mục phân cách bằng dấu phẩy |
| `BOOTSTRAP_ADMIN_USER_IDS` | Tùy chọn thay/bổ sung email bằng exact DB user ID |

Tạo Google client trong [Google Auth Platform](https://console.cloud.google.com/auth/clients),
cấu hình consent/audience và thêm tài khoản thử nếu app đang Testing.
Tạo GitHub OAuth App trong [Developer settings](https://github.com/settings/developers).
Homepage/JavaScript origin local là `http://localhost:3000`. Callback phải khớp:

```text
http://localhost:3000/api/auth/callback/google
http://localhost:3000/api/auth/callback/github
```

Preview/production dùng OAuth app và callback của đúng môi trường. Server startup
kiểm tra đủ cấu hình Auth; lỗi chỉ nêu tên biến, không in giá trị. Build có thể chạy
không có OAuth secrets/DB connection; khởi động server thì cần cấu hình đầy đủ.
GitHub cần scope mặc định `read:user user:email`; email đăng nhập phải được provider
xác minh. Không tự liên kết hai tài khoản Google/GitHub chỉ vì trùng email.

Bootstrap:

1. Chạy `pnpm dev`, mở `/api/auth/signin`, đăng nhập bằng tài khoản nằm trong allowlist.
2. Chạy `pnpm auth:bootstrap-admin`. Lệnh chỉ nâng user OAuth đã tồn tại, trong một
   transaction; mọi selector phải khớp đúng một user. Email không phân biệt hoa/thường;
   có trùng mơ hồ thì dùng exact ID từ `/api/auth/session`. Không tạo user qua email.
3. Chạy lại lệnh: `promoted=0`, tổng user/admin không tăng. Reload `/api/auth/session`
   để xác nhận `user.role` là `admin`. Không cần đăng nhập lại.

Lệnh không có public endpoint, không tự chạy khi login/deploy, không hạ quyền admin
khác và chỉ log counts. Allowlist rỗng/sai/chưa login làm lệnh thất bại; không ghi
một phần. Bỏ một user khỏi allowlist không thu hồi role đã cấp.

`/author/**` và `/admin/**` redirect guest sớm qua proxy. Page/API tự kiểm DB session;
cookie tồn tại không chứng minh đã đăng nhập. P3-06 kiểm editor theo owner/admin và
Story–Chapter membership từ DB. Guest gọi editor API nhận `401`, reader nhận `403`,
author khác owner nhận `404`. PUT cần header `Origin`
khớp `AUTH_URL` (trình duyệt gửi tự động); public Reader vẫn truy cập không cần login.

```sh
pnpm test
pnpm test:auth:db
pnpm build
pnpm test:auth:http
pnpm test:client-bundle
```

`test:auth:db` rollback toàn bộ fixture trong transaction. `test:auth:http` tự chạy
production server local với secret/provider values dành cho test, tạo user/session
tạm trong DB đang cấu hình rồi xóa đúng các fixture và dừng server. Chạy trên dev/CI;
test này không thay thế nghiệm thu OAuth thực với Google/GitHub. CI database job
chạy cả hai suite trên PostgreSQL tạm.

Tích hợp theo [Prisma adapter](https://authjs.dev/getting-started/adapters/prisma),
[database RBAC](https://authjs.dev/guides/role-based-access-control) và
[deployment](https://authjs.dev/getting-started/deployment) của Auth.js; giữ stack
NextAuth v5 đã chốt trong docs. Bằng chứng/gate: [P3-03](docs/verification/p3-03.md).

## Migration JSON → Prisma (P3-04)

Migration là CLI server-only và không đổi nguồn đọc/ghi runtime của app. Đặt
`LEGACY_OWNER_USER_ID` trong `.env.local` bằng exact `User.id` đã tồn tại; script không
suy owner từ chuỗi tên tác giả trong JSON. Trước apply, bảo đảm mọi media root-relative
được JSON tham chiếu đều có trong `public/`.

Chạy từng mode riêng và dừng ngay khi một mode lỗi:

```sh
pnpm migrate:phase3 -- --mode=dry-run
pnpm migrate:phase3 -- --mode=apply
pnpm migrate:phase3 -- --mode=apply
pnpm migrate:phase3 -- --mode=verify
```

`dry-run` parse toàn bộ seed, resolve Scene/curated preset thành snapshot v1, kiểm tra
Story–Chapter–Block membership, range/overlap, manifest/keyword và media checksum; DB
chỉ được đọc để xác minh owner, ID collision và technical effect lạ. `apply` upsert stable
legacy ID/slug và `authorDisplayName` trong một transaction, seed overlay/dictionary và
không xóa row ngoài seed. Lần apply thứ hai phải không tăng count. `verify` đối chiếu
count, ID/slug, byline, order/text, effect config, public status, Scene/catalog snapshot,
checksum preset, 25 overlay IDs và
global/personal isolation. Report không in credential hoặc `LEGACY_OWNER_USER_ID`.

Chỉ chạy trên database đã deploy migration P3-02. Dev/preview/production phải dùng owner
và connection riêng của đúng môi trường. P3-04 vẫn để bốn `PHASE3_*` flag ở
JSON/false; P3-05 bổ sung read/shadow selectors ở phần dưới, còn write cutover thuộc
stage sau. DB integration có rollback:

```sh
pnpm test:migration:db
```

Nếu database đã chạy P3-04 trước migration
`20260907000000_story_author_display_name`, deploy migration mới rồi chạy lại hai lượt
`apply` + `verify` để backfill đúng byline legacy.

Trước apply ở môi trường dùng chung, tạo Neon restore point/branch và ghi application
revision. Nếu apply thất bại, transaction không ghi một phần; sửa source/config rồi chạy
dry-run lại. Vì runtime vẫn dùng JSON ở P3-04, có thể rollback application revision và để
dữ liệu additive trong DB. Nếu cần hoàn tác dữ liệu đã apply, restore branch/restore point
đã ghi; không dùng `migrate reset`, không xóa thủ công các row có thể đã được tham chiếu.

## Prisma read & shadow parity (P3-05)

Runtime mặc định vẫn đọc JSON. Có thể chọn Prisma read riêng cho Story/Scene hoặc bật
shadow sau khi database của đúng môi trường đã migrate + verify:

```text
PHASE3_STORY_READ_SOURCE=json|prisma
PHASE3_SCENE_READ_SOURCE=json|prisma
PHASE3_SHADOW_READ=false|true
PHASE3_STORY_WRITE_SOURCE=json
```

Shadow trả kết quả primary, chỉ chạy read an toàn, chuẩn hóa default/order không có ý
nghĩa rồi so sánh; log chỉ có stable code + mismatch count. Snapshot DB sai fail có
observability và không resolve ngược catalog. `authorId` chỉ dùng ownership;
`authorDisplayName` map về public `Story.author`.

```sh
pnpm test:reads:db
```

Suite tạo/migrate fixture trong transaction và rollback toàn bộ; bao phủ JSON/Prisma
parity, public/full boundary, Story–Chapter membership, published navigation, Scene và
Effect/catalog reads, shadow mismatch bằng 0 và invalid snapshot. P3-05 chưa bật Prisma
write, chưa chuyển editor mutation/Reader và chưa xóa JSON adapter.

## DAL & content commands (P3-06)

P3-06 bổ sung commands Story/Chapter/Scene và editor aggregate transaction. Runtime
`StoryRepository.save()` và legacy Scene save bị chặn, kể cả khi nguồn đọc vẫn JSON.
Mặc định `PHASE3_STORY_WRITE_SOURCE=json` **tắt ghi nội dung**. Command HTTP hợp lệ
trả `503 WRITES_DISABLED`; payload editor legacy chưa chuyển contract bị `400`.
Reader/Editor đã chuyển sang snapshot trong implementation P3-07 bên dưới;
production cutover vẫn cần các gate môi trường.

Để kiểm thử riêng trên dev/preview đã migrate, cả `PHASE3_STORY_READ_SOURCE` và
`PHASE3_SCENE_READ_SOURCE` phải là `prisma` trước khi đặt write source thành `prisma`.
Không bật production write ở P3-06. Không dùng JSON làm rollback sau DB write.
Các suite HTTP bên dưới chỉ thay flags của server test con, không sửa file env.

Mọi mutation lấy actor từ DB session và yêu cầu `Origin` khớp `AUTH_URL`.
Story ID luôn là slug. Tạo truyện nhận `{ metadata, byline?, chapters: [{ title }] }`;
byline được xử lý theo [quy tắc tạo truyện](docs/12-auth-and-author-management.md#125-luồng-tạo-truyện-mới--authorstoriesnew-wizard-2-bước).
Tất cả mutation còn lại bắt buộc có `expectedUpdatedAt` lấy từ `meta.updatedAt` của
full read hoặc command response trước. Đây là revision của **toàn Story aggregate**;
hai tab sửa hai chương khác nhau cũng có thể nhận `409` và phải reload/đối chiếu.

Các route dưới đây đã có implementation; lấy `B = /api/stories/[storyId]`,
`C = B/chapters/[chapterId]`. Payload chỉ liệt kê field ngoài `expectedUpdatedAt`:

| Method / route | Payload / kết quả |
|---|---|
| `POST /api/stories` | `metadata`, `byline?`, `chapters`; tạo draft + nâng reader→author cùng transaction |
| `GET B/manage` | Full Story owner/admin + revision |
| `PUT B` | `metadata`; cập nhật thông tin truyện |
| `POST B/submit-review` | Gửi duyệt draft/rejected |
| `POST B/cancel-review` | Rút pending_review về draft |
| `POST B/archive` | Gỡ published về archived |
| `POST B/restore` | Khôi phục archived về draft |
| `POST B/chapters` | `title`; tạo chương draft |
| `PATCH B/chapters/reorder` | `chapterIds`; phải gồm mọi chương đúng một lần |
| `PATCH C` | `title`; đổi tên chương |
| `PUT C` | `blocks`; giữ Scene và validate range theo blocks mới |
| `DELETE C` | Xóa chương; giữ ≥1 chương và ≥1 chương public nếu Story public |
| `PATCH C/publish` | `status: draft\|published` |
| `GET C/editor` | `{ chapter, scenes }` snapshot owner/admin + revision |
| `PUT C/editor` | `blocks`, `scenes`; atomic replace, không nhận full chapter/status từ client |
| `PUT C/scenes` | `scenes`; replace canonical snapshots |

Success có dạng `{ data, meta: { updatedAt } }` (create `201`, còn lại `200`, chapter
delete `data: null`). Public `GET B` dùng `{ data }` và vẫn lọc trạng thái public.
Failure dùng `{ error: { code, message, fieldErrors? } }`; thiếu login `401`, thiếu role
`403`, khác owner/membership hoặc không tồn tại `404`, state/stale conflict `409`,
JSON/DTO sai `400`, body quá 4,000,000 bytes `413`. Error boundary hỗ trợ `429` cho
rate-limit được tích hợp sau; P3-06 chưa thêm distributed rate limiter.

```sh
pnpm test
pnpm test:commands:db
pnpm build
pnpm test:auth:http
pnpm test:commands:http
pnpm test:client-bundle
```

Chạy DB/HTTP suites trên dev/CI: fixtures có user/ID riêng, mọi dữ liệu fixture được
dọn trong `finally`. DB suite kiểm thêm transaction rollback bằng lỗi được chèn sau
khi ghi blocks và Scenes, cùng hai mutation đồng thời trên hai chương. HTTP suite
khởi chạy production server local hai lần với write bật/tắt và kiểm mọi mutation
guest bị chặn, payload/envelope, ownership, byline, snapshot, stale update và 413.
Hồ sơ kết quả và gate môi trường: [P3-06 verification](docs/verification/p3-06.md).

## Reader / Editor và controlled cutover (P3-07)

Reader dùng `getPublicChapter()` cho chương, Scene snapshots và published navigation.
`ReaderPane` không tải `/api/scenes` hoặc `/api/scene-library`; JSON adapter vẫn có thể
resolve legacy data phía server trước khi trả cùng contract snapshot. Home/Story vẫn
dùng public repository methods cũ. Renderer và Scene media không resolve ngược catalog.

Editor bootstrap lấy full owner/admin data qua DAL; Chapter, Scenes và revision lấy
từ cùng một DB transaction. Danh mục dùng cho lựa chọn mới đi qua active catalog
methods. Scene đã lưu mở được dù preset nguồn archived hoặc không còn ingredient
trong catalog: picker giữ snapshot hiện tại, chỉ copy ingredient mới khi tác giả chọn.
Không chuyển CSS presentation ngược thành dữ liệu lưu. Save dùng
`blocks/scenes/expectedUpdatedAt`, đọc `data/meta`, giữ dirty state khi lưu lỗi/409
hoặc khi tác giả gõ tiếp trong lúc đang lưu. Không tự retry bằng revision mới.

Kiểm tra trên Local + Neon dev (DB suites tạo fixture riêng và cleanup):

```sh
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm test:client-bundle
pnpm test:commands:db
pnpm test:commands:http
pnpm test:auth:http
pnpm test:reads:db
pnpm baseline:counts
```

`test:commands:http` bao gồm P3-07 client serializer/picker round-trip và HTTP page
checks. Browser smoke là gate local bổ sung, không thêm dependency vào app: cài
Playwright vào thư mục công cụ riêng, đặt `P3_07_PLAYWRIGHT_MODULE` thành đường dẫn
module đó rồi chạy lại `pnpm test:commands:http`. Script
`scripts/p3-07-browser-smoke.cjs` dùng Edge headless mặc định; có thể đặt
`P3_07_BROWSER_CHANNEL=chrome` khi máy có Chrome. Chỉ dùng session fixture do suite
tạo, không dùng browser profile thật. Ảnh QA lưu tại
`../.tools/p3-07-browser/artifacts/`. Cách dùng Playwright Library theo
[tài liệu chính thức](https://playwright.dev/docs/library).

### Thực hiện cutover trên từng môi trường

Hiện chỉ có Local + Neon dev; **chưa hoàn tất toàn stage P3-07**. Các bước dưới đây
là công việc còn phải thực hiện và ghi bằng chứng, không phải kết quả đã chạy.

1. Tạo Vercel preview/staging và DB riêng theo [Prisma operations](prisma/README.md).
   Cấu hình OAuth callback/`AUTH_URL` đúng deployment; pooled/direct URL cùng DB.
   Deploy schema, bootstrap đúng owner và migrate seed theo phần P3-03/P3-04 ở trên
   khi DB đó chưa có dữ liệu. Không chạy lại seed apply lên DB đã nhận nội dung mới.
2. Trước traffic cutover, ghi commit/deployment, môi trường/DB target (không ghi URL
   chứa secret), người phụ trách, thời gian quan sát và ngưỡng latency/error được
   chấp nhận. Đối chiếu baseline cùng route/dataset; mọi mismatch chưa giải thích,
   lỗi snapshot hoặc rò rỉ public/owner đều chặn tiến bước tiếp theo.
3. Khi dữ liệu JSON/DB còn tương đương, bật shadow để kiểm parity rồi chuyển hai
   read flags sang `prisma`, giữ write `json` (nghĩa là **tắt ghi**, không ghi JSON).
   Smoke Home/Story/Reader/Editor; đo latency và kiểm logs `P3_SHADOW_*`/
   `P3_PRISMA_*`. Đối chiếu owner draft, outsider 404, public Story/Chapter/membership.
   Production canary cần phạm vi traffic/thời gian cụ thể của môi trường deploy;
   các flags hiện tại là toàn deployment, không có cơ chế chia traffic theo phần trăm.
4. Trên preview DB riêng, tắt shadow JSON trước khi tạo dữ liệu mới rồi bật write
   `prisma`. Chứng minh editor read–edit–save–reload, snapshot/provenance bất biến
   khi chỉ sửa text, stale 409 và aggregate rollback bằng suite cùng smoke UI.
   Command chưa có UI được kiểm qua integration test, không mở rộng sang P3-10–14.
5. Sau read canary đạt ngưỡng đã ghi, chuẩn bị production write: ghi backup/restore
   point, retention thực tế và kết quả restore thử trên DB riêng. Xác minh restore
   đọc được dữ liệu/Scene/revision trước khi bật production write. Freeze ngắn nếu
   cần; bật write chỉ khi cả hai read flags là Prisma, smoke create/edit/Scene save,
   đối chiếu counts/latest update rồi kết thúc freeze.

### Freeze và rollback

- Trước DB write thật: có thể đổi public read về JSON nếu dữ liệu/UI còn tương
  thích. Editor tiếp tục dùng DB qua authorized DAL; không mở lại legacy save.
- Sau DB write thật: JSON không còn là nguồn rollback. Giữ read Prisma; có thể
  đặt write flag `json` để **chặn command writes** trong lúc xử lý sự cố. Khôi phục
  DB bằng restore/PITR hoặc forward fix; verify dữ liệu rồi mới mở lại write Prisma.
- Shadow so sánh toàn bộ với JSON sẽ mismatch có chủ đích sau DB writes; tắt
  shadow này trước write, không dùng mismatch đó làm bằng chứng corruption.
- Giữ JSON adapters/read-only legacy endpoints tới cleanup P3-17; không còn
  Reader/Editor consumer ghi qua các API legacy.

Bằng chứng và gate còn thiếu: [P3-07 verification](docs/verification/p3-07.md).
