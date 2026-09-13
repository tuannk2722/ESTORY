# 04 — Thiết Kế UI/UX: Tích Hợp `ui-ux-pro-max-skill`

> Xem `00-INDEX.md` để biết thứ tự ưu tiên và điều hướng. Đọc file này trước khi quyết định bất kỳ màu sắc/font/spacing/motion preset nào.

---

## 4.1. Skill này là gì

`ui-ux-pro-max-skill` (GitHub: `nextlevelbuilder/ui-ux-pro-max-skill`) là một **AI skill** — cơ sở dữ liệu tra cứu (~84 style, ~192 color palette, font pairing, UX guideline, GSAP motion preset...) mà AI coding assistant dùng để **ra quyết định thiết kế có căn cứ**, hỗ trợ Next.js + Tailwind. Đây **không phải** component library, không sinh code UI trực tiếp — nó cung cấp *tài liệu tham khảo có cấu trúc* để AI/bạn chọn design token phù hợp.

## 4.2. Cách dùng trong project này

- **Reader Screen**: tra cứu palette/font pairing phù hợp theo thể loại/mood truyện (kinh dị, lãng mạn...) thay vì đoán màu ngẫu nhiên.
- **Author Editor**: tra cứu guideline cho dashboard/form UX.
- **Admin Portal**: tra cứu tập trung cho responsive sidebar, table→card, form validation và drawer/dialog focus; vẫn dùng semantic token/theme hiện có, không sinh một design system hoặc bộ màu riêng cho `/admin/**`.
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

## 4.4. Component token cho Home Hero

Home Hero dùng semantic/component token, không hardcode overlay theo tên file ảnh:

| Token | Vai trò |
|---|---|
| `--home-hero-placeholder` | nền tức thì khi ảnh chưa tải hoặc lỗi; dẫn xuất từ `--color-background`/`--color-muted` của theme |
| `--home-hero-scrim` | radial/linear scrim sau content để chữ, search và chip không phụ thuộc độ sáng cục bộ của artwork |
| `--home-hero-control-surface` | surface đủ đặc cho search/chip, dẫn xuất từ `--color-card`; không dùng glass trong tới mức mất contrast |
| `--home-hero-bottom-fade` | fade ảnh về đúng `--color-background` trước Story section |

Mỗi `[data-theme="dark|light|sepia"]` chỉ gán giá trị cho bốn token trên; mapping theme →
asset thuộc `HomeHeroArtwork`, không nhét URL vào primitive color token. Foreground/body text
trên vùng ảnh đạt WCAG AA 4.5:1, large heading tối thiểu 3:1; border/focus/control vẫn dùng
semantic token hiện có. Đánh giá contrast trên **ảnh + scrim thực tế** ở cả safe zone và mọi
breakpoint, không chỉ so hai mã màu. Chi tiết layout/loading/switch ở `04b` §1 và `11` §9.2.3.

---
← Về `00-INDEX.md` | Trước: `03-file-structure.md` | Tiếp theo: `05-user-stories-phase1.md`
