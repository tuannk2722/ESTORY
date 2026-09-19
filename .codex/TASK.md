# Current Task — P3-14 Scene Authoring v2 (2026-09-19)

Status: implementation and direct local/Neon/live-R2 checks complete. The P3-14 stage is not yet
fully accepted: strict P3-04 seed parity reports two classified mutable runtime rows, and external
CI/deployment gates have not run. Details are recorded in `docs/verification/p3-14.md`.

## Goal and approved decisions

- Implement `../scene-palette-preset-product-decision.md` D-11 through D-16.
- Rescope P3-14 to Scene Authoring v2, deterministic auto treatment, and retirement of Palette/Preset from new authoring.
- Author sees only `auto` (default) and `original`; no look/custom/advanced controls.
- Keep SceneRenderConfig v1 parser/renderer semantics unchanged. New Scenes use v2; an existing v1 Scene converts only after an explicit background/treatment action.
- Soft-retire ColorPalette and ScenePreset from new UI/API choices. Preserve tables, migrated rows, v1 snapshots, provenance, and migration verification through P3-17.
- Auto derivation runs client-side first, stores resolved lowercase hex values in the Scene snapshot, and falls back safely to original.

## Implementation boundaries

- Update canonical docs and `../phase3-execution-plan.md`; historical verification files remain historical.
- Do not add Prisma tables or columns for auto treatment.
- Reader must never fetch catalogs or analyze media.
- P3-15 and P3-16 retain Freesound/audio and personal/AI background ownership; P3-16 will reuse the v2 authoring flow.
- Preserve the uncommitted P3-13 changes already in the worktree.

## Required validation

- Focused contract/renderer/authoring/search tests for v1/v2, deterministic derivation and legacy provenance.
- Existing unit suite, typecheck, lint, build and client-bundle check.
- Relevant DB/HTTP integration suites if repository/API behavior changes.
- Inspect final diff and record evidence in `docs/verification/p3-14.md`.
