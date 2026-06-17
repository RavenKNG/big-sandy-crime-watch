import { buildDailyBookingRecap, buildDailyBookingRecapReels, createDailyBookingRecapCaption, publishDailyBookingRecapBuild } from "../src/lib/daily-booking-recap";
import { publishDailyRecapFacebookReel, verifyFacebookReelsCapability } from "../src/lib/facebook-reels";

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  if (process.argv.includes("--verify-reels")) {
    console.log(JSON.stringify(await verifyFacebookReelsCapability(), null, 2));
    return;
  }

  const dayKey = readArg("--day");
  const publish = process.argv.includes("--publish");

  if (publish) {
    const build = await buildDailyBookingRecapReels({ dayKey });
    if (!build.ok) {
      console.log(JSON.stringify(build, null, 2));
      return;
    }
    const published = [];
    for (const reel of build.reels) {
      published.push(await publishDailyBookingRecapBuild(reel, async ({ caption, videoFile }) =>
        publishDailyRecapFacebookReel({
          description: caption,
          title: "Big Sandy Crime Watch Daily Booking Recap",
          videoFile,
        }),
      ));
    }
    console.log(JSON.stringify({ build, published }, null, 2));
    return;
  }

  const build = await buildDailyBookingRecap({ dayKey });
  console.log(
    JSON.stringify(
      build.ok
        ? {
            ...build,
            previewCaption: createDailyBookingRecapCaption(build.dayKey),
          }
        : build,
      null,
      2,
    ),
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
