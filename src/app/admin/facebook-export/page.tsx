import { markRecordManuallyPosted } from "@/app/actions";
import { CopyDraftButton } from "@/components/CopyDraftButton";
import { articles } from "@/lib/demo-data";
import { getDb } from "@/lib/db";
import { createArticleDraft, createRecordDraft } from "@/lib/facebook";

export const dynamic = "force-dynamic";

export default async function FacebookExportPage() {
  const records = await getDb().publicRecordDemo.findMany({
    where: {
      publishStatus: {
        in: ["APPROVED", "PUBLISHED"],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <main>
      <section className="content-card">
        <p className="eyebrow">MANUAL FACEBOOK EXPORT</p>
        <h1>Reviewed posting queue</h1>
        <p>
          Copy the text and target URL into Facebook manually. Confirm the post is live
          before marking it posted.
        </p>

        <h2>Editorial update</h2>
        <Export
          text={createArticleDraft(articles[0])}
          url={`https://BigSandyCrimeWatch.com/news/${articles[0].slug}`}
        />

        <h2>Reviewed synthetic records</h2>
        {records.length === 0 ? (
          <p>No approved saved records.</p>
        ) : (
          records.map((record: (typeof records)[number]) => (
            <div className="charge" key={record.id}>
              <h3>{record.displayName}</h3>
              <Export
                text={createRecordDraft({
                  ...record,
                  age: record.age ?? undefined,
                  gender: record.gender ?? undefined,
                  city: record.city ?? undefined,
                  state: record.state ?? undefined,
                  arrestingAgency: record.arrestingAgency ?? undefined,
                  arrestingOfficer: record.arrestingOfficer ?? undefined,
                  bookingDateTimeText: record.bookingDateTimeText ?? undefined,
                  sourceUrl: record.sourceUrl ?? undefined,
                  imageUrl: record.imageUrl ?? record.imageLocalPath ?? undefined,
                  recordDate: record.recordDate.toISOString(),
                  sourceTimestamp: record.sourceTimestamp.toISOString(),
                  county: record.county ?? "",
                  status: record.status ?? "",
                  charges: [],
                })}
                url={`https://BigSandyCrimeWatch.com/records/${record.slug}`}
                image={record.imageUrl ?? record.imageLocalPath ?? undefined}
              />
              <p>
                Status: <span className="pill">{record.facebookPostStatus}</span>
              </p>
              {record.facebookPostStatus === "POSTED" ? (
                <p className="muted">Already marked as manually posted.</p>
              ) : (
                <form action={markRecordManuallyPosted}>
                  <input type="hidden" name="id" value={record.id} />
                  <button type="submit">Mark manually posted</button>
                </form>
              )}
            </div>
          ))
        )}
      </section>
    </main>
  );
}

function Export({
  text,
  url,
  image,
}: {
  text: string;
  url: string;
  image?: string;
}) {
  return (
    <div>
      <textarea readOnly value={text} />
      <p>
        <strong>Target URL:</strong> {url}
      </p>
      {image ? (
        <p>
          <strong>Image reference:</strong> {image}
        </p>
      ) : null}
      <div className="button-row">
        <CopyDraftButton text={text} label="Copy post text" />
        <CopyDraftButton text={url} label="Copy target URL" />
      </div>
    </div>
  );
}
