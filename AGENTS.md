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


<!-- END:nextjs-agent-rules -->