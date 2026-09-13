# 10 — Những Gì KHÔNG Làm (Out of Scope theo từng phase)

> Xem `00-INDEX.md` để biết thứ tự ưu tiên và điều hướng. File này thuộc nhóm **Constraints** cùng với `01-tech-stack.md` — ưu tiên cao nhất khi có mâu thuẫn. **Luôn kiểm tra file này trước khi tự ý thêm bất kỳ tính năng/công nghệ nào ngoài yêu cầu rõ ràng của task.**

---

## Ở Phase 1–2, không tự ý thêm (trừ khi task yêu cầu rõ)

- Authentication/login thật (chỉ chuẩn bị `types/user.ts` cho trước, chưa dùng — xem `02-data-schema.md` mục 2.5)
- Database thật (Postgres/MongoDB/Supabase...)
- i18n/đa ngôn ngữ
- Thanh toán/monetization
- Đổi framework khác (Remix, SvelteKit...) — stack đã chốt ở `01-tech-stack.md`

## Xuyên suốt mọi phase, không tự ý thêm

- Microservices/tách backend riêng (NestJS/Express riêng biệt) — Next.js full-stack là đủ
- i18n, thanh toán, đổi framework — vẫn không nằm trong scope trừ khi có yêu cầu tường minh mới
- **Rating/Comment (đánh giá sao + bình luận):** đã có schema dự trữ ở `02-data-schema.md` mục 2.8 nhưng **chưa** được đưa vào scope Phase 3 hiện tại — không tự ý implement bảng/route/UI cho 2 tính năng này cho tới khi có yêu cầu tường minh ở phase tiếp theo
- **Trang thống kê cho Author (`/author/.../stats`):** đã có schema dự trữ (`StoryStats`, `Chapter.view_count`) ở `02-data-schema.md` mục 2.10 để tránh phải sửa schema giữa chừng, nhưng **chưa** xây route/UI hiển thị — chỉ số `👁`/`🔖` trên `StoryManageCard` (`12-auth-and-author-management.md` mục 12.4) cũng chỉ hiện khi có dữ liệu, không tự bịa UI thống kê chi tiết hơn cho tới khi có yêu cầu tường minh
- **Global Sound Library dùng chung cho mọi author:** `AudioAsset` import từ Freesound hoặc upload (`08-effects-and-scenes.md` mục 8.9) luôn là asset **cá nhân** (`owner_id`) — không tự động/thủ công "promote" lên thư viện dùng chung cho author khác. Tương tự, `BackgroundAsset` cá nhân (`scope: "personal"`, upload hoặc AI generate — mục 8.10) không được đưa vào thư viện global do admin quản lý. Chỉ triển khai khi có yêu cầu tường minh riêng.
- **Edit/trim audio sau khi import/upload:** không xây UI cắt/chỉnh sửa waveform cho `AudioAsset` — author cần sound đúng độ dài thì tự chuẩn bị trước khi import/upload.
- **Content moderation UI riêng cho ảnh AI-generate/audio import:** dựa vào bộ lọc mặc định của Cloudflare Workers AI và chính sách nội dung của Freesound, không tự xây thêm lớp kiểm duyệt/dashboard riêng cho 2 luồng này.
- **Bulk moderation và lịch sử/audit dashboard:** P3-11 duyệt hoặc từ chối từng Story sau khi xem chi tiết; không thêm multi-select/bulk decision, bảng moderation history hay notification workflow. `reviewed_at/reviewed_by/rejection_reason` chỉ giữ quyết định gần nhất theo `02` §2.7.
- **AI/semantic search cho Story:** chưa thêm embedding/vector column, indexing job, external search provider, autocomplete, typo correction hoặc relevance score/ranking. P3-11 chỉ giữ query/DTO/repository seam theo `11` §9.2.2; AI tạo ảnh ở §8.10 là scope khác và không bị dòng này loại bỏ.
- **Mở rộng Home Hero ngoài ba ảnh tĩnh:** P3-11A không thêm video, parallax, particle, ảnh theo mùa/người dùng/genre hoặc ornament ngoài layout `04b` §1. Không sinh một bản rồi dùng CSS filter thay ba artwork đã có. Portrait art-direction riêng chỉ bổ sung nếu sau này có yêu cầu phải giữ cả motif trái/phải trên mobile; hiện tại cho phép crop chúng như decoration.
- **No-code Effect builder trong Admin:** admin không tạo `EffectType`, renderer, category/icon, default slider hoặc per-picker visibility. Những phần này thuộc technical effect manifest và cần thay đổi code + test.
- **ScenePreset builder trong Admin:** curated preset mới chỉ được developer seed/import bằng script. Admin được Preview và sửa metadata/catalog status, không dùng lại Custom ScenePicker bốn bước để tạo preset.
- **Raw CSS/JSON authoring cho Scene catalog:** form Background không nhận CSS gradient tùy ý hay particle JSON tùy ý. Chỉ dùng typed gradient fields và `composition_key` đã đăng ký/validate trong code.
- **Xóa vật lý media cùng lúc với archive catalog:** “Remove khỏi catalog” là soft archive. Không xóa/overwrite object storage đang nằm trong `SceneRenderConfig` snapshot; orphan cleanup là tác vụ riêng có reference audit.

## Về testing

Phase 1–2 không cần test coverage đầy đủ (ưu tiên tốc độ lặp UI/UX). Phase 3 mới bắt đầu yêu cầu unit test cho `lib/repositories` và `lib/services` (xem `07-user-stories-phase3.md` US-3.8) — vẫn không cần test coverage cho component UI.

---
← Về `00-INDEX.md` | Trước: `09-non-functional-requirements.md` | Tiếp theo: `11-phase3-technical-roadmap.md`
