# Current Task — P3-12 audio ownership and keyword search (2026-09-16)

## Completed follow-up — user authorized

- Chuyển audio sang code-owned, tách Author catalog khỏi Admin revision DTO, bỏ Admin
  audio mutations và DB active gate cho audio; giữ snapshot/renderer/ownership checks.
- Xóa overlay audio bằng bước data cleanup sau cutover, có backup; không đổi lịch sử SQL
  migration, không tái tạo overlay qua seed/sync. Không push/deploy trong task này.
- Keyword phục vụ search block/scene effect/Admin; giữ block onBlur suggestions và weight
  chỉ cho suggestion. Audio preset có keyword trong code; không thêm ranking/provider.
- Nguồn canonical: `docs/02` §2.6, `docs/08` §8.5.1, `docs/07` US-3.12;
  runbook cleanup/rollback và bằng chứng tại `docs/verification/p3-12.md`.
- Code/spec/runbook hoàn tất. Unit/typecheck/lint/build/client-bundle, Effect DB cutover
  probes, migration rollback, command và read regression đã pass. Read test đã sửa kỳ vọng
  để giữ metadata/keyword Admin thay vì giả định DB luôn bằng seed.
- HTTP + browser Admin/block/scene search/audio đã pass trên production build sau cleanup.
  Outside-close combobox dùng click capture để tránh dịch chuyển nút trước mouseup và vẫn
  hoạt động trong dialog chặn bubbling; browser đã kiểm chuyển menu. Build cần network
  Google Fonts; Neon cần escalation. Unit/build/client-bundle/targeted lint cuối đều pass.
- User xác nhận Neon dev chỉ workspace dùng. Cleanup đã apply: xóa 1 overlay/0 keyword;
  rerun 0/0; deployment sync không tạo lại, còn 24 overlay Admin. Backup và hash audit ở
  `../.tools/p3-12-audio-overlay-backup-20260916.json` và `../.tools/p3-12-audio-cutover-before.json`.
  Effect/Scene/AudioAsset hash/count trước/sau khớp. Đã dọn fixture HTTP bị gián đoạn.
- Audit cuối: 24 overlay, 0 audio overlay/keyword, 0 fixture HTTP user/keyword;
  69 Effect, 17 Scene, 0 AudioAsset. Biên bản đã cập nhật; diff/whitespace đã kiểm.
  Không còn implementation/local verification đang chờ. Không push/deploy.

## Baseline và bảo toàn thay đổi

Task bắt đầu trên changeset P3-12/review chưa commit. Giữ toàn bộ thay đổi hợp lệ đã có;
bằng chứng baseline 2026-09-15 nằm trong `docs/verification/p3-12.md`. CI/Vercel Preview chưa chạy.
