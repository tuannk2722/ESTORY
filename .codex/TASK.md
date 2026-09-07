# Current Task

## Goal
Implement P3-05 Prisma read repositories, public/full contract and safe shadow parity tests. Preserve legacy story attribution with the user-approved `Story.authorDisplayName` database field, and repair the Linux CI database preflight that blocked P3-04.

## Source of Truth
- AGENTS.md; docs/00-INDEX.md; docs/01-tech-stack.md sections 1.2–1.3.
- docs/02-data-schema.md sections 2.1/2.6/2.9; docs/08-effects-and-scenes.md section 8.7.
- docs/09-non-functional-requirements.md public/snapshot/catalog boundaries.
- docs/11-phase3-technical-roadmap.md sections 9.2–9.3 and relevant Prisma mappings.
- Workspace runbook ../phase3-execution-plan.md P3-05.

## Verified Starting State
- HEAD 519f3ca; worktree was clean before P3-05 edits.
- P3-04 passed dry-run/apply/apply/verify on Neon dev, but GitHub Actions failed before migrations because `check-empty-database.mjs` directly imported a TypeScript module whose extensionless nested import cannot be resolved by Node 24 ESM on Linux.
- Local `pnpm typecheck` and `pnpm test` pass at the P3-04 baseline.
- JSON story contract retains a public attribution string while Prisma only persisted the shared migrated owner ID. User approved adding `Story.authorDisplayName` everywhere affected.
- DATABASE_URL/DIRECT_URL and the exact legacy owner selector are present only in ignored `.env.local`; never print credentials or owner selectors.

## In Progress
- No local implementation work remains; awaiting external environment gates.

## Completed
- P3-04 implementation and Neon dev evidence are recorded in docs/verification/p3-04.md.
- P3-05 requirements, docs, current repository consumers, feature flags, Prisma codecs, migration source and CI failure were inspected.
- Added and deployed the additive `Story.authorDisplayName` migration; P3-04 apply/apply/verify passes with exact legacy bylines and unchanged counts.
- Implemented Prisma Story/Scene/catalog/Effect reads, server-only selectors and safe shadow comparison without Prisma writes or consumer cutover.
- Repaired `db:check-empty` by using the repository TypeScript runner; the migrated Neon dev now reaches the intended non-empty rejection instead of failing Node ESM resolution.
- Local/static/build/client-bundle gates and Neon database/auth/migration/P3-05 read/HTTP integration gates pass. Migration status is current and schema drift is zero.
- Added `docs/verification/p3-05.md` and updated affected schema, auth/author, NFR, roadmap, operations and index documentation.
- Final diff/whitespace/credential review passed; no real credentials or owner selectors were added.

## Remaining
- GitHub Actions and Vercel Preview/Production remain external gates until new runs are confirmed.

## Constraints
- Prisma read flags remain JSON by default; Prisma write remains rejected.
- No editor mutation conversion, DB write cutover, Reader transition, Admin UI or deletion of JSON adapters in P3-05.
- Shadow reads return the primary result, compare only safe reads, and log only stable code/count metadata—never content, tokens, selectors or connection data.
- Invalid database snapshots fail observably without catalog fallback.
- Use workspace .tools/node-v24.20.0-win-x64 and pnpm 10.33.0.
