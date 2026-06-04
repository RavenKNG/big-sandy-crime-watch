import { RecordCard } from "@/components/RecordCard";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { publishedRecordOrder, storedRecordToDemoRecord } from "@/lib/record-display";
import { isRowanCounty, ROWAN_JAILTRACKER_URL, ROWAN_PAGE_TITLE } from "@/lib/rowan";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ county: string }>;
}): Promise<Metadata> {
  const county = (await params).county.toLowerCase();
  if (isRowanCounty(county)) {
    return {
      title: ROWAN_PAGE_TITLE,
      description:
        "Use Big Sandy Crime Watch to access the official Rowan County Detention Center inmate lookup and current JailTracker instructions.",
      alternates: { canonical: "/county/rowan" },
    };
  }

  return {
    title: `${county.charAt(0).toUpperCase() + county.slice(1)} County`,
    alternates: { canonical: `/county/${county}` },
  };
}

export default async function CountyPage({ params }: { params: Promise<{ county: string }> }) {
  const county = (await params).county.toLowerCase();
  const stored = await getDb().publicRecordDemo.findMany({
    where: { publishStatus: "PUBLISHED", county: { equals: county, mode: "insensitive" } },
    include: { charges: { orderBy: { displayOrder: "asc" } } },
    orderBy: publishedRecordOrder,
  });
  const records = stored.map(storedRecordToDemoRecord);
  const isRowan = isRowanCounty(county);

  return (
    <main>
      <p className="eyebrow">COUNTY DESK</p>
      <h1>{isRowan ? ROWAN_PAGE_TITLE : `${county} County`}</h1>

      {isRowan ? (
        <section className="content-card">
          <p>
            Looking for Rowan County Detention Center inmates? This page links to the
            official Rowan County JailTracker lookup for current inmates, mugshots,
            booking information, charges, and bond details when listed.
          </p>
          <p className="notice">
            Rowan JailTracker may ask for a short verification code before showing
            current inmates.
          </p>
          <div className="button-row">
            <a
              className="button"
              href={ROWAN_JAILTRACKER_URL}
              target="_blank"
              rel="noreferrer"
            >
              Open Rowan County JailTracker Inmate Lookup
            </a>
            <Link className="secondary-button" href="/last-72-hours">
              Browse regional public record updates
            </Link>
          </div>
          {records.length === 0 ? (
            <p>
              No locally imported Rowan records are published here yet. Use the official
              Rowan JailTracker lookup above.
            </p>
          ) : null}
        </section>
      ) : null}

      {records.length === 0 ? (
        isRowan ? null : <p>No published records are available for this county.</p>
      ) : (
        <div className="record-grid">
          {records.map((record: (typeof records)[number]) => (
            <RecordCard key={record.slug} record={record} />
          ))}
        </div>
      )}
    </main>
  );
}
