# Deployment Risks: Official News Automation

## Do Not Deploy Yet

Official News Automation should not be deployed until the Prisma migration blocker is resolved.

## Current Blockers

- Official-news tracking models are present in `prisma/schema.prisma`, but no migration has been created/applied.
- Production migration history has a known duplicate unfinished row for `20260531012000_initial_mvp`.
- Deploying schema-dependent code before the migration exists would leave `/admin/official-news` and DB-writing official-news helpers unable to read the planned tables.
- `node_modules` is missing locally, so typecheck/tests/build have not been run in this checkout.

## Safe Deployment Preconditions

Before deploy:

1. Resolve or explicitly approve the Prisma migration-history plan.
2. Create and review the official-news migration.
3. Run Prisma generate.
4. Run typecheck, tests, and build.
5. Confirm official-news env flags default safe:
   - `OFFICIAL_NEWS_IMPORT_ENABLED=false`
   - `OFFICIAL_NEWS_AUTO_POST=false`
   - `KSP_IMPORT_ENABLED=false`
   - `KSP_AUTO_POST=false`
6. Confirm no production `.env` changes are needed unless intentionally enabling import.
7. Confirm auto-posting remains disabled unless deliberately enabled.
8. Smoke check existing booking and Facebook admin pages after deploy.

## Safe Non-Deploy Work Remaining

- Strengthen fixture parser coverage.
- Keep dry-run importer read-only.
- Add DB-writing importer only after migration plan is approved.
- Add scheduler integration only after DB importer and tests are stable.

