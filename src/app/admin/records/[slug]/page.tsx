import Link from "next/link";
import { notFound } from "next/navigation";
import { updateDemoRecordStatus } from "@/app/actions";
import { getDb } from "@/lib/db";

export default async function AdminRecordPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const record = await getDb().publicRecordDemo.findUnique({
    where: { slug: (await params).slug },
    include: {
      charges: {
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  if (!record) notFound();

  return (
    <main>
      <section className="content-card">
        <p className="eyebrow">EDITORIAL RECORD PREVIEW</p>
        <h1>{record.displayName}</h1>
        <p>
          Status: <span className="pill">{record.publishStatus}</span>
        </p>
        <p>
          {record.county} - {record.recordDate.toISOString()}
        </p>

        <h2>Source attribution</h2>
        <p>
          Source: {record.sourceName}
          <br />
          Timestamp: {record.sourceTimestamp.toISOString()}
        </p>
        {record.sourceUrl ? (
          <p>
            <a href={record.sourceUrl}>Open source URL</a>
          </p>
        ) : null}

        <h2>Listed demo charges</h2>
        {record.charges.map((charge: (typeof record.charges)[number]) => (
          <div className="charge" key={charge.id}>
            <strong>{charge.offense}</strong>
            <p>{charge.chargeDescription}</p>
            {charge.statute ? <span className="pill">{charge.statute}</span> : null}
            {charge.caseNumber ? <p>Case: {charge.caseNumber}</p> : null}
          </div>
        ))}

        <h2>Publish checklist</h2>
        <ul>
          <li>Confirm source attribution and timestamp.</li>
          <li>Confirm listed charges and source notes.</li>
          <li>Confirm no home address is present.</li>
          <li>Keep as DRAFT until editorial review is complete.</li>
        </ul>
        <p className="notice">
          Synthetic demo draft. Review compliance notes before publishing.
        </p>
        <pre>{record.complianceNotes}</pre>

        <div className="button-row">
          {(["PUBLISHED", "HIDDEN", "REJECTED"] as const).map((status) => (
            <form action={updateDemoRecordStatus} key={status}>
              <input type="hidden" name="id" value={record.id} />
              <input type="hidden" name="publishStatus" value={status} />
              <button type="submit">{status}</button>
            </form>
          ))}
        </div>

        {record.publishStatus === "PUBLISHED" ? (
          <p>
            <Link href={`/records/${record.slug}`}>Open public detail page</Link>
          </p>
        ) : null}
        <p>
          <Link href="/admin">Back to dashboard</Link>
        </p>
      </section>
    </main>
  );
}
