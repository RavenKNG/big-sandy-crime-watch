import { RecordCard } from "@/components/RecordCard";
import Link from "next/link";
import { counties, countyDirectoryLabel } from "@/lib/content";
import { formatCountyLabel } from "@/lib/display-format";
import { getDb } from "@/lib/db";
import { getFeaturedCountyPage } from "@/lib/featured-county-pages";
import { publishedRecordOrder, storedRecordToDemoRecord } from "@/lib/record-display";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ county: string }>;
}): Promise<Metadata> {
  const county = (await params).county.toLowerCase();
  const featuredCounty = getFeaturedCountyPage(county);
  if (featuredCounty) {
    return {
      title: featuredCounty.pageTitle,
      description: featuredCounty.description,
      alternates: { canonical: `/county/${featuredCounty.countySlug}` },
    };
  }

  return {
    title: formatCountyLabel(county),
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
  const featuredCounty = getFeaturedCountyPage(county);

  return (
    <main>
      <p className="eyebrow">COUNTY DESK</p>
      <h1>{featuredCounty?.pageTitle ?? formatCountyLabel(county)}</h1>

      {featuredCounty ? (
        <section className="content-card">
          <p>{featuredCounty.intro}</p>
          <p className="notice">{featuredCounty.notice}</p>
          <div className="button-row">
            <a
              className="button"
              href={featuredCounty.lookupUrl}
              target="_blank"
              rel="noreferrer"
            >
              {featuredCounty.lookupButtonText}
            </a>
            <Link className="secondary-button" href="/last-72-hours">
              Browse regional public record updates
            </Link>
            <Link
              className="secondary-button"
              href={`/search?county=${encodeURIComponent(formatCountyLabel(featuredCounty.countySlug))}`}
            >
              {featuredCounty.searchLabel}
            </Link>
          </div>
          {records.length === 0 ? (
            <p>{featuredCounty.emptyState}</p>
          ) : null}
        </section>
      ) : null}

      {records.length === 0 ? (
        featuredCounty ? null : <p>No published records are available for this county.</p>
      ) : (
        <div className="record-grid">
          {records.map((record: (typeof records)[number]) => (
            <RecordCard key={record.slug} record={record} />
          ))}
        </div>
      )}
      <section className="content-card source-directory">
        <p className="eyebrow">COUNTY DIRECTORY</p>
        <h2>Browse county pages</h2>
        <div className="filter-row">
          {counties.map((entry) => (
            <Link className="pill" href={`/county/${entry}`} key={entry}>
              {countyDirectoryLabel(entry)}
            </Link>
          ))}
        </div>
      </section>
      <p className="policy-links">
        <Link href="/today">Today</Link> | <Link href="/last-72-hours">Last 72 Hours</Link> |{" "}
        <Link href="/search">Search</Link> | <Link href="/correction-request">Correction requests</Link>
      </p>
    </main>
  );
}
