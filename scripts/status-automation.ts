import { getAutomationStatusSnapshot } from "../src/lib/automation-status";
import { verifyFacebookPageToken } from "../src/lib/facebook-token-health";

async function main() {
  const [snapshot, facebookHealth] = await Promise.all([
    getAutomationStatusSnapshot(),
    verifyFacebookPageToken(),
  ]);

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        snapshot,
        facebookHealth,
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
