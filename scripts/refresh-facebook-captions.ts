import { prisma } from "../src/lib/prisma-runtime";
import { createFacebookRecordCaption } from "../src/lib/facebook-record-caption";

async function main() {
  const drafts = await prisma.facebookDraft.findMany({
    where: { status: "DRAFTED", recordId: { not: null } },
    include: { record: { include: { charges: { orderBy: { displayOrder: "asc" } } } } },
  });
  let updated = 0;
  for (const draft of drafts) {
    if (!draft.record) continue;
    await prisma.facebookDraft.update({
      where: { id: draft.id },
      data: { postText: createFacebookRecordCaption(draft.record, draft.postUrl) },
    });
    updated += 1;
  }
  console.log(JSON.stringify({ queuedCaptionsUpdated: updated }));
}

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
