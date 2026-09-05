# 05 — User Stories & Acceptance Criteria — PHASE 1 (Reader-only MVP)

> Xem `00-INDEX.md` để biết thứ tự ưu tiên và điều hướng. Trước khi implement, đọc `01-tech-stack.md` và `02-data-schema.md`. Đây thuộc nhóm **User Stories** — ưu tiên thứ 3 khi có mâu thuẫn.

---

**US-1.1 — Xem danh sách truyện**
> Là người đọc, tôi muốn thấy danh sách truyện có sẵn để chọn đọc.
- [ ] Trang `/` hiển thị grid/list các truyện, lấy dữ liệu qua `StoryRepository.getAllPublic()` (không đọc file JSON trực tiếp trong component — xem `11-phase3-technical-roadmap.md` mục 9.2)
- [ ] Mỗi item hiện: cover (hoặc placeholder), title, description, genre tags
- [ ] Click vào → điều hướng tới `/stories/[storyId]`

**US-1.2 — Xem mục lục truyện**
> Là người đọc, tôi muốn thấy danh sách chương của một truyện trước khi đọc.
- [ ] Trang `/stories/[storyId]` liệt kê chapters theo `order`
- [ ] Nếu có `ReadingProgress` cho truyện này (đọc qua `settingsStore`) → hiện nút "Đọc tiếp" dẫn thẳng tới đúng chapter/block

**US-1.3 — Đọc truyện với hiệu ứng theo viewport**
> Là người đọc, khi tôi cuộn tới một block có effect, effect đó phải tự kích hoạt đúng lúc.
- [ ] Dùng một Intersection Observer chung để khoanh vùng các block gần viewport, sau đó chọn active block quanh reading anchor (~42% vùng đọc hữu dụng). Có hysteresis nhỏ ở ranh giới để tránh đổi qua lại; cách chọn phải chuẩn hóa theo phần block có thể nhìn thấy để paragraph dài không bị bất lợi. Khi active block đổi → trigger toàn bộ `effects[]` của block đó (áp dụng `delay_ms` nếu có)
- [ ] Effect chỉ trigger **1 lần mỗi lần block vào viewport** — trừ effect `loop: true` (BGM) chạy liên tục cho tới khi rời khỏi phạm vi block/chapter
- [ ] Text luôn đọc được rõ ràng và sắc nét 100% (áp dụng kiến trúc Text-First: văn bản `z-20` luôn nổi trên các hiệu ứng hạt/thị giác `z-[5]`, hiệu ứng mang thuộc tính `pointer-events-none`)
- [ ] Effect intensity thực tế = `effect.intensity * settings.intensity_multiplier`
- [ ] Nếu `settings.effects_enabled === false` → không trigger effect nào, chỉ hiện text thuần

**US-1.4 — Tùy chỉnh trải nghiệm đọc**
> Là người đọc, tôi muốn bật/tắt và điều chỉnh cường độ hiệu ứng.
- [ ] SettingsPanel có: toggle tổng, toggle riêng 4 category, slider intensity_multiplier (0–100%), toggle reduced_motion, font size, theme. Theme áp dụng cho app chrome; canvas nội dung truyện luôn Cinematic Dark theo chủ đích thiết kế
- [ ] Thay đổi lưu ngay qua `settingsStore` (Phase 1–2: localStorage) và áp dụng real-time
- [ ] `reduced_motion` mặc định = `window.matchMedia('(prefers-reduced-motion: reduce)')`, user có thể override thủ công
- [ ] `ReaderScreenHeader` hiển thị trạng thái khi `reduced_motion`, master effects, category effects hoặc cường độ 0% đang làm thay đổi trải nghiệm; trạng thái dẫn tới `SettingsPanel` để Reader hiểu vì sao effect không xuất hiện
- [ ] Khi `reduced_motion` có hiệu lực, nội dung chữ và audio vẫn khả dụng; video/asset looping dùng poster tĩnh, visual/motion/transition động không được mount

**US-1.5 — Chọn font chữ đọc truyện**
> Là người đọc, tôi muốn chọn font chữ hiển thị nội dung truyện theo sở thích cá nhân.
- [ ] SettingsPanel có selector `font_family` (xem `02-data-schema.md` mục 2.3), liệt kê các lựa chọn font serif văn học đã định nghĩa ở `04-ui-ux-design.md`
- [ ] Mỗi lựa chọn trong selector hiển thị preview bằng chính font đó (không hiện tên font bằng font mặc định của UI)
- [ ] Chỉ áp dụng cho vùng văn bản truyện (`prose-reader`/`font-story`) — **không** đổi font tiêu đề chương (`font-display`) hay font giao diện điều khiển (`font-ui`)
- [ ] Thay đổi lưu ngay qua `settingsStore` và áp dụng real-time, cùng cơ chế với `font_size`/`theme` (US-1.4)

**US-1.6 — Lưu tiến trình đọc**
> Là người đọc, tôi muốn quay lại đúng vị trí đã đọc.
- [ ] Khi block cuối cùng đọc tới thay đổi, debounce ~1s rồi ghi `ReadingProgress` qua `settingsStore`
- [ ] Khi mở lại chapter đã đọc dở, tự động scroll tới đúng block đã lưu

**US-1.7 — Điều hướng chương**
> Là người đọc, tôi muốn dễ dàng chuyển chương và biết mình đang đọc tới đâu.
- [ ] ProgressBar hiển thị % đã cuộn trong chapter hiện tại
- [ ] Có nút "Chương trước / Chương sau" ở cuối mỗi chapter

**US-1.8 — Trang "Đang đọc"**
> Là người đọc, tôi muốn thấy tất cả truyện tôi đang đọc dở ở một trang riêng.
- [ ] Trang `/library/reading` liệt kê `Story` có `ReadingProgress.status === "reading"` (`02-data-schema.md` mục 2.3), sắp xếp theo `updated_at` giảm dần
- [ ] Mỗi item hiện: cover, title, % tiến trình ước lượng, nút "Đọc tiếp" dẫn thẳng tới đúng chapter/block
- [ ] Danh sách này **suy ra tự động** từ hành vi đọc, không cần user tự thêm

**US-1.9 — Trang "Đã lưu" (Bookmark)**
> Là người đọc, tôi muốn chủ động lưu truyện muốn đọc sau vào một danh sách riêng, tách biệt với "Đang đọc".
- [ ] Nút bookmark (toggle on/off) hiện ở trang chi tiết truyện và trên mỗi item danh sách
- [ ] Trang `/library/bookmarks` liệt kê toàn bộ `Story` có trong `Bookmark` (`02-data-schema.md` mục 2.4) của user, sắp xếp theo `created_at` giảm dần
- [ ] Một truyện có thể vừa nằm ở "Đang đọc" vừa ở "Đã lưu" cùng lúc, độc lập với nhau
- [ ] Phase 1–2 (chưa auth thật): lưu bookmark ở localStorage, hoạt động bình thường không cần đăng nhập

---

## Definition of Done — Phase 1

Người dùng có thể: mở app → chọn 1 truyện demo → đọc ít nhất 1 chapter có tối thiểu 5 effect khác loại (2 visual, 1 audio, 1 motion, 1 transition) → tùy chỉnh và thấy hiệu ứng thay đổi real-time → rời đi và quay lại đúng vị trí → thấy truyện đó xuất hiện ở trang "Đang đọc" → bookmark 1 truyện khác và thấy nó xuất hiện ở trang "Đã lưu". **Cộng thêm:** toàn bộ truy cập dữ liệu đi qua `StoryRepository`/`settingsStore`, không có component nào gọi thẳng `fs.readFile` hay `localStorage` trực tiếp.

---
← Về `00-INDEX.md` | Trước: `04-ui-ux-design.md` | Tiếp theo: `06-user-stories-phase2.md`
