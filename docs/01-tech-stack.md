# 01 — Tech Stack

> Xem `00-INDEX.md` để biết thứ tự ưu tiên và điều hướng. File này thuộc nhóm **Constraints** — ưu tiên cao nhất khi có mâu thuẫn với các file khác (trừ ràng buộc cụ thể hơn ở `10-out-of-scope.md`).

---

## 1.1. Phase 1–2 (MVP, chưa có backend thật)

| Layer | Công nghệ | Ghi chú |
|---|---|---|
| Framework | **Next.js 16.x (App Router)** | Khớp code hiện tại; Server Components mặc định, chỉ `"use client"` khi cần state/effect/interactivity |
| Ngôn ngữ | **TypeScript** | Strict mode bật. Không dùng `any` trừ khi không thể tránh, phải có comment giải thích |
| Styling | **Tailwind CSS** | Không viết CSS module riêng trừ khi Tailwind không đáp ứng được (VD: keyframe phức tạp → `tailwind.config` extend hoặc `globals.css`) |
| Animation | **Framer Motion** | Cho transition, text animation, entrance/exit effect |
| Particle effect | **CSS/SVG animation** | Mưa, tuyết, khói, đom đóm... dùng số lượng phần tử giới hạn và CSS variables để giữ bundle nhẹ; chỉ cân nhắc canvas engine khi profiler chứng minh cần thiết |
| Âm thanh | **Howler.js** | Quản lý BGM + sound effect rời rạc, hỗ trợ crossfade |
| Viewport detection | **Intersection Observer API** (native) | Biết đoạn văn nào đang trong khung nhìn → trigger effect |
| Icon | **lucide-react** | |
| State cài đặt đọc | **React Context + useReducer** | Không cần Redux/Zustand ở quy mô này |
| Data access | **Repository pattern** (xem `03-file-structure.md` mục 3.1) | Bọc nguồn dữ liệu ngay từ đầu, dù bên dưới vẫn là JSON |
| Lưu trữ nội dung truyện | **File JSON tĩnh** trong `/content/stories/*.json` | Đọc qua `JsonStoryRepository`, không đọc file trực tiếp trong component |
| Lưu cài đặt/tiến trình | **localStorage** (client-side) | Sẽ giữ lại làm cache ở Phase 3, không xóa bỏ |
| Package manager | **pnpm** | |
| Design reference | **ui-ux-pro-max skill** | Tra cứu style/palette/typography trước khi quyết định UI — xem `04-ui-ux-design.md` |
| Deploy | **Vercel** | Free tier đủ dùng |

## 1.2. Phase 3 — bổ sung khi lên production đầy đủ

| Layer | Công nghệ | Ghi chú |
|---|---|---|
| Database | **PostgreSQL** (Neon hoặc Supabase, managed, free tier) | |
| ORM | **Prisma** | Schema map 1:1 với `types/story.ts` — xem `11-phase3-technical-roadmap.md` mục 9.4 |
| Auth | **Auth.js (NextAuth v5)** | OAuth (Google/GitHub) ưu tiên hơn Credentials để đỡ tự quản lý password |
| Validation | **Zod** | Validate toàn bộ input/output của API Route Handlers |
| Media storage | **Cloudflare R2** hoặc **Supabase Storage** (S3-compatible) | Cover image, audio effect do tác giả upload |
| AI Image Generation | **Cloudflare Workers AI** (text-to-image) | Chỉ dùng cho tính năng "Tạo bằng AI" ở Scene background cá nhân của author — xem `08-effects-and-scenes.md` mục 8.10, luôn qua interface trừu tượng `ImageGenerationProvider` (`03-file-structure.md`), không gọi thẳng SDK trong component |
| 3rd-party audio | **Freesound APIv2** | Search/preview/import sound cá nhân của author — `08-effects-and-scenes.md` mục 8.9. Search/preview dùng app token chung; Import cần OAuth cá nhân (`12-auth-and-author-management.md` mục 12.9) |
| API | **Next.js Route Handlers** (`/app/api/**`) | Không tách backend riêng (NestJS/Express) trừ khi có lý do cụ thể — xem `11-phase3-technical-roadmap.md` mục 9.1 |
| CI/CD | **GitHub Actions** | Lint + type-check + test khi push |
| Production runtime | **Node.js 24 LTS** | Pin major bằng `.nvmrc`/`engines`; không dùng odd/current/EOL release cho build production |

> Vẫn **không** tách backend riêng, **không** dùng microservices — Next.js full-stack là đủ cho quy mô personal project kể cả ở Phase 3.

## 1.3. Ràng buộc kỹ thuật quan trọng (áp dụng mọi phase)

- **Không** dùng WebGL/Three.js ở Phase 1–2. Chỉ cân nhắc ở Phase 3 nếu có hiệu ứng thực sự cần 3D.
- **Không** thêm CMS/DB thật (Postgres, Supabase...) ở Phase 1–2 — nhưng **phải** viết code qua Repository pattern ngay từ đầu để Phase 3 không phải sửa UI layer khi swap.
- **Luôn** tôn trọng `prefers-reduced-motion` — mọi hiệu ứng chuyển động phải có nhánh fallback tĩnh.
- **Luôn** ưu tiên CSS/GPU-accelerated animation (`transform`, `opacity`) hơn animate `width/height/top/left`.
- Component hiệu ứng phải **pure/tách rời** — nhận props và tự render, không phụ thuộc cứng vào 1 truyện cụ thể.
- Khi refactor sang Phase 3, **không đụng vào `/components/reader` và `/components/effects`** trừ khi bắt buộc — đây là phần UI/UX đã ổn định, chỉ đổi lớp dữ liệu bên dưới (strangler pattern, xem `11-phase3-technical-roadmap.md`).
- **Chỉ dùng pnpm**: `packageManager` phải pin `pnpm@10.33.0`, CI dùng `pnpm install --frozen-lockfile`, repository chỉ giữ `pnpm-lock.yaml`. Không commit đồng thời `package-lock.json`.
- Phase 3 pin Node.js 24 LTS; local/CI/Vercel phải cùng major. Node 25 hiện là EOL và không được dùng làm baseline production.

---
← Về `00-INDEX.md` | Tiếp theo: `02-data-schema.md`
