# My Storytelling App — Agent Instructions

Scroll-based storytelling application built with Next.js 16
(App Router), TypeScript, Tailwind CSS, GSAP and Framer Motion.

## 1. Source of Truth

Project behavior, architecture, schemas, UI rules and requirements are
defined under `docs/`.

Before working on a task:

1. Read `docs/00-INDEX.md`.
2. Use it to identify the documents relevant to the current task.
3. Read those documents before modifying code.

- Do not read the entire documentation set by default.
- Use `docs/00-INDEX.md` to identify only the documents and sections
  relevant to the current task.
- Prefer targeted sections over reading large unrelated files in full.
- Do not re-read unchanged documentation during the same task unless
  context recovery or conflict verification requires it.
- Do not duplicate information from authoritative docs into TASK.md or
  implementation plans; reference the source instead.

- Do not duplicate project documentation in this file.

- If the current task conflicts with documented behavior, do not silently
choose one. Report the conflict or update the documentation when the
task explicitly introduces a new decision.


## 2. Task Workflow

Before implementation:

- Determine the current project Phase and task scope.
- Read the relevant documentation.
- Inspect the existing implementation before proposing changes.
- Do not implement unrelated improvements outside the requested scope.

For long-running or multi-phase tasks:
- maintain `.codex/TASK.md` as recoverable temporary task state.
- update it at meaningful phase boundaries, not after every small edit.
- keep permanent architectural/domain decisions in project documentation
- Do not copy large documentation sections, source code, git diffs, or
conversation history into TASK.md.
- Before starting a new major phase, ensure the task can be reconstructed
from TASK.md + authoritative docs + current code/git state.

For small UI/UX implementation details that do not affect architecture,
schema, or public contracts, make a reasonable decision using the
project UI/UX guidance without unnecessarily blocking on clarification.

Ask before making an unrequested decision that materially changes:
- architecture
- data schema
- repository contracts
- public interfaces
- project scope


## 3. Hard Invariants

- Story persistence must go through `StoryRepository`.
- Settings persistence must go through `settingsStore`.
- Components/pages must not directly access persistence mechanisms when
  an approved abstraction exists.
- Scene and Effect are separate domain concepts. Scene behavior must not
  be implemented through `EffectConfig` / `EffectRegistry`.
- Respect the currently documented project Phase and out-of-scope rules.
- Do not introduce libraries, technologies, or architectural patterns
  outside the documented stack without explicit task justification.
- Follow the documented accessibility, responsive, reduced-motion and
  UI/UX requirements.


## 4. Validation

Before considering an implementation task complete:

- Review the relevant non-functional requirements.
- Run the checks appropriate to the modified scope.
- At minimum, ensure TypeScript errors have not been introduced.
- Run build/tests when required by the task or affected subsystem.
- Inspect `git diff` for unintended changes.

Common commands:

`pnpm dev`
`pnpm build`
`pnpm run typecheck`


## 5. Context Recovery

Conversation history is not the source of truth for project behavior.

If task context appears incomplete, ambiguous, compacted, or interrupted:

1. Do not guess previous decisions.
2. Do not immediately modify code.
3. Read `.codex/TASK.md` if it exists.
4. Read the authoritative project documents referenced by the task.
5. Inspect `git status`, `git diff`, and relevant modified files.
6. Reconstruct the current goal, completed work, remaining work,
   constraints, and next step.
7. Report information that conflicts or cannot be verified.
8. Continue implementation only after task state is sufficiently
   reconstructed.

Long-term architectural decisions, domain rules, and requirements must
be persisted in project documentation, not only in conversation history
or `.codex/TASK.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
