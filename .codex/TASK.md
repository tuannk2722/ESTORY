# Current Task

## Goal
Implement the next stage: P3-00 (baseline, runtime lock, CI skeleton).

## Source of Truth
- `docs/00-INDEX.md`, `docs/01-tech-stack.md`, `docs/02-data-schema.md`.
- `docs/07-user-stories-phase3.md` US-3.8, `docs/09-non-functional-requirements.md`, `docs/10-out-of-scope.md`.
- `docs/11-phase3-technical-roadmap.md` 9.7; workspace runbook `../phase3-execution-plan.md` P3-00.

## Current Decisions
- Git/code confirms P3-00 is the first unimplemented stage; stop at this stage.
- Use portable Node 24.20.0 in workspace `.tools` for local verification; global Node remains 25.5.0.
- No domain/UI/persistence changes. No dependency upgrades.

## Completed
- [x] Read relevant docs; initial working tree clean at `43a32fb`.
- [x] Initial lint/typecheck/test/build pass on existing Node 25.5.0.
- [x] Add Node/pnpm pins, CI workflow, read-only seed count/hash script.
- [x] Frozen install on Node 24.20.0 / pnpm 10.33.0 reinstalled all 365 packages; lockfile unchanged.
- [x] Remove npm lockfile only after frozen install succeeded.
- [x] Node 24 lint/typecheck/test (25 assertions)/counts/build all pass.
- [x] Update README; save results in `docs/verification/p3-00.md` and seed snapshot JSON.
- [x] Inspect diff; YAML/pins/single lockfile/snapshot validation and `git diff --check` pass.

## In Progress
- No local implementation work remains for P3-00. Full exit gate awaits remote checks below.

## Remaining
- [ ] On commit: keep `package-lock.json` deletion in a separate commit as requested by the runbook.
- [ ] On push: verify actual GitHub CI run and required status check configuration.
- [ ] On deployment: verify Vercel Node 24 / pnpm 10.33.0 + Corepack per README.

## Modified Files
- `package.json`, `.nvmrc`, `.github/workflows/ci.yml`, `scripts/baseline-counts.mjs`, `README.md`, `.codex/TASK.md`, `docs/verification/p3-00.md`, `docs/verification/p3-00-baseline.json`; delete `package-lock.json`.

## Known Issues
- `docs/14-ai-assistant-guidelines.md` is referenced by INDEX but absent throughout workspace; follow available AGENTS/docs.
- Missing legacy `/scene-backgrounds/rain-loop.mp4` is a P3-04 migration blocker, outside P3-00.
- Remote GitHub CI/branch protection and Vercel deployment settings cannot be verified by local checks.
- Current seed has 68 block effects (runbook's old audit said 67); use saved script output.

## Next Step
Collect remote P3-00 gate evidence before starting P3-01 contract/compatibility bridge. Do not treat local validation as a deployed CI/Vercel check.

## Last Verified
2026-09-05; full local evidence in `docs/verification/p3-00.md`.
