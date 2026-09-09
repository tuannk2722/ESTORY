# Current Task — P3-08

## Goal and scope
Implement settings/progress/bookmark sync through completion. User approved first-login guest import once per account; later DB always wins, including empty lists. Vercel deployment deferred explicitly.

## Sources
AGENTS.md; docs/00-INDEX.md; ../phase3-execution-plan.md P3-08; docs/02 sections 2.3–2.5; docs/07 US-3.4; docs/11 section 9.5; docs/12 section 12.7.4; docs/01, 09, 10 constraints; docs/05 and 04b Reader/resume rules.

## Starting state
HEAD cf713c8, clean tree on 2026-09-09. User confirms P3-07 CI green and Neon preview-db created. Vercel/production gates deferred, not verified. Existing tables and auth/session guards available; settingsStore is still localStorage-only.

## Implementation decisions
UserSettings existence marks initialization, created atomically with guest import. Existing DB data wins. updatedAt supplies shared sync revision; Serializable conditional update prevents stale writes. Session owns actor; expectedUserId only guards cookie/account changes. Separate guest and account caches; consume captured guest data after successful bootstrap. Keep synchronous settingsStore facade with subscriptions/queued network writes; no new dependencies or auth UI.

## Progress / remaining
Implementation complete: service/route, store lifecycle, subscriptions and Reader integration; unit/DB/HTTP/browser tests and CI entries. Permanent rules and verification are recorded in docs/verification/p3-08.md and referenced source docs.
Installed Next route guide and Auth.js client types read; ui-ux-pro-max guidance for async feedback read.

## Tools and constraints
Node: ../.tools/node-v24.20.0-win-x64. Playwright + Edge: ../.tools/p3-07-browser. Never print credentials. No deployment or persistent env changes. Do not mark external CI/deployment checks passed without evidence.

## Verification checkpoint
Unit, production build/TypeScript, lint, client bundle and baseline counts passed. Sync DB/HTTP and Edge browser passed on Neon dev, including account isolation, stale revisions, empty DB, offline/retry and mounted cookie changes. Auth HTTP and P3-07 command HTTP/browser regressions passed. Final server-only Story lookup adjustment uses existing repository access record; rebuilt and DB/HTTP reruns passed, targeted lint and client bundle passed. Final diff reviewed; no schema/lock/content/env changes. Fixture cleanup runs in finally; read-only final audit found zero P3-08 fixture users, temporary helper removed. Authorized implementation and local/Neon dev verification complete. No commit/push/deploy. P3-08 external CI awaits push; Vercel explicitly deferred.
