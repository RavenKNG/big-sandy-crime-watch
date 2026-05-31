import fs from "node:fs/promises";
import path from "node:path";
import { importApprovedFolder } from "../src/lib/approved-imports";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function moveFolder(source: string, targetRoot: string, status: "processed" | "failed") {
  const baseName = path.basename(source);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destination = path.resolve(targetRoot, `${baseName}-${status}-${stamp}`);

  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.rename(source, destination);

  return destination;
}

async function main() {
  const folder = arg("folder");
  const move = process.argv.includes("--move");

  if (!folder) {
    throw new Error(
      'Usage: npm run import:approved-folder -- --folder "work/approved-imports/person-folder" [--move]',
    );
  }

  const autoPublish = process.env.AUTO_PUBLISH_REVIEWED_IMPORTS === "true";
  const createFacebookDraft = process.env.AUTO_QUEUE_FACEBOOK_DRAFTS !== "false";

  try {
    const result = await importApprovedFolder({
      folder,
      autoPublish,
      createFacebookDraft,
    });

    let movedTo: string | undefined;

    if (move && result.status !== "missing_record_json") {
      movedTo = await moveFolder(
        path.resolve(folder),
        process.env.REVIEWED_IMPORT_PROCESSED_DIR || "work/approved-imports-processed",
        "processed",
      );
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          result,
          movedTo,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    let movedTo: string | undefined;

    if (move) {
      try {
        movedTo = await moveFolder(
          path.resolve(folder),
          process.env.REVIEWED_IMPORT_FAILED_DIR || "work/approved-imports-failed",
          "failed",
        );
      } catch {
        // Keep the original error as the important failure.
      }
    }

    console.error(
      JSON.stringify(
        {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          movedTo,
        },
        null,
        2,
      ),
    );

    process.exit(1);
  }
}

main();