# Current Task — P3-09

## Goal and scope
Implement the R2 media-storage foundation after P3-08. User explicitly expands personal Background upload from image-only to image or video; video requires a separately uploaded poster and each author is limited to 10 retained video uploads.

## Sources
AGENTS.md; docs/00-INDEX.md; ../phase3-execution-plan.md P3-09/P3-16; docs/01 section 1.2; docs/02 sections 2.5/2.9/2.11; docs/03 Phase-3 paths; docs/04b sections 5.5/8.2–8.4; docs/06 Scene extension; docs/07 US-3.6/3.19; docs/08 sections 8.3–8.10; docs/09/10; docs/11 sections 9.4c/9.5–9.7.

## Starting state
HEAD 6d5fcda on branch phase3, clean app repository at task start. P3-08 local/Neon gates passed; user reports CI and Vercel preview green. Existing Prisma BackgroundAsset/AudioAsset models and auth guards exist, but no storage provider, upload intent, R2 dependencies, routes or UI upload integration.

## Decisions introduced by user request
Docs were updated before code. R2 Standard is the default implementation behind MediaStorageProvider. Image/poster cap 5 MiB; audio 8 MiB and 5 minutes; background video mp4/webm 50 MiB for both Admin and Author. Author cap is 10 retained video slots; pending requests reserve slots and slots release only after physical cleanup. Background video is a two-part upload (video + required image poster); AI remains image-only. Presigned PUT lasts 10 minutes and uses If-None-Match to prevent key overwrite/reuse.

## Scope boundary
P3-09 owns provider/config, durable upload-intent schema, presign/complete/cancel services/routes, validation, tests and operational docs. P3-10/13/15/16 will claim completed uploads in their domain transactions and own Story wizard/Admin/audio/ScenePicker UI. Do not pull those UIs into this stage.

## Completed
Added two additive migrations, durable upload intents, R2 provider/config, presign/complete/cancel routes, server-side media inspection, immutable keys, role/owner/state guards, video+poster bundles and concurrent 10-slot quota. Updated decision docs first, then implementation/runbook/tests. Local static/build gates, Neon dev migration/DB/HTTP regressions and live R2 CORS/PUT/reuse/expiry/public-delivery/cleanup smoke passed. Evidence: `docs/verification/p3-09.md`.

## Remaining outside P3-09 implementation
GitHub Actions and Vercel preview/production configuration/deployment are not run locally. P3-10/13/15/16 must claim completed intents inside their domain transactions and own Story wizard/Admin/audio/ScenePicker UI. Production object cleanup still requires the later reference-audit job; do not infer cleanup from DB archive/delete.

## Constraints
Node 24 via ../.tools/node-v24.20.0-win-x64; pnpm 10.33.0. No secrets in logs/tests/docs. No deployment or persistent external configuration without user authority. Preserve Reader/Editor behavior and P3-08 changes.
