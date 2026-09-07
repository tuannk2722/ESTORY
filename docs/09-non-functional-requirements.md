# 09 — Non-Functional Requirements (áp dụng xuyên suốt)

> Xem `00-INDEX.md` để biết thứ tự ưu tiên và điều hướng. Rà lại checklist này trước khi coi 1 task là "hoàn thành", bất kể đang ở phase nào.

---

- **Performance:** Lighthouse Performance score mục tiêu ≥ 85 trên trang Reader. Không load toàn bộ audio/particle cả chapter cùng lúc — dùng `rootMargin` của Intersection Observer để pre-load sớm ~1 block trước.
- **Accessibility:** Text luôn đọc được (contrast đạt WCAG AA tối thiểu) kể cả khi effect đang chạy hoặc khi Scene đang hiển thị nền dạng ảnh/particle phía sau (canvas Reader luôn Cinematic Dark, màu chữ truyện cố định `#F8FAFC`, kết hợp lớp phủ `background_tint` ~35% và vignette nền để đảm bảo tương phản). Theme Light/Sepia không đổi canvas nội dung. Hỗ trợ `prefers-reduced-motion` bắt buộc (chuyển looping video/particle sang poster frame tĩnh).
- **Responsive:** Hoạt động tốt từ 375px (mobile) tới desktop. Effect trên mobile có thể giảm bớt độ phức tạp để đảm bảo mượt.
- **Code style:** Component nhỏ, đơn nhiệm. Không file nào quá dài — nếu quá dài và chưa hợp lý nhất thì tách nhỏ.
- **Bảo mật (Phase 3):** Mọi Route Handler ghi dữ liệu phải qua kiểm tra session + role. Không expose Prisma client trực tiếp cho client-side. Secrets (DB URL, OAuth keys) luôn qua biến môi trường, không hardcode.
- **Public read boundary (mọi Phase):** fail-closed khi `Story.status`/`Chapter.status` bị thiếu hoặc không phải `published`. Endpoint nhận `chapterId` phải xác minh chapter thuộc đúng public Story; không query/trả Scene, block hay effect chỉ dựa trên ID do client cung cấp. Editor dùng boundary full + ownership/role riêng, không tái sử dụng public filter cho draft.
- **Story attribution/ownership:** public DTO dùng `Story.author` map từ `authorDisplayName`; internal Prisma Story PK và `authorId` không thay cho slug/byline. Ownership luôn query bằng `authorId`, không suy từ tên hiển thị; shadow log không chứa byline hoặc nội dung truyện.
- **Bảo mật tích hợp bên thứ 3 (Phase 3 — Freesound & AI Background, `08-effects-and-scenes.md` mục 8.9, 8.10):** `access_token`/`refresh_token` Freesound mã hoá at-rest trong DB, không bao giờ trả về client hay xuất hiện trong log. Mọi lượt gọi Freesound/Cloudflare Workers AI đều qua server (Route Handler), không gọi thẳng từ client. Giới hạn concurrent request tới upstream (Freesound search, Cloudflare Workers AI) theo author để tránh 1 user chiếm hết headroom chung. File upload (audio/ảnh) validate định dạng + dung lượng ở cả client lẫn server — server là nguồn tin cậy cuối cùng, không tin client-side check.
- **Quota theo ngày (Phase 3):** `freesound_import_quota` và `ai_background_quota` (`02-data-schema.md` mục 2.5) dùng pattern reserve trước khi gọi upstream → commit khi thành công / refund khi lỗi, tránh trường hợp author bị trừ quota oan vì lỗi hệ thống. Search/Preview Freesound **không** tính vào quota này.
- **Admin accessibility (Phase 3):** table phải chuyển thành card ở mobile thay vì buộc thao tác chính qua horizontal scroll; tabs/drawer/dialog/menu/form/preview dùng được bằng keyboard. Drawer/dialog trap focus và trả focus về trigger; submit lỗi focus error summary rồi liên kết tới field; không bắt buộc mọi touch target ≥44×44px; status/error không chỉ biểu thị bằng màu.
- **Admin media UX:** upload có progress, Cancel/Retry và server-side MIME/magic-byte/size validation. Looping asset thiếu poster bị chặn trước khi publish. Thumbnail lazy-load, cố định aspect ratio để tránh layout shift; Preview không autoplay audio.
- **Scene snapshot integrity:** Reader chỉ render `SceneRenderConfig`, không tải toàn bộ catalog. `schema_version` phải được validate; snapshot/media URL là immutable. Replace upload tạo object key mới; archive/hard-delete catalog không được làm hỏng Scene cũ.
- **Catalog query boundary:** Author chỉ thấy item `active`; Admin Scene API chỉ trả Background `scope = global`; personal asset luôn filter theo `ownerId`. Mọi archive/hard-delete trả dependency impact; storage cleanup tách khỏi DB mutation.
- **AI preview payload:** Vercel Function giới hạn request và response 4.5 MB. Không trả hai ảnh base64 trong một response nếu chưa chứng minh payload nằm dưới ngưỡng; mỗi preview/commit request phải có encoded-size cap và test 413 boundary.

---
← Về `00-INDEX.md` | Trước: `08-effects-and-scenes.md` | Tiếp theo: `10-out-of-scope.md`
