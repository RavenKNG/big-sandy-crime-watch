import { prisma } from "../src/lib/prisma-runtime";
import fs from "node:fs/promises";
import path from "node:path";
import { importApprovedFolder } from "../src/lib/approved-imports";
import { createFacebookRecordCaption } from "../src/lib/facebook-record-caption";
import { publishedRecordOrder } from "../src/lib/record-display";
import { runOfficialSourceImport } from "../src/lib/official-source-import";
import { verifyFacebookPageToken } from "../src/lib/facebook-token-health";

const ROOT = process.cwd();

function envBool(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

function envNum(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
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

  const siteUrl = (process.env.SITE_URL || "https://bigsandycrimewatch.com").replace(/\/$/, "");

  const records = await prisma.publicRecordDemo.findMany({
    where: {
      publishStatus: "PUBLISHED",
    },
    include: {
      charges: {
        orderBy: {
          displayOrder: "asc",
        },
      },
    },
    orderBy: publishedRecordOrder,
    take: 50,
  });

  let created = 0;
  let skipped = 0;

  for (const record of records) {
    const existing = await prisma.facebookDraft.findFirst({
      where: {
        recordId: record.id,
      },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    const postUrl = `${siteUrl}/records/${record.slug}`;
    const postText = createFacebookRecordCaption(record, postUrl);

    await prisma.facebookDraft.create({
      data: {
        recordId: record.id,
        status: "DRAFTED",
        scheduledFor: new Date(),
        postText,
        postUrl,
        imageUrl: record.imageUrl || record.imageLocalPath,
      },
    });

    await prisma.publicRecordDemo.update({
      where: {
        id: record.id,
      },
      data: {
        facebookPostStatus: "DRAFTED",
      },
    });

    created += 1;
  }

  return {
    created,
    skipped,
  };
}

async function postNextFacebookDraft() {
  if (!envBool("FACEBOOK_POSTING_ENABLED", false)) {
    return {
      skipped: true,
      reason: "FACEBOOK_POSTING_ENABLED=false",
    };
  }

  const pageId = process.env.FACEBOOK_PAGE_ID;
  const pageToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

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
  const imageUrl = draft.imageUrl
    ? new URL(draft.imageUrl, `${siteUrl}/`).toString()
    : undefined;
  const response = await fetch(
    `https://graph.facebook.com/v25.0/${pageId}/${imageUrl ? "photos" : "feed"}`,
    {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      imageUrl
        ? { message: draft.postText, url: imageUrl, access_token: pageToken }
        : { message: draft.postText, link: draft.postUrl, access_token: pageToken },
    ),
    },
  );

  const json = await response.json();

  if (!response.ok) {
    const graphError = json as { error?: { code?: number } };
    const retryableCredentialError = graphError.error?.code === 190;
    await prisma.facebookDraft.update({
      where: {
        id: draft.id,
      },
      data: {
        status: retryableCredentialError ? "DRAFTED" : "FAILED",
        scheduledFor: retryableCredentialError
          ? new Date(Date.now() + envNum("POST_INTERVAL_HOURS", 3) * 60 * 60 * 1000)
          : draft.scheduledFor,
        errorMessage: JSON.stringify(json),
      },
    });

    return {
      posted: false,
      failed: true,
      retryable: retryableCredentialError,
      error: JSON.stringify(json),
      draftId: draft.id,
    };
  }

  await prisma.facebookDraft.update({
    where: {
      id: draft.id,
    },
    data: {
      status: "POSTED",
      facebookPostId: json.post_id || json.id,
    },
  });

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
    facebookPostId: json.post_id || json.id,
  };
}

async function runOnce(options: { skipFacebookPost?: boolean } = {}) {
  const officialSourceResult = await runOfficialSourceImport();
  const importResults = await scanApprovedImports();
  const draftResults = await createFacebookDraftsForPublishedRecords();
  const facebookTokenHealth = await verifyFacebookPageToken();
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
        facebookPostResult,
      },
      null,
      2,
    ),
  );
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

  await runOnce({ skipFacebookPost: envBool("AUTOMATION_SKIP_INITIAL_FACEBOOK_POST", false) });

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
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});

