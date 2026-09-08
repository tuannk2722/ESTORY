# Current Task

## Goal
Implement P3-07 — Reader transition & controlled cutover. User explicitly requested continuing implementation after inspection, then sent resume. Complete authorized local implementation/testing; record external environment gates separately.

## Source of Truth
- AGENTS.md; docs/00-INDEX.md; ../phase3-execution-plan.md P3-07.
- docs/01-tech-stack.md section 1.3; docs/10-out-of-scope.md.
- docs/02-data-schema.md sections 2.1/2.9; docs/05-user-stories-phase1.md; docs/06-user-stories-phase2.md; docs/07-user-stories-phase3.md US-3.1/3.3/3.5/3.7/3.8.
- docs/08-effects-and-scenes.md sections 8.3–8.7; docs/09-non-functional-requirements.md.
- docs/11-phase3-technical-roadmap.md sections 9.2/9.3/9.5; docs/12-auth-and-author-management.md sections 12.6/12.7.
- README.md P3-05/P3-06 operations; prisma/README.md; docs/verification/p3-06.md.

## Starting State
- Inspected 2026-09-08: HEAD 5c7569b, P3-06 commit; working tree clean before task-state update.
- User confirms P3-06 Local and GitHub Actions green on branch phase3 at 5c7569b: CI / Node 24 validation (push) and CI / PostgreSQL foundation (push) both pass. CI result is user-confirmed, not independently fetched.
- User confirms only Local + Neon dev DB exist; no Vercel preview/staging with a separate database. Vercel deployment, preview and production cutover evidence remain outstanding.
- No application code, schema, environment or database changes during inspection. No tests rerun for unchanged application code.

## Local Implementation Complete
- Reader route/ReaderPane now use canonical snapshots, no library fetch/legacy ID resolution; next-scene preload honors reduced motion.
- Editor DB bootstrap, canonical state/selectors/range/picker/previews and P3-06 save envelopes implemented. Existing UI layout retained; snapshot-only current ingredient options preserve archived/missing catalog sources.
- Added p3-07-client tests and extended P3-06 HTTP integration with actual client serializer, archived provenance, owner draft page and public Reader tests. Optional scripts/p3-07-browser-smoke.cjs uses external Playwright tooling (no app dependency change).
- Passed: unit suite, build (including TypeScript), lint, client-bundle scan, baseline counts, commands DB/HTTP, reads DB and auth HTTP. Final browser script lint also passed.
- Final headless Edge + HTTP run passed: canonical Reader without library requests, video continuity/transitions, reduced-motion poster without early video requests, 375–1440px, picker focus/Escape, text and Scene edit/save/reload, preview save and stale 409. Fixed early video download before reduced-motion preferences hydrated. Inspected Reader and Editor screenshots, including Editor at 375px.
- Browser plugin has no available connections (discovery returned []). Installed Playwright 1.58.2 with user-approved network command in ../.tools/p3-07-browser; headless Edge uses fresh fixture-only context.
- Reviewed diff and passed git diff --check. No deployment, commit/push, application dependencies, schema, seed or persistent environment changes. Evidence: docs/verification/p3-07.md; cutover/freeze/rollback runbook: README.md P3-07.

## Remaining
- GitHub Actions for the new P3-07 changeset; P3-06 green CI is only baseline evidence.
- Establish Vercel preview/staging with a separate DB, then execute the environment-specific read/write checks in README.md. Only Local + Neon dev currently exists (user confirmed).
- Production canary/observation criteria, backup/restore/PITR evidence, write cutover and deployed Reader Lighthouse remain pending. Do not mark the whole P3-07 stage complete from local tests. Detailed gates: docs/verification/p3-07.md.

## Constraints
- Production writes remain off until P3-07 gates pass. No environment changes or deployments made during inspection.
- No Author wizard/Admin catalog tooling/settings sync/media integration or schema changes without demonstrated scope requirement.
- After real DB writes, rollback uses DB restore/PITR or forward fix, not JSON writes.
- HTTP/domain Story IDs are slugs. Byline policy: docs/12 section 12.5.
- Node: workspace .tools/node-v24.20.0-win-x64; pnpm 10.33.0. Never print credentials, sessions or connection values.
