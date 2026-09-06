# Current Task

## Goal
Implement P3-02 PostgreSQL + Prisma foundation. Keep the application on JSON.

## Source of Truth
- AGENTS.md; docs/00-INDEX.md; docs/01-tech-stack.md sections 1.2-1.3.
- docs/02-data-schema.md mapped models; docs/11-phase3-technical-roadmap.md sections 9.2-9.4c/9.7.
- docs/03-file-structure.md; docs/07-user-stories-phase3.md US-3.1/3.2.
- docs/08-effects-and-scenes.md sections 8.3/8.6; docs/09-non-functional-requirements.md; docs/10-out-of-scope.md.
- Workspace runbook ../phase3-execution-plan.md P3-02.

## Verified Starting State
- HEAD 3972d53; clean working tree. P3-01 committed at 78de862; user confirms green baseline.
- No Prisma, database environment files, or database client. Repository factory uses JSON.
- Local verification uses workspace .tools/node-v24.20.0-win-x64 and pnpm 10.33.0.
- Read relevant installed Next.js environment and server/client boundary documentation.

## In Progress
- None. P3-02 implementation and local/Neon verification are complete.

## Completed
- Prisma CLI/client/adapter-pg 7.10.0 and pg 8.23.0 pinned with one pnpm lockfile.
- All 19 models/five enums mapped from roadmap, query indexes, atomic initial migration.
- Server-only singleton and startup environment validation; JSON repository factory unchanged.
- P3-01 snapshot codecs reused for database JSON; settings category JSON validated.
- Migration/generation scripts, PostgreSQL CI service, browser-bundle gate and prisma/README.md operations/rollback instructions.
- Frozen install, format/validate/generate, lint/typecheck/tests/build and browser-bundle scan passed.
- Neon empty-database preflight, migration deployment/redeployment/status, zero schema drift and 19-model integration test passed.
- User supplied URLs in .env.example; relocated credentials to ignored .env.local and restored empty example values. Do not print credentials.

## Remaining
- Final diff review and credential audit passed; see docs/verification/p3-02.md for evidence.
- Remote GitHub Actions/Vercel checks and preview/production env setup have not been performed. No push/deploy requested.
- Stop before P3-03 Auth or data import/read-write cutover.

## Constraints / Known Issues
- Neon dev URLs are available only in ignored .env.local; initial migration has been applied. Do not edit the applied migration.
- Separate dev/preview/prod connections. Production runs only prisma migrate deploy.
- No Prisma read/write cutover, data import, Auth setup, UI or later-stage services.
- Preserve documented schema; no Rating/Comment/analytics tables.
- Missing legacy /scene-backgrounds/rain-loop.mp4 belongs to P3-04 data migration.

## Last Verified
2026-09-06: P3-02 local validation and Neon development migration/integration gates passed; production JSON startup HTTP 200 without database URLs. Detailed evidence: docs/verification/p3-02.md.
