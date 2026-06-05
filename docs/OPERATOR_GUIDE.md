# Big Sandy Crime Watch Operator Guide

## Core model

Big Sandy has two production processes:

- `big-sandy-crime-watch`: the public/admin Next.js web app on `127.0.0.1:3100`
- `big-sandy-crime-watch-automation`: the recurring import + Facebook worker

Both must be started from the repo root at `/opt/big-sandy-crime-watch` and both
must load the production `.env`.

## Canonical PM2 management

Do not hand-build PM2 commands. Use the tracked ecosystem file:

```bash
cd /opt/big-sandy-crime-watch
export PATH=/root/.nvm/versions/node/v24.11.1/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export NODE_BINARY=/root/.nvm/versions/node/v24.11.1/bin/node
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
```

## Production deploy sequence

```bash
cd /opt/big-sandy-crime-watch
export PATH=/root/.nvm/versions/node/v24.11.1/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export NODE_BINARY=/root/.nvm/versions/node/v24.11.1/bin/node
npm ci
npx prisma generate
npm run build
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
```

If a reviewed Prisma migration exists, run:

```bash
npx prisma migrate deploy
```

before the build.

## Required production paths

- app root: `/opt/big-sandy-crime-watch`
- persistent mugshot storage: `/opt/big-sandy-crime-watch-storage/booking-images`

Never store production mugshots only inside the deploy tree.

## Quick health checks

```bash
cd /opt/big-sandy-crime-watch
export PATH=/root/.nvm/versions/node/v24.11.1/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
npm run status:automation
pm2 status
pm2 logs big-sandy-crime-watch --lines 80 --nostream
pm2 logs big-sandy-crime-watch-automation --lines 80 --nostream
```

Public smoke checks:

```bash
curl -I https://bigsandycrimewatch.com/
curl -I https://bigsandycrimewatch.com/today
curl -I https://bigsandycrimewatch.com/county/rowan
curl -I https://bigsandycrimewatch.com/sitemap.xml
```

## Admin access

`/admin` is protected with Basic Auth from `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

## Facebook operations

- token health: `npm run facebook:token-health`
- diagnostics: `npm run facebook:diagnose`
- one-shot test post: `npm run facebook:test-post -- --confirm`

Do not enable `FACEBOOK_TEST_POST_ENABLED` unless you are intentionally running
one controlled test.

### Facebook app-mode incident note

Symptom:

- admins can see automated booking posts
- non-admin visitors cannot open the exact post permalink or see the booking feed
- the same visitors can still see the Page shell, manual posts, and/or the Photos tab

Confirmed cause:

- the Meta app (`BSCW Page Poster`) was still unpublished / in Development mode
- Graph API posts were effectively limited to Page managers, app-role users, or both

Fix:

1. Publish the Meta app in Meta for Developers.
2. Reconnect Facebook through `/admin/facebook/connect`.
3. Run:

   ```bash
   npm run facebook:token-health
   npm run status:automation
   ```

4. Verify only a **brand-new** automated post with a non-admin viewer.

Do not trust older automated posts as proof after an app-mode change. Repost an
important old item manually if public visibility matters.

### Current Facebook publish path

Big Sandy currently publishes mugshot posts this way:

1. upload the mugshot to `/{page-id}/photos` with `published=false`
2. create the final `/{page-id}/feed` post with `attached_media`
3. explicitly send `published=true` on the final feed post

It does **not** send:

- `no_story`
- `targeting`
- `unpublished_content_type`
- `scheduled_publish_time`
- dark-post fields

## Import / queue behavior

- official-source import runs inside the automation worker
- reviewed imports live under `work/approved-imports`
- queue state is stored in PostgreSQL
- Facebook posting cadence is controlled by `POST_INTERVAL_HOURS`

## Safe recovery notes

- If mugshots appear broken, check `BOOKING_IMAGE_STORAGE_DIR` first
- If Facebook is quiet, check `facebook:token-health` and `status:automation`
- If PM2 is online but the site is down, verify `big-sandy-crime-watch` is
  actually bound to `127.0.0.1:3100`

## Windows deploy helper

For local operator use, the tracked deploy helper is:

- `scripts/deploy-production.ps1`

It should remain the only maintained artifact-style deploy script.
