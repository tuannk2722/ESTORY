# P3-15 ? local implementation validated, external gates pending

## Active follow-up — CI/Vercel failure 2026-09-21

Latest supplied Vercel log: dpl_7SdS5MxJyQb6XjHReNVXB68UgCLT, commit 24aad2b.
Webpack build succeeds; deployment rejects Function package mentioning symlink directories.
Fixed next.config.ts explicit FFmpeg includes to resolve the real package directory.
Node24 webpack build/TypeScript and targeted ESLint pass; fresh local traces retain binary
without descendants beneath traced directory symlinks. See verification/p3-15.md.
Linux Vercel redeploy still required to confirm root cause. No push/deploy performed.

User reports Node24 CI build fails collecting Freesound disconnect route without DATABASE_URL.
Clean worktree at start. Fixed eager Prisma imports in oauth/search/import using existing runtime
loader. Added isolated module-import regression test and CI step. Regression + audio DB pass;
no-DB production build (including TypeScript), targeted ESLint and audio HTTP regression passed.
Vercel CLI inspect requested deployment
dpl_6Mebu1n39RTXqfLF9UwrXUzw3WoY requires authentication; asked user via async input.
No schema changes, commits or push. Preserve UI and M4A/AAC follow-ups below.

User: no schema/migrations/reservation table; Freesound 15/day; AI 0 pending P3-16.
Source of truth: docs/02 2.5, docs/08 8.9, docs/verification/p3-15.md.
P3-13/14 acceptance updated using user confirmation; historical drift preserved.

Implemented quota + Freesound OAuth/search/import/upload/library/pickers/attribution.
Quota handoff files and request-local/crash limitations recorded in verification.
Node24: prepend C:/Users/OS/story-telling/.tools/node-v24.20.0-win-x64 to PATH.

Passed: unit, lint, typecheck/build, quota DB, audio DB/HTTP, live R2 WAV/MP3 upload,
live Freesound app search, client bundle. Final typecheck after R2 fixture addition passed.
Tests clean disposable fixtures; no schema changes. No commits/push/deployment.

Still required: browser smoke (browser unavailable; automatic approval review rejected
troubleshooting due to account usage limit; do not bypass with another browser tool),
live personal OAuth/refresh/download/import, Vercel Linux spike + bundle size and CI.
Local ffmpeg-static 5.3.0 candidate spike passes ~4-5 sec for 299 sec WAV; Windows trace
~257.7 MB, close to 250 MB platform limit; Linux deploy gate is important.
Temporary admin-only POST /api/admin/audio-transcode-spike available for preview metrics,
remove after deployment evidence. User must interact with personal OAuth and enable browser.
Local empty encryption key initialized securely; no value printed. Configure preview key
and exact callback before OAuth test. API key falls back to client secret per official docs.

Next: external gates when environment
is available. Do not mark stage complete based on local gates alone.


## Audio picker UI refactor ? 2026-09-21
User asks two tabs, immediate upload-to-library, consistent sound rows, bounded Freesound results and better Scene config placement.
Implemented: shared SoundRow for presets/library/Freesound, immediate library upload with retry/progress, scrollable search + pagination, full-width Scene audio section and selection-to-config focus. Preview is shared per modal to prevent overlapping audio. Personal selections preserve asset attribution when configuring volume/loop and do not appear as manual URLs.
Preserve existing P3-15 work; no schema/API changes. Authoritative UX update: docs/08 ?8.9.
Passed: typecheck, targeted ESLint, existing pnpm test suite, git diff --check and scope review (pre-existing P3-15 changes preserved).
Browser verification remains unavailable: runtime initialized but getForUrl reported no browser; documented discovery returned an empty list. No fallback browser used. Live upload/import and visual responsive/theme QA were not performed for this refactor.

## Freesound M4A/AAC support - 2026-09-21
User authorized focused M4A/AAC import support, same MP3 output and limits; device upload unchanged.
normalize-audio.ts uses private temporary seekable input for ftyp containers, pipes for other audio including AAC ADTS. No network/external MOV references. Finally cleanup.
Real generated fixture suite passed (new test:audio:transcode command, added Linux CI step). Docs/08 section 8.9 and verification/p3-15 document behavior and external gates.
Passed: typecheck, targeted ESLint, unit suite, real transcode tests, production build and diff review. Initial sandbox build could not fetch Google Fonts; escalated retry passed. No deployment or live OAuth import; Linux CI/Vercel gates remain external.
