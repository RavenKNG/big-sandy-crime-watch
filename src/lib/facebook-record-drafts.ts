import type { BookingCardRecord } from "./booking-card-generator";
import { absoluteSiteUrl } from "./display-format";
import {
  createFacebookRecordCaption,
  type FacebookRecordCaption,
} from "./facebook-record-caption";
import { facebookRecordUrl } from "./facebook-links";
import { resolveBookingPhoto } from "./booking-photo";

export type FacebookRecordDraftRecord = BookingCardRecord &
  FacebookRecordCaption & {
    id?: string;
    charges: FacebookRecordCaption["charges"];
  };

export async function createFacebookRecordDraftPayload(
  record: FacebookRecordDraftRecord,
  siteUrl = process.env.SITE_URL || "https://bigsandycrimewatch.com",
) {
  const postUrl = facebookRecordUrl(record.slug, siteUrl);
  const postText = createFacebookRecordCaption(record, postUrl);

  const photo = await resolveBookingPhoto(record);
  if (photo.status === "available" && photo.imagePathOrUrl) {
    return {
      postText,
      postUrl,
      imageUrl: absoluteSiteUrl(photo.imagePathOrUrl, siteUrl),
      errorMessage: null as string | null,
    };
  }

  return {
    postText,
    postUrl,
    imageUrl: null,
    errorMessage: JSON.stringify({
      warning: "Booking record has no confirmed mugshot; Facebook posting held for manual repair.",
      photoStatus: photo.status,
      reason: photo.reason,
      checkedSource: photo.checkedSource,
    }),
  };
}
