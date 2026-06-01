import { verifyFacebookPageToken } from "../src/lib/facebook-token-health";

async function main() {
  console.log(JSON.stringify(await verifyFacebookPageToken(), null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
