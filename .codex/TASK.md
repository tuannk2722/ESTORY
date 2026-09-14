# Current Task — P3-11

## Goal and scope

Triển khai tuần tự P3-11A rồi P3-11B theo `../phase3-execution-plan.md` §P3-11.
P3-11A gồm search/list foundation, Home search + public genre facets và Hero artwork theo
theme. P3-11B gồm Admin shell và moderation list/detail/preview/approve/reject.

## Sources

`AGENTS.md`; `docs/00-INDEX.md`; runbook P3-11; `docs/02` §2.1/2.7; `docs/03`;
`docs/04` §4.4; `docs/04b` §0/§1/§8.0–8.1; `docs/05` US-1.1;
`docs/06` US-2.2/2.7; `docs/07` US-3.20/3.11; `docs/08` §8.7; `docs/09`;
`docs/10`; `docs/11` §9.2.2–9.2.3/§9.5; `docs/12` §12.7.4/12.7.6.

## Starting state

HEAD `549e228` trên branch `phase3`. User xác nhận baseline P3-10, test, GitHub Actions
và Vercel preview đều xanh. `AGENTS.md` đang có thay đổi do user/Next.js tạo và phải giữ
nguyên. Ba artwork nguồn hiện nằm trong `public/home-background-image/` với tên tạm; phải
đổi sang tên canonical dựa trên nội dung, không dựa trên tên tạm.

## Decisions

- Public story search dùng cùng pure text primitive với picker, nhưng chạy server-side qua
  repository; Home không tải aggregate rồi lọc client-side.
- Genre facet chỉ lấy Story published, đếm DISTINCT Story và hiển thị từ nhiều Story xuống
  ít Story; tie-break deterministic theo normalization rồi label. Tối đa 6, responsive bằng
  wrap, không horizontal-scroll hoặc clipping.
- `q + genre` là AND, URL-backed và reset cursor khi đổi filter. Không hardcode taxonomy.
- Ba Hero asset art-directed Dark/Light/Sepia dùng `next/image`; paint hint chỉ chống FOUC,
  `settingsStore` vẫn là authority.
- P3-11B dùng read model/admin DAL riêng; không nới public repository để preview private.
- Moderation chapter detail chỉ giữ block count + tổng effect count; không query/serialize/hiển thị breakdown theo category.
- Admin chapter preview dùng route group shell-neutral và dedicated Admin header có `data-reader-header`; chỉ phần render nội dung dùng chung `ReaderPane`, không kéo `ReaderScreenHeader`/`SettingsPanel` vào route moderation.

## Progress

- Đã triển khai P3-11A và P3-11B; migration search document đã apply trên Neon dev.
- Automated local/Neon gates và HTTP integration của baseline P3-11 đã xanh; phép đo search p95
  `67.53 ms` trên 3 Story published nên chưa thêm `pg_trgm`/GIN. Sau refactor moderation,
  typecheck/lint/unit/build/client-bundle xanh; DB/HTTP integration cần rerun khi được phép ghi
  fixture lên Neon development.
- Còn chờ browser visual/a11y smoke do công cụ browser không khởi tạo được kernel assets, và
  chờ CI/Vercel của changeset P3-11 sau khi user quyết định commit/push.

## Constraints

Không push/deploy hoặc đổi persistent environment nếu chưa được giao. Không thêm AI search,
taxonomy table, `pg_trgm`/GIN khi chưa có phép đo, hoặc dependency mới. Ghi bằng chứng chung
tại `docs/verification/p3-11.md`.
