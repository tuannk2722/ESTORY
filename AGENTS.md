<!-- BEGIN:nextjs-agent-rules -->

# Hướng dẫn dự án My Storytelling App

Dự án Web ứng dụng Scroll-based Storytelling cho sách/truyện, xây dựng bằng Next.js 14 (App Router) + TypeScript + Tailwind CSS + GSAP ScrollTrigger.

## 1. Lệnh thường dùng:
- Chạy môi trường Dev: `pnpm run dev`
- Build sản phẩm: `pnpm run build`
- Kiểm tra lỗi type: `pnpm run typecheck`

## 2. Nguồn tài liệu bắt buộc tuân thủ (Source of Truth):
- Mọi logic và kiến trúc BẮT BUỘC phải đọc và tuân thủ các file trong thư mục `docs/`:
- Trước khi code một module mới, AI PHẢI đọc file doc tương ứng trước.

## 3. Tiêu chuẩn Thiết kế & UI/UX (UI/UX Pro Max):
- Sử dụng bảng màu và cặp font chữ chuẩn từ skill `ui-ux-pro-max`.
- Mọi tương tác click/touch phải có kích thước tối thiểu 44px (`min-h-[44px] min-w-[44px]`).
- Đảm bảo độ tương phản văn bản đạt chuẩn WCAG AA (tối thiểu 4.5:1).
- Tôn trọng `@media (prefers-reduced-motion: reduce)` để người đọc không bị say chuyển động.
- Không dùng emoji làm icon chính, ưu tiên dùng bộ icon SVG (như `lucide-react`).

# 4 — Ghi Chú Cho AI Assistant Khi Làm Việc Với Bộ Tài Liệu Này

> Xem `00-INDEX.md` để biết thứ tự ưu tiên và điều hướng. **Đọc file này trước khi bắt đầu bất kỳ task nào**, cùng với `01-tech-stack.md` và `02-data-schema.md`.

---

- Khi bắt đầu 1 task, luôn xác định đang ở **Phase nào** (1, 2, hay 3) và chỉ implement đúng phạm vi Phase đó trừ khi được yêu cầu khác. Tham khảo `05-user-stories-phase1.md`, `06-user-stories-phase2.md`, `07-user-stories-phase3.md`.
- Khi tạo effect component mới, luôn theo đúng interface `EffectConfig` ở `02-data-schema.md` mục 2.1 và đăng ký vào `EffectRegistry.ts` (xem `03-file-structure.md`).
- Khi tạo/sửa bất kỳ chỗ nào truy cập dữ liệu truyện hoặc settings, luôn đi qua `StoryRepository`/`settingsStore` — **không bao giờ** gọi thẳng file system hoặc localStorage trong component/page, kể cả ở Phase 1. Xem `11-phase3-technical-roadmap.md` mục 9.2.
- Khi quyết định màu sắc/font/spacing/motion preset, tra cứu qua skill `ui-ux-pro-max` trước (`04-ui-ux-design.md`) thay vì tự bịa.
- Khi không chắc 1 quyết định UI/UX nhỏ, tự quyết theo gu thẩm mỹ tốt (có tham khảo skill) và ghi chú lại trong code comment — không cần dừng lại hỏi. Nhưng khi quyết định ảnh hưởng tới **kiến trúc/data schema/Repository interface**, nên hỏi lại trước khi code.
- Khi thực hiện refactor Phase 3, luôn theo nguyên tắc **strangler pattern** ở `11-phase3-technical-roadmap.md` — không viết lại `/components/reader` hay `/components/effects`, mỗi bước vẫn phải giữ app chạy được (deployable).
- Trước khi thêm bất kỳ tính năng/thư viện/công nghệ nào không được nêu rõ trong task, kiểm tra `10-out-of-scope.md` để chắc chắn không nằm ngoài phạm vi.
- Sau khi hoàn thành 1 task, rà lại checklist ở `09-non-functional-requirements.md` (performance, accessibility, responsive, code style, security) trước khi coi là xong.
- Khi task liên quan tới bối cảnh/màu nền/nhạc nền trải dài nhiều block (không phải hiệu ứng chấm phá 1 block) — kể cả khi bối cảnh đó có nền tự chuyển động (video loop, particle) — đó là **Scene**, không phải **Effect**. Đọc `08-effects-and-scenes.md` mục 8.3 → 8.8 trước khi code, và không nhét logic Scene vào `EffectConfig`/`EffectRegistry.ts`.
- Khi tạo/sửa 1 `BackgroundAsset` có `motion: "looping"` (video/particle tự chuyển động), luôn bắt buộc kèm `poster_frame` và đảm bảo component render kiểm tra `reduced_motion` để fallback đúng — xem `08-effects-and-scenes.md` mục 8.4.
- Nếu chưa có đủ tham số đầu vào (VD: thiếu `targetAudience`, `genre`, `keyThemes`), hãy hỏi lại user để bổ sung trước khi gọi skill.

---
← Về `00-INDEX.md` | Trước: `11-phase3-technical-roadmap.md` | (Hết bộ tài liệu)

<!-- END:nextjs-agent-rules -->