import { prisma } from "../src/lib/prisma-runtime";
import fs from "node:fs/promises";
import path from "node:path";
import { importApprovedFolder } from "../src/lib/approved-imports";
import { repairMissingFacebookDrafts } from "../src/lib/facebook-draft-repair";
import { runOfficialNewsImport } from "../src/lib/official-news-import";
import { runOfficialSourceImport } from "../src/lib/official-source-import";
import { verifyFacebookPageToken } from "../src/lib/facebook-token-health";
import { getFacebookCredential, markFacebookPostResult, redactFacebookSecrets } from "../src/lib/facebook-connection";
import {
  createFacebookFeedPostForm,
  createFacebookPhotoUploadForm,
  resolveFacebookPhotoUploadUrl,
} from "../src/lib/facebook-publish";
import { queueRowanPromoDraft } from "../src/lib/rowan-promo-runtime";

const ROOT = process.cwd();

function envBool(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

function envNum(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isRetryableFacebookGraphError(error?: { code?: number; error_subcode?: number; message?: string }) {
  if (!error?.code) return false;

  // Meta's generic/transient platform errors should pause and retry on the next cadence,
  // not strand a draft as permanently failed.
  return [1, 2, 4, 17, 32, 190, 613].includes(error.code);
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function moveFolder(source: string, targetRoot: string, status: "processed" | "failed") {
  await ensureDir(targetRoot);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destination = path.join(targetRoot, `${path.basename(source)}-${status}-${stamp}`);

  await fs.rename(source, destination);
  return destination;
}

async function scanApprovedImports() {
  const inputRoot = path.resolve(ROOT, process.env.REVIEWED_IMPORT_DIR || "work/approved-imports");
  const processedRoot = path.resolve(ROOT, process.env.REVIEWED_IMPORT_PROCESSED_DIR || "work/approved-imports-processed");
  const failedRoot = path.resolve(ROOT, process.env.REVIEWED_IMPORT_FAILED_DIR || "work/approved-imports-failed");

  await ensureDir(inputRoot);
  await ensureDir(processedRoot);
  await ensureDir(failedRoot);

  const entries = await fs.readdir(inputRoot, { withFileTypes: true });
  const folders = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(inputRoot, entry.name));

  const autoPublish = envBool("AUTO_PUBLISH_REVIEWED_IMPORTS", false);
  const createFacebookDraft = envBool("AUTO_QUEUE_FACEBOOK_DRAFTS", true);

  const results = [];

  for (const folder of folders) {
    const recordJson = path.join(folder, "record.json");
    const recordCsv = path.join(folder, "record.csv");

    if (!(await exists(recordJson)) && !(await exists(recordCsv))) {
      results.push({
        ok: false,
        folder,
        skipped: true,
        reason: "Missing record.json or record.csv",
      });
      continue;
    }

    try {
      const result = await importApprovedFolder({
        folder,
        autoPublish,
        createFacebookDraft,
      });

      const movedTo = await moveFolder(folder, processedRoot, "processed");

      results.push({
        ok: true,
        folder,
        result,
        movedTo,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await fs.writeFile(
        path.join(folder, "import-error.json"),
        JSON.stringify(
          {
            ok: false,
            error: message,
            failedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
        "utf8",
      );

      const movedTo = await moveFolder(folder, failedRoot, "failed");

      results.push({
        ok: false,
        folder,
        error: message,
        movedTo,
      });
    }
  }

  return results;
}

async function createFacebookDraftsForPublishedRecords() {
  if (!envBool("AUTO_QUEUE_FACEBOOK_DRAFTS", true)) {
    return {
      skipped: true,
      reason: "AUTO_QUEUE_FACEBOOK_DRAFTS=false",
    };
  }

  return repairMissingFacebookDrafts({
    windowHours: envNum("FACEBOOK_DRAFT_REPAIR_WINDOW_HOURS", 72),
    maxCreate: envNum("FACEBOOK_DRAFT_REPAIR_MAX_CREATE", 25),
    dryRun: false,
  });
}

async function postNextFacebookDraft() {
  if (!envBool("FACEBOOK_POSTING_ENABLED", false)) {
    return {
      skipped: true,
      reason: "FACEBOOK_POSTING_ENABLED=false",
    };
  }

  const credential = await getFacebookCredential();
  const pageId = credential?.pageId;
  const pageToken = credential?.pageToken;

  if (!pageId || !pageToken) {
    return {
      skipped: true,
      reason: "FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN missing",
    };
  }

  const draft = await prisma.facebookDraft.findFirst({
    where: {
      status: "DRAFTED",
      scheduledFor: {
        lte: new Date(),
      },
    },
    orderBy: {
      scheduledFor: "asc",
    },
  });

  if (!draft) {
    return {
      skipped: true,
      reason: "No due Facebook draft found",
    };
  }

  const siteUrl = (process.env.SITE_URL || "https://bigsandycrimewatch.com").replace(/\/$/, "");
  const imageUrl = resolveFacebookPhotoUploadUrl(draft.imageUrl, siteUrl);
  const createFeedLinkPost = async () =>
    fetch(`https://graph.facebook.com/v25.0/${pageId}/feed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: createFacebookFeedPostForm({
        message: draft.postText,
        link: draft.postUrl,
        accessToken: pageToken,
      }).toString(),
    });

  const response = imageUrl
    ? await (async () => {
        const uploadResponse = await fetch(`https://graph.facebook.com/v25.0/${pageId}/photos`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: createFacebookPhotoUploadForm({
            imageUrl,
            accessToken: pageToken,
          }).toString(),
        });

        const uploadJson = await uploadResponse.json();
        if (!uploadResponse.ok) {
          return {
            response: uploadResponse,
            json: uploadJson,
            usedPhotoUpload: true,
          };
        }

        const photoId =
          typeof uploadJson?.id === "string"
            ? uploadJson.id
            : typeof uploadJson?.post_id === "string"
              ? uploadJson.post_id
              : null;

        if (!photoId) {
          return {
            response: uploadResponse,
            json: {
              error: {
                code: 500,
                message: "Facebook photo upload did not return a usable media id.",
              },
            },
            usedPhotoUpload: true,
          };
        }

        const feedResponse = await fetch(`https://graph.facebook.com/v25.0/${pageId}/feed`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: createFacebookFeedPostForm({
            message: draft.postText,
            photoId,
            accessToken: pageToken,
          }).toString(),
        });

        return {
          response: feedResponse,
          json: await feedResponse.json(),
          usedPhotoUpload: true,
        };
      })()
    : {
        response: await createFeedLinkPost(),
        json: undefined as unknown,
        usedPhotoUpload: false,
      };

  const responseJson = response.json ?? (await response.response.json());

  if (!response.response.ok) {
    const redactedJson = redactFacebookSecrets(responseJson);
    const graphError = responseJson as { error?: { code?: number; error_subcode?: number; message?: string } };
    const failedImageRead =
      imageUrl &&
      ((graphError.error?.code === 100 && graphError.error?.error_subcode === 1366046) ||
        (graphError.error?.code === 324 && graphError.error?.error_subcode === 2069019) ||
        graphError.error?.message?.includes("usable media id"));

    if (failedImageRead) {
      const fallbackResponse = await createFeedLinkPost();

      const fallbackJson = await fallbackResponse.json();
      if (fallbackResponse.ok) {
        await prisma.facebookDraft.update({
          where: {
            id: draft.id,
          },
          data: {
            status: "POSTED",
            facebookPostId: fallbackJson.post_id || fallbackJson.id,
            errorMessage: null,
          },
        });
        await markFacebookPostResult();

        if (draft.recordId) {
          await prisma.publicRecordDemo.update({
            where: {
              id: draft.recordId,
            },
            data: {
              facebookPostStatus: "POSTED",
            },
          });
        }

        return {
          posted: true,
          fallbackToFeed: true,
          draftId: draft.id,
          facebookPostId: fallbackJson.post_id || fallbackJson.id,
        };
      }
    }

    const retryableFacebookError = isRetryableFacebookGraphError(graphError.error);
    await prisma.facebookDraft.update({
      where: {
        id: draft.id,
      },
      data: {
        status: retryableFacebookError ? "DRAFTED" : "FAILED",
        scheduledFor: retryableFacebookError
          ? new Date(Date.now() + envNum("POST_INTERVAL_HOURS", 3) * 60 * 60 * 1000)
          : draft.scheduledFor,
        errorMessage: JSON.stringify(redactedJson),
      },
    });
    await markFacebookPostResult(redactedJson);

    return {
      posted: false,
      failed: true,
      retryable: retryableFacebookError,
      error: JSON.stringify(redactedJson),
      draftId: draft.id,
    };
  }

  await prisma.facebookDraft.update({
    where: {
      id: draft.id,
    },
    data: {
      status: "POSTED",
      facebookPostId: responseJson.post_id || responseJson.id,
    },
  });
  await markFacebookPostResult();

  if (draft.recordId) {
    await prisma.publicRecordDemo.update({
      where: {
        id: draft.recordId,
      },
      data: {
        facebookPostStatus: "POSTED",
      },
    });
  }

  return {
    posted: true,
    draftId: draft.id,
    facebookPostId: responseJson.post_id || responseJson.id,
  };
}

async function runOnce(options: { skipFacebookPost?: boolean } = {}) {
  const officialSourceResult = await runOfficialSourceImport();
  const importResults = await scanApprovedImports();
  const draftResults = await createFacebookDraftsForPublishedRecords();
  const facebookTokenHealth = await verifyFacebookPageToken();
  const rowanPromoResult = await queueRowanPromoDraft();
  const facebookPostResult = options.skipFacebookPost
    ? { skipped: true, reason: "Startup post skipped; waiting for the configured interval." }
    : !facebookTokenHealth.healthy
      ? {
          skipped: true,
          reason: "Facebook Page token health check failed; queue preserved.",
          actionRequired: facebookTokenHealth.actionRequired,
        }
    : await postNextFacebookDraft();

  console.log(
    JSON.stringify(
      {
        ok: true,
        ranAt: new Date().toISOString(),
        officialSourceResult,
        importResults,
        draftResults,
        facebookTokenHealth,
        rowanPromoResult,
        facebookPostResult,
      },
      null,
      2,
    ),
  );
}

async function runOfficialNewsOnce() {
  const result = await runOfficialNewsImport({ live: true });
  console.log(
    JSON.stringify(
      {
        ok: !("ok" in result) || result.ok,
        ranAt: new Date().toISOString(),
        officialNewsResult: result,
      },
      null,
      2,
    ),
  );
  return result;
}

async function main() {
  const once = process.argv.includes("--once");

  if (once) {
    await runOnce();
    await prisma.$disconnect();
    return;
  }

  const intervalHours = envNum("POST_INTERVAL_HOURS", 3);
  const intervalMs = intervalHours * 60 * 60 * 1000;
  const officialNewsIntervalMinutes = envNum("KSP_SCAN_INTERVAL_MINUTES", 15);
  const officialNewsIntervalMs = officialNewsIntervalMinutes * 60 * 1000;

  await runOnce({ skipFacebookPost: envBool("AUTOMATION_SKIP_INITIAL_FACEBOOK_POST", false) });
  await runOfficialNewsOnce();

  setInterval(() => {
    runOnce().catch((error) => {
      console.error(
        JSON.stringify(
          {
            ok: false,
            failedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
          },
          null,
          2,
        ),
      );
    });
  }, intervalMs);

  setInterval(() => {
    runOfficialNewsOnce().catch((error) => {
      console.error(
        JSON.stringify(
          {
            ok: false,
            failedAt: new Date().toISOString(),
            officialNewsResult: {
              failed: true,
              error: error instanceof Error ? error.message : String(error),
            },
          },
          null,
          2,
        ),
      );
    });
  }, officialNewsIntervalMs);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});

