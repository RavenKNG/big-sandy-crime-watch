# Automation

Audit date: 2026-06-07 UTC.

## Main Worker

Main file:

```bash
scripts/automation-runner.ts
```

PM2 process:

```bash
big-sandy-crime-watch-automation
```

The worker runs once at startup and then repeats every `POST_INTERVAL_HOURS`.

## Worker Cycle

Each cycle performs:

1. `runOfficialSourceImport()`
2. `scanApprovedImports()`
3. `createFacebookDraftsForPublishedRecords()`
4. `verifyFacebookPageToken()`
5. `queueRowanPromoDraft()`
6. `postNextFacebookDraft()` if token health is good and posting is enabled

The worker logs a structured JSON result each cycle.

## Official News Automation

Official News Automation is scaffolded as a separate disabled-by-default foundation for KSP Post 8/Post 9 and future official public-safety news sources.

Current safe commands:

```bash
npm run official-news:scan
npm run ksp:scan
npm run official-news:smoke
```

`official-news:scan` and `ksp:scan` use local fixtures by default. `official-news:smoke` performs a read-only live fetch. Neither command writes database rows, creates Facebook drafts, generates persistent assets, or posts to Facebook.

Import requires:

- `OFFICIAL_NEWS_IMPORT_ENABLED=true`
- `KSP_IMPORT_ENABLED=true`

Auto-post requires:

- `OFFICIAL_NEWS_AUTO_POST=true`
- `KSP_AUTO_POST=true`

The KSP scan interval is configured separately with `KSP_SCAN_INTERVAL_MINUTES=15`; it should not be tied to the existing Facebook posting cadence. `KSP_AUTO_POST_MAX_AGE_DAYS=7` keeps backfilled older KSP stories manual-review-only while allowing recent official stories to queue when auto-post flags are intentionally enabled.

## Official Source Import

Main file:

```bash
src/lib/official-source-import.ts
```

Configured sources:

- Big Sandy Regional Detention Center Public Roster
- Rowan County Detention Center

Only automatic sources are imported by default. `automaticOfficialSources()` currently returns BSRDC only.

The source gate requires all three env flags for live unattended import:

- `OFFICIAL_SOURCE_FETCH_ENABLED=true`
- `AUTO_IMPORT_OFFICIAL_RECORDS=true`
- `AUTO_PUBLISH_VALID_IMPORTED_RECORDS=true`

If any are false, import is skipped.

## Big Sandy Regional Detention Center

Source config:

- Slug: `big-sandy-regional-detention-center`
- Fetch mode: `publicroster-api`
- Agency code: configured in code
- Automation: enabled

Import range defaults to the last three Eastern calendar days.

Vendor rows are parsed into:

- name
- source ID
- booking date/time
- gender/status
- county/arresting agency/officer when present
- charges
- image ID
- source URL
- source fingerprint

Images are fetched through the vendor SAS-image endpoint when an image ID exists.

## Rowan County

Source config:

- Slug: `rowan-county-detention-center`
- Fetch mode: `jtclientweb-captcha`
- Automation: disabled

The code probes the JailTracker route and records a blocked summary if captcha is required. Safe unattended import remains disabled until a supported non-captcha source exists.

## Reviewed Folder Imports

Reviewed import automation scans:

```bash
work/approved-imports
```

Processed folders move to:

```bash
work/approved-imports-processed
```

Failed folders move to:

```bash
work/approved-imports-failed
```

Each folder must include `record.json` or `record.csv`. A mugshot/image file in the same folder is detected by magic bytes and copied into booking-image storage.

Reviewed imports include a safety check for address-like text and reject records that appear to contain home/address data.

Production currently has `AUTO_PUBLISH_REVIEWED_IMPORTS=false`, so reviewed folder imports do not auto-publish unless that flag changes.

## Draft Repair

Main file:

```bash
src/lib/facebook-draft-repair.ts
```

The worker repairs missing Facebook drafts for recent published records when safe. Defaults:

- Window: 72 hours unless `FACEBOOK_DRAFT_REPAIR_WINDOW_HOURS` is set.
- Max create: 25 unless `FACEBOOK_DRAFT_REPAIR_MAX_CREATE` is set.

Manual command:

```bash
npm run facebook:repair-drafts
npm run facebook:repair-drafts -- --confirm
```

Dry run showed 0 repair candidates during audit.

## Image Repair

Main file:

```bash
scripts/repair-booking-images.ts
```

Image repair:

1. Finds published BSRDC records with image references.
2. Checks whether files exist under booking-image storage.
3. Re-fetches matching offender images from the official source where possible.
4. Clears missing/unrecoverable image references to allow fallback behavior.
5. Updates drafts with repaired image paths where appropriate.

## Rowan Promo

The worker calls `queueRowanPromoDraft()`. At audit time it returned:

- queued: false
- reason: `ROWAN_PROMO_ENABLED is not true.`

This feature exists in code but is disabled in production.
