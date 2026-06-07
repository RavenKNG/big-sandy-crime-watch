# Database

Audit date: 2026-06-07 UTC.

Big Sandy Crime Watch uses PostgreSQL with Prisma. The Prisma schema is in `prisma/schema.prisma`; migration files are under `prisma/migrations`.

## Tables

Production tables observed:

- `Article`
- `PublicRecordDemo`
- `ChargeDemo`
- `SourceImportRun`
- `FacebookDraft`
- `FacebookConnection`
- `CorrectionRequest`
- `SponsorAd`
- `PublishLog`
- `_prisma_migrations`

Planned official-news tracking tables have been added to `prisma/schema.prisma` but should not be considered deployed until a reviewed migration is created and applied:

- `OfficialNewsSource`
- `OfficialNewsStory`
- `OfficialNewsGeneratedAsset`
- `OfficialNewsImportLog`

## Core Models

`PublicRecordDemo` is the primary booking/public-record table. Despite the legacy `Demo` suffix, this table holds production booking records.

Important fields:

- `slug`: public URL identifier, unique.
- `displayName`, `age`, `gender`, `city`, `county`, `state`.
- `sourceRecordId`: source-specific unique ID, unique when present.
- `sourceFingerprint`: hash used for dedupe/update detection, unique when present.
- `bookingDate`, `recordDate`, `bookingDateTimeText`, `bookingTimeKnown`.
- `sourceName`, `sourceUrl`, `sourceTimestamp`.
- `imageUrl`, `imageLocalPath`.
- `publishStatus`: `DRAFT`, `APPROVED`, `PUBLISHED`, `HIDDEN`, `REJECTED`.
- `facebookPostStatus`: `NOT_QUEUED`, `DRAFTED`, `QUEUED`, `POSTED`, `FAILED`, `MANUAL_REQUIRED`.

`ChargeDemo` stores charges for a record and cascades on record delete.

`FacebookDraft` stores post text, URL, optional image URL, status, schedule time, Facebook post ID, comment ID, and error message.

`FacebookConnection` stores the primary Facebook Page connection. The Page token is encrypted; do not query or print `encryptedPageToken`.

`SourceImportRun` stores import summaries, including a JSON payload with counts, detected counties, detected agencies, skips, and failures.

## Relationships

- `PublicRecordDemo` has many `ChargeDemo`.
- `PublicRecordDemo` has many `FacebookDraft`.
- `PublicRecordDemo` has many `CorrectionRequest`.
- `Article` has many `FacebookDraft`.
- `Article` has many `CorrectionRequest`.

Deletes cascade from records/articles to drafts and charges. Correction requests retain nullable references when target content is removed.

## Indexes and Duplicate Protection

Production indexes observed:

- `Article.slug` unique.
- `PublicRecordDemo.slug` unique.
- `PublicRecordDemo.sourceRecordId` unique.
- `PublicRecordDemo.sourceFingerprint` unique.
- Primary-key indexes on all model tables.

Import duplicate checks also query:

- `sourceRecordId`
- `sourceFingerprint`
- `sourceUrl`
- `slug`

Reviewed-folder imports check:

- `sourceRecordId`
- `slug`
- `sourceUrl`

For official-source imports, if an existing record has the same `sourceFingerprint`, it is counted as a duplicate and skipped, except missing images may be repaired.

## Migrations

Tracked migrations:

- `20260531012000_initial_mvp`
- `20260531021000_correction_related_url`
- `20260601014500_add_arresting_details`
- `20260601022000_add_reviewed_booking_fields`
- `20260601024000_add_source_fingerprint`
- `20260601102000_add_facebook_connection`

Production migration history contains a duplicate row for `20260531012000_initial_mvp` with `finished_at = null`. The schema is present and the site is running, but this should be investigated before adding new migrations because Prisma may treat failed/unfinished migration metadata conservatively.

Official News Automation requires a new migration for the planned tracking models. Do not run it until the duplicate unfinished migration metadata is resolved or explicitly approved.

## Production Counts Observed

At audit time:

- Records: 77
- Charges: 212
- Facebook drafts: 76
- Correction requests: 2
- Sponsor ads: 1
- Articles: 0

Record states:

- 76 records: `PUBLISHED` and `POSTED`
- 1 record: `DRAFT` and `NOT_QUEUED`

Facebook draft states:

- 76 drafts: `POSTED`
- 0 due drafts
- 0 failed drafts
- 0 manual-required drafts

Source run counts:

- Big Sandy Regional Detention Center Public Roster: 139 import runs; latest observed run at `2026-06-07T02:38:33.484Z`.
- Rowan County Detention Center: 1 recorded run; automation disabled due captcha.

County values observed in records:

- Johnson
- Lawrence
- Magoffin
- Martin
- Bourbon
- Breathitt
- Carter
- Harrison
- Oldham
- Demo

County values come from source data and may include transfer/outside counties. Website county pages are broader than current automatic source coverage.
