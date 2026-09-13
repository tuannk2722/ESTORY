# 04b — Page Layouts Chi Tiết — Phase 1, 2 & Management (Phase 3)

> Xem `00-INDEX.md` để biết thứ tự ưu tiên và điều hướng. File này **bổ sung** cho `04-ui-ux-design.md` (design token: màu/font/component class) — ở đây mô tả **bố cục giao diện thực tế từng trang/màn hình**, để AI assistant không phải tự đoán cách sắp xếp khi code. Mục 1 → 5: Phase 1–2. Mục 6 → 8: Phase 3 (Auth/Author/Admin), logic/rule chi tiết ở `07-user-stories-phase3.md`, `08-effects-and-scenes.md` và `12-auth-and-author-management.md`.

---

## 0. Quy ước Dùng Chung Cho Mọi Trang

- **Breakpoint** (khớp checklist `04`): `375px` (mobile) / `768px` (tablet) / `1024px` (laptop) / `1440px` (desktop). Mobile-first — style mặc định cho 375px, mở rộng dần bằng `md:`/`lg:`/`xl:` của Tailwind.
- **Spacing:** dùng thang mặc định của Tailwind (bội số 4px). Khoảng cách section chuẩn: `py-8 md:py-12 lg:py-16`; khoảng cách item trong grid: `gap-4 md:gap-6`.
- **Container:** trang danh sách/chi tiết dùng `max-w-6xl mx-auto px-4` hoặc `max-w-4xl mx-auto px-4`; Admin dùng `max-w-7xl` vì bảng quản trị dày hơn. Riêng khung đọc truyện dùng `max-w-2xl` / `max-w-[65ch]` căn giữa.
- **Z-Index Layering Matrix chuẩn toàn hệ thống (Text-First Architecture):**
  ```
  z-0     SceneLayer & Cinematic Color Grading (BackgroundAsset, Color wash, Depth tint, Ambient aura)
  z-[5]   EffectLayer & Visual/Motion/Particle Effects (toàn bộ hiệu ứng khí quyển, pointer-events-none)
  z-20    Story Text Layer (.prose-reader, StoryBlock, Tiêu đề chương, Drop Cap, Dialogue Box)
  z-50    ProgressBar (fixed top-0, nằm trên ReaderScreenHeader)
  z-40    AppHeader / ReaderScreenHeader / AdminSidebar / AdminMobileNav topbar
  z-50    Full Reader Preview Overlay (trong Editor mode)
  z-[60]  Floating Action Dock (PreviewToggle + Save Button)
  z-[80]  Modal/drawer/sheet backdrop; surface có thể dùng z-[85]
  z-[90]  In-Modal Live Previews (createPortal preview, Scene Live Preview, Popconfirm)
  z-[100] ConfirmModal hoặc dialog nghiệp vụ mở trên một drawer
  ```
- **Trạng thái chung:**
  - *Loading:* skeleton card cùng kích thước với card thật hoặc dòng text thông báo `glass-card p-12 text-center text-muted-foreground`.
  - *Empty:* icon `lucide-react` + 1 câu ngắn font-story/ui + CTA theo ngữ cảnh; empty do search/filter ưu tiên Xóa tìm kiếm/bộ lọc, không mặc định dẫn về `/`.
- **Icon:** toàn bộ dùng `lucide-react`, không dùng emoji làm icon cấu trúc. Reader/Author mặc định target `44×44px`; Admin áp dụng mật độ và target theo mục 8.5, nhưng icon-only button luôn có vùng bấm đủ rõ và accessible name.
- **Search boundary:** `SearchInput` chỉ là field dùng chung. Picker Effect/Scene/combobox lọc tức thì catalog đầy đủ đã tải ở client; Home giữ `q/genre`, Admin giữ `q/status` trong URL và lọc/paginate ở server theo `11` §9.2.2. Không tải aggregate Story về client để dùng matcher của picker.
- **Search accessibility:** mỗi input có label hiển thị hoặc `sr-only` (placeholder không thay label), clear button có accessible name và trả focus về input. Result count/no-result cập nhật trong vùng `role="status" aria-atomic="true"`; chỉ dùng combobox ARIA nếu thật sự có popup suggestion.

---

## 1. `/` — Trang Chủ / Khám Phá Truyện (US-1.1, US-3.20)

```
┌────────────────────────────────────────────────────────────────────────┐
│ AppHeader (sticky, z-40, glass-card blur)                              │
│  ✨ StoryVerse                     [🕒 Đang đọc] [🔖 Đã lưu]   [User/Theme]│
├────────────────────────────────────────────────────────────────────────┤
│ Hero full-bleed (artwork theo Dark/Light/Sepia + scrim/fade):           │
│  [✨ Trải nghiệm Đọc Truyện Đa Giác Quan] (pill badge)                 │
│  Nơi Câu Chữ Chạm Tới Cảm Xúc (h1 gradient text)                       │
│  Đọc truyện sống động với hiệu ứng hình ảnh và âm thanh...             │
│  Search landmark "Tìm truyện":                                        │
│   [ Tìm theo tên truyện hoặc tác giả...                ] [Tìm kiếm]    │
│  Genres: [Tất cả] [Thể loại 1] [Thể loại 2] ...                       │
├────────────────────────────────────────────────────────────────────────┤
│ Section "Truyện Nổi Bật" / heading theo q + genre (+ tổng kết quả):   │
│  Grid: 1 cột (mobile) / 2 cột (sm: 640px) / 3 cột (lg: 1024px)         │
│  ┌────────────────────────┐  ┌────────────────────────┐  ...           │
│  │ [Cover 16:9 / fallback]│  │ [Cover 16:9 / fallback]│                │
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
  - Menu điều hướng: `Đang đọc` (`Clock`), `Đã lưu` (`Bookmark`).
  - Menu người dùng `UserMenu` tích hợp Theme Switcher (`Dark`, `Light`, `Sepia`).
- **Hero Section (`HomeHero`)**:
  - Là section full-width ngay dưới `AppHeader`; chỉ artwork tràn ngang, content vẫn ở safe zone giữa (`max-w-3xl`, padding mobile). Hero chứa nguyên badge/heading/description hiện có rồi Search + Genres; Story section tiếp theo vẫn `max-w-6xl` trên surface trang, không đặt card lên artwork và không đổi nội dung/chức năng khác của Home.
  - Dùng ba artwork tĩnh map 1:1 với Dark/Light/Sepia theo `11` §9.2.3. Artwork chỉ trang trí (`alt=""`, không pointer event), `object-cover center top`; lớp scrim trung tâm giữ chữ/control đủ tương phản và fade đáy hòa vào `--color-background`, không để lộ mép chữ nhật của PNG.
  - Khung có `min-height: clamp(26rem, 34vw, 32rem)` nhưng vẫn nở theo content, nên dành chỗ trước khi ảnh tải và không CLS. Ở mobile, ưu tiên chữ/search/genre trong vùng trống giữa; chấp nhận crop sách/núi ở hai cạnh. Không kéo méo, parallax hoặc thêm ornament ngoài scope Hero này.
  - Khi đổi theme, giữ ảnh cũ tới khi ảnh mới load/decode rồi crossfade ngắn; reduced motion đổi tức thì sau decode. Initial saved theme không được lóe Dark trước khi sync; loading/performance contract ở `11` §9.2.3 và `09`.
- **Tìm truyện (`StorySearchForm`)**:
  - Form GET tới `/`, param canonical `q`; label “Tìm truyện”, placeholder “Tìm theo tên truyện hoặc tác giả…”. Desktop field + nút cùng hàng; mobile field full-width và nút bên dưới/đủ target 44px.
  - Home dùng submit rõ ràng: Enter hoặc nút “Tìm kiếm” chạy ngay trên server, không request theo từng phím. URL lưu raw query đã trim/collapse; refresh/back/forward phải khôi phục đúng input và kết quả. Clear xóa `q`/cursor nhưng giữ `genre`, submit ngay và trả focus về input.
  - Đổi query reset cursor. Kết quả phân trang server; không autocomplete/suggestion hoặc client-side relevance trong scope này.
- **Genres (`HomeGenreFilters`)**:
  - Hàng quick-filter nằm ngay dưới Search: “Tất cả” + tối đa 6 genre có Story public, do `listPublicGenreFacets()` trả về; không hardcode taxonomy và không suy từ page kết quả đang hiển thị. Không có facet thì ẩn cả hàng.
  - Mỗi chip là link GET target tối thiểu 44px, giữ `q`, set đúng một `genre` và bỏ cursor; “Tất cả” chỉ bỏ `genre`. Active có state ngoài màu và `aria-current="page"`; mobile `flex-wrap` căn giữa, không buộc horizontal scroll.
  - `genre` match exact facet và kết hợp AND với `q`; không đưa genre vào free-text search. Heading: không filter → “Truyện Nổi Bật”; chỉ `q` → `Kết quả cho “…”`; chỉ genre → `Thể loại “…”`; có cả hai → `Kết quả cho “…” · Thể loại “…”`. Pagination giữ cả `q/genre`.
- **Result states**: khi điều hướng, giữ control thao tác được, đánh dấu vùng kết quả `aria-busy`; loading lần đầu/query/filter dùng skeleton đúng card. Không có Story public là base-empty; filter không match là “Không tìm thấy truyện phù hợp” + “Xóa bộ lọc” (bỏ cả `q/genre`). Error giữ query/filter và có Retry.
- **StoryCard (`bg-card border border-border rounded-xl`)**:
  - Banner trên dùng `aspect-video`: render `cover_image` bằng `object-cover` và `object-position` từ `cover_position`; khi không có cover mới dùng nền chuyển sắc semantic làm fallback. Lớp scrim giữ bookmark và genre đủ tương phản trên mọi ảnh. Nút bookmark `Bookmark` tròn góc trên phải (`min-h-[44px] min-w-[44px]`).
  - Public card, `StoryManageCard` và live preview cạnh `StoryForm` phải giữ cùng tỷ lệ `16:9` và cùng focal point; không dùng chiều cao cố định làm thay đổi crop theo breakpoint.
  - Thân card: title (`line-clamp-2`), tác giả (`User` icon), mô tả (`line-clamp-2`) và hàng CTA trực quan "Đọc truyện"; toàn card là link tới `/stories/[storyId]`. Genre pills nằm trên cover, tối đa 3 tag rồi rút gọn thành `+N`.

---

## 2. `/stories/[storyId]` — Chi Tiết Tác Phẩm & Mục Lục Chương (US-1.2)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Breadcrumb: Khám phá / Tên Truyện                                      │
├────────────────────────────────────────────────────────────────────────┤
│ Story Info Banner (cover 16:9, full-bleed ở md+, rounded-3xl):         │
│  [Cover + scrim bảo đảm contrast]                                      │
│  [Thể loại 1] [Thể loại 2]                                             │
│  Tên Tác Phẩm · mô tả · 👤 tác giả · 📖 số chương                     │
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
  - Dùng `cover_image` làm visual chính ở viewport `16:9`, `object-cover` và `object-position` từ `cover_position`, cùng quy ước crop với wizard/dashboard/Home. Scrim trung tính nhiều lớp giữ chữ trắng đạt tương phản trên mọi ảnh; CTA vẫn dùng token Primary/Accent của Dark, Light và Sepia.
  - Desktop đặt tags, tiêu đề, mô tả, tác giả và số chương trực tiếp trên cover. Mobile giữ cover `16:9` riêng rồi đặt nội dung trên media-surface tối liền kề, tránh đổi tỷ lệ crop hoặc nhồi chữ lên ảnh thấp.
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
- **Thao tác chèn nhanh**: `Hover Divider Gap` giữa 2 block giữ hit-area cao tối thiểu 44 px nhưng đường kẻ/pill `+ Thêm đoạn` ẩn ở trạng thái nghỉ và chỉ lộ khi pointer hover. Keyboard `focus-visible` và trạng thái nhấn trên touch được phản hồi tương đương mà không làm CTA hiện thường trực; disabled không nhận action và giảm nhấn mạnh. Trong lúc reorder, gap được thay bằng placeholder cùng kích thước và drop indicator nằm absolute trong slot cao 0, nên hover CTA/drop feedback không làm các Block Card dịch chuyển. Nút `+ Thêm Đoạn Văn Mới` cuối trang vẫn luôn hiện.

### 5.3. Cột 3: Timeline — Điều Hướng Toàn Cảnh Chương (Sticky top-20)
- Tự động co giãn bề ngang (`w-64 ↔ w-80`).
- **Thống kê tổng quan**: Số lượng block và tổng số hiệu ứng toàn chương (`Zap` icon).
- **Thẻ block rút gọn**: Vạch đứng `Scene Ribbon`, số `#index`, nhãn loại, icon hiệu ứng, trích dẫn 1 dòng văn bản. Click để cuộn mượt và highlight block.

### 5.4. Hộp Thoại Hiệu Ứng (`EffectPicker.tsx`) — Modal `z-[80]`
- **4 Tab Category**: `Hình Ảnh (Visual)`, `Chuyển Động (Motion)`, `Âm Thanh (Audio)`, `Chuyển Cảnh (Transition)`.
- **Thanh tìm kiếm thời gian thực**: Lọc client-side ngay trên catalog active đã tải theo tên/mô tả; state chỉ sống trong modal, không URL/debounce/network. Đây là AND-token substring bỏ dấu/case, không phải fuzzy/typo search; ưu tiên đưa hiệu ứng đang sửa lên đầu.
- **Bộ tinh chỉnh 4 thông số**: `Intensity` (0.1 - 1.0), `Duration` (200ms - 10000ms; với audio hiển thị là **Giới hạn phát tối đa**), `Delay` (0ms - 3000ms), `Loop` toggle.
- **Cơ chế Live Preview Portal tức thì (`z-[90]`)** của từng effect (render toàn màn hình 5s), luôn bypass Reader Settings để author xem chính xác cấu hình đang chỉnh.
- **(Phase 3) Tab `Âm Thanh` nhúng `SoundSourcePicker.tsx`** — 3 tab con `Thư viện của tôi` / `Tải lên` / `Tìm trên Freesound` (`FreesoundSearchPanel.tsx`: ô tìm kiếm debounce, danh sách kết quả kèm nút play preview, nút "Dùng sound này" — disable + dòng lý do + CTA "Kết nối Freesound" nếu chưa liên kết). Xem `08-effects-and-scenes.md` mục 8.9.

### 5.5. Hộp Thoại Bối Cảnh (`ScenePicker.tsx`) — Modal Lớn `z-[80]`
- **Tab 1: Scene Preset Có Sẵn (`mode === "preset"`)**: Lưới preset có thumbnail, swatch màu, nút nghe thử Howler và nút `Xem trước` 1-Click. Search Background/Preset/Palette/combobox lọc tức thì client-side trên catalog đã tải; mọi field/tags được đưa vào một matcher, state đóng cùng modal. “Xem thêm” chỉ tăng số item đang render, không phải server cursor.
- **Tab 2: Tùy Chỉnh Phối Riêng (`mode === "custom"`)**: 4 bước (Backgrounds, Palettes, Scene Effects với popover `clamp()` chống tràn, Ambient Audio).
  - **(Phase 3) Bước 1 "Backgrounds" nhúng `BackgroundSourcePicker.tsx`** — 3 tab con `Thư viện Preset` (global, như hiện tại) / `Tải lên` / `Tạo bằng AI`. Trong `Tải lên`: Author chọn file → client detect image/video → nếu là video thì hiện field poster bắt buộc, quota `đã dùng/10`, và chỉ bật Upload khi đủ cặp hợp lệ; server vẫn detect/validate lại. `AIBackgroundGeneratePanel.tsx`: prompt prefill theo genre/mood — editable, nút "Tạo ảnh", grid đúng **2 ảnh** preview cạnh nhau kèm nút "Dùng ảnh này" riêng từng ảnh, dòng nhỏ hiện số lượt tạo còn lại/ngày. Xem `08-effects-and-scenes.md` mục 8.10.
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
- Vùng menu điều hướng (`Đang đọc`/`Đã lưu`) giữ nguyên như mục 1, không đổi theo trạng thái login.
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
│  🔗 Liên kết tài khoản          │  ← bắt đầu render khi P3-15 có connection projection
│    Freesound: [Đã kết nối ✓ | Kết nối] │  ← P3-15, mục 12.9
├───────────────────────────────┤
│  📚 Truyện của tôi          →  │  ← chỉ hiện nếu role >= author
│  🛠️ Trang quản trị          →  │  ← chỉ hiện nếu role === admin
├───────────────────────────────┤
│  🚪 Đăng xuất                  │
└───────────────────────────────┘
```
- Dùng `glass-card` + `rounded-xl` như các card khác, không cần backdrop tối toàn màn hình (khác `EffectPicker`) vì đây là menu ngữ cảnh nhỏ, đóng khi click ra ngoài.
- P3-10 chỉ tạo boundary `IntegrationsSection.tsx`, không render row/action giả. Từ P3-15, khối "Liên kết tài khoản" chỉ hiện với `role >= author`: đã kết nối → tên Freesound + "Ngắt kết nối"; chưa kết nối → "Kết nối" mở OAuth. Chi tiết ở `12-auth-and-author-management.md` mục 12.9.

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
- Cover của `StoryManageCard` dùng `aspect-video` + `object-cover` + `cover_position` giống hệt preview và public `StoryCard`. Badge đặt trên ảnh phải có surface/scrim đủ tương phản, không phụ thuộc màu hoặc độ sáng của cover.
- Dashboard nhận `ManagedStory` gọn: mỗi chapter chỉ có metadata quản lý cùng `blockCount`/`effectCount`; không tải hoặc serialize text block, Effect config hay Scene qua Server → Client chỉ để tính số chương/status trên card.
- Hàng `👁 / 🔖` (lượt xem/bookmark) chỉ render khi có dữ liệu `StoryStats` (mục 12.8 file 12) — nếu chưa build, ẩn cả hàng, không hiện số `0` gây hiểu lầm.
- Empty state: `glass-card p-12 text-center`, icon `BookOpen` + "Bạn chưa có truyện nào" + nút CTA lớn "+ Tạo truyện đầu tiên".

### 7.2. `/author/stories/new` — Wizard tạo truyện (2 bước)

```
┌────────────────────────────────────────────────────────────────────────┐
│ AppHeader                                                                │
├────────────────────────────────────────────────────────────────────────┤
│  ① Thông tin truyện  ───────  ② Danh sách chương   (step indicator)     │
├────────────────────────────────────────────────────────────────────────┤
│ BƯỚC 1 — xl: StoryForm + preview 22rem; dưới xl xếp dọc                 │
│  ┌──────────────────────────────────────┐  ┌────────────────────────┐  │
│  │ [ Upload Cover 16:9 + focal point ] │  │ Xem trước trang chủ    │  │
│  │ Tên truyện: [.....................] │  │ [StoryCard visual]     │  │
│  │ Bút danh:   [.....................] │  │ inert, cùng cover crop │  │
│  │ Mô tả:      [textarea............] │  └────────────────────────┘  │
│  │ Thể loại: [Kỳ ảo x] [+ Thêm]       │                              │
│  │                         [Tiếp tục →]│                              │
│  └──────────────────────────────────────┘                              │
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
- Preview cover dùng đúng viewport `16:9` của card. Khi có preview và form không bị khóa, author luôn có thể chạm/click vào vùng muốn ưu tiên, kéo ảnh hoặc focus vùng preview rồi dùng phím mũi tên để đổi focal point `x/y` trong `0..100`. Chuyển Bước 1 → Bước 2 → quay lại phải giữ nguyên file, preview URL và vị trí đã chọn.
- Bước 1 có live preview của toàn public `StoryCard`: ở `xl` form và preview rộng khoảng `22rem` nằm thành hai cột, preview sticky dưới header; dưới `xl` preview xếp sau form và không tạo cuộn ngang. Preview dẫn xuất trực tiếp từ state form, dùng cùng visual surface/cover focal point nhưng hoàn toàn inert — không link, không mutation bookmark, không control giả và không `aria-live`. Bước 2 giữ `max-w-3xl` căn giữa và không render preview.
- `[::]` = tay cầm kéo-thả sắp xếp lại thứ tự chương (tái dùng pattern Drag & Drop của `BlockEditor.tsx`).
- Khoảng giữa hai chapter dùng cùng `InsertGapButton`: hit-area/gap geometry luôn được giữ, còn đường kẻ/pill `+ Thêm chương` ẩn khi nghỉ và hiện khi pointer hover, keyboard `focus-visible` hoặc đang nhấn trên touch. Trong lúc drag, placeholder cùng chiều cao giữ drop zone ổn định. Sau khi thêm, focus chuyển vào ô title mới; nút lên/xuống vẫn là phương án thay thế cho drag trên mobile và bàn phím.
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
│ Thông tin truyện: [StoryForm prefill] + [live StoryCard] ở xl           │
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

Trang quản lý gửi `afterChapterId` khi thêm ở divider; server tạo và đặt chapter vào đúng
vị trí trong cùng transaction Story/revision. Không ghép một request append với một request
reorder riêng vì có thể thành công một nửa.
- Ở trạng thái nghỉ, cuối danh sách chỉ hiện nút `[ + Thêm chương ]`, đồng nhất với wizard;
  form không mở sẵn. Nút ở cuối và `InsertGapButton` giữa hai row cùng mở một draft row cục bộ
  có nhãn `Chương N · Chưa lưu`, input title, `Thêm` và `Hủy`. Chưa tạo chapter trong database
  cho tới khi title hợp lệ được submit. `Escape`/Hủy đóng draft và trả focus về đúng trigger;
  submit thành công thay draft bằng row thật rồi focus title của row mới.
- Payload quản lý là `ManagedStory`, không phải aggregate Editor đầy đủ: mỗi row chapter chỉ nhận `id/title/order/status/blockCount/effectCount`. Text block, Effect config và Scene không đi qua RSC/client props của trang này. Reorder thành công chỉ trả danh sách `{ id, order }`; client áp order vào state đang có thay vì nhận lại hoặc serialize toàn bộ chapter content.
- Chỉ section "Thông tin truyện" dùng bố cục form + live `StoryCard` hai cột ở `xl`; preview lấy cover local nếu đang thay ảnh, nếu không lấy cover persisted, và sticky chỉ trong section này để dừng trước danh sách chương. Dưới `xl` preview xếp sau form. Banner trạng thái, chapter list và vùng nguy hiểm vẫn full-width.
- Toggle `⇄` publish/unpublish riêng chương — disable + tooltip nếu đó là chương `published` cuối cùng của 1 truyện đang `published` (rule mục 12.7.3 file 12).
- Nút "✏ Sửa nội dung" dẫn `/author/stories/[storyId]/[chapterId]` (trang đã có ở mục 5).
- Nút "📤 Gửi duyệt" chỉ hiện khi `Story.status` là `draft`/`rejected`; disable + tooltip nếu chưa đủ điều kiện (mục 12.7.2 file 12).
- **Vì sao 1 trang dài thay vì tái dùng layout 2 bước có Next/Back:** khung bọc dạng wizard (step state, nút Next/Back, step indicator) là phần tốn thêm logic so với 1 trang dài đơn thuần — bản thân `StoryForm`/`ChapterListManager` được dùng lại y hệt ở cả 2 nơi, chỉ khác cái shell bọc ngoài. 1 trang dài vừa ít code hơn vừa phù hợp hơn khi tác giả chỉ muốn sửa nhanh 1 field mà không phải bấm qua từng bước như lúc tạo mới.

## 8. Admin Pages — Phase 3

> Logic quyền/business rule nằm ở `07-user-stories-phase3.md` US-3.11 → US-3.13 và `08-effects-and-scenes.md` mục 8.5. Admin pages ưu tiên quản trị rõ, dense vừa phải; không dùng editor canvas nếu workflow không cần.

### 8.0. Admin shell chung

- `/admin/**` là back-office tách khỏi Reader/Author: **không render `AppHeader`**. `app/admin/layout.tsx` kiểm `requireRole("admin")`, sau đó render `AdminShell`; link “Về trang đọc” (`/`) luôn khả dụng để thoát ngữ cảnh quản trị.
- Mọi màu/surface/border/focus dùng semantic design token hiện có và hỗ trợ Dark/Light/Sepia. `ThemeSwitcher` dùng lại `settingsStore`; không tạo cơ chế lưu theme riêng cho Admin.

#### 8.0.1. Desktop `lg+`

```text
┌──────────────────────┬──────────────────────────────────────────────┐
│ Sidebar fixed h-dvh  │ Main scroller h-dvh overflow-y-auto         │
│ 16rem / 4.5rem       │ content max-w-7xl px-6 py-8                 │
│ logo + collapse      │ breadcrumb → page header → page content     │
│ quản trị / hệ thống  │                                              │
└──────────────────────┴──────────────────────────────────────────────┘
```

- Sidebar mở rộng rộng `w-64`; thu gọn `w-[72px]`. Header sidebar dùng wordmark hiện có “StoryVerse” + nhãn “Quản trị”, không tạo brand/logo thứ hai. Main bù đúng chiều rộng để không bị che và là vùng cuộn dọc duy nhất; không tạo double scrollbar ở `body`.
- Nhóm **Quản trị**: “Duyệt truyện” (`/admin/stories`, badge số pending), “Hiệu ứng” (`/admin/effects`), “Bối cảnh” (`/admin/scene-library`). Nhóm **Hệ thống**: “Về trang đọc”, danh tính Admin và `ThemeSwitcher`. Trong rollout theo stage, mục chưa có page phải disabled kèm “Sắp có”/stage label, không để link 404; enable lần lượt ở P3-12/P3-13.
- Item active suy từ pathname, có cả surface/label/`aria-current="page"`, không chỉ đổi màu. Badge pending là số khi mở rộng và dot có accessible label khi thu gọn.
- Toggle là button có `aria-expanded`/accessible name. Trạng thái thu gọn chỉ là UI state của shell, mặc định mở rộng và không bắt buộc persist. Khi thu gọn, label/section heading ẩn trực quan nhưng nav item vẫn có accessible name và tooltip dùng được bằng hover lẫn focus.

#### 8.0.2. Mobile và tablet `<lg`

- `AdminMobileNav` thay sidebar cố định bằng topbar sticky `z-40` có nút Menu, nhãn khu vực và action cần thiết; đây là chrome riêng của Admin, không phải `AppHeader`.
- Menu mở left navigation sheet trên scrim (`z-[80]`, rộng tối đa `20rem` và không vượt viewport), dùng cùng cấu hình nav desktop. Sheet trap focus; `Escape`, scrim, nút Close hoặc chọn route đều đóng; sau khi đóng trả focus về nút Menu. Khóa background scroll trong lúc mở.
- Main dùng document scroll, `px-4 py-6`; breakpoint đổi qua desktop phải đóng sheet và không mang trạng thái collapsed sang mobile. Nội dung và sticky action chừa safe-area/bottom inset, không overflow ngang ở 375px hoặc landscape.

#### 8.0.3. Khung trang và trạng thái dùng chung

- Main content: breadcrumb (ẩn hoặc rút gọn trên mobile nếu lặp title), `h1`, mô tả ngắn, search/filter/result count. Filter/sort/search có ý nghĩa điều hướng phải phản ánh vào URL search params để refresh/back không mất trạng thái.
- Loading dùng skeleton đúng shape; empty state phân biệt “chưa có dữ liệu” và “không có kết quả lọc”; error state giữ query hiện tại và có Retry.
- Toast chỉ báo kết quả. Validation/concurrency/network error phải hiện tại dialog/drawer hoặc error summary tương ứng; action phá hủy/khó hoàn tác dùng `ConfirmModal`.

### 8.1. `/admin/stories` — Kiểm duyệt tác phẩm

Nguồn nghiệp vụ: `02` §2.7 và `12` §12.7; acceptance criteria: `07` US-3.11. UI không tự nới state machine.

#### 8.1.1. Cấu trúc trang và truy vấn

- Breadcrumb “Quản trị / Kiểm duyệt truyện”; title “Kiểm duyệt tác phẩm”; mô tả ngắn về việc xem nội dung trước khi public.
- Ba summary card chỉ đọc: Chờ duyệt, Đã xuất bản, Bị từ chối. Count là tổng theo status, không đổi theo search/status filter của list.
- Default `status=pending_review`; khi xem `all`, pending đứng trước rồi sắp xếp theo `submittedAt` mới nhất (`null` sau cùng), với `createdAt`/`id` làm tie-breaker ổn định cho cursor. Status filter gồm `pending_review`, `published`, `rejected`, `draft`, `archived`, `all`; chip/tab dùng button có trạng thái selected. Ở mobile có thể gom cùng lựa chọn vào nút “Bộ lọc”/sheet, không tạo bộ tiêu chí thứ hai.
- Search server-side theo title hoặc bút danh với contract `11` §9.2.2. Input có draft tức thì nhưng chỉ commit URL sau debounce khoảng `300ms`; Enter/Clear commit ngay, không commit giữa IME composition. Typing dùng replace không scroll để không tạo một history entry mỗi phím. `q`/status đổi thì xóa cursor; “Tải lại” giữ nguyên query/filter. List dùng pagination/cursor, không load toàn bộ aggregate để đếm ở client.
- Read model mỗi row chỉ gồm cover + focal point, title, genre, bút danh, `submittedAt`, chapter/block/effect counts, status và `meta.updatedAt`; không serialize text block, Effect config hoặc Scene vào list.

#### 8.1.2. Danh sách desktop/mobile

| Desktop `md+` | Mobile `<md` |
|---|---|
| Table: Bìa & tên/genre · Tác giả · Ngày gửi · Quy mô · Trạng thái · Thao tác | Card dọc giữ cùng dữ liệu ưu tiên: cover/title/status → author/date → counts → action |
| Cover `aspect-video object-cover`, áp `object-position: x% y%` | Không dùng table scroll ngang cho thao tác chính |
| Row action chính “Xem chi tiết” | CTA full-width hoặc cuối card, target rõ ràng |

- Status badge có text + icon/shape, không chỉ màu. `submittedAt = null` hiển thị “Chưa gửi”; các status không phải pending chỉ có action xem.
- Quyết định duyệt/từ chối **không đặt thành quick action ở row**: admin phải mở chi tiết để đối chiếu nội dung; action chỉ hiện trong footer drawer khi server vẫn trả `pending_review`.
- Empty state riêng cho queue pending (“Không có tác phẩm chờ duyệt”) và cho filter/search (“Không tìm thấy kết quả” + Xóa bộ lọc). Loading/error theo 8.0.3.
- Result count/no-result là live status sau khi server response hoàn tất; vùng list dùng `aria-busy` khi navigation pending nhưng không chuyển focus khỏi input.

#### 8.1.3. `StoryReviewDrawer`

- “Xem chi tiết” mở right drawer desktop `max-w-2xl`; mobile là full-screen dialog/sheet. Backdrop `z-[80]`, surface `z-[85]`; header và footer sticky, phần giữa cuộn và chừa padding để footer không che nội dung.
- Header: title, `StatusBadge`, Close. Body theo thứ tự: cover 16:9 đúng focal point; bút danh + email tài khoản (admin-only); ngày tạo/gửi gần nhất; description; genre; chapter list theo `order`.
- Mỗi chapter hiển thị title/order, `draft|published`, block count và **block effect** count theo đủ `EffectCategory`: visual/audio/motion/transition. Scene/ambient là domain riêng, không gộp vào `EffectConfig` count; admin kiểm tra nó trong Reader preview. Nút “Đọc thử chương” mở admin-only preview trong tab mới, dùng Reader renderer với full chapter snapshot qua admin DAL; **không** gọi/nới public repository và không làm pending/draft content public.
- Footer chỉ có “Từ chối” và “Phê duyệt tác phẩm” khi status là `pending_review`; với status khác, footer chỉ có Close. Không cho thao tác trong lúc detail đang loading, submit đang chạy hoặc revision đã stale.
- Drawer trap focus, `Escape`/Close trả focus về đúng row/card. Nếu không có dữ liệu chưa lưu thì scrim click được đóng. Khi mở dialog con, focus thuộc dialog con và drawer phía sau inert.

#### 8.1.4. Reject và approve

**RejectReasonModal** mở trên drawer ở `z-[100]`, `max-w-lg`:

- Textarea có label, placeholder hướng admin nêu vấn đề để tác giả sửa, counter thời gian thực và validation inline + error summary. Server trim reason rồi yêu cầu `5..2000` ký tự; rỗng/toàn whitespace/ngoài range đều bị chặn.
- “Hủy bỏ” không đổi state; “Xác nhận từ chối” dùng destructive style và gửi `{ reason, expectedUpdatedAt }`. Submit pending khóa Close/action để tránh gửi lặp.

Approve dùng `useConfirm()` hiện có (`variant: success`, `z-[100]`):

- Title: `Phê duyệt tác phẩm “{title}”?`; mô tả phải nói rõ truyện sẽ public và toàn bộ chapter được chuyển `published`; confirm text “Phê duyệt ngay”.
- Command gửi `expectedUpdatedAt`; server mới được quyết định transition và publish chapters trong một transaction.

Sau thành công, đóng dialog/drawer, cập nhật row/count hoặc revalidate query rồi toast và trả focus hợp lý. `409` giữ drawer mở, vô hiệu decision cũ và hiện CTA “Tải dữ liệu mới”; không tự retry bằng revision mới. Lỗi khác giữ input/reason để admin sửa hoặc thử lại.

### 8.2. `/admin/effects` — Effect Library

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

### 8.3. `/admin/scene-library` — Global Scene Catalog

Header và tab:

```text
Scene Library
Quản lý nguyên liệu global và curated preset dùng cho lựa chọn mới.
[ Backgrounds ] [ Palettes ] [ Scene Presets ]
```

Tab dùng semantic tabs (`role=tablist/tab/tabpanel`), hỗ trợ ArrowLeft/ArrowRight/Home/End. Tab active nằm trong URL `?tab=`.

#### 8.3.1. Tab Backgrounds

- Toolbar: Search, Type, Motion, Status, Add Background.
- Visual grid: 1 cột ở 375px, 2 cột ở `sm`, 3 ở `lg`, 4 ở `xl`.
- Card: thumbnail/poster ratio cố định, label, type, motion/status badge, tối đa ba mood tag + “+N”, Preview, Edit, More.
- Chỉ query `scope: "global"`; personal background tuyệt đối không xuất hiện.
- Form add/edit thay đổi theo `type`:
  - Image: upload `jpg`/`png`/`webp` tối đa 5 MiB, luôn static.
  - Video: upload `mp4`/`webm` tối đa 50 MiB + poster `jpg`/`png`/`webp` tối đa 5 MiB, playback luôn muted + looping. Đây là cùng giới hạn file với Author; Admin không có count limit.
  - Gradient: angle + danh sách color stop typed; không có textarea raw CSS.
  - Particle composition: combobox `composition_key` đã đăng ký + field config theo schema; không có textarea raw JSON.
- Upload có progress, Cancel/Retry và trạng thái processing. Save disabled trong lúc upload/validate.
- `motion: looping` thiếu poster phải chặn Save ở client và server.
- Preview dùng cùng shared `SceneLayer` (bên trong dùng `SceneBackground`); reduced-motion preview chuyển sang poster.

#### 8.3.2. Tab Palettes

- Toolbar: Search, Status, Add Palette.
- Compact grid: 1/2/3/4 cột theo mobile/`sm`/`lg`/`xl`.
- Card hiển thị primary, secondary, accent, background tint đã áp opacity, label, mood tags/status và action Preview/Edit/More.
- Form có bốn channel; `background_tint` gồm color picker, text hex và opacity slider/input đồng bộ.
- Preview trên sample Reader frame với body text cố định, Drop Cap/dialogue border để kiểm tra đúng phạm vi palette.
- Contrast warning phải xuất hiện trước Save; không tự động đổi màu user đã nhập.

#### 8.3.3. Tab Scene Presets — catalog, không phải builder

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

#### 8.3.4. Lifecycle, remove và dependency feedback

- Status badge: Draft, Active, Archived. Author picker chỉ thấy Active.
- Action “Remove khỏi catalog” mở ConfirmModal mô tả rõ: item không còn xuất hiện cho lựa chọn mới; Scene đã lưu không thay đổi. Preset có thể hiện thêm số Scene lưu provenance.
- Hard delete chỉ xuất hiện khi `activated_at = null`; không gộp hard delete với Remove. Preset import không được dùng draft Background/Palette làm source.
- Replace media tạo object key mới; UI không có action xóa trực tiếp storage object.

### 8.4. Quan hệ với Author ScenePicker

- `ScenePicker` Tab 1 chỉ đọc curated `ScenePreset.status = active`.
- `ScenePicker` Tab 2 Custom Scene chỉ đọc Background/Palette active cộng personal background đúng owner.
- Hai đường đều deep-copy cùng `SceneRenderConfig` vào Scene; Reader không biết Scene đến từ preset hay custom.
- Author upload ở ScenePicker có thể tạo personal image hoặc video+poster; AI Background vẫn chỉ tạo personal static image, không sinh full ScenePreset.

### 8.5. Responsive & Accessibility gate riêng cho Admin

- Không bắt buộc mọi click/touch target tối thiểu 44×44px, kích thước còn tùy vào giao diện xung quanh; icon dùng `lucide-react`, không dùng emoji làm icon chính.
- Navigation sheet/drawer/dialog trap focus, `Escape` đóng khi không dirty/pending, trả focus về trigger; dialog lồng làm surface phía sau inert, destructive confirm đặt initial focus ở Cancel.
- Form submit lỗi focus vào error summary; mỗi lỗi link/focus đúng field. Không chỉ dùng màu để biểu thị status/error.
- Keyboard dùng được sidebar collapse/nav, table/card action, menu, tabs, color input và Preview controls; tab order theo thứ tự nhìn thấy, focus ring không bị sticky header/footer che hoàn toàn.
- Animation drawer/card/preview tôn trọng `prefers-reduced-motion`; video/particle Preview dùng poster/static fallback.
- 375px và mobile landscape không có horizontal overflow; sticky footer action trong mobile form không che field cuối (`padding-bottom` theo safe area).
- Text/status/controls đạt WCAG AA; thumbnail có alt khi mang thông tin, còn ảnh trang trí dùng alt rỗng.

---
← Về `00-INDEX.md` | Liên quan: `04-ui-ux-design.md` (design token), `03-file-structure.md` (vị trí component), `08-effects-and-scenes.md` (logic Scene/Effect render), `12-auth-and-author-management.md` (luồng/rule auth & quản lý truyện)
