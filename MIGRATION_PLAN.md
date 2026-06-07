# Official News Migration Plan

## Current Status

- `prisma/schema.prisma` includes planned official-news tracking models.
- No official-news migration has been created or applied.
- No Prisma generate/migrate command has been run in this checkpoint.
- `node_modules` is currently missing locally, so Prisma CLI is not locally available without installing dependencies.

## Safety Blocker

Production `_prisma_migrations` reportedly contains a duplicate unfinished row for `20260531012000_initial_mvp`.

Do not introduce or apply a new official-news migration until this is reviewed with a Prisma-supported, non-destructive procedure.

## Planned Models

- `OfficialNewsSource`
- `OfficialNewsStory`
- `OfficialNewsGeneratedAsset`
- `OfficialNewsImportLog`

## Next Safe Steps

1. Confirm production database backup exists.
2. Inspect `_prisma_migrations` without printing secrets.
3. Resolve or document the unfinished duplicate migration using Prisma-supported guidance.
4. Install dependencies locally only if approved/needed.
5. Create and review the migration locally:

```bash
npx prisma migrate dev --name add_official_news_tracking
```

6. Run:

```bash
npx prisma generate
npm run typecheck
npm test
npm run build
```

7. Only after passing checks and reviewing SQL, apply in production with the documented deploy sequence.

## Commands Not To Run Until Approved

```bash
npx prisma migrate dev
npx prisma migrate deploy
npx prisma db push
npx prisma migrate reset
npx prisma migrate resolve
```

Never reset the production database.

