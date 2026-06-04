# Deployment Notes

## Current status

This is a synthetic-fixture demo. Do not enable a real source adapter until human legal and platform review is complete.

## Required setup

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Run `npm install`, `npx prisma generate`, and `npx prisma migrate deploy`.
3. Configure admin authentication before exposing `/admin`.
4. Keep `FACEBOOK_POSTING_ENABLED=false` until official Meta credentials and editorial rules are reviewed.
5. Keep `ADS_ENABLED=false`, `ANALYTICS_ENABLED=false`, and `EMAIL_NOTIFICATIONS_ENABLED=false` until reviewed.
6. Keep `BSRDC_IMPORT_ENABLED=false`; the reviewed-fixture importer creates drafts only and live fetching remains unconfigured.
7. Build with `npm run build`.
8. Start production through `pm2 startOrReload ecosystem.config.cjs --update-env`.

## Suggested PM2 command

```bash
export NODE_BINARY=/root/.nvm/versions/node/v24.11.1/bin/node
pm2 startOrReload ecosystem.config.cjs --update-env
```

## Manual operator workflow

1. Sign in to `/admin` with the configured Basic Auth credentials.
2. Use `/admin/manual-entry` for synthetic demo drafts only.
3. Enter multiple charges as `Offense | Statute | Description`, one per line.
4. Review the saved draft from its admin preview page.
5. Publish, hide, or reject the draft after editorial review.
6. Review free correction requests from `/admin`.
7. Use `/admin/facebook-export` for manual editorial copy and posted-status tracking.
8. Configure sponsor placeholders from `/admin/sponsors`; new sponsors remain disabled by default.

## DNS

Point the apex `A` record and either the `www` `CNAME` or `A` record to the selected deployment target after a server is provisioned.

## Dependency advisories

`npm audit` currently reports moderate transitive advisories through Next.js
PostCSS and Prisma development tooling. npm's suggested automated resolutions
require risky major-version changes or downgrades. Defer until compatible
upstream patch releases are available and keep tests/build green.
