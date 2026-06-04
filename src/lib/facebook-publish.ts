export function createFacebookGraphForm(
  fields: Record<string, string | number | boolean | null | undefined>,
) {
  const form = new URLSearchParams();

  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    form.set(key, String(value));
  }

  return form;
}

export function createFacebookPhotoUploadForm(input: {
  imageUrl: string;
  accessToken: string;
}) {
  return createFacebookGraphForm({
    url: input.imageUrl,
    published: false,
    access_token: input.accessToken,
  });
}

export function createFacebookFeedPostForm(input: {
  message: string;
  accessToken: string;
  photoId?: string | null;
  link?: string | null;
}) {
  const form = createFacebookGraphForm({
    message: input.message,
    access_token: input.accessToken,
    link: input.photoId ? undefined : input.link,
  });

  if (input.photoId) {
    form.set("attached_media[0]", JSON.stringify({ media_fbid: input.photoId }));
  }

  return form;
}

export function resolveFacebookPhotoUploadUrl(
  imageUrl: string | null | undefined,
  siteUrl: string,
) {
  if (!imageUrl) return null;

  const absolute = new URL(imageUrl, `${siteUrl}/`);

  if (absolute.pathname.replace(/\/+$/, "") === "/media/mugshot") {
    const proxiedSrc = absolute.searchParams.get("src");
    if (!proxiedSrc) return null;

    const proxiedAbsolute = new URL(proxiedSrc, `${siteUrl}/`);
    if (proxiedAbsolute.pathname.startsWith("/booking-images/")) {
      return proxiedAbsolute.toString();
    }

    return null;
  }

  if (absolute.pathname.toLowerCase().endsWith(".svg")) {
    return null;
  }

  return absolute.toString();
}
