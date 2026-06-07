# Security Audit

Audit date: 2026-06-07 UTC.

## Secrets

Secrets are stored in production `.env` and in encrypted database fields. This documentation intentionally lists variable names only, not values.

High-sensitivity variables:

- `DATABASE_URL`
- `ADMIN_PASSWORD`
- `FACEBOOK_PAGE_ACCESS_TOKEN`
- `FACEBOOK_APP_SECRET`
- `FACEBOOK_TOKEN_ENCRYPTION_KEY`
- `FACEBOOK_PAGE_ID`
- `FACEBOOK_APP_ID`
- `ADMIN_EMAIL`

The Facebook stored Page token is encrypted in PostgreSQL with AES-256-GCM using a derived key from `FACEBOOK_TOKEN_ENCRYPTION_KEY`.

## Admin Authentication

`/admin/:path*` is protected by `src/proxy.ts` using Basic Auth.

Positive findings:

- If `ADMIN_EMAIL` or `ADMIN_PASSWORD` is missing, admin returns 503 instead of opening.
- Credential comparison uses `crypto.timingSafeEqual`.
- Admin routes are scoped through the Next proxy matcher.

Risks:

- Basic Auth has no rate limiting.
- Basic Auth has no MFA.
- Admin credentials are shared/static.
- There is no CSRF token layer around server actions beyond browser/basic-auth context.

## Public Data Handling

Positive findings:

- Correction/hide/deindex request flow exists.
- Record pages include innocence/presumption language.
- Reviewed folder imports reject address-like text.
- Source attribution fields are stored and displayed.

Risks:

- Search by name is public and unrestricted.
- No explicit robots deindex workflow automation was found beyond correction request statuses.
- No audit trail was found for admin status changes except limited `PublishLog` model presence.

## Facebook Token Handling

Positive findings:

- OAuth reconnect flow stores encrypted Page token in PostgreSQL.
- Diagnostics redact token-like fields and token-looking strings.
- Posting pauses when token health is invalid.
- Test posting is separately gated by `FACEBOOK_TEST_POST_ENABLED`.

Risks:

- Environment fallback still supports raw `FACEBOOK_PAGE_ACCESS_TOKEN`.
- Meta app live/development mode could not be automatically verified through the current Graph field.

## Server Exposure

Observed public ports:

- 22 SSH
- 80 HTTP
- 443 HTTPS

Observed local-only relevant ports:

- `127.0.0.1:3100` Next app
- `127.0.0.1:5432` PostgreSQL

Nginx proxies the public site to the local Next app. PostgreSQL was not observed listening publicly.

## Nginx and TLS

Positive findings:

- HTTPS certificate is installed.
- HTTP redirects to HTTPS.
- `nginx -t` passed.
- Certbot renewal is installed.

Risks:

- Nginx exposes `X-Powered-By: Next.js` from upstream responses.
- No explicit security headers were observed in the Nginx site file.

Recommended headers to consider after testing:

- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Content-Security-Policy`
- `Permissions-Policy`

## Dependency and Runtime Notes

The app uses modern Next.js, Prisma, and React versions. Existing docs mention moderate transitive advisories through Next.js/PostCSS and Prisma tooling, with automated resolutions considered risky. Re-check `npm audit` before any dependency upgrade work.

## Logging

Positive findings:

- Automation logs structured JSON.
- Facebook diagnostics avoid token printing.

Risks:

- Logs include operational details and public record names.
- PM2 logs should be treated as sensitive operational data.
- Do not paste logs containing credentials, tokens, env values, or raw Graph authorization data.

