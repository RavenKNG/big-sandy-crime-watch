# Deployment Notes

## Current status

This is a synthetic-fixture demo. Do not enable a real source adapter until human legal and platform review is complete.

## Required setup

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Run `npm install`, `npx prisma generate`, and `npx prisma migrate deploy`.
3. Configure admin authentication before exposing `/admin`.
4. Keep `FACEBOOK_POSTING_ENABLED=false` until official Meta credentials and editorial rules are reviewed.
5. Build with `npm run build`.
6. Start with `npm run start`.

## Suggested PM2 command

```bash
pm2 start npm --name big-sandy-crime-watch -- start
```

## DNS

Point the apex `A` record and either the `www` `CNAME` or `A` record to the selected deployment target after a server is provisioned.
