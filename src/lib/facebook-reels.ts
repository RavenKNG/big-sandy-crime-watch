import fs from "node:fs/promises";
import { FACEBOOK_GRAPH_ROOT, getFacebookCredential, redactFacebookSecrets } from "./facebook-connection";

export async function createFacebookReelStartSession(input: {
  pageId: string;
  accessToken: string;
}) {
  const response = await fetch(`${FACEBOOK_GRAPH_ROOT}/${input.pageId}/video_reels`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      upload_phase: "start",
      access_token: input.accessToken,
    }).toString(),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(redactFacebookSecrets(json)));
  }
  return json as { video_id: string; upload_url?: string };
}

export async function uploadFacebookReelVideo(input: {
  accessToken: string;
  videoId: string;
  videoFile: string;
  uploadUrl?: string | null;
}) {
  const bytes = await fs.readFile(input.videoFile);
  const response = await fetch(
    input.uploadUrl || `https://rupload.facebook.com/video-upload/v25.0/${input.videoId}`,
    {
      method: "POST",
      headers: {
        Authorization: `OAuth ${input.accessToken}`,
        offset: "0",
        file_size: String(bytes.byteLength),
        "Content-Type": "application/octet-stream",
      },
      body: bytes,
    },
  );
  const json = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(redactFacebookSecrets(json)));
  }
  return json as { success: boolean };
}

export async function publishFacebookPageReel(input: {
  pageId: string;
  accessToken: string;
  videoId: string;
  description: string;
  title?: string;
}) {
  const form = new URLSearchParams({
    upload_phase: "finish",
    access_token: input.accessToken,
    video_id: input.videoId,
    video_state: "PUBLISHED",
    description: input.description,
  });
  if (input.title) {
    form.set("title", input.title);
  }

  const response = await fetch(`${FACEBOOK_GRAPH_ROOT}/${input.pageId}/video_reels`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(redactFacebookSecrets(json)));
  }
  return json as { success?: boolean; reel_id?: string; id?: string; permalink_url?: string };
}

export async function publishDailyRecapFacebookReel(input: {
  description: string;
  title?: string;
  videoFile: string;
}) {
  const credential = await getFacebookCredential();
  if (!credential?.pageId || !credential?.pageToken) {
    throw new Error("Facebook Page credentials are unavailable.");
  }

  const started = await createFacebookReelStartSession({
    pageId: credential.pageId,
    accessToken: credential.pageToken,
  });
  await uploadFacebookReelVideo({
    accessToken: credential.pageToken,
    videoId: started.video_id,
    videoFile: input.videoFile,
    uploadUrl: started.upload_url,
  });
  const published = await publishFacebookPageReel({
    pageId: credential.pageId,
    accessToken: credential.pageToken,
    videoId: started.video_id,
    description: input.description,
    title: input.title,
  });

  return {
    reelId: published.reel_id || published.id || started.video_id,
    permalink: published.permalink_url ?? null,
  };
}

export async function verifyFacebookReelsCapability() {
  const credential = await getFacebookCredential();
  if (!credential?.pageId || !credential?.pageToken) {
    return {
      ok: false,
      supported: false,
      reason: "Facebook Page credentials are unavailable.",
    };
  }

  const response = await fetch(
    `${FACEBOOK_GRAPH_ROOT}/${credential.pageId}?fields=id,name&access_token=${encodeURIComponent(credential.pageToken)}`,
  );
  const json = await response.json();
  if (!response.ok) {
    return {
      ok: false,
      supported: false,
      reason: JSON.stringify(redactFacebookSecrets(json)),
    };
  }

  return {
    ok: true,
    supported: true,
    pageId: credential.pageId,
    pageName: typeof json?.name === "string" ? json.name : null,
    note: "Facebook Page credentials resolved. Reels publish flow is implemented against /video_reels; full permission confirmation requires an actual publish attempt.",
  };
}
