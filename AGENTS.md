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

sau khi đã có đủ tại liệu và skills, hãy thực hiện bước đầu tiên trong chu trình làm web project giúp tôi.
"Chào bạn, tôi đã chốt xong bảng màu và các yêu cầu trong docs/. Hãy tiến hành Giai đoạn 1 của dự án my-storytelling-app:

Đọc file [04-ui-ux-design.md](file;file:///c%3A/Users/OS/story-telling/docs/04-ui-ux-design.md)  để cấu hình tailwind.config.ts và app/globals.css (khai báo đầy đủ các biến CSS cho Theme Dark/Light, Google Fonts Cinzel + Cormorant Garamond + Outfit, cùng cấu hình hỗ trợ chuyển đổi theme).
Đọc file [08-effects-and-scenes.md](file;file:///c%3A/Users/OS/story-telling/docs/08-effects-and-scenes.md)  để tạo file types/story.ts định nghĩa toàn bộ TypeScript Interfaces cho: Story, Chapter, Scene, Dialogue, Choice.
Tạo file dữ liệu mẫu src/data/sample-story.json chứa 1 chương truyện ngắn gồm 3 cảnh (Scene) để chuẩn bị test tính năng Scrollytelling.
Hãy thực hiện từng bước và liệt kê các file bạn đã tạo/cập nhật."

Phong cách thiết kê và bảng màu mà tôi áp cho web đây:"
## 1. Phong cách thiết kế chủ đạo (Design Style)
- **Style IDs gốc từ UI/UX Pro Max:** `dark-mode-oled` + `parallax-storytelling` + `e-ink-paper`.
- **Triết lý thẩm mỹ:** Nền đen OLED sâu thẳm, tương phản cao, chữ sắc nét chống mỏi mắt, hiệu ứng viền mờ tinh tế và chuyển động cuộn gắn liền với nhịp thở câu chuyện.

---

## 2. Hệ thống Themes & Bảng màu Toàn Cục (Global Color Tokens)

Dự án hỗ trợ 3 chế độ đọc (Reader Modes) chuyển đổi qua thuộc tính `data-theme`:

### A. Theme "dark" (Mặc định - OLED Midnight Dark)
Tối ưu hóa cho màn hình OLED, tiết kiệm pin và đọc ban đêm êm dịu:
- `--color-background`: `#05070F` (Nền than đen sâu)
- `--color-foreground`: `#F8FAFC` (Chữ trắng ngà rõ nét)
- `--color-card`: `#0E1426` (Nền thẻ mờ Glassmorphism)
- `--color-card-foreground`: `#F1F5F9`
- `--color-primary`: `#3B82F6` (Xanh hoàng gia)
- `--color-secondary`: `#1E293B`
- `--color-accent`: `#E2B714` (Vàng kim điểm nhấn & Drop Cap)
- `--color-muted`: `#1E293B`
- `--color-muted-foreground`: `#94A3B8` (Chữ phụ / mô tả)
- `--color-border`: `rgba(255, 255, 255, 0.1)`
- `--color-ring`: `#38BDF8` (Viền sáng khi focus)

### B. Theme "light" (Paper Light - Ban Ngày / E-Ink)
Mô phỏng trang giấy in tự nhiên, giảm chói:
- `--color-background`: `#FDFBF7` (Màu giấy ngà)
- `--color-foreground`: `#18181B` (Mực đen sâu)
- `--color-card`: `#FFFFFF`
- `--color-card-foreground`: `#18181B`
- `--color-primary`: `#2563EB`
- `--color-secondary`: `#E2E8F0`
- `--color-accent`: `#B45309` (Màu hổ phách)
- `--color-muted`: `#F1F5F9`
- `--color-muted-foreground`: `#64748B`
- `--color-border`: `#E2E8F0`
- `--color-ring`: `#2563EB`

### C. Theme "sepia" (Sepia Warm - Ấm áp / Cổ điển)
Giảm ánh sáng xanh tối đa cho mắt:
- `--color-background`: `#F4EEDD` (Màu kem ấm)
- `--color-foreground`: `#2C2416` (Mực nâu đậm)
- `--color-card`: `#EAE2CC`
- `--color-card-foreground`: `#2C2416`
- `--color-primary`: `#B45309`
- `--color-accent`: `#D97706`
- `--color-muted-foreground`: `#786C55`
- `--color-border`: `rgba(44, 36, 22, 0.15)`
- `--color-ring`: `#B45309`

---

## 3. Hệ thống Typography (Google Fonts)

- **Tiêu đề Sử thi / Tên chương (`font-display`):** `Cinzel` (Weights: 600, 700, 900)
- **Nội dung đọc truyện (`font-story`):** `Cormorant Garamond` (Weights: 400, 600, Italic)
- **Giao diện điều khiển / UI (`font-ui`):** `Outfit` (Weights: 300, 400, 500, 600, 700)
- **Độ rộng khung đọc:** Tối đa `max-w-2xl` (65ch) để mắt không phải đảo quá rộng khi đọc.
- **Khoảng cách dòng:** `line-height: 1.85` (thông thoáng, dễ theo dõi).

---

## 4. Hiệu ứng Scrollytelling & UI Components

1. **Drop Cap (Chữ cái đầu đoạn):**
   - Phóng to `3.5rem - 4rem`, nổi bật màu `--color-accent`, font `Cinzel`.
2. **Khung tranh Scrollytelling (Sticky Viewport):**
   - Ghim cố định ở nền: `position: sticky; top: 0; height: 100vh`.
   - Chuyển cảnh mượt mà: `transition: opacity 0.8s ease, transform 0.8s ease`.
3. **Thanh tiến độ đọc (Progress Bar):**
   - Nằm trên đỉnh màn hình, chiều cao 3px, hiệu ứng chuyển màu theo `--color-accent`.
4. **Hộp thoại nhân vật (Dialogue Box):**
   - Avatar tròn 48px viền sáng, nền thẻ `--color-card` bo góc 14px.

---

## 5. Checklist Nghiệm thu UX (Pre-delivery Checklist)
- [ ] Không dùng emoji làm icon chính (dùng icon SVG từ thư viện `lucide-react`).
- [ ] Mọi nút bấm, icon có kích thước chạm tối thiểu 44px × 44px (`min-h-[44px] min-w-[44px]`).
- [ ] Có `cursor-pointer` và hiệu ứng hover chuyển động mượt mà (150-300ms) trên tất cả các phần tử click được.
- [ ] Độ tương phản văn bản đạt chuẩn WCAG AA (tối thiểu 4.5:1).
- [ ] Trạng thái focus hiển thị rõ ràng bằng `--color-ring` khi điều hướng bằng bàn phím.
- [ ] Tôn trọng `@media (prefers-reduced-motion: reduce)`: Tắt các hiệu ứng hạt/parallax mạnh đối với người dùng nhạy cảm chuyển động.
- [ ] Giao diện Responsive mượt mà trên 4 mốc: 375px (Mobile), 768px (Tablet), 1024px (Laptop), 1440px (Desktop).
"

