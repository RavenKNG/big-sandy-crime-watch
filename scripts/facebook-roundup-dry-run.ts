import { createFacebookRoundupCaption } from "../src/lib/facebook-links";

const type = process.argv.includes("--last-72-hours") ? "last_72_hours" : "today";

console.log(
  JSON.stringify(
    {
      dryRunOnly: true,
      type,
      caption: createFacebookRoundupCaption(type),
      queued: false,
      posted: false,
    },
    null,
    2,
  ),
);
