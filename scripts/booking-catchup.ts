import { buildBookingCatchUp, buildBookingCatchUpReels, createBookingCatchUpCaption, publishBookingCatchUpBuild } from "../src/lib/booking-catchup";
import { publishBookingCatchUpFacebookReel, verifyFacebookReelsCapability } from "../src/lib/facebook-reels";

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
  const slotTime = readArg("--slot");
  const publish = process.argv.includes("--publish");

  if (publish) {
    const build = await buildBookingCatchUpReels({ dayKey, slotTime });
    if (!build.ok) {
      console.log(JSON.stringify(build, null, 2));
      return;
    }
    const published = [];
    for (const reel of build.reels) {
      published.push(await publishBookingCatchUpBuild(reel, async ({ caption, videoFile }) =>
        publishBookingCatchUpFacebookReel({
          description: caption,
          title: "Booking Catch-Up",
          videoFile,
        }),
      ));
    }
    console.log(JSON.stringify({ build, published }, null, 2));
    return;
  }

  const build = await buildBookingCatchUp({ dayKey, slotTime });
  console.log(
    JSON.stringify(
      build.ok
        ? {
            ...build,
            previewCaption: createBookingCatchUpCaption(build.dayKey),
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
