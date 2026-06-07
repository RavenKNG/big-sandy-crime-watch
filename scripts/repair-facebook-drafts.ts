import { prisma } from "../src/lib/prisma-runtime";
import { getFacebookDraftGapSummary, repairMissingFacebookDrafts } from "../src/lib/facebook-draft-repair";

function argValue(name: string) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

function positiveNumberArg(name: string, fallback: number) {
  const parsed = Number.parseFloat(argValue(name) ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main() {
  const confirmed = process.argv.includes("--confirm");
  const windowHours = positiveNumberArg("hours", 72);
  const maxCreate = positiveNumberArg("max", 25);

  const summary = await getFacebookDraftGapSummary({ windowHours });
  const repair = await repairMissingFacebookDrafts({
    windowHours,
    maxCreate,
    dryRun: !confirmed,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: confirmed ? "confirmed_repair" : "dry_run",
        note: confirmed
          ? "Created eligible missing Facebook drafts only. This command did not post to Facebook."
          : "Dry run only. Re-run with --confirm to create eligible missing drafts.",
        summary,
        repair,
      },
      null,
      2,
    ),
  );
}

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
