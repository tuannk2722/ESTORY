# 04 — Thiết Kế UI/UX: Tích Hợp `ui-ux-pro-max-skill`

> Xem `00-INDEX.md` để biết thứ tự ưu tiên và điều hướng. Đọc file này trước khi quyết định bất kỳ màu sắc/font/spacing/motion preset nào.

---

## 4.1. Skill này là gì

`ui-ux-pro-max-skill` (GitHub: `nextlevelbuilder/ui-ux-pro-max-skill`) là một **AI skill** — cơ sở dữ liệu tra cứu (~84 style, ~192 color palette, font pairing, UX guideline, GSAP motion preset...) mà AI coding assistant dùng để **ra quyết định thiết kế có căn cứ**, hỗ trợ Next.js + Tailwind. Đây **không phải** component library, không sinh code UI trực tiếp — nó cung cấp *tài liệu tham khảo có cấu trúc* để AI/bạn chọn design token phù hợp.

## 4.2. Cách dùng trong project này

- **Reader Screen**: tra cứu palette/font pairing phù hợp theo thể loại/mood truyện (kinh dị, lãng mạn...) thay vì đoán màu ngẫu nhiên.
- **Author Editor**: tra cứu guideline cho dashboard/form UX.
- **Landing/Story list page**: tra cứu style tổng thể (typography scale, spacing system) để nhất quán toàn app.
- **Scene Palette Library** (xem `02-data-schema.md` mục 2.9 và `08-effects-and-scenes.md` mục 8.5): tra cứu phối màu theo mood truyện thay vì tự chọn ngẫu nhiên — mỗi `ColorPalette` điều khiển màu + opacity lớp phủ (`background_tint`) và điểm nhấn (`primary`, `accent`). Riêng canvas đọc truyện luôn dùng Cinematic Dark với chữ `#F8FAFC`; Theme Light/Sepia chỉ áp dụng cho app chrome, không đổi màu thân chữ truyện.
- Có thể tra cứu thủ công trước khi giao task cho AI:
```bash
# Khi chạy từ bên trong my-storytelling-app:
python3 ../.agents/skills/ui-ux-pro-max/scripts/search.py "horror dark reading app" --domain style
python3 ../.agents/skills/ui-ux-pro-max/scripts/search.py "reading app" --design-system -f markdown

# Hoặc từ workspace root (story-telling):
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "horror dark reading app" --domain style
```

## 4.3. Ranh giới sử dụng

- Skill chỉ tác động tới **quyết định thiết kế** (màu sắc, font, spacing, motion preset tham khảo) — **không** được dùng để thay đổi kiến trúc Data Schema (`02-data-schema.md`) hay Repository pattern (`11-phase3-technical-roadmap.md` mục 9.2) đã chốt.
- Vẫn cần review bằng mắt — skill đưa gợi ý có căn cứ, không đảm bảo khớp 100% gu thẩm mỹ cá nhân.
- Áp dụng ở **mọi phase** (1, 2, 3), không riêng giai đoạn nào.

---
← Về `00-INDEX.md` | Trước: `03-file-structure.md` | Tiếp theo: `05-user-stories-phase1.md`
