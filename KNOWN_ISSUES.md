# Known Issues

Audit date: 2026-06-07 UTC.

## Facebook Was Not Stuck During Audit

The original symptom was that Big Sandy Crime Watch had stopped posting to Facebook. At audit time the system had resumed or was already healthy:

- Latest successful post: `2026-06-07T02:38:45.024Z`
- Token health: healthy
- Posting enabled
- Queue backlog: 0
- Due drafts: 0
- Failed drafts: 0
- Public records needing draft repair: 0

The current idle state is expected: there are no due drafts to post.

## Migration History Has a Duplicate Unfinished Row

Production `_prisma_migrations` contains a duplicate `20260531012000_initial_mvp` row with `finished_at = null`.

Impact:

- Current schema appears applied and production is running.
- Future migrations may be risky until migration history is understood and repaired using Prisma-supported procedures.

## Production Directory Is Not a Git Worktree

`/opt/big-sandy-crime-watch` is not a git repository.

Impact:

- `git status` cannot verify server drift.
- Deployments rely on artifact/file replacement plus `.build-sha`.
- Rollback provenance is weaker than a normal checked-out release.

## Server Has Large In-Tree Backup Artifact

Production root contains a large `$backup` file.

Impact:

- Increases deploy directory size.
- Could confuse file sync or backup procedures.
- Should be inventoried before removal; do not delete without confirming contents and backup policy.

## Nginx Config Is Minimal

The site works and `nginx -t` passes, but the site config has no explicit security headers.

Impact:

- Browser hardening is limited.
- Add headers only after testing admin OAuth/callback and image routes.

## Admin Auth Is Basic Auth Only

The admin area is protected, but Basic Auth lacks MFA, session management, lockouts, and rate limiting.

Impact:

- Acceptable for early controlled operations, but weak for a mature production platform.

## Graph App Mode Check Is Inconclusive

Facebook token health is healthy, but app live/development mode could not be read through the current Graph field.

Impact:

- If admins can see posts but non-admin users cannot, manually verify the Meta app is published/live and reconnect Facebook.

## Rowan Automation Is Disabled

Rowan County page exists, but Rowan import automation is disabled because the source route requires captcha.

Impact:

- Rowan page is primarily a lookup/source page, not an automated booking feed.

## Pike Is a Page, Not an Automated Source

Pike County is in navigation and directory links, but no Pike automated source config was found.

Impact:

- Users may expect Pike booking imports that the system does not currently provide.

## Articles/Future News Are Not Implemented

`Article` exists in the schema and article route code exists, but production article count was 0.

Impact:

- Crime news, warrants, drug busts, missing persons, weather alerts, and similar ideas remain roadmap items, not active features.

## Visual/UI Weaknesses

- The design is functional but heavy in dark red/gold styling.
- Cards use relatively large border radii and a high-contrast promotional look.
- Ad slots are placeholders and can visually interrupt the record feed.
- Search is basic and does not expose date/charge filters.
- Mobile layout has breakpoints, but long names/agencies should be visually regression-tested with screenshots before design changes.

