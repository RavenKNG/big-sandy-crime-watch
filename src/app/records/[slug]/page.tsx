import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AdSlot } from "@/components/AdSlot";
import { Mugshot } from "@/components/Mugshot";
import { getRecord, innocenceNotice } from "@/lib/content";
import { getDb } from "@/lib/db";
import { bookingDisplayText, publishedRecordOrder } from "@/lib/record-display";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const slug = (await params).slug;
  const stored = await getDb().publicRecordDemo.findUnique({
    where: { slug },
    select: { displayName: true, county: true, publishStatus: true },
  });
  const fixture = process.env.NODE_ENV === "production" ? undefined : getRecord(slug);
  const name = stored?.publishStatus === "PUBLISHED" ? stored.displayName : fixture?.displayName;
  if (!name) return {};

  const county = stored?.county ? `${stored.county} County, KY` : "the Big Sandy region of Kentucky";
  const description = `Booking information for ${name} in ${county}. County, full charges, and booking details are available from public source records. Individuals are presumed innocent unless proven guilty.`;
  return {
    title: `${name} Booking Record - ${stored?.county ? `${stored.county} County, KY` : "Big Sandy Region"}`,
    description,
    alternates: { canonical: `/records/${slug}` },
    openGraph: { title: `${name} Booking Record - Big Sandy Region`, description, url: `/records/${slug}`, type: "article" },
  };
}

export default async function RecordPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const stored = await getDb().publicRecordDemo.findUnique({
    where: { slug },
    include: { charges: { orderBy: { displayOrder: "asc" } } },
  });
  const fixture = process.env.NODE_ENV === "production" ? undefined : getRecord(slug);
  const record =
    stored?.publishStatus === "PUBLISHED"
      ? {
          ...stored,
          recordDate: stored.recordDate.toISOString(),
          sourceTimestamp: stored.sourceTimestamp.toISOString(),
          county: stored.county ?? "",
          city: stored.city ?? undefined,
          state: stored.state ?? undefined,
          status: stored.status ?? "",
          arrestingAgency: stored.arrestingAgency ?? undefined,
          arrestingOfficer: stored.arrestingOfficer ?? undefined,
          bookingDateTimeText: stored.bookingDateTimeText ?? undefined,
          bookingTimeKnown: stored.bookingTimeKnown,
          charges: stored.charges,
        }
      : fixture;

  if (!record || ("publishStatus" in record && record.publishStatus !== "PUBLISHED")) notFound();

  const latest = await getDb().publicRecordDemo.findMany({
    where: { publishStatus: "PUBLISHED", slug: { not: slug } },
    select: { slug: true, displayName: true, county: true },
    orderBy: publishedRecordOrder,
    take: 3,
  });
  const imageReference = record.imageUrl ?? ("imageLocalPath" in record ? record.imageLocalPath ?? undefined : undefined);

  return (
    <main>
      <article className="content-card">
        <p className="eyebrow">PUBLIC BOOKING RECORD</p>
        <h1>{record.displayName}</h1>
        <Mugshot src={imageReference} alt={`${record.displayName} booking image`} />

        <section className="booking-summary">
          <h2>Booking summary</h2>
          <p>
            <strong>Booking date:</strong> {bookingDisplayText(record)}
          </p>
          {record.age && <p><strong>Age:</strong> {record.age}</p>}
          {record.county && <p><strong>County:</strong> {record.county}</p>}
          {"city" in record && record.city && <p><strong>City:</strong> {record.city}</p>}
          {"state" in record && record.state && <p><strong>State:</strong> {record.state}</p>}
          {"arrestingAgency" in record && record.arrestingAgency && (
            <p><strong>Arresting agency:</strong> {record.arrestingAgency}</p>
          )}
          {"arrestingOfficer" in record && record.arrestingOfficer && (
            <p><strong>Arresting officer:</strong> {record.arrestingOfficer}</p>
          )}
        </section>

        <AdSlot placement="detail-before-charges" />

        <section className="charges-box">
          <h2>Charges Listed</h2>
          {record.charges.map((charge, index) => (
            <div className="charge" key={`${charge.offense}-${index}`}>
              <strong>{charge.offense}</strong>
              <p>{charge.chargeDescription}</p>
              {charge.statute && <span className="pill">{charge.statute}</span>}
            </div>
          ))}
        </section>

        <p className="notice">{innocenceNotice}</p>
        <section className="charge">
          <h2>Source attribution</h2>
          <p>
            Source: {record.sourceName}
            <br />
            Timestamp: {new Date(record.sourceTimestamp).toISOString()}
          </p>
        </section>
        <Link className="button" href={`/correction-request?record=${record.slug}`}>
          Request correction or de-index review
        </Link>

        <section className="related-records">
          <h2>Latest public records</h2>
          {record.county&&<p><Link className="county-link" href={`/county/${record.county.toLowerCase()}`}>Browse more {record.county} County records</Link></p>}
          {latest.map((item) => (
            <p key={item.slug}>
              <Link href={`/records/${item.slug}`}>{item.displayName}{item.county?` - ${item.county} County`:""}</Link>
            </p>
          ))}
          <p><Link href="/today">Browse today&apos;s regional bookings</Link></p>
          <p><Link href="/last-72-hours">Browse the last 72 hours</Link></p>
        </section>

        <AdSlot placement="detail-lower" />
      </article>
    </main>
  );
}
