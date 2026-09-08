# 04b — Page Layouts Chi Tiết — Phase 1, 2 & Management (Phase 3)

> Xem `00-INDEX.md` để biết thứ tự ưu tiên và điều hướng. File này **bổ sung** cho `04-ui-ux-design.md` (design token: màu/font/component class) — ở đây mô tả **bố cục giao diện thực tế từng trang/màn hình**, để AI assistant không phải tự đoán cách sắp xếp khi code. Mục 1 → 5: Phase 1–2. Mục 6 → 8: Phase 3 (Auth/Author/Admin), logic/rule chi tiết ở `07-user-stories-phase3.md`, `08-effects-and-scenes.md` và `12-auth-and-author-management.md`.

---

## 0. Quy ước Dùng Chung Cho Mọi Trang

- **Breakpoint** (khớp checklist `04`): `375px` (mobile) / `768px` (tablet) / `1024px` (laptop) / `1440px` (desktop). Mobile-first — style mặc định cho 375px, mở rộng dần bằng `md:`/`lg:`/`xl:` của Tailwind.
- **Spacing:** dùng thang mặc định của Tailwind (bội số 4px). Khoảng cách section chuẩn: `py-8 md:py-12 lg:py-16`; khoảng cách item trong grid: `gap-4 md:gap-6`.
- **Container:** trang danh sách/chi tiết dùng `max-w-6xl mx-auto px-4` hoặc `max-w-4xl mx-auto px-4`. Riêng khung đọc truyện dùng `max-w-2xl` / `max-w-[65ch]` căn giữa.
- **Z-Index Layering Matrix chuẩn toàn hệ thống (Text-First Architecture):**
  ```
  z-0     SceneLayer & Cinematic Color Grading (BackgroundAsset, Color wash, Depth tint, Ambient aura)
  z-[5]   EffectLayer & Visual/Motion/Particle Effects (toàn bộ hiệu ứng khí quyển, pointer-events-none)
  z-20    Story Text Layer (.prose-reader, StoryBlock, Tiêu đề chương, Drop Cap, Dialogue Box)
  z-50    ProgressBar (fixed top-0, nằm trên ReaderScreenHeader)
  z-40    AppHeader / ReaderScreenHeader sticky, SettingsPanel drawer
  z-50    Full Reader Preview Overlay (trong Editor mode)
  z-[60]  Floating Action Dock (PreviewToggle + Save Button)
  z-[80]  Modals & Backdrops (EffectPicker, ScenePicker)
  z-[90]  In-Modal Live Previews (createPortal preview, Scene Live Preview, Popconfirm)
  z-[100] ConfirmModal (cảnh báo nguy hiểm / rời trang)
  ```
- **Trạng thái chung:**
  - *Loading:* skeleton card cùng kích thước với card thật hoặc dòng text thông báo `glass-card p-12 text-center text-muted-foreground`.
  - *Empty:* icon `lucide-react` + 1 câu ngắn font-story/ui + nút CTA dẫn về `/`.
- **Icon:** toàn bộ dùng `lucide-react`, kích thước chạm tối thiểu `44×44px` (`min-h-[44px] min-w-[44px]`).

---

## 1. `/` — Trang Chủ / Khám Phá Truyện (US-1.1)

```
┌────────────────────────────────────────────────────────────────────────┐
│ AppHeader (sticky, z-40, glass-card blur)                              │
│  ✨ StoryVerse      [📖 Khám phá] [🕒 Đang đọc] [🔖 Đã lưu]   [User/Theme]│
├────────────────────────────────────────────────────────────────────────┤
│ Hero Section (căn giữa):                                               │
│  [✨ Trải nghiệm Đọc Truyện Đa Giác Quan] (pill badge)                 │
│  Nơi Câu Chữ Chạm Tới Cảm Xúc (h1 gradient text)                       │
│  Đọc truyện sống động với hiệu ứng hình ảnh và âm thanh...             │
├────────────────────────────────────────────────────────────────────────┤
│ Section "Truyện Nổi Bật" (BookOpen icon + X truyện có sẵn):            │
│  Grid: 1 cột (mobile) / 2 cột (sm: 640px) / 3 cột (lg: 1024px)         │
│  ┌────────────────────────┐  ┌────────────────────────┐  ...           │
│  │ [Banner h-44 Gradient] │  │ [Banner h-44 Gradient] │                │
│  │ ✨ Icon + Tiêu đề + [🔖]│  │ ✨ Icon + Tiêu đề + [🔖]│                │
│  │ ---------------------- │  │ ---------------------- │                │
│  │ 👤 Tác giả: ...        │  │ 👤 Tác giả: ...        │                │
│  │ Mô tả 3 dòng           │  │ Mô tả 3 dòng           │                │
│  │ [Tag 1] [Tag 2]        │  │ [Tag 1] [Tag 2]        │                │
│  │ [ Đọc Truyện → ]       │  │ [ Đọc Truyện → ]       │                │
│  └────────────────────────┘  └────────────────────────┘                │
└────────────────────────────────────────────────────────────────────────┘
```

- **AppHeader (`sticky top-0 z-40`)**:
  - Logo `Sparkles` + "StoryVerse" dẫn về `/`.
  - Menu điều hướng: `Khám phá` (`BookOpen`), `Đang đọc` (`Clock`), `Đã lưu` (`Bookmark`).
  - Menu người dùng `UserMenu` tích hợp Theme Switcher (`Dark`, `Light`, `Sepia`).
- **Hero Section**: Giới thiệu phong cách scrollytelling và định hướng sản phẩm.
- **StoryCard (`bg-card border border-border rounded-xl`)**:
  - Banner trên (`h-44`): Nền chuyển sắc gradient Indigo/Slate + quầng sáng glow + icon `Sparkles`. Nút bookmark `Bookmark` tròn góc trên phải (`min-h-[44px] min-w-[44px]`).
  - Thân card: Tác giả (`User` icon), mô tả truyện (`line-clamp-3`), danh sách thể loại `genre` pills, và nút bấm chính "Đọc Truyện →" dẫn tới `/stories/[storyId]`.

---

## 2. `/stories/[storyId]` — Chi Tiết Tác Phẩm & Mục Lục Chương (US-1.2)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Breadcrumb: Khám phá / Tên Truyện                                      │
├────────────────────────────────────────────────────────────────────────┤
│ Story Info Banner (glass-card p-6 md:p-8 rounded-2xl):                 │
│  [Thể loại 1] [Thể loại 2]                                             │
│  Tên Tác Phẩm (font-display text-3xl md:text-5xl font-bold)            │
│  👤 Tác giả: Tên Tác Giả                                               │
│  Mô tả chi tiết tác phẩm (font-story text-base md:text-lg)             │
│  -------------------------------------------------------------         │
│  [ ▶ Bắt Đầu Đọc / Đọc Tiếp ]    [ 🔖 Lưu Đọc Sau / Đã Lưu ]           │
├────────────────────────────────────────────────────────────────────────┤
│ Mục Lục Chương (BookOpen icon + N chương):                             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Chương 1: Tên chương 1                 [✨ X hiệu ứng]  Đọc →    │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ Chương 2: Tên chương 2   [Đang đọc dở] [✨ Y hiệu ứng]  Đọc →    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

- **Breadcrumb**: Điều hướng nhanh quay lại trang chủ.
- **Khung thông tin truyện (`Story Info Banner`)**:
  - Hiển thị tags thể loại, tiêu đề lớn, tác giả và đoạn mô tả chi tiết.
  - **Nút hành động (`StoryDetailActions`)**:
  - Nút đọc: "Bắt Đầu Đọc" (nếu chưa có tiến trình) hoặc "Đọc Tiếp" (nếu đang đọc dở, tự gắn `#block_id`).
    - Trước khi tạo link, đối chiếu vị trí lưu với danh sách chapter public hiện tại. Chapter đã unpublish/xóa → coi như chưa có tiến trình; block đã xóa trong chapter còn public → mở đầu chapter, không gắn hash cũ.
    - Nút lưu: Toggle bookmark lưu/bỏ lưu truyện qua `settingsStore`.
- **Mục Lục Chương (`ChapterList`)**:
  - Liệt kê các chương theo thứ tự `order`.
  - Huy hiệu "Đang đọc dở" màu accent cho chương có tiến trình gần nhất.
  - Huy hiệu "X hiệu ứng" (`Sparkles`) đếm tổng số effect trong chương.
  - **ResumeReadingModal**: Khi người đọc bấm vào một chương khác với chương đang đọc dở, modal xuất hiện hỏi người đọc muốn tiếp tục chương cũ hay vào thẳng chương vừa chọn. Chỉ hiện modal nếu chapter lưu cũ vẫn còn trong public projection; chapter đã unpublish/xóa phải bị bỏ qua.

---

## 3. `/stories/[storyId]/[chapterId]` — Trải Nghiệm Đọc Truyện (US-1.3 → 1.7)

```
┌────────────────────────────────────────────────────────────────────────┐
│ ProgressBar (fixed top-0 left-0 right-0, h-1, z-50, accent fill)       │
├────────────────────────────────────────────────────────────────────────┤
│ ReaderScreenHeader (sticky top-0, z-40, glass-card blur):              │
│  [← Quay lại truyện]        Tên Chương              [⚙ Cài đặt đọc]   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   SceneLayer (z-0, background asset + 3-tier color grading + audio)    │
│                                                                        │
│     #effect-portal-root / EffectLayer (z-[5], pointer-events-none)     │
│                                                                        │
│     prose-reader max-w-2xl mx-auto (z-20, text-first layer):           │
│       CHƯƠNG 1 (font-ui text-xs accent uppercase)                      │
│       Tên Chương (font-display text-3xl md:text-5xl text-[#F8FAFC])    │
│                                                                        │
│       ─ StoryBlock 1 (Paragraph, Drop Cap chữ đầu) ─                   │
│       ─ StoryBlock 2 (Dialogue, .dialogue-box) ─                       │
│       ─ StoryBlock 3 (Paragraph / Heading) ─                           │
│                                                                        │
│     [ ← Chương Trước ]                       [ Chương Sau → ] (z-20)   │
│                                                                        │
│     (Phase 3) AttributionFooter — "Nguồn âm thanh" nếu có (z-20)       │
└────────────────────────────────────────────────────────────────────────┘
```

- **Thanh tiến trình (`ProgressBar`, `z-50`)**: Nằm trên đỉnh màn hình và trên stacking context của header, tự động tính toán % cuộn trang thực tế.
- **Thanh Header mini (`ReaderScreenHeader`, `z-40`)**:
  - Nút quay lại (`ArrowLeft`) về trang chi tiết tác phẩm.
  - Tên chương căn giữa.
  - Nút bánh răng `Settings` mở `SettingsPanel` drawer.
- **Hệ thống kết xuất Text-First**:
  - `SceneLayer` (`z-0`): Ảnh/Gradient/Video loop nền, Color wash (`mix-blend-mode: color`), Radial depth tint, Ambient aura, và Howler audio loop.
  - `EffectLayer` (`z-[5]`): Hạt mưa, tuyết, khói, đom đóm, ánh nến... kích hoạt theo viewport, 100% `pointer-events-none`.
  - Khung chữ `main.prose-reader` (`z-20`): Chữ trắng ngà `#F8FAFC` sắc nét, Drop Cap chữ đầu đoạn, hộp thoại `.dialogue-box`.
- **Thanh điều hướng chương (`ChapterNav`, `z-20`)**: Nút chuyển "Chương Trước" / "Chương Sau" ở cuối trang.
- **(Phase 3) `AttributionFooter` (`z-20`)**: chỉ hiện khi chapter có ít nhất 1 sound cần ghi nguồn (`AudioAsset.attribution`, `08-effects-and-scenes.md` mục 8.9.3); ẩn hoàn toàn nếu không có, không chiếm chỗ trống vô ích.
- **Bảng Cài Đặt Đọc (`SettingsPanel`)**:
  - Drawer trượt từ mép phải màn hình.
  - Bật/tắt tổng hiệu ứng và toggle từng nhóm: Visual, Audio, Motion, Transition.
  - Thanh trượt cường độ `Intensity` và toggle `Giảm chuyển động`.
  - Tùy chọn cỡ chữ (S, M, L, XL), Font chữ (5 fonts serif), Theme (Dark, Light, Sepia). Theme đổi app chrome/header/drawer; canvas nội dung truyện vẫn Cinematic Dark.

---

## 4. `/library/reading` & `/library/bookmarks` — Thư Viện Cá Nhân (US-1.8, US-1.9)

Cả 2 trang đều sử dụng chung `AppHeader` ở trên và bố cục danh sách thẻ `max-w-4xl mx-auto`.

### 4.1. `/library/reading` — Danh Sách Truyện Đang Đọc
- Header: Icon `Clock` màu cyan + Tiêu đề "Truyện Đang Đọc".
- Danh sách thẻ dọc (`ReadingListClient`):
  - Tiêu đề truyện, badge "Đang đọc", thời gian cập nhật gần nhất.
  - Vị trí chương đang đọc dở (`Sparkles` icon).
  - Thanh phần trăm tiến trình đọc ước lượng (`progressPct%`) kèm thanh bar màu accent.
  - Click vào thẻ: Chuyển hướng trực tiếp vào vị trí block đang đọc dở (`/stories/[storyId]/[chapterId]#[blockId]`).
  - Empty state: Thông báo chưa có truyện kèm nút CTA "Khám phá thư viện truyện".

### 4.2. `/library/bookmarks` — Danh Sách Truyện Đã Lưu
- Header: Icon `Bookmark` màu amber + Tiêu đề "Truyện Đã Lưu".
- Danh sách thẻ dọc (`BookmarksListClient`):
  - Tác giả, ngày lưu (`Calendar` icon), thể loại.
  - Tiêu đề truyện, mô tả ngắn gọn (2 dòng).
  - Nút icon `Bookmark` bên phải để gỡ bỏ truyện khỏi danh sách đã lưu.
  - Click vào thân thẻ: Chuyển hướng về trang chi tiết `/stories/[storyId]`.
  - Empty state: Thông báo chưa lưu tác phẩm kèm nút CTA "Khám phá và lưu truyện".

---

## 5. `/author/stories/[storyId]/[chapterId]` — Trang Soạn Thảo (Author Editor) (Phase 2, US-2.1 → 2.9)

> Route trước đây gọi là `/editor/[storyId]/[chapterId]` — đổi tên/gộp vào chung namespace `/author` từ chính Phase 2 để tránh phải move file khi lên Phase 3 (xem `12-auth-and-author-management.md` mục 12.1 và lý do gộp route). Hành vi/acceptance criteria của US-2.1 → US-2.9 không đổi gì, chỉ đổi đường dẫn.

Layout 3 cột cân bằng, **tối ưu hóa cho Desktop (≥1024px)**, hỗ trợ co giãn linh hoạt trên Tablet và cảnh báo thân thiện trên Mobile:

```
Desktop (≥1024px):
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│ Top Story Bar: [← Về truyện] Tên Truyện • Tên Chương • N blocks • N bối cảnh              │
├─────────────────────────┬───────────────────────────────────────────┬─────────────────────┤
│ CỘT 1: ScenePanel       │ CỘT 2: BlockEditor (Soạn Thảo Trung Tâm)  │ CỘT 3: Timeline     │
│ (Sticky top-20)         │                                           │ (Sticky top-20)     │
│ [<<] Thu gọn / [>>] Mở  │ [+ Thêm đoạn văn mới]                     │ Icon + Thống kê     │
│ — Chọn dải block        │ ┌───────────────────────────────────────┐ │ ① ĐOẠN VĂN [S1] ⚡🌧│
│   (2 bước có chỉ dẫn)   │ │ [::] #1  [Paragraph] [Dialogue] [H] [x]│ │ ② ĐỐI THOẠI [S1]    │
│ — Danh sách thẻ Scene:  │ │ Textarea tự động giãn nở chiều cao... │ │ ③ TIÊU ĐỀ   [S2] ⚡ │
│   * Thumbnail trực quan │ │ ✨ Gợi ý: [Mưa] [Sấm chớp] (onBlur)    │ │ ... (Vạch Ribbon  │
│   * Swatch 3 màu        │ │ Hiệu ứng: [🌧 Mưa rơi x] [+ Gắn effect]│ │      màu Scene)   │
│   * Nút Sửa / Xóa Scene │ └───────────────────────────────────────┘ │                     │
│ (w-72 ↔ w-14)           │ (Hover Divider Gap: chèn block ở giữa)    │ (Click nhảy mượt)   │
│                         │ ┌───────────────────────────────────────┐ │ (w-64 ↔ w-80)       │
│                         │ │ [::] #2  [Paragraph] [Dialogue] [H] [x]│ │                     │
│                         │ └───────────────────────────────────────┘ │                     │
├─────────────────────────┴───────────────────────────────────────────┴─────────────────────┤
│ Floating Action Dock (fixed bottom-6 z-[60]):  [Soạn Thảo | Xem Trước]   [ Lưu Thay Đổi ] │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.1. Cột 1: ScenePanel — Quản Lý Bối Cảnh Môi Trường (Sticky top-20)
- **Cơ chế Thu gọn / Mở rộng linh hoạt**: Thu gọn `w-14` (hiện dãy nút tròn Mini Scene 1, 2, 3...) / Mở rộng `w-72`.
- **Khung chọn dải block tương tác 2 bước**:
  - Bước 1: Nhấp chọn block bắt đầu.
  - Bước 2: Nhấp chọn block kết thúc.
  - Chặn lập tức nếu dải chọn giao thoa với Scene khác trong chương.
- **Thẻ Scene chi tiết**: Thumbnail trực quan, swatch 3 màu, icon nhạc/hạt, nút xem vị trí, sửa (`ScenePicker`) và xóa (`ConfirmModal` + Optimistic UI).

### 5.2. Cột 2: BlockEditor — Vùng Soạn Thảo Trung Tâm
- **Cấu trúc Block Card**:
  - Drag & drop kết hợp với scroll màn hình mượt mà, tiện lợi.
  - Segmented control 3 chế độ: `Đoạn Văn` (`paragraph`), `Đối Thoại` (`dialogue`), `Tiêu Đề` (`heading`).
  - Textarea tự động co giãn (`scrollHeight`) theo nội dung, không có thanh cuộn riêng.
  - Nút xóa thông minh (`Popconfirm`): Xóa ngay nếu rỗng; popup xác nhận nếu có chữ/effect; chặn xóa nếu chỉ còn 1 block.
- **Gợi ý hiệu ứng thông minh (`onBlur` Activated)**: Quét từ khóa tiếng Việt khi rời textarea, hiển thị tối đa 3 chip gợi ý có icon `Sparkles`.
- **Thao tác chèn nhanh**: `Hover Divider Gap` giữa 2 block và nút `+ Thêm Đoạn Văn Mới` cuối trang.

### 5.3. Cột 3: Timeline — Điều Hướng Toàn Cảnh Chương (Sticky top-20)
- Tự động co giãn bề ngang (`w-64 ↔ w-80`).
- **Thống kê tổng quan**: Số lượng block và tổng số hiệu ứng toàn chương (`Zap` icon).
- **Thẻ block rút gọn**: Vạch đứng `Scene Ribbon`, số `#index`, nhãn loại, icon hiệu ứng, trích dẫn 1 dòng văn bản. Click để cuộn mượt và highlight block.

### 5.4. Hộp Thoại Hiệu Ứng (`EffectPicker.tsx`) — Modal `z-[80]`
- **4 Tab Category**: `Hình Ảnh (Visual)`, `Chuyển Động (Motion)`, `Âm Thanh (Audio)`, `Chuyển Cảnh (Transition)`.
- **Thanh tìm kiếm thời gian thực**: Lọc theo tên/mô tả; ưu tiên đưa hiệu ứng đang sửa lên đầu.
- **Bộ tinh chỉnh 4 thông số**: `Intensity` (0.1 - 1.0), `Duration` (200ms - 10000ms; với audio hiển thị là **Giới hạn phát tối đa**), `Delay` (0ms - 3000ms), `Loop` toggle.
- **Cơ chế Live Preview Portal tức thì (`z-[90]`)** của từng effect (render toàn màn hình 5s), luôn bypass Reader Settings để author xem chính xác cấu hình đang chỉnh.
- **(Phase 3) Tab `Âm Thanh` nhúng `SoundSourcePicker.tsx`** — 3 tab con `Thư viện của tôi` / `Tải lên` / `Tìm trên Freesound` (`FreesoundSearchPanel.tsx`: ô tìm kiếm debounce, danh sách kết quả kèm nút play preview, nút "Dùng sound này" — disable + dòng lý do + CTA "Kết nối Freesound" nếu chưa liên kết). Xem `08-effects-and-scenes.md` mục 8.9.

### 5.5. Hộp Thoại Bối Cảnh (`ScenePicker.tsx`) — Modal Lớn `z-[80]`
- **Tab 1: Scene Preset Có Sẵn (`mode === "preset"`)**: Lưới preset có thumbnail, swatch màu, nút nghe thử Howler và nút `Xem trước` 1-Click.
- **Tab 2: Tùy Chỉnh Phối Riêng (`mode === "custom"`)**: 4 bước (Backgrounds, Palettes, Scene Effects với popover `clamp()` chống tràn, Ambient Audio).
  - **(Phase 3) Bước 1 "Backgrounds" nhúng `BackgroundSourcePicker.tsx`** — 3 tab con `Thư viện Preset` (global, như hiện tại) / `Tải ảnh lên` / `Tạo bằng AI` (`AIBackgroundGeneratePanel.tsx`: ô prompt prefill sẵn theo genre/mood — editable, nút "Tạo ảnh", grid đúng **2 ảnh** preview cạnh nhau kèm nút "Dùng ảnh này" riêng từng ảnh, dòng nhỏ hiện số lượt tạo còn lại/ngày). Xem `08-effects-and-scenes.md` mục 8.10.
  - **(Phase 3) Bước 4 "Ambient Audio" nhúng lại `SoundSourcePicker.tsx`** — cùng component với tab Âm Thanh ở `EffectPicker` (mục 5.4), tái sử dụng không viết lại logic.
- **Full Interactive Live Preview Overlay (`z-[90]`)**: Xem trước toàn màn hình với 5 lớp kết xuất thực tế. Header riêng hiển thị trạng thái Reader Settings đang ảnh hưởng đến preview.

### 5.6. Floating Action Dock (`fixed bottom-6 z-[60]`)
- Cố định ở giữa đáy màn hình, luôn nổi ở cả chế độ Soạn Thảo và Xem Trước:
  - **Bộ gạt chế độ (`PreviewToggle`)**: Chuyển đổi tức thì `Soạn Thảo` (`Edit3`) và `Xem Trước` (`Eye`).
  - **Nút Lưu Thay Đổi (`Save`)**: Lưu qua API Route `PUT /api/stories/[id]` với trạng thái `Loader2` và toast 6 giây.
  - Full Preview dùng cùng Reader header; link quay lại bị disabled và preview luôn áp dụng Reader Settings toàn cục.

---

## 6. Navbar theo trạng thái đăng nhập & Profile Modal (Phase 3)

Logic đầy đủ (khi nào đổi role, quyền truy cập...) ở `12-auth-and-author-management.md` mục 12.1 → 12.3. Mục này chỉ mô tả bố cục.

### 6.1. `AppHeader` — 3 trạng thái bên phải

```
Guest:            ... [🌗 Theme]  [ Đăng nhập ]
Reader đã login:  ... [🌗 Theme]  [ ✍️ Viết truyện ]  (Avatar) 
Author/Admin:     ... [🌗 Theme]  [ 📚 Truyện của tôi ]  (Avatar)
```
- Vùng menu điều hướng (`Khám phá`/`Đang đọc`/`Đã lưu`) giữ nguyên như mục 1, không đổi theo trạng thái login.
- Nút "Đăng nhập" mở popup OAuth (Google/GitHub) qua Auth.js — không mở trang riêng.
- Click Avatar (không phải nút chính) → mở `ProfileModal` (`z-[80]`, cùng tầng modal với `EffectPicker`/`ScenePicker`).

### 6.2. `ProfileModal` (`z-[80]`, căn giữa hoặc trượt từ góc phải trên xuống dưới Avatar)

```
┌───────────────────────────────┐
│  (Avatar lớn)                  │
│  Tên người dùng                │
│  email@example.com             │
│  [Badge: Tác giả]  ← chỉ hiện nếu role != reader
├───────────────────────────────┤
│  🌗 Giao diện: [Dark|Light|Sepia] │
├───────────────────────────────┤
│  🔗 Liên kết tài khoản          │  ← chỉ hiện nếu role >= author (`IntegrationsSection.tsx`)
│    Freesound: [Đã kết nối ✓ | Kết nối] │  ← mục 12.9
├───────────────────────────────┤
│  📚 Truyện của tôi          →  │  ← chỉ hiện nếu role >= author
│  🛠️ Trang quản trị          →  │  ← chỉ hiện nếu role === admin
├───────────────────────────────┤
│  🚪 Đăng xuất                  │
└───────────────────────────────┘
```
- Dùng `glass-card` + `rounded-xl` như các card khác, không cần backdrop tối toàn màn hình (khác `EffectPicker`) vì đây là menu ngữ cảnh nhỏ, đóng khi click ra ngoài.
- Khối "Liên kết tài khoản" (Phase 3, `IntegrationsSection.tsx`) chỉ hiện với `role >= author` vì Search/Preview Freesound đã dùng được ngay trong Editor không cần connect — mục này chỉ cần khi author muốn **Import** thật (`08-effects-and-scenes.md` mục 8.9.2). Đã kết nối → hiện tên tài khoản Freesound + nút "Ngắt kết nối"; chưa kết nối → nút "Kết nối" mở OAuth. Chi tiết luồng ở `12-auth-and-author-management.md` mục 12.9.

---

## 7. Author Dashboard & Story Wizard (Phase 3)

Logic/rule đầy đủ ở `12-auth-and-author-management.md` mục 12.4 → 12.7. Chỉ truy cập khi `role >= author` (redirect nếu không đủ quyền).

### 7.1. `/author` — Dashboard "Truyện của tôi"

```
┌────────────────────────────────────────────────────────────────────────┐
│ AppHeader (giữ nguyên)                                                  │
├────────────────────────────────────────────────────────────────────────┤
│ Truyện của tôi                                    [ + Tạo truyện mới ] │
│ [Tất cả] [Nháp] [Chờ duyệt] [Đã xuất bản] [Bị từ chối] [Lưu trữ]        │
├────────────────────────────────────────────────────────────────────────┤
│ Grid StoryManageCard: 1 cột (mobile) / 2 cột (tablet) / 3 cột (desktop)│
│  ┌────────────────────────┐  ┌────────────────────────┐                │
│  │ [Cover]     [● Nháp]   │  │ [Cover]  [● Đã xuất bản]│                │
│  │ Tên truyện              │  │ Tên truyện              │                │
│  │ 2/5 chương đã publish   │  │ 5/5 chương đã publish   │                │
│  │ 👁 128   🔖 12          │  │ 👁 3.4k  🔖 210         │                │
│  │ [ Sửa ]           [⋮]  │  │ [ Sửa ]           [⋮]  │                │
│  └────────────────────────┘  └────────────────────────┘                │
└────────────────────────────────────────────────────────────────────────┘
```
- Badge status màu theo `StoryStatus` (mục 12.7.5 của file 12): Nháp = xám (`bg-muted`), Chờ duyệt = vàng (`bg-warning/20 text-warning`), Đã xuất bản = xanh (`bg-success/20 text-success`), Bị từ chối = đỏ (`bg-destructive/20 text-destructive`), Lưu trữ = xám mờ.
- Hàng `👁 / 🔖` (lượt xem/bookmark) chỉ render khi có dữ liệu `StoryStats` (mục 12.8 file 12) — nếu chưa build, ẩn cả hàng, không hiện số `0` gây hiểu lầm.
- Empty state: `glass-card p-12 text-center`, icon `BookOpen` + "Bạn chưa có truyện nào" + nút CTA lớn "+ Tạo truyện đầu tiên".

### 7.2. `/author/stories/new` — Wizard tạo truyện (2 bước)

```
┌────────────────────────────────────────────────────────────────────────┐
│ AppHeader                                                                │
├────────────────────────────────────────────────────────────────────────┤
│  ① Thông tin truyện  ───────  ② Danh sách chương   (step indicator)     │
├────────────────────────────────────────────────────────────────────────┤
│ BƯỚC 1 (StoryForm):                             max-w-2xl mx-auto       │
│  [ Upload Cover Image ] (preview 16:9 sau khi chọn)                     │
│  Tên truyện: [......................................]                  │
│  Tên tác giả / Bút danh hiển thị: [..................]                  │
│  Mô tả:      [textarea..............................]                  │
│  Thể loại:   [Kinh dị x] [Lãng mạn x] [+ Thêm thể loại]                 │
│                                              [ Tiếp tục → ]  (disable   │
│                                               tới khi form hợp lệ)     │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ BƯỚC 2 (ChapterListManager):                    max-w-2xl mx-auto       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ [::] Chương 1  [........................tên chương........] [x] │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ [::] Chương 2  [........................tên chương........] [x] │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  [ + Thêm chương ]                                                      │
│                                     [ ← Quay lại ]      [ 💾 Lưu ]      │
└────────────────────────────────────────────────────────────────────────┘
```

- Ô `byline` điền sẵn từ `User.name`, cho phép sửa tự do; fallback và lỗi bắt buộc nhập theo `12-auth-and-author-management.md` mục 12.5. Hiện lỗi ngay dưới ô và liên kết label/error với input.
- `[::]` = tay cầm kéo-thả sắp xếp lại thứ tự chương (tái dùng pattern Drag & Drop của `BlockEditor.tsx`).
- Nút "Lưu" disable tới khi dữ liệu bước 1 hợp lệ (gồm byline sau fallback) và có ≥ 1 dòng chương với `title` không rỗng.
- Sau khi Lưu thành công → redirect `/author/stories/[storyId]` (không quay về `/author`).

### 7.3. `/author/stories/[storyId]` — Quản lý truyện (thông tin + danh sách chương)

Trang này chỉ chủ sở hữu/admin vào được, xem `12-auth-and-author-management.md` mục 12.6. Bố cục tương tự 7.2 nhưng **gộp 1 trang, không chia bước**, có thêm banner trạng thái và toggle publish/unpublish từng chương:

```
┌────────────────────────────────────────────────────────────────────────┐
│ AppHeader                                                                │
├────────────────────────────────────────────────────────────────────────┤
│ [← Về Truyện của tôi]                                                   │
│ Status Banner: 🟡 Đang chờ admin duyệt   /   🔴 Bị từ chối: "lý do..."  │
├────────────────────────────────────────────────────────────────────────┤
│ Thông tin truyện (StoryForm, prefill sẵn)                               │
├────────────────────────────────────────────────────────────────────────┤
│ Danh sách chương (ChapterListManager, bản mở rộng):                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ [::] #1 Tên chương    [●Published ⇄]   [✏ Sửa nội dung]  [x]     │  │
│  │        12 block · 8 hiệu ứng                                     │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ [::] #2 Tên chương    [○ Draft ⇄]      [✏ Sửa nội dung]  [x]     │  │
│  │        0 block · chưa có nội dung                                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  [ + Thêm chương ]                                                      │
├────────────────────────────────────────────────────────────────────────┤
│                          [ 💾 Lưu thay đổi ]   [ 📤 Gửi duyệt ]         │
└────────────────────────────────────────────────────────────────────────┘
```
- Toggle `⇄` publish/unpublish riêng chương — disable + tooltip nếu đó là chương `published` cuối cùng của 1 truyện đang `published` (rule mục 12.7.3 file 12).
- Nút "✏ Sửa nội dung" dẫn `/author/stories/[storyId]/[chapterId]` (trang đã có ở mục 5).
- Nút "📤 Gửi duyệt" chỉ hiện khi `Story.status` là `draft`/`rejected`; disable + tooltip nếu chưa đủ điều kiện (mục 12.7.2 file 12).
- **Vì sao 1 trang dài thay vì tái dùng layout 2 bước có Next/Back:** khung bọc dạng wizard (step state, nút Next/Back, step indicator) là phần tốn thêm logic so với 1 trang dài đơn thuần — bản thân `StoryForm`/`ChapterListManager` được dùng lại y hệt ở cả 2 nơi, chỉ khác cái shell bọc ngoài. 1 trang dài vừa ít code hơn vừa phù hợp hơn khi tác giả chỉ muốn sửa nhanh 1 field mà không phải bấm qua từng bước như lúc tạo mới.

## 8. Admin Pages — Phase 3

> Logic quyền/business rule nằm ở `07-user-stories-phase3.md` US-3.11 → US-3.13 và `08-effects-and-scenes.md` mục 8.5. Admin pages ưu tiên quản trị rõ, dense vừa phải; không dùng editor canvas nếu workflow không cần.

### 8.0. Admin shell chung

- Desktop có sidebar: Stories, Effects, Scene Library; mobile dùng sheet navigation từ nút `Menu`.
- Main content `max-w-7xl mx-auto px-4 md:px-6`, header sticky dưới `AppHeader` khi list dài.
- Mỗi page có title, mô tả ngắn, search/filter và status/result count. Filter được phản ánh vào URL search params để refresh/back không mất trạng thái.
- Loading dùng skeleton đúng shape; empty state phân biệt “chưa có dữ liệu” và “không có kết quả lọc”; error state có Retry.
- Action phá hủy dùng `ConfirmModal` hoặc `Popconfirm`; toast chỉ báo kết quả, không thay thế inline error hoặc error summary.

### 8.1. `/admin/effects` — Effect Library

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Effects                                      25 technical effects       │
│ [Search]                    [Category] [Status]                         │
├────────────────────────────────────────────────────────────────────────┤
│ Effect                  Technical ID       Category   Status   Action   │
│ Mưa rơi                particle_rain       Visual     Active   [Edit]   │
│ Tuyết rơi              particle_snow       Visual     Active   [Edit]   │
│ Rung màn hình          screen_shake        Motion     Active   [Edit]   │
│ Xé trang               transition_page...  Transition Disabled [Edit]  │
└────────────────────────────────────────────────────────────────────────┘
```

- Desktop `md+`: table/list là surface chính, header cột rõ và row action bằng button có accessible name.
- Mobile `<md`: mỗi row chuyển thành compact card; không ép table scroll ngang cho thao tác chính.
- Technical ID/category hiển thị muted và read-only. Không có Create Effect.
- Search match label, description và technical ID; category/status filter kết hợp AND.
- Toggle trạng thái không đặt trực tiếp trong row để tránh thao tác nhầm; thực hiện trong drawer rồi Save.

Click `Edit` mở right drawer desktop (`max-w-xl`) hoặc full-height bottom sheet/mobile dialog:

```text
Effect: Mưa rơi                         [Close]
Technical ID  particle_rain (read-only)
Category      Visual (read-only)

Label         [................................]
Description   [................................]
Status        [Active switch]

Keyword suggestions
[Keyword................] [Weight 1..100] [Add]
mưa            95                         [Edit] [Remove]
mưa rơi        90                         [Edit] [Remove]

[Preview]                                  [Cancel] [Save]
```

- Không hiển thị input default intensity/duration/delay/loop, renderer, icon hoặc per-picker visibility.
- Keyword validate inline; duplicate sau normalization hiển thị ngay cạnh field và trong error summary trên đầu form.
- Preview dùng renderer thật trong vùng cô lập, có Stop và trạng thái reduced-motion rõ ràng.
- Dirty drawer khi close/back/overlay click phải mở confirm “Bỏ thay đổi?”. Sau Save thành công giữ focus hợp lý ở row vừa sửa.
- Khi tắt effect, helper text nói rõ: “Ẩn khỏi lựa chọn/gợi ý mới; nội dung đã lưu vẫn render.”

### 8.2. `/admin/scene-library` — Global Scene Catalog

Header và tab:

```text
Scene Library
Quản lý nguyên liệu global và curated preset dùng cho lựa chọn mới.
[ Backgrounds ] [ Palettes ] [ Scene Presets ]
```

Tab dùng semantic tabs (`role=tablist/tab/tabpanel`), hỗ trợ ArrowLeft/ArrowRight/Home/End. Tab active nằm trong URL `?tab=`.

#### 8.2.1. Tab Backgrounds

- Toolbar: Search, Type, Motion, Status, Add Background.
- Visual grid: 1 cột ở 375px, 2 cột ở `sm`, 3 ở `lg`, 4 ở `xl`.
- Card: thumbnail/poster ratio cố định, label, type, motion/status badge, tối đa ba mood tag + “+N”, Preview, Edit, More.
- Chỉ query `scope: "global"`; personal background tuyệt đối không xuất hiện.
- Form add/edit thay đổi theo `type`:
  - Image: upload image, luôn static.
  - Video: upload video câm + poster frame, luôn looping.
  - Gradient: angle + danh sách color stop typed; không có textarea raw CSS.
  - Particle composition: combobox `composition_key` đã đăng ký + field config theo schema; không có textarea raw JSON.
- Upload có progress, Cancel/Retry và trạng thái processing. Save disabled trong lúc upload/validate.
- `motion: looping` thiếu poster phải chặn Save ở client và server.
- Preview dùng cùng shared `SceneLayer` (bên trong dùng `SceneBackground`); reduced-motion preview chuyển sang poster.

#### 8.2.2. Tab Palettes

- Toolbar: Search, Status, Add Palette.
- Compact grid: 1/2/3/4 cột theo mobile/`sm`/`lg`/`xl`.
- Card hiển thị primary, secondary, accent, background tint đã áp opacity, label, mood tags/status và action Preview/Edit/More.
- Form có bốn channel; `background_tint` gồm color picker, text hex và opacity slider/input đồng bộ.
- Preview trên sample Reader frame với body text cố định, Drop Cap/dialogue border để kiểm tra đúng phạm vi palette.
- Contrast warning phải xuất hiện trước Save; không tự động đổi màu user đã nhập.

#### 8.2.3. Tab Scene Presets — catalog, không phải builder

```text
┌──────────────────────┐ ┌──────────────────────┐
│ [preview/thumbnail]  │ │ [preview/thumbnail]  │
│ Đêm mưa cổ trấn     │ │ Lễ hội huyền ảo      │
│ dark · rain · calm   │ │ warm · festival      │
│ Active               │ │ Active               │
│ [Preview]      [More]│ │ [Preview]      [More]│
└──────────────────────┘ └──────────────────────┘
```

- Không có nút Create và không có Background/Palette/Effects/Audio builder.
- Empty state hướng developer tới script import; không hướng admin sang Custom ScenePicker.
- Admin chỉ Preview full Scene, sửa `label`, `description`, `mood_tags`, thumbnail, status và Remove khỏi catalog.
- Metadata drawer hiển thị `id`, `schema_version` và source version ở chế độ read-only để debug.
- Preview full-screen dùng đúng shared `SceneLayer`, sample story text cố định, có audio Play/Stop rõ ràng; không autoplay audio.

#### 8.2.4. Lifecycle, remove và dependency feedback

- Status badge: Draft, Active, Archived. Author picker chỉ thấy Active.
- Action “Remove khỏi catalog” mở ConfirmModal mô tả rõ: item không còn xuất hiện cho lựa chọn mới; Scene đã lưu không thay đổi. Preset có thể hiện thêm số Scene lưu provenance.
- Hard delete chỉ xuất hiện khi `activated_at = null`; không gộp hard delete với Remove. Preset import không được dùng draft Background/Palette làm source.
- Replace media tạo object key mới; UI không có action xóa trực tiếp storage object.

### 8.3. Quan hệ với Author ScenePicker

- `ScenePicker` Tab 1 chỉ đọc curated `ScenePreset.status = active`.
- `ScenePicker` Tab 2 Custom Scene chỉ đọc Background/Palette active cộng personal background đúng owner.
- Hai đường đều deep-copy cùng `SceneRenderConfig` vào Scene; Reader không biết Scene đến từ preset hay custom.
- AI Background ở Author ScenePicker (US-3.19) chỉ tạo personal background image, không sinh full ScenePreset.

### 8.4. Responsive & Accessibility gate riêng cho Admin

- Không bắt buộc mọi click/touch target tối thiểu 44×44px, kích thước còn tùy vào giao diện xung quanh; icon dùng `lucide-react`, không dùng emoji làm icon chính.
- Drawer/dialog trap focus, `Escape` đóng khi không dirty, trả focus về trigger; destructive confirm đặt initial focus ở Cancel.
- Form submit lỗi focus vào error summary; mỗi lỗi link/focus đúng field. Không chỉ dùng màu để biểu thị status/error.
- Keyboard dùng được toàn bộ table action, menu, tabs, color input và Preview controls.
- Animation drawer/card/preview tôn trọng `prefers-reduced-motion`; video/particle Preview dùng poster/static fallback.
- 375px không có horizontal overflow; sticky footer action trong mobile form không che field cuối (`padding-bottom` theo safe area).
- Text/status/controls đạt WCAG AA; thumbnail có alt khi mang thông tin, còn ảnh trang trí dùng alt rỗng.

---
← Về `00-INDEX.md` | Liên quan: `04-ui-ux-design.md` (design token), `03-file-structure.md` (vị trí component), `08-effects-and-scenes.md` (logic Scene/Effect render), `12-auth-and-author-management.md` (luồng/rule auth & quản lý truyện)
