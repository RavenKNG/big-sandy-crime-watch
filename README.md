# Big Sandy Crime Watch

Mobile-first regional public booking and public-safety site.

## Local setup

```bash
npm install
npx prisma generate
npm run typecheck
npm test
npm run dev
```

## Facebook Page connection

Facebook posting is disabled by default. The admin reconnect workflow uses normal Facebook Login and does not require Business Portfolio, Ads Manager, ad accounts, audiences, billing, or system-user assets.

Configure placeholder-backed environment values:

```text
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_REDIRECT_URI=https://bigsandycrimewatch.com/admin/facebook/callback
FACEBOOK_PAGE_NAME=Big Sandy Crime Watch
FACEBOOK_TOKEN_ENCRYPTION_KEY=
FACEBOOK_PAGE_ID=
FACEBOOK_PAGE_ACCESS_TOKEN=
FACEBOOK_POSTING_ENABLED=false
FACEBOOK_TOKEN_WARNING_DAYS=21
FACEBOOK_TOKEN_CRITICAL_DAYS=7
FACEBOOK_TEST_POST_ENABLED=false
```

In the Meta app dashboard:

1. Configure Facebook Login for the app.
2. Add the exact redirect URI from `FACEBOOK_REDIRECT_URI`.
3. Request only: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, and `public_profile`.
4. Open `/admin/facebook/connect` while authenticated to the site admin.
5. Click **Reconnect Facebook** and complete Facebook Login with the profile that manages the Big Sandy Crime Watch Page.
6. The callback validates OAuth state, exchanges the authorization response for a long-lived user token, calls `/me/accounts`, finds the configured Page, and stores the returned Page token encrypted in PostgreSQL.
7. Keep `FACEBOOK_POSTING_ENABLED=false` until `npm run facebook:token-health` is healthy and a controlled one-shot test is explicitly approved.

The reconnect flow stores no token in source control and prints no token in diagnostics.

Official Meta references:

- [Facebook Login access tokens](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/)
- [Manual Facebook Login flow](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/)
- [Pages API posts](https://developers.facebook.com/docs/pages-api/posts/)
- [Pages API reference](https://developers.facebook.com/docs/pages-api/)

## Facebook operator commands

```bash
npm run facebook:diagnose
npm run facebook:token-health
npm run facebook:test-post -- --confirm
```

`facebook:test-post` remains locked unless `FACEBOOK_TEST_POST_ENABLED=true` is deliberately set for one controlled test.

## Token monitoring

The recurring worker verifies token health before each posting attempt. It pauses posting when credentials are missing, invalid, expired, or rejected. Stored connection status is visible only under `/admin/facebook/connect`. Default warning thresholds:

- Warning: 21 days before reported expiration.
- Critical: 7 days before reported expiration.

Reconnect before the reported expiration. Page-token behavior can change when the managing Facebook user changes credentials, removes app access, loses Page permissions, or Meta restricts the app or Page.

## Deployment notes

Apply database migrations and generate Prisma Client before restarting the app:

```bash
npx prisma migrate deploy
npx prisma generate
npm run build
export NODE_BINARY=/root/.nvm/versions/node/v24.11.1/bin/node
pm2 startOrReload ecosystem.config.cjs --update-env
```

Production hardening rules:

- keep `BOOKING_IMAGE_STORAGE_DIR` on persistent storage outside the deploy tree
- run the web app and automation worker through `ecosystem.config.cjs`
- avoid ad hoc `pm2 start npm -- ...` production commands

Never commit `.env`, tokens, app secrets, encryption keys, or exported credentials.
