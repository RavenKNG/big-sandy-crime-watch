# Current Checkpoint: Credit-Efficient KSP Automation Work

## Operating Mode

- Optimize for high-value, low-risk progress.
- Do not wander, re-inspect broadly, overbuild, or start risky work that cannot be finished cleanly.
- Prefer narrow checkpoints over large partial feature attempts.
- If battery/credits are low, switch to checkpoint documentation instead of implementation.

## Hard Stops

Do not:

- Deploy.
- Push to GitHub.
- Install packages.
- Run migrations.
- Modify `.env`.
- Enable auto-posting.
- Print secrets or env values.
- Change existing working booking/mugshot/Facebook behavior.
- Call the live Facebook API.

## Feature State

- Feature track: Official News Automation / KSP Post 8 and Post 9.
- Existing booking/import/Facebook systems are working and should be protected.
- KSP automation must remain disabled by default.
- Facebook drafts for official news must remain manual/review-required unless both official-news and KSP auto-post flags are explicitly true.
- KSP summaries must be factual, attributed to Kentucky State Police, linked to the original KSP source, and must not copy full KSP articles.

## Current Repo State

- Checkpoint 1 planning/repo inspection is complete.
- Checkpoint 2 official-news foundation exists in the working tree.
- `CHECKPOINT_3_PLAN.md` documents the next parser/importer dry-run checkpoint.
- `node_modules` is missing locally, so tests/typecheck should be skipped unless dependencies are already present.
- Prisma schema has planned official-news models, but no migration has been created or applied.
- Production has a known duplicate unfinished Prisma migration row; migration work must be its own explicitly approved checkpoint.

## Next Safest Checkpoint

Continue with Checkpoint 3 only:

1. Inspect `CHECKPOINT_3_PLAN.md`.
2. Inspect only the current official-news files:
   - `src/lib/official-news.ts`
   - `src/lib/ksp-news-adapter.ts`
   - `src/lib/official-news-import.ts`
   - `scripts/official-news-scan.ts`
   - `tests/official-news-ksp.test.ts`
   - `fixtures/ksp/`
3. Strengthen fixture dry-run behavior and parser tests.
4. Keep all importer behavior dry-run/read-only.
5. Stop before DB-writing behavior, migration generation, scheduler integration, deploy, or Facebook posting changes.

## Recommended Continuation Prompt

Continue from `CHECKPOINT_CURRENT.md` and `CHECKPOINT_3_PLAN.md`. Do not deploy, push, install packages, run migrations, modify `.env`, enable auto-posting, call Facebook APIs, or change existing booking/mugshot/Facebook behavior. Work on Checkpoint 3 only: inspect the current official-news parser/importer files, strengthen the KSP fixture dry-run path, improve parser tests if dependencies are present, and keep all importer behavior dry-run/read-only. Run only cheap feasible checks such as `git diff --check`; skip typecheck/tests if `node_modules` is missing. Stop before DB-writing behavior or migration work.

