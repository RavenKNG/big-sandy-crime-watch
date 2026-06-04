import { getAutomationStatusSnapshot } from "../src/lib/automation-status";
import { verifyFacebookPageToken } from "../src/lib/facebook-token-health";
import { getOfficialSourceStatuses } from "../src/lib/official-source-status";

async function main() {
  const [snapshot, facebookHealth, officialSources] = await Promise.all([
    getAutomationStatusSnapshot(),
    verifyFacebookPageToken(),
    getOfficialSourceStatuses(),
  ]);

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        snapshot,
        facebookHealth,
        officialSources,
      },
      null,
      2,
    ),
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
