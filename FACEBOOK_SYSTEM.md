# Facebook System

Audit date: 2026-06-07 UTC.

## Purpose

The Facebook subsystem creates branded booking-record drafts and posts them to the Big Sandy Crime Watch Facebook Page on a configured cadence.

## Credential Model

The preferred credential path is stored OAuth:

1. Admin visits `/admin/facebook/connect`.
2. App starts Facebook Login using configured app credentials.
3. Callback exchanges the authorization code.
4. App retrieves Pages available to the authenticated user.
5. App finds the configured Page.
6. Page token is encrypted with AES-256-GCM and stored in `FacebookConnection.encryptedPageToken`.

Environment fallback exists for `FACEBOOK_PAGE_ID` and `FACEBOOK_PAGE_ACCESS_TOKEN`, but production currently reports `credentialSource: stored_oauth`.

Never print or commit:

- Page access tokens
- App secret
- Token encryption key
- Database URL
- Encrypted token payload

## Token Health

Token health is checked before posting. `verifyFacebookPageToken()` validates:

- Credential configured
- `/me` returns the expected Page ID and Page name
- Debug token is valid
- Token type is `PAGE`
- `pages_manage_posts` scope exists
- Token is not inside warning/critical expiration windows

Health writes status back to `FacebookConnection`.

At audit time token health was healthy. The app-mode Graph field `is_live` could not be read because Graph returned `(#100) Tried accessing nonexisting field (is_live)`. The system therefore records a manual warning that Meta app mode should be checked if public visibility issues recur.

## Draft Creation

Draft creation happens in:

- `src/lib/facebook-record-drafts.ts`
- `src/lib/facebook-draft-repair.ts`
- `src/lib/official-source-import.ts`
- `src/lib/approved-imports.ts`

Official News Automation adds an isolated draft path in `src/lib/official-news-db.ts` for article-linked KSP/official-news drafts. It uses `FacebookDraft.articleId` and does not change booking-record draft creation.

Draft payload includes:

- `postText`
- `postUrl`
- `imageUrl`
- optional `errorMessage`

Record post URLs include Facebook UTM parameters through `facebookRecordUrl()`.

## Image Fallback Behavior

Draft creation tries to generate booking-card images first. If Sharp/image generation fails, the draft is still created with:

- the same post text
- the same post URL
- `imageUrl = null`
- an error JSON noting link-only fallback

This means image failures should not stop Facebook posting. They degrade to link posts.

## Publish Flow

The automation worker posts one due draft per interval.

Official-news auto-posting remains disabled unless `OFFICIAL_NEWS_AUTO_POST=true`, `KSP_AUTO_POST=true`, and the existing Facebook posting controls are also deliberately enabled. Draft creation alone is not the same as auto-posting.

For image drafts:

1. Resolve draft image URL.
2. Upload image to `/{page-id}/photos` with `published=false`.
3. Create final `/{page-id}/feed` post with `attached_media[0]`.
4. Send `published=true` on the final feed post.
5. Store Facebook post ID and mark draft/record posted.

For link-only drafts:

1. Create `/{page-id}/feed` post with `message`, `link`, and `published=true`.
2. Store Facebook post ID and mark draft/record posted.

The current code does not send dark-post/scheduled-post fields such as:

- `no_story`
- `targeting`
- `unpublished_content_type`
- `scheduled_publish_time`

## Error Recovery

If Facebook cannot read the uploaded image or no usable media ID is returned, the worker retries as a link-only feed post.

Retryable Graph error codes are kept as `DRAFTED` and rescheduled for the next interval:

- `1`
- `2`
- `4`
- `17`
- `32`
- `190`
- `613`

Non-retryable errors mark the draft `FAILED`.

## Duplicate Prevention

Each record should have at most one active/posted meaningful draft. Draft creation checks for an existing `FacebookDraft` by `recordId`.

Repair logic classifies published records by:

- missing draft
- invalid posted state
- failed draft
- manual-required draft
- active draft
- valid posted draft with Facebook post ID

Only safe missing/invalid-posted cases are auto-create eligible. Failed/manual-required drafts are left for review.

## Current Posting Diagnosis

At audit time:

- Posting was enabled.
- Latest successful Facebook post was `2026-06-07T02:38:45.024Z`.
- 76 drafts were posted.
- 0 drafts were due.
- 0 drafts were failed.
- 0 published records needed repair.

The system was idle because it had no due drafts, not because the automation worker or token was broken.
