# Current Task

## Goal
Implement P3-04 JSON-to-Prisma migration with dry-run, apply and verify modes after the user's confirmed green P3-03 baseline.

## Source of Truth
- AGENTS.md; docs/00-INDEX.md; docs/01-tech-stack.md sections 1.2–1.3.
- docs/02-data-schema.md relevant models, especially 2.1/2.6/2.9.
- docs/07-user-stories-phase3.md US-3.1/3.2; docs/08-effects-and-scenes.md sections 8.3/8.6.
- docs/11-phase3-technical-roadmap.md sections 9.3–9.4c.
- docs/03-file-structure.md; docs/09-non-functional-requirements.md; docs/10-out-of-scope.md.
- Workspace runbook ../phase3-execution-plan.md P3-04.

## Verified Starting State
- HEAD 173d594; P3-02/P3-03 verification exists and user reports the P3-03 baseline green.
- JSON baseline: 3 stories, 10 chapters, 64 blocks, 69 block effects, 17 scenes, 41 backgrounds, 20 palettes, 39 presets.
- Story/chapter/block/effect/scene legacy IDs are globally unique in current fixtures; Scene ingredient and preset references resolve.
- DATABASE_URL/DIRECT_URL and the exact legacy owner selector are present only in ignored `.env.local`; never print credentials or owner selectors.

## In Progress
- P3-04 is complete on the configured Neon dev database. No P3-05 work has started.

## Completed
- P3-03 implementation and verification are recorded in docs/verification/p3-03.md.
- P3-04 requirements, schema, current adapters/mappers, fixtures and database foundation were inspected.
- P3-04 CLI, source/media validation, reusable manifest/keyword sync, transactional apply, exact verify, tests, CI step and operations docs are implemented.
- User-supplied covers now use paths matching their formats: WebP for an-khe-tra-vang, PNG for demo-story and JPEG for son-tinh-thuy-tinh. All referenced media pass existence and checksum validation.
- Typecheck, lint, unit tests, Prisma validate, build and client bundle scan pass.
- Neon migration integration passes apply twice + verify inside a rollback transaction; unknown manifest ID and overlay preservation are tested.
- The real Neon dev sequence passed: dry-run, apply, second idempotent apply with unchanged counts, then exact verify.
- Final migrated counts are 3 stories, 10 chapters, 64 blocks, 69 block effects, 17 scenes, 41 backgrounds, 20 palettes, 39 presets, 25 effect definitions and 144 normalized keywords.

## Remaining
- Remote GitHub Actions and Vercel Preview/Production are separate environment gates.
- Before applying outside Neon dev, the operator must create the environment-specific restore point and rerun dry-run → apply twice → verify using that environment's exact owner ID.
- Start P3-05 only when requested.

## Constraints
- No schema change, Prisma repository/read cutover, DB write cutover, Admin UI or later-stage command services.
- Keep runtime Story/Scene reads and writes on JSON; migration is an explicit server-side CLI only.
- Preserve stable legacy IDs/slugs and public Story/Chapter status; no destructive cleanup of unrelated DB rows or media.
- Apply must be transactional, idempotent and fail closed on invalid source, owner, manifest IDs, ranges or media.
- Use workspace .tools/node-v24.20.0-win-x64 and pnpm 10.33.0.
