import { getFacebookCredential } from "../src/lib/facebook-connection";
import { verifyFacebookPageToken } from "../src/lib/facebook-token-health";

async function main() {
  const credential = await getFacebookCredential();
  const health = await verifyFacebookPageToken();
  console.log(JSON.stringify({ configured: Boolean(credential), credentialSource: credential?.source, pageIdPresent: Boolean(credential?.pageId), tokenPresent: Boolean(credential?.pageToken), health }, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
