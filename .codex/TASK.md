# Current Task

## Goal
Implement P3-03 Auth.js and admin bootstrap after the user's confirmed green P3-02 baseline.

## Source of Truth
- AGENTS.md; docs/00-INDEX.md; docs/01-tech-stack.md sections 1.2–1.3.
- docs/02-data-schema.md section 2.5; docs/07-user-stories-phase3.md US-3.3/3.5.
- docs/11-phase3-technical-roadmap.md section 9.5; docs/12-auth-and-author-management.md sections 12.1–12.3.
- docs/03-file-structure.md; docs/09-non-functional-requirements.md; docs/10-out-of-scope.md.
- Workspace runbook ../phase3-execution-plan.md P3-03.

## Verified Starting State
- HEAD 3065d8f; clean working tree. P3-02 evidence in docs/verification/p3-02.md.
- Prisma 7.10.0 has all Auth.js models; no Auth.js dependencies or guards yet.
- Only exposed content mutation is legacy editor PUT; editor page/API full reads are unguarded.
- JSON has no trustworthy owner. Restrict legacy editor to admin until P3-06 ownership integration.
- Installed Next.js proxy/authentication guides and official Auth.js docs inspected.
- DATABASE_URL/DIRECT_URL set in ignored .env.local. Never print credentials.

## In Progress
- None. P3-03 code and local/Neon dev gates passed, including a real admin.

## Completed
- Auth.js 5.0.0-beta.32 + Prisma adapter 2.11.3; database sessions and safe stable ID/role projection.
- Verified provider email, same-origin redirects, no automatic account linking, safe auth logging.
- Session/rank guards, author/admin proxy/layout guards, admin-only legacy editor page/API and mutation Origin check.
- Transactional promote-only CLI bootstrap with email/ID allowlist; no user creation or admin demotion.
- Unit, DB and HTTP integration suites; CI jobs, README/env example and docs/verification/p3-03.md.
- Frozen offline install, lint/typecheck/unit/build/client-bundle/credential audit/diff checks passed.
- Neon Auth DB integration passed with rollback; HTTP suite passed, disposable users/sessions deleted.
- User confirmed real GitHub login. Verified 1 GitHub account and active session in Neon dev.
- Full allowlist has 2 emails; second has no OAuth user, so full-list bootstrap failed without changes.
- Scoped the existing CLI to the one signed-in, allowlisted GitHub user using process-only exact ID env; .env.local unchanged.
- Bootstrap run 1: matched=1, promoted=1, admins=1. Run 2: matched=1, promoted=0, admins=1.
- User/Account/Session counts unchanged at 1/1/1; existing session projection retains user ID and returns role admin.

## Remaining
- Google real OAuth smoke, remote CI/Vercel and preview/prod checks unverified; no push/deploy requested.
- Second configured allowlist email has not signed in/been bootstrapped. Full-list CLI intentionally requires every selector to match.
- Stop before P3-04 unless explicitly requested. Verification: docs/verification/p3-03.md.

## Constraints
- No schema changes, Story/Scene cutover, owner/membership services, Auth UI/onboarding or later stages.
- Bootstrap only promotes existing allowlisted OAuth users; no public endpoint or admin demotion.
- Keep Story/Scene persistence on JSON; no secrets or session/OAuth tokens in logs.
- Use workspace .tools/node-v24.20.0-win-x64 and pnpm 10.33.0.
