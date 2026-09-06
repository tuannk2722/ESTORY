# 00 — Điểm bắt đầu cho AI coding assistant

Ứng dụng đọc/soạn truyện: block kích hoạt Effect theo viewport; Scene giữ bối cảnh trên một dải block. Phase 1–2 dùng JSON/localStorage; Phase 3 chuyển dần sang production theo lộ trình đã chốt.

## Đọc theo task

1. Đọc file này và [AGENTS.md](../AGENTS.md).
2. Trước khi code, đọc [01 — Tech stack](01-tech-stack.md), chọn **đúng model/mục** trong [02 — Data schema](02-data-schema.md) và hàng phù hợp ở bảng dưới. Kiểm tra [10 — Out of scope](10-out-of-scope.md) khi xác định scope.
3. Inspect code hiện tại trước khi sửa. Bản thiết kế đích không chứng minh tính năng đã được implement.
4. Rà [09 — NFR](09-non-functional-requirements.md) theo phần bị ảnh hưởng; chạy kiểm tra theo [README](../README.md) và AGENTS.

Không mặc định đọc hết docs, toàn bộ `02` hoặc toàn bộ roadmap cho mọi task Phase 3. Đọc thêm khi thay đổi chạm contract/dependency khác; không đọc lại phần không đổi trong cùng task. Với schema/migration toàn hệ thống, phải đọc đủ các model và quan hệ liên quan.

## Nguồn quyết định & bằng chứng

Khi docs mâu thuẫn, giữ thứ tự ưu tiên:

1. **Constraints:** `01` §1.3 và `10`.
2. **Data schema:** `02`.
3. **User stories/nghiệp vụ:** `05`, `06`, `07`, `12`.
4. Các mô tả còn lại.

Nếu vẫn chưa phân xử được, nêu mâu thuẫn trước khi code phần phụ thuộc; không tự đổi logic/thuật toán/contract đã chốt.

- **Tiến độ đã xác minh:** [verification/](verification/), gồm [P3-00](verification/p3-00.md), [P3-01](verification/p3-01.md) và [P3-02](verification/p3-02.md); đối chiếu git/code khi tiếp tục. Checkbox trong user stories là tiêu chí, không phải bảng tiến độ tự cập nhật.
- **Trạng thái task tạm:** `.codex/TASK.md` nếu có, theo AGENTS. Runbook/task state chỉ điều phối công việc; không thay nguồn quyết định và không chép lại schema/rule.
- **Stack/version đang cài:** `package.json`, `pnpm-lock.yaml`, `.nvmrc`. Lệnh local/CI/deploy: README.

## Bản đồ tài liệu

| Nguồn | Sở hữu nội dung |
|---|---|
| [01 — Tech stack](01-tech-stack.md) | Công nghệ và constraints theo phase |
| [02 — Data schema](02-data-schema.md) | Domain types/invariants; §2.8/2.10 là dự trữ |
| [03 — File structure](03-file-structure.md) | Vị trí/quy ước file hiện có và dự kiến |
| [04 — UI/UX](04-ui-ux-design.md) + [04b — Page layouts](04b-page-layouts.md) | Tra cứu thiết kế bằng skill; layout từng màn hình |
| [05 — Phase 1](05-user-stories-phase1.md) / [06 — Phase 2](06-user-stories-phase2.md) | AC Reader / chapter editor cần giữ khi refactor |
| [07 — Phase 3](07-user-stories-phase3.md) | Checklist nghiệm thu tính năng production |
| [08 — Effects & Scenes](08-effects-and-scenes.md) | Render, catalog, nguồn audio/background cá nhân |
| [09 — NFR](09-non-functional-requirements.md) / [10 — Out of scope](10-out-of-scope.md) | Chất lượng, bảo mật / ranh giới tính năng |
| [11 — Technical roadmap](11-phase3-technical-roadmap.md) | Repository, migration/cutover, Prisma mapping; giữ số mục 9.x |
| [12 — Auth & Author](12-auth-and-author-management.md) | Auth UI/onboarding, quản lý truyện và state rules |

## Chọn phần cần đọc

Bảng này bổ sung bước đọc chung phía trên. Số `02`, `08`… là file trong bảng tài liệu; § là mục. Task UI đọc thêm `04` và đúng layout trong `04b`; tạo file mới đọc `03`.

| Task | Mục cần đọc | Điểm vào code hiện có |
|---|---|---|
| Reader, thư viện, resume/settings | `02` §2.1/2.3–2.4; `05`; `04b` §1–4; Scene liên quan: `08` §8.4; public read: `11` §9.2.1, `12` §12.7.4 | `src/components/reader/`, `src/lib/reader/`, `src/lib/settingsStore.ts` |
| Chapter editor, lưu/reorder block | `02` §2.1/2.9; `06`; `04b` §5; `08` §8.3/8.4/8.7; Phase-3 mutation: `11` §9.2/9.5 | `src/components/editor/`, `src/lib/editor/`, `src/services/editorService.ts` |
| Effect renderer/suggestion | `02` §2.1/2.6; `08` §8.1/8.2/8.5.1; `06` US-2.2/2.3 | `src/lib/effects/`, `src/lib/effectSuggestion.ts`, `src/components/effects/` |
| Scene runtime/picker | `02` §2.9; `08` §8.3–8.7; `06` US-2.7–2.9; `04b` §5.5/8.3 | `src/types/scene.ts`, `scene-legacy.ts`, `src/lib/scenes/`, `src/components/scenes/` |
| DB/schema/migration | `07` US-3.1/3.2; `11` §9.2–9.4c/9.7; `02` toàn bộ model được map; Scene: `08` §8.3/8.6 | `src/lib/repositories/`, `content/`; Prisma chưa có ở mốc P3-01 |
| Repository/API/authz/cutover | `07` US-3.1/3.3/3.5/3.7; `11` §9.2/9.3/9.5; `12` §12.7; `09` | `src/lib/repositories/`, `src/lib/services/`, `src/types/api.ts`, `src/app/api/` |
| Auth UI/Author/moderation | `02` §2.5/2.7; `07` US-3.11/3.14–3.17; `12` §12.1–12.7; `04b` §6–7 | `src/components/ui/`, `src/app/author/`; các trang quản lý là đích Phase 3 |
| Settings/progress/bookmark sync | `02` §2.3–2.5; `07` US-3.4; `11` §9.5; `12` §12.7.4 | `src/lib/settingsStore.ts`, `src/components/ui/ThemeProvider.tsx` |
| Effect Admin | `02` §2.6; `07` US-3.12; `08` §8.5.1; `11` §9.4; `04b` §8.0/8.1/8.4 | Manifest/projector ở `src/lib/effects/`; Admin UI là đích Phase 3 |
| Scene catalog/Preset import | `02` §2.9; `07` US-3.13; `08` §8.3/8.5–8.7; `11` §9.4b; `04b` §8.0/8.2–8.4 | `src/lib/repositories/scene-repository.ts`, `src/lib/scenes/` |
| Storage/Freesound/AI background | `07` US-3.6/3.18/3.19; `02` §2.5/2.9/2.11; `08` §8.9 hoặc §8.10; `12` §12.9 nếu Freesound; `11` §9.4c/9.6; `09` | Chưa tích hợp ở mốc P3-01; vị trí đích trong `03` |
| CI/testing/hardening | `07` US-3.8; `09`; `11` §9.6; README | `.github/workflows/ci.yml`, `scripts/`, `src/__tests__/` |

Bản đồ code là điểm tìm kiếm, không yêu cầu tạo thêm abstraction hay đổi tên file. Dùng `rg --files src` để xác nhận đường dẫn thực tế. Không áp dụng shape legacy cho contract đích, cũng không xóa bridge trước khi consumer được chuyển.
