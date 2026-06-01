import { FACEBOOK_GRAPH_ROOT, getFacebookCredential, markFacebookPostResult, redactFacebookSecrets } from "../src/lib/facebook-connection";
import { verifyFacebookPageToken } from "../src/lib/facebook-token-health";

async function main() {
  if (process.env.FACEBOOK_TEST_POST_ENABLED !== "true" || !process.argv.includes("--confirm")) {
    throw new Error("Facebook one-shot test posting is disabled. Enable FACEBOOK_TEST_POST_ENABLED=true and pass --confirm only for an explicitly approved controlled test.");
  }
  const health = await verifyFacebookPageToken();
  const credential = await getFacebookCredential();
  if (!health.healthy || !credential) throw new Error("Facebook token health check failed. No test post was created.");
  const response = await fetch(`${FACEBOOK_GRAPH_ROOT}/${credential.pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Big Sandy Crime Watch connection test. Automated posting remains disabled.", access_token: credential.pageToken }),
  });
  const json = await response.json();
  if (!response.ok) {
    await markFacebookPostResult(json);
    throw new Error(JSON.stringify(redactFacebookSecrets(json)));
  }
  await markFacebookPostResult();
  console.log(JSON.stringify({ posted: true, facebookPostId: json.id }));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
