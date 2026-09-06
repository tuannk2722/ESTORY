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
