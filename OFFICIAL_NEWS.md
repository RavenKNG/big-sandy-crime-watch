# Official News Automation

Official News Automation is a disabled-by-default foundation for importing official public-safety news into Big Sandy Crime Watch.

Initial sources:

- Kentucky State Police Post 9: `https://www.kentuckystatepolice.ky.gov/news?tag=post-9`
- Kentucky State Police Post 8: `https://www.kentuckystatepolice.ky.gov/news?tag=post-8`

## Safety Defaults

Imports do not run unless both flags are explicitly enabled:

```text
OFFICIAL_NEWS_IMPORT_ENABLED=true
KSP_IMPORT_ENABLED=true
```

Auto-posting does not run unless both flags are explicitly enabled:

```text
OFFICIAL_NEWS_AUTO_POST=true
KSP_AUTO_POST=true
```

The current dry-run command does not write database rows, create Facebook drafts, generate persistent assets, or post to Facebook.

## Commands

Fixture dry-run:

```bash
npm run official-news:scan
npm run ksp:scan
```

Read-only live smoke check:

```bash
npm run official-news:smoke
```

## Environment Flags

```text
OFFICIAL_NEWS_IMPORT_ENABLED=false
OFFICIAL_NEWS_AUTO_POST=false
KSP_IMPORT_ENABLED=false
KSP_AUTO_POST=false
KSP_AUTO_POST_MAX_AGE_DAYS=7
KSP_SCAN_INTERVAL_MINUTES=15
KSP_GENERATE_IMAGE_CARDS=true
KSP_CREATE_FACEBOOK_DRAFTS=true
KSP_REQUIRE_ADMIN_APPROVAL=false
```

## Database Status

`prisma/schema.prisma` includes the planned reusable tracking models:

- `OfficialNewsSource`
- `OfficialNewsStory`
- `OfficialNewsGeneratedAsset`
- `OfficialNewsImportLog`

No migration has been run. Before enabling imports, create and review a migration from the schema change, then apply it through the normal deployment process only after the known production migration-history issue is resolved.

Suggested local migration creation command after approval:

```bash
npx prisma migrate dev --name add_official_news_tracking
```

Production should use the reviewed migration through:

```bash
npx prisma migrate deploy
```

Do not run either command until migration history is confirmed safe.

## Article Behavior

KSP releases may be short. The importer creates a concise Big Sandy Crime Watch summary from available facts only, attributes the story to Kentucky State Police, and links the original source. It must not copy the full KSP release or add unsupported facts.

Official-news articles should remain `DRAFT` or `REVIEW` until an operator publishes them. The public news route displays only published database articles and retains the existing demo article fallback.

## Facebook Drafts

Official-news draft creation uses the existing `FacebookDraft` model with `articleId`. It does not rewrite the existing booking/mugshot posting system. Draft creation is separate from auto-posting; auto-posting remains gated by both official-news auto-post flags and the existing Facebook posting controls.

## Admin Review

Review foundation route:

```text
/admin/official-news
```

It shows source status, safety flags, imported stories, article references, image status, Facebook draft status, and import logs once the tracking tables exist.
