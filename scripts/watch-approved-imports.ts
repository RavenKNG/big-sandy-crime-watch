import fs from "node:fs/promises";
import path from "node:path";
import { importApprovedFolder } from "../src/lib/approved-imports";

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function moveFolder(source: string, targetRoot: string, status: "processed" | "failed") {
  const baseName = path.basename(source);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destination = path.resolve(targetRoot, `${baseName}-${status}-${stamp}`);

  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.rename(source, destination);

  return destination;
}

async function scanOnce() {
  const enabled = process.env.REVIEWED_IMPORT_AUTOMATION_ENABLED === "true";

  if (!enabled) {
    console.log(
      JSON.stringify({
        ok: true,
        skipped: true,
        reason: "REVIEWED_IMPORT_AUTOMATION_ENABLED is not true.",
      }),
    );
    return;
  }

  const inputRoot = path.resolve(process.env.REVIEWED_IMPORT_DIR || "work/approved-imports");
  const processedRoot = path.resolve(
    process.env.REVIEWED_IMPORT_PROCESSED_DIR || "work/approved-imports-processed",
  );
  const failedRoot = path.resolve(
    process.env.REVIEWED_IMPORT_FAILED_DIR || "work/approved-imports-failed",
  );

  await fs.mkdir(inputRoot, { recursive: true });
  await fs.mkdir(processedRoot, { recursive: true });
  await fs.mkdir(failedRoot, { recursive: true });

  const entries = await fs.readdir(inputRoot, { withFileTypes: true });
  const folders = entries.filter((entry) => entry.isDirectory());

  const autoPublish = process.env.AUTO_PUBLISH_REVIEWED_IMPORTS === "true";
  const createFacebookDraft = process.env.AUTO_QUEUE_FACEBOOK_DRAFTS !== "false";

  for (const folderEntry of folders) {
    const folder = path.join(inputRoot, folderEntry.name);
    const recordPath = path.join(folder, "record.json");
    const csvPath = path.join(folder, "record.csv");

    if (!(await exists(recordPath)) && !(await exists(csvPath))) {
      console.log(
        JSON.stringify({
          ok: false,
          folder,
          skipped: true,
          reason: "Missing record.json or record.csv.",
        }),
      );
      continue;
    }

    try {
      const result = await importApprovedFolder({
        folder,
        autoPublish,
        createFacebookDraft,
      });

      const movedTo = await moveFolder(folder, processedRoot, "processed");

      console.log(
        JSON.stringify({
          ok: true,
          folder,
          result,
          movedTo,
        }),
      );
    } catch (error) {
      const movedTo = await moveFolder(folder, failedRoot, "failed");

      console.error(
        JSON.stringify({
          ok: false,
          folder,
          error: error instanceof Error ? error.message : String(error),
          movedTo,
        }),
      );
    }
  }
}

async function main() {
  const once = process.argv.includes("--once");
  const intervalMs = Number.parseInt(process.env.REVIEWED_IMPORT_INTERVAL_MS || "300000", 10);

  await scanOnce();

  if (once) return;

  setInterval(() => {
    scanOnce().catch((error) => {
      console.error(
        JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
  }, intervalMs);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
