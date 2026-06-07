# Big Sandy Crime Watch Architecture

Audit date: 2026-06-07 UTC.

Big Sandy Crime Watch is a production Next.js/PostgreSQL system for publishing public booking records from Eastern Kentucky public-record sources and posting selected updates to the Big Sandy Crime Watch Facebook Page.

## Production Shape

- Domain: `bigsandycrimewatch.com`
- VPS project path: `/opt/big-sandy-crime-watch`
- GitHub source: `https://github.com/RavenKNG/big-sandy-crime-watch`
- Production build marker observed: `ea32e38`
- Web process: `big-sandy-crime-watch`
- Automation process: `big-sandy-crime-watch-automation`
- Public app port: `127.0.0.1:3100`
- Reverse proxy: Nginx on ports 80/443
- Database: PostgreSQL database named `bigsandycrimewatch`
- Persistent image root: `/opt/big-sandy-crime-watch-storage/booking-images`

## Application Stack

- Next.js `16.2.6`
- React `19.2.4`
- Prisma `7.8.0`
- PostgreSQL via `@prisma/adapter-pg` and `pg`
- Sharp for booking-card PNG generation
- PM2 for process management
- Nginx and Let's Encrypt for HTTPS

## Runtime Processes

PM2 runs two Big Sandy services:

- `big-sandy-crime-watch`: serves the Next.js app with `next start --hostname 127.0.0.1 --port 3100`.
- `big-sandy-crime-watch-automation`: runs `scripts/automation-runner.ts` through `tsx`.

Both processes load `.env` through Node's `--env-file=.env` option. Production runs under Node `/root/.nvm/versions/node/v24.11.1/bin/node`.

## Frontend

The public frontend is under `src/app`.

Important routes:

- `/`: homepage with latest records, county links, ad placeholders, and correction links.
- `/today`: records for the current Eastern calendar day.
- `/yesterday`: previous-day records.
- `/last-72-hours`: records from the most recent three Eastern calendar days.
- `/county/[county]`: county record pages and source lookup pages.
- `/category/[category]`: category archive pages.
- `/records/[slug]`: public record detail pages.
- `/search`: simple published-record search by name, county, and agency.
- `/correction-request`: public correction/hide/deindex request form.
- `/disclaimer`, `/privacy`, `/contact`: policy and contact pages.
- `/admin/*`: Basic Auth protected admin area.

The UI is server-rendered and database-backed for live public records. `dynamic = "force-dynamic"` is used on record-heavy pages, so pages are not static snapshots.

## Backend and API-Like Routes

There is no separate API server. Server actions and route handlers live inside the Next app.

Important route handlers:

- `src/app/booking-images/[...path]/route.ts`: serves persistent booking image files from `BOOKING_IMAGE_STORAGE_DIR`.
- `src/app/media/mugshot/route.ts`: generates branded SVG mugshot/fallback media from a raw image path or URL.
- `src/app/admin/facebook/connect/start/route.ts`: starts Facebook OAuth.
- `src/app/admin/facebook/callback/route.ts`: handles Facebook OAuth callback and stores an encrypted Page token.

Server actions in `src/app/actions.ts` support manual record creation, record status changes, correction status changes, sponsor creation, and manual Facebook-post marking.

## Data Flow

1. Automation imports records from the configured official source, currently Big Sandy Regional Detention Center.
2. Import code normalizes vendor rows into `PublicRecordDemo` rows and `ChargeDemo` rows.
3. Duplicate checks run before create/update.
4. Mugshots are downloaded where available into persistent storage.
5. Booking-card preview/full PNGs are generated when Facebook draft payloads are created.
6. Published records get `FacebookDraft` rows.
7. The automation loop checks Facebook token health and posts the next due draft.
8. Posted drafts update both `FacebookDraft.status` and `PublicRecordDemo.facebookPostStatus`.

## Current Source Coverage

Configured source modules include:

- Big Sandy Regional Detention Center Public Roster: automation enabled.
- Rowan County Detention Center: configured as a source page but automation disabled because the vendor JailTracker route requires an interactive captcha.

The website navigation includes county pages for Johnson, Magoffin, Lawrence, Martin, Pike, and Rowan. Actual production record coverage is determined by imported BSRDC rows and detected county/arresting-agency fields; at audit time, production records existed for Johnson, Lawrence, Magoffin, Martin, and several outside/transfer counties, but not Pike or Rowan booking imports.

## Key Environment Variables

Do not document values in source or docs. Production uses these variable names:

- `DATABASE_URL`
- `SITE_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `FACEBOOK_PAGE_ID`
- `FACEBOOK_PAGE_ACCESS_TOKEN`
- `FACEBOOK_TOKEN_STRATEGY`
- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`
- `FACEBOOK_REDIRECT_URI`
- `FACEBOOK_PAGE_NAME`
- `FACEBOOK_TOKEN_ENCRYPTION_KEY`
- `FACEBOOK_TEST_POST_ENABLED`
- `FACEBOOK_POSTING_ENABLED`
- `FACEBOOK_TOKEN_WARNING_DAYS`
- `FACEBOOK_TOKEN_CRITICAL_DAYS`
- `POST_INTERVAL_HOURS`
- `AUTOMATION_SKIP_INITIAL_FACEBOOK_POST`
- `BOOKING_IMAGE_STORAGE_DIR`
- `OFFICIAL_SOURCE_FETCH_ENABLED`
- `OFFICIAL_SOURCE_URL`
- `OFFICIAL_SOURCE_API_URL`
- `AUTO_IMPORT_OFFICIAL_RECORDS`
- `AUTO_PUBLISH_VALID_IMPORTED_RECORDS`
- `AUTO_QUEUE_FACEBOOK_DRAFTS`
- `AUTO_PUBLISH_REVIEWED_IMPORTS`
- `REVIEWED_IMPORT_DIR`
- `REVIEWED_IMPORT_PROCESSED_DIR`
- `REVIEWED_IMPORT_FAILED_DIR`
- `ADS_ENABLED`
- `ADS_PROVIDER`
- `ADS_IN_FEED_FREQUENCY`

