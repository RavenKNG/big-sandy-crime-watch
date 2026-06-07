# Checkpoint 3 Plan: KSP Parser/Importer

## Current Repo State

- Checkpoint 1 planning/repo inspection is complete.
- Checkpoint 2 foundation work is present in the working tree.
- The working tree has existing untracked audit/docs files from prior context.
- `node_modules` is missing locally, so typecheck/tests have not been run.
- No deploy, push, package install, migration run, `.env` edit, or auto-post enablement has happened.
- Existing booking/mugshot Facebook posting behavior has not been intentionally changed.

## What Checkpoint 2 Completed

- Added reusable official-news source/types/helpers in `src/lib/official-news.ts`.
- Added KSP Post 8/Post 9 parser adapter in `src/lib/ksp-news-adapter.ts`.
- Added fixture dry-run importer in `src/lib/official-news-import.ts`.
- Added read-only dry-run script `scripts/official-news-scan.ts`.
- Added KSP fixtures under `fixtures/ksp/`.
- Added tests in `tests/official-news-ksp.test.ts`.
- Added official-news card foundation in `src/lib/official-news-card.ts`.
- Added isolated DB/article/Facebook draft helper in `src/lib/official-news-db.ts`.
- Added planned Prisma tracking models in `prisma/schema.prisma`.
- Added `/admin/official-news` review foundation.
- Made `/news/[slug]` able to read published DB articles while preserving demo fallback.
- Added docs in `OFFICIAL_NEWS.md` and updated automation/database/Facebook/operations docs.
- Added disabled-by-default official-news/KSP env flags to `.env.example`.

## Exact Next Step For Checkpoint 3

Checkpoint 3 should focus on the KSP parser/importer with fixtures and dry-run only:

1. Review the current official-news parser/helper files for type issues.
2. Run tests/typecheck only if dependencies are already present.
3. Strengthen fixture parsing and dry-run output.
4. Add importer orchestration that reports what would be created/skipped without writing database rows.
5. Do not start DB-writing import behavior until the migration plan is approved and the work can be finished cleanly.

## Prisma Migration Risks

- `prisma/schema.prisma` includes new official-news tracking models, but no migration has been created or applied.
- Production docs note a duplicate unfinished row for `20260531012000_initial_mvp` in `_prisma_migrations`.
- That migration-history issue should be resolved or explicitly approved before creating/applying any new migration.
- Do not run Prisma migration commands until this risk is reviewed.
- New DB helper code uses planned models and may require regenerated Prisma Client after migration work is approved.

## Commands Not To Run Yet

Do not run:

```bash
npm install
npm ci
npx prisma migrate dev
npx prisma migrate deploy
npx prisma db push
npx prisma generate
npm run build
pm2 restart big-sandy-crime-watch
pm2 reload big-sandy-crime-watch
pm2 startOrReload ecosystem.config.cjs --update-env
git push
```

Also do not run any command that posts to Facebook or enables official-news auto-posting.

## Recommended Next Prompt

Continue from `CHECKPOINT_3_PLAN.md`. Do not deploy, push, install packages, run migrations, modify `.env`, enable auto-posting, or change existing booking/Facebook behavior. Work on Checkpoint 3 only: inspect the current official-news parser/importer files, strengthen the KSP fixture dry-run path, improve parser tests if dependencies are present, and keep all importer behavior dry-run/read-only. Stop before DB-writing behavior or migration work.

