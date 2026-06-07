import type { BookingCardRecord } from "./booking-card-generator";
import { generateBookingCardImages } from "./booking-card-generator";
import { absoluteSiteUrl } from "./display-format";
import {
  createFacebookRecordCaption,
  type FacebookRecordCaption,
} from "./facebook-record-caption";
import { facebookRecordUrl } from "./facebook-links";

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

  try {
    const bookingCards = await generateBookingCardImages(record);
    return {
      postText,
      postUrl,
      imageUrl: absoluteSiteUrl(bookingCards.previewPath, siteUrl),
      errorMessage: null as string | null,
    };
  } catch (error) {
    return {
      postText,
      postUrl,
      imageUrl: null,
      errorMessage: JSON.stringify({
        warning: "Booking card generation failed; draft was created as a link-only fallback.",
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
}
