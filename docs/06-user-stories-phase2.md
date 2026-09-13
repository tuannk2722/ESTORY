# 06 — User Stories & Acceptance Criteria — PHASE 2 (Author Editor)

> Xem `00-INDEX.md` để biết thứ tự ưu tiên và điều hướng. Trước khi implement, đọc `01-tech-stack.md`, `02-data-schema.md`, và `05-user-stories-phase1.md`.

---

**US-2.1 — Soạn thảo nội dung theo block chuyên sâu**
> Là tác giả, tôi muốn viết truyện theo từng đoạn (block) linh hoạt với giao diện công thái học.
- [ ] Trang `/author/stories/[storyId]/[chapterId]` bố cục 3 cột cân bằng (`ScenePanel` ↔ `BlockEditor` ↔ `Timeline`). *(Route trước đây gọi `/editor/[storyId]/[chapterId]` — đổi tên ngay từ Phase 2, xem `12-auth-and-author-management.md` mục 12.1)*
- [ ] Mỗi block có segmented control 3 kiểu: `paragraph` (đoạn văn chuẩn), `dialogue` (đối thoại in nghiêng + màu accent), `heading` (tiêu đề in đậm to `font-display`).
- [ ] Textarea auto-expanding tự động giãn nở chiều cao theo nội dung (`scrollHeight`), không có thanh cuộn riêng gây phân tâm.
- [ ] Kéo thả sắp xếp lại block bằng HTML5 Drag & Drop engine với Custom Drag Ghost (`opacity: 0.85`, xoay `1.5deg`), throttled `dragOver` qua `requestAnimationFrame`, và động cơ tự động cuộn trang (`Auto-Scroll` tại vùng biên 120px).
- [ ] `Hover Divider Gap`: Rê chuột giữa 2 block làm xuất hiện đường kẻ sáng và nút `+` để chèn block trống ở giữa; nút `+ Thêm Đoạn Văn Mới` cố định cuối trang.
- [ ] Nút xóa thông minh (`Popconfirm`): Xóa ngay không cần hỏi nếu block rỗng; bật popup xác nhận nếu block có nội dung/hiệu ứng; chặn xóa kèm thông báo nếu chương chỉ còn đúng 1 block.

**US-2.2 — Gắn & Tinh chỉnh hiệu ứng block (`EffectPicker`)**
> Là tác giả, tôi muốn gắn một hoặc nhiều hiệu ứng chấm phá vào block và tinh chỉnh thông số trực quan.
- [ ] Nút `+ Gắn Hiệu Ứng` mở `EffectPicker.tsx` dạng modal `z-[80]` căn giữa với 4 tab danh mục: `Hình Ảnh (Visual)`, `Chuyển Động (Motion)`, `Âm Thanh (Audio)`, `Chuyển Cảnh (Transition)`.
- [ ] Ô tìm kiếm thời gian thực lọc client-side catalog đã tải theo tên/mô tả bằng AND-token substring bỏ dấu/case; không URL, debounce, request server hay gọi sai là fuzzy search. Tự động ưu tiên đưa hiệu ứng đang sửa lên đầu danh sách.
- [ ] Bộ 4 thanh trượt thông số: `Intensity` (0.1 - 1.0), `Duration` (200ms - 10000ms), `Delay` (0ms - 3000ms cho chuỗi choreography), và công tắc `Loop`.
- [ ] Nút con mắt `Eye` kích hoạt **Live Preview Portal tức thì (`z-[90]`)** qua `createPortal` render hạt/chớp sáng toàn màn hình trong 5 giây mà không làm đóng modal.
- [ ] Quick Effect Preview luôn phát đúng cấu hình effect đang chỉnh, không áp dụng `effects_enabled`, category toggles, `intensity_multiplier` hay `reduced_motion` của Reader; thay đổi thông số khi preview đang mở phải cập nhật preview. Đây là công cụ kiểm thử effect, không phải mô phỏng trải nghiệm Reader.
- [ ] Với audio `loop: false`, nhãn `duration_ms` là **Giới hạn phát tối đa**: audio chỉ phát một lần; giới hạn chỉ cắt file dài hơn, không kéo dài hoặc tự phát lại file ngắn.
- [ ] Hiệu ứng đã gắn hiển thị thành chip trên block, click thân chip để sửa lại, click `X` để gỡ bỏ. Block có thể gắn nhiều hiệu ứng cùng lúc.
- [ ] Ở Phase 2, tab `Âm Thanh` chọn `audio_src` qua preset có sẵn hoặc dán URL thủ công. **(Mở rộng ở Phase 3, không thuộc scope Phase 2 này)**: thêm nguồn "Thư viện của tôi" / "Tải lên" / "Tìm trên Freesound" — vì cần `authorId` thật + quota cá nhân, xem `08-effects-and-scenes.md` mục 8.9 và `07-user-stories-phase3.md` US-3.18.

**US-2.3 — Gợi ý hiệu ứng thông minh theo từ khóa (`effectSuggestion.ts`)**
> Là tác giả, tôi muốn hệ thống tự động gợi ý hiệu ứng phù hợp dựa trên nội dung tiếng Việt vừa gõ mà không làm gián đoạn dòng suy nghĩ.
- [ ] `lib/effectSuggestion.ts`: Bộ từ điển từ khóa tiếng Việt đa tầng gắn với độ tin cậy cơ sở (`baseConfidence` từ 0.75 đến 0.95).
- [ ] **Kích hoạt an toàn khi `onBlur`**: Chỉ quét từ khóa khi tác giả rời khỏi ô nhập liệu (`onBlur`), không hiện popup làm phiền lúc đang gõ phím.
- [ ] Hiển thị tối đa 3 chip gợi ý có icon `Sparkles` ngay dưới textarea, hover hiện tooltip từ khóa khớp, bấm chip mở ngay `EffectPicker` tương ứng. Gợi ý **không tự ý áp dụng**.

**US-2.4 — Timeline điều hướng toàn cảnh chương**
> Là tác giả, tôi muốn nhìn tổng quan toàn bộ mạch truyện và vị trí các hiệu ứng / bối cảnh.
- [ ] Cột `Timeline.tsx` (`sticky top-20`, tự co giãn `w-64 ↔ w-80`) thống kê tổng số block và tổng số hiệu ứng (`Zap` icon).
- [ ] Mỗi block hiển thị rút gọn: Số `#index`, nhãn loại, huy hiệu Scene (`S1`, `S2`...), dải icon hiệu ứng, và 1 dòng trích đoạn.
- [ ] `Scene Ribbon`: Vạch kẻ đứng màu accent ở mép trái thẻ biểu thị ranh giới phân đoạn Scene.
- [ ] Click vào thẻ: Cuộn mượt màn hình chính tới đúng block (`scrollIntoView`) và highlight tạm thời. Đồng bộ trạng thái chọn dải Scene.

**US-2.5 — Chuyển đổi linh hoạt Soạn Thảo & Xem Trước (`Floating Action Dock`)**
> Là tác giả, tôi muốn chuyển đổi tức thì giữa chế độ viết và chế độ đọc thử mà không bị mất thanh điều khiển.
- [ ] `Floating Action Dock` cố định tại `fixed bottom-6 left-1/2 -translate-x-1/2 z-[60]`, luôn nổi trên cả giao diện soạn thảo và màn hình Preview toàn màn hình (`z-50`).
- [ ] Bộ gạt `PreviewToggle`: Nút `Soạn Thảo` (`Edit3`) và `Xem Trước` (`Eye`) chuyển đổi qua lại 0ms không tải lại trang.
- [ ] Chế độ Preview mở đúng `ReaderPane` component với dữ liệu state đang soạn thảo (chưa lưu) kèm nút gạt quay lại chế độ soạn thảo.
- [ ] Full Editor Preview mặc định mô phỏng đúng Reader Settings toàn cục và dùng cùng `ReaderScreenHeader`; liên kết quay lại trên header ở trạng thái disabled để không rời editor ngoài ý muốn.

**US-2.6 — Lưu nội dung & An toàn dữ liệu**
> Là tác giả, tôi muốn lưu lại toàn bộ nội dung đã soạn ở bất kỳ chế độ nào và được bảo vệ khỏi mất dữ liệu.
- [ ] Nút `Lưu Thay Đổi` trên Floating Action Dock hoạt động ở cả chế độ Soạn Thảo và ngay khi đang Xem Trước.
- [ ] Gọi API Route `PUT /api/stories/[storyId]` gọi `StoryRepository.save()` (ghi đè JSON ở Phase 2, swap sang DB ở Phase 3).
- [ ] Trạng thái `isSaving`: Icon xoay tròn `Loader2`, vô hiệu hóa nút bấm chống click đúp, thông báo toast 6 giây.
- [ ] Nút `ArrowLeft` trên Header tích hợp `ConfirmModal` (`z-[100]`) cảnh báo trước khi rời trang nếu có thay đổi chưa lưu.

**US-2.7 — Quản lý & Gán Scene cho dải block (`ScenePanel` & `ScenePicker`)**
> Là tác giả, tôi muốn quản lý và gán bối cảnh môi trường cho từng dải block liên tiếp.
- [ ] `ScenePanel.tsx` bên trái (`sticky top-20`, hỗ trợ thu gọn `w-14` / mở rộng `w-72`):
  - Chế độ thu gọn: Dãy nút tròn Mini Scene (1, 2, 3...) tự phóng to và sáng viền khi focus vào block thuộc Scene; click cuộn tới block đầu.
  - Chế độ mở rộng: Khung chọn dải block 2 bước có chỉ dẫn rõ ràng.
- [ ] **Thuật toán chống va chạm chồng lấn (Overlap Collision Check)**: $\max(start_A, start_B) \le \min(end_A, end_B)$ — chặn ngay lập tức nếu dải chọn giao thoa với Scene khác trong chương.
- [ ] Hộp thoại `ScenePicker.tsx` (`z-[80]`, `max-w-4xl`) Tab 1 "Preset Có Sẵn": Lưới 2 cột các mẫu bối cảnh kèm search client-side trên catalog đã tải và visible batching “Xem thêm” (không phải server pagination/cursor), swatch 3 màu, nút `Xem trước` 1-Click.
- [ ] Implementation Phase 2 legacy resolve preset qua `background_id`/`palette_id`; khi vào Phase 3 bắt buộc migrate thành deep snapshot `SceneRenderConfig` và ghi qua `SceneCommandService`, không giữ ID catalog làm runtime source. Timeline/ScenePanel vẫn cập nhật Optimistic UI.

**US-2.8 — Tự phối bối cảnh riêng (Custom Scene Composition)**
> Là tác giả, tôi muốn tự do chọn từng thành phần nền, bảng màu, hiệu ứng không gian và nhạc nền.
- [ ] Tab 2 "Tùy Chỉnh Phối Riêng" trong `ScenePicker.tsx` hỗ trợ quy trình 4 bước:
  - 1. Chọn bối cảnh nền (`BackgroundAsset` dạng Image, Gradient, Video loop, Particle) — Phase 2 chỉ chọn từ thư viện seed JSON (`scope: "global"`). **(Mở rộng ở Phase 3, không thuộc scope Phase 2 này)**: thêm "Tải lên" (ảnh hoặc video + poster bắt buộc) / "Tạo bằng AI" cho background cá nhân — `08-effects-and-scenes.md` mục 8.10, `07-user-stories-phase3.md` US-3.19.
  - 2. Chọn bảng màu ánh sáng (`ColorPalette` qua `SearchableCombobox` hiển thị dải 4 vệt màu).
  - 3. Thêm & tinh chỉnh hiệu ứng không gian đa tầng (chỉ liệt kê effect phù hợp phạm vi Scene; Dropdown thêm + Badges + **Popover chống tràn dùng chung `EffectConfigForm` chuẩn với EffectPicker block**, không duy trì form tham số riêng).
  - 4. Cấu hình nhạc nền môi trường (Chọn preset hoặc nhập URL thủ công, thanh trượt âm lượng, checkbox `loop`) — cùng ghi chú mở rộng nguồn âm thanh cá nhân như US-2.2 ở trên (`08-effects-and-scenes.md` mục 8.9).
- [ ] Có thể mở lại bất kỳ Scene nào để chỉnh sửa hoặc xóa Scene (kèm `ConfirmModal` cảnh báo nguy hiểm).

**US-2.9 — Trải nghiệm Live Preview theo kiến trúc Text-First**
> Là tác giả, tôi muốn thấy bối cảnh và hiệu ứng hoạt động sống động trong khi văn bản truyện luôn sắc nét 100%.
- [ ] Áp dụng **Text-First Visual Rendering Stack**:
  - `Story Text Layer` (`z-20`): Tiêu đề, văn bản truyện, Drop Cap, hộp thoại luôn ở tầng cao nhất.
  - `Effects Layer` (`z-[5]`): Hạt môi trường và hiệu ứng block trôi êm đềm ở tầng dưới con chữ, 100% mang thuộc tính `pointer-events-none`.
  - `Color Palette Layer` (`z-0`): Color wash, depth gradient, ambient aura.
  - `Background Layer` (`z-0`): Ảnh / Video loop / Gradient.
- [ ] Cuộn qua ranh giới Scene có hiệu ứng crossfade mượt (~800ms) qua Framer Motion `AnimatePresence`.
- [ ] Hỗ trợ `reduced_motion`: Hiển thị `poster_frame` tĩnh thay cho video loop và tắt chuyển động hạt khi người dùng bật chế độ giảm chuyển động.
- [ ] Scene Preview giữ header riêng của modal và hiển thị trạng thái Reader Settings đang ảnh hưởng đến preview; không cung cấp override riêng trong Scene Preview.

---

## Definition of Done — Phase 2

Tác giả có thể mở editor cho 1 chapter → viết/sửa/xóa các block với 3 định dạng → kéo thả sắp xếp lại mượt mà với auto-scroll → gắn hiệu ứng qua `EffectPicker` modal kèm xem thử portal 5s (dùng gợi ý từ khóa `onBlur` ít nhất 1 lần) → chọn dải block hợp lệ tạo Scene từ Preset (thử nút xem trước 1-click) và tự phối 1 Scene riêng 4 bước (với video loop và popover thông số `clamp`) → chuyển đổi qua lại giữa Soạn Thảo và Xem Trước mượt mà qua Floating Action Dock (`z-[60]`) → lưu truyện thành công với phản hồi toast 6s — toàn bộ dữ liệu quản lý qua `StoryRepository`/`SceneRepository`/`SceneLibraryRepository` theo chuẩn Repository Pattern.

---
← Về `00-INDEX.md` | Trước: `05-user-stories-phase1.md` | Tiếp theo: `07-user-stories-phase3.md` (xem thêm `08-effects-and-scenes.md`)
