# Operations

Audit date: 2026-06-07 UTC.

## Normal Health Checks

Run from the production project:

```bash
cd /opt/big-sandy-crime-watch
export PATH=/root/.nvm/versions/node/v24.11.1/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
npm run status:automation
pm2 status
pm2 logs big-sandy-crime-watch --lines 80 --nostream
pm2 logs big-sandy-crime-watch-automation --lines 120 --nostream
```

`npm run status:automation` is the best single command for import/Facebook state.

## Facebook Current State at Audit

Observed status:

- `FACEBOOK_POSTING_ENABLED=true`
- `POST_INTERVAL_HOURS=0.5`
- Credential source: stored OAuth token in PostgreSQL
- Token health: healthy
- Data access expiration observed: `2026-09-03T01:29:14.000Z`
- Latest successful post observed: `2026-06-07T02:38:45.024Z`
- Queue backlog: 0
- Due drafts: 0
- Public draft gaps: 0
- Failed drafts: 0

The system was not actively stuck at audit time. It was idle because all eligible drafts had been posted.

## Import Current State at Audit

Official BSRDC import was enabled and running through the automation process.

Most recent observed BSRDC import:

- Range: `2026-06-04` to `2026-06-06`
- Found: 17
- Created: 0
- Updated: 0
- Duplicates skipped: 17
- Failed: 0
- Drafts created: 0

This means the import source was reachable and dedupe was preventing duplicate rows.

## Logs

PM2 logs:

- Web stdout: `/root/.pm2/logs/big-sandy-crime-watch-out.log`
- Web stderr: `/root/.pm2/logs/big-sandy-crime-watch-error.log`
- Automation stdout: `/root/.pm2/logs/big-sandy-crime-watch-automation-out.log`
- Automation stderr: `/root/.pm2/logs/big-sandy-crime-watch-automation-error.log`

Observed web stderr contained Next.js Server Action mismatch errors after deployments. These are usually caused by stale browser clients submitting actions from an older build, but should be watched if they persist without deployments.

## Resource Snapshot

At audit time:

- Disk `/`: 144 GB total, 82 GB used, 56 GB available.
- `/opt/big-sandy-crime-watch`: about 1.3 GB.
- `/opt/big-sandy-crime-watch-storage`: about 77 MB.
- Persistent booking-image files observed: 143.
- Memory: 7.8 GiB total, about 3.7 GiB used, about 3.7 GiB available.
- Swap: 4.0 GiB total, about 209 MiB used.

## Scheduled Jobs and Services

BSCW automation is PM2-based, not cron-based.

Observed crontab entry was unrelated to BSCW and points at Raven Royale tooling. Do not modify it during BSCW work.

Relevant services:

- `pm2-root.service`
- `nginx`
- `postgresql`
- Certbot renewal via `/etc/cron.d/certbot`

## Runbook: If Facebook Gets Quiet

1. Check whether there are records to post:

   ```bash
   npm run status:automation
   ```

2. If queue backlog and due draft count are both 0, posting is idle by design.
3. If token health is unhealthy, reconnect via `/admin/facebook/connect`.
4. If public records are missing drafts, run dry-run repair:

   ```bash
   npm run facebook:repair-drafts
   ```

5. If dry run shows eligible repairs, create drafts:

   ```bash
   npm run facebook:repair-drafts -- --confirm
   ```

6. Watch automation logs for the next interval.

## Runbook: If Imports Stop

1. Confirm automation worker is online in PM2.
2. Run `npm run status:automation`.
3. Inspect latest `officialSourceResult`.
4. Confirm `OFFICIAL_SOURCE_FETCH_ENABLED`, `AUTO_IMPORT_OFFICIAL_RECORDS`, and `AUTO_PUBLISH_VALID_IMPORTED_RECORDS` are enabled.
5. Check whether source fetches are failing or only returning duplicates.

## Runbook: Official News / KSP

Official News Automation is disabled by default. Before enabling it, confirm the official-news Prisma migration has been reviewed and applied.

Safe local checks:

```bash
npm run official-news:scan
npm run official-news:smoke
```

`official-news:scan` uses fixtures. `official-news:smoke` is read-only against KSP. Neither command posts to Facebook.

If anything looks wrong, keep these flags false:

```text
OFFICIAL_NEWS_IMPORT_ENABLED=false
OFFICIAL_NEWS_AUTO_POST=false
KSP_IMPORT_ENABLED=false
KSP_AUTO_POST=false
```

## Runbook: If Images Break

1. Confirm `BOOKING_IMAGE_STORAGE_DIR` points at persistent storage.
2. Check whether `/booking-images/...` returns 200.
3. Run:

   ```bash
   npm run images:repair
   ```

4. Confirm generated `booking-card-preview.png` and `booking-card-full.png` files exist where expected.
