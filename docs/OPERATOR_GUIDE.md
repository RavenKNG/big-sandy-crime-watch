# Big Sandy Crime Watch Operator Guide

## Admin login

Open `/admin` and enter the configured Basic Auth email and password. Keep those
credentials out of screenshots, chat, source code, and documentation.

## Create and review a manual record

1. Open `/admin/manual-entry`.
2. Enter synthetic demo content only. Do not enter a home address.
3. Enter one charge per line as `Offense | Statute | Description`.
4. Save the draft and review the editorial preview.
5. Use `PUBLISHED`, `HIDDEN`, or `REJECTED` after review.
6. For a published record, open its public detail page from the preview.

## Correction requests

Public visitors use `/correction-request`. Review submitted requests on `/admin`.
Open the related record link when present and move the request through `NEW`,
`REVIEWING`, `RESOLVED`, or `DENIED`.

## Facebook manual export

Open `/admin/facebook-export`. Copy the post text and target URL, publish
manually, then mark the record manually posted only after confirming the post.
Automated Facebook posting remains disabled.

## Sponsor placeholders

Open `/admin/sponsors` to save placeholder configuration. Newly saved sponsors
remain disabled. Do not enable real ads during the demo phase.

## Disabled features

- Official-source adapter
- Real-record scraping
- Facebook API auto-posting
- Email notifications
- Real sponsor display

## Server operations

```bash
cd /opt/big-sandy-crime-watch
export PATH=/root/.nvm/versions/node/v24.11.1/bin:$PATH
pm2 status
pm2 logs big-sandy-crime-watch --lines 80 --nostream
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart big-sandy-crime-watch --update-env
pm2 save
```

Run migrations only when a reviewed schema migration is present. Do not touch
the Raven Royale PM2 processes or Nginx configuration during this workflow.
