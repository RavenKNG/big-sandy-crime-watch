# Big Sandy Crime Watch / Credit-Efficient Codex Operating Rules

The user has limited Codex credits/battery and wants maximum useful output per percent. Always optimize for high-value, low-risk progress. Do not burn credits wandering, re-inspecting unnecessarily, overbuilding, debugging blindly, or starting risky changes that cannot be finished cleanly.

## Project Context

- Project: Big Sandy Crime Watch
- Domain: bigsandycrimewatch.com
- Goal: automated public-safety / mugshot / KSP news website for Big Sandy and nearby Kentucky counties.
- Current feature track: Official News Automation / KSP Post 8 and Post 9.
- Current counties: Johnson, Magoffin, Martin, Lawrence, Pike, Rowan.
- Existing booking/import/Facebook systems are working and should be protected.
- Monetization is by views/ads only. No paid removals.
- Wording must be factual, attributed, and avoid implying guilt.

## Credit-Efficiency Rules

1. Never start by coding blindly. First inspect only the files relevant to the task.
2. Before editing, summarize what exists and identify the smallest safe checkpoint.
3. Prefer narrow checkpoint work over huge feature attempts.
4. Reuse existing architecture, models, routes, workers, Facebook draft logic, env patterns, and admin patterns.
5. Do not create duplicate systems if an existing system can be extended safely.
6. Do not run expensive commands unless they are specifically useful for the checkpoint.
7. Do not install packages unless explicitly authorized.
8. Do not run migrations unless explicitly authorized.
9. Do not deploy or push unless explicitly authorized.
10. Do not modify production `.env`.
11. Do not print secrets or environment variable values.
12. Do not enable auto-posting unless explicitly authorized.
13. Do not touch working booking/mugshot/Facebook behavior unless the current task explicitly requires it.
14. When credits/battery are low, switch from implementation to checkpoint documentation.
15. Always leave the repo in a state that the next Codex session can resume without re-discovering everything.

## Battery/Credit Mode

- Above 50%: feature implementation is allowed if scoped and testable.
- 20-50%: isolated components, tests, admin scaffolding, importer logic, and controlled integration are allowed.
- 10-20%: planning, fixtures, docs, review, small helper functions only.
- Under 10%: no risky code. Write checkpoint docs, continuation prompts, risks, exact next steps, and git status only.
- Under 7%: emergency mode. Stop implementation. Preserve context. Create or update a checkpoint file and final continuation prompt.

## Mandatory Checkpoint Behavior

At the end of every session, report:

- files changed
- commands run
- checks run
- checks skipped and why
- git status
- what was implemented
- what was intentionally not implemented
- remaining risks
- exact next recommended checkpoint
- continuation prompt for the next session

## Preferred Workflow

1. Read existing docs/checkpoints first.
2. Inspect only relevant code paths.
3. Identify existing conventions.
4. Propose the smallest safe implementation.
5. Make focused edits.
6. Add or update tests/fixtures if feasible.
7. Run only feasible checks.
8. Stop and summarize.
9. Do not continue into the next checkpoint unless explicitly asked.

## Testing Strategy

- Prefer fixture-based tests for parsers/importers.
- Prefer deterministic helpers over live network calls.
- Do not call live Facebook API in tests.
- Do not rely on production data.
- If `node_modules` is missing, do not install unless authorized. State that tests/typecheck were skipped because dependencies are unavailable.
- Run `git diff --check` when feasible because it is cheap and useful.

## Official News / KSP-Specific Rules

- KSP automation must remain disabled by default.
- Default env flags must remain false:
  - `OFFICIAL_NEWS_IMPORT_ENABLED=false`
  - `OFFICIAL_NEWS_AUTO_POST=false`
  - `KSP_IMPORT_ENABLED=false`
  - `KSP_AUTO_POST=false`
- Deduplicate by canonical KSP URL.
- Do not copy full KSP articles.
- Summarize factually.
- Attribute to Kentucky State Police.
- Link back to the original KSP article.
- Facebook drafts must remain manual/review-required unless both official-news and KSP auto-post flags are true.
- Do not call live Facebook API unless explicitly authorized.
- Generated cards should be reusable and deterministic where possible.
- Admin pages/actions should follow existing admin patterns only. If patterns are unclear, document and skip.

## Prisma/Migration Caution

- Production has a known duplicate unfinished Prisma migration row.
- Do not create, apply, resolve, or reset migrations unless explicitly authorized.
- If Prisma changes are needed, document the schema plan first.
- Migration work should be its own checkpoint.
- Never use destructive Prisma commands unless explicitly authorized and backed up.

## Deployment Caution

- Deployment must be its own checkpoint.
- Before deploy, confirm:
  - migration status
  - env vars
  - build/typecheck/tests
  - PM2/worker process names
  - rollback plan
  - smoke-check URLs
- Do not deploy mixed with risky feature development.

## Low-Credit Emergency Action

If credits/battery are low, create or update one of these files instead of coding:

- `CHECKPOINT_CURRENT.md`
- `CHECKPOINT_3_PLAN.md`
- `CHECKPOINT_4_PLAN.md`
- `DEPLOYMENT_RISKS.md`
- `MIGRATION_PLAN.md`
- `NEXT_CODEX_PROMPT.md`

In emergency mode, include:

- exact repo state
- current feature state
- what not to touch
- next safest command
- next safest files to inspect
- exact continuation prompt

## Anti-Waste Rules

- Do not repeatedly inspect the entire repo after architecture has already been documented.
- Do not rewrite working systems.
- Do not refactor for style during feature work.
- Do not add new dependencies for convenience.
- Do not chase unrelated TypeScript or lint issues unless they block the checkpoint.
- Do not start a migration/deploy/Facebook integration unless there is enough credit to finish, test, and summarize.
- Do not leave half-wired automation enabled.
- Do not make "probably" claims. Verify or say not verified.
- Do not assume production behavior from local-only files.
- Do not continue past the requested checkpoint.

The user values completed, usable checkpoints more than ambitious partial work. When in doubt, stop early, document clearly, and produce the next exact prompt.

