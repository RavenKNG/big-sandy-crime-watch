# Roadmap

This roadmap separates production-stability work from future editorial/content ideas. Do not implement roadmap items without a scoped plan and tests.

## Phase 1: Stabilize Operations

- Resolve duplicate unfinished Prisma migration metadata using a Prisma-safe procedure.
- Make production deployment reproducible from a clean artifact or git checkout.
- Add a pre-deploy checklist covering typecheck, tests, build, migration review, PM2 status, and smoke checks.
- Add automated daily status snapshots for imports, Facebook health, queue depth, failed drafts, and disk usage.
- Add alerting for:
  - Facebook token unhealthy
  - failed drafts
  - missing draft gaps
  - import failures
  - no successful import for a defined window
  - SSL certificate nearing expiration

## Phase 2: Harden Security

- Replace or supplement Basic Auth with stronger admin authentication.
- Add rate limiting for admin and correction forms.
- Add security headers after testing.
- Add admin action audit logs.
- Review correction/hide/deindex workflow and create an operational SLA.
- Document backup/restore procedures for PostgreSQL and booking images.

## Phase 3: Improve Facebook Growth Loop

- Add clearer queue dashboard in admin.
- Add public-visibility verification workflow for new automated posts.
- Add posting cadence controls in admin instead of env-only changes.
- Improve draft preview and retry handling for failed/manual-required drafts.
- Add optional non-booking promotional posts only when editorial rules are clear.

## Phase 4: Improve Import Coverage

- Keep BSRDC import stable before adding sources.
- Investigate Pike County source options.
- Investigate Rowan County supported/non-captcha options.
- For any new source, require:
  - legal/platform review
  - source reliability notes
  - dedupe strategy
  - image policy
  - rate-limit policy
  - dry-run importer
  - tests with sanitized fixtures

## Phase 5: Product and UX

- Improve mobile visual polish on record cards and record pages.
- Add richer search filters:
  - date range
  - county
  - agency
  - charge keyword
  - source
- Add county/source status indicators so users understand which pages are automated versus lookup-only.
- Improve ad placement so monetization does not disrupt record scanning.
- Add sitemap coverage checks and Search Console workflow.

## Future Content Ideas

These are not currently implemented production features:

- Crime news
- Search warrants
- Drug busts
- Major court sentences
- Missing persons
- Wanted persons
- Scam warnings
- Severe weather alerts
- Death investigations
- School lockdowns

Before implementing any of these, define editorial standards, source requirements, correction policy, and automation boundaries.

