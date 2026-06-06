import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { AdSlot } from "@/components/AdSlot";
import { Mugshot } from "@/components/Mugshot";
import { ensureBookingCardImages } from "@/lib/booking-card-generator";
import { getRecord, innocenceNotice } from "@/lib/content";
import { getDb } from "@/lib/db";
import { absoluteSiteUrl, countySlug, formatCountyLabel, formatCountyName } from "@/lib/display-format";
import { publicMugshotUrl } from "@/lib/mugshot-public";
import { findOfficialSourceByName } from "@/lib/official-sources";
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
    select: {
      slug: true,
      displayName: true,
      age: true,
      county: true,
      publishStatus: true,
      bookingDateTimeText: true,
      bookingTimeKnown: true,
      recordDate: true,
      arrestingAgency: true,
      sourceName: true,
      imageUrl: true,
      imageLocalPath: true,
    },
  });
  const fixture = process.env.NODE_ENV === "production" ? undefined : getRecord(slug);
  const name = stored?.publishStatus === "PUBLISHED" ? stored.displayName : fixture?.displayName;
  if (!name) return {};

  const county = stored?.county ? `${formatCountyLabel(stored.county)}, KY` : "the Big Sandy region of Kentucky";
  const description = `Booking information for ${name} in ${county}. County, full charges, and booking details are available from public source records. Individuals are presumed innocent unless proven guilty.`;
  let openGraphImage = publicMugshotUrl(stored?.imageUrl ?? stored?.imageLocalPath, process.env.SITE_URL);
  if (stored?.publishStatus === "PUBLISHED") {
    try {
      const cards = await ensureBookingCardImages(stored);
      openGraphImage = absoluteSiteUrl(cards.fullPath, process.env.SITE_URL);
    } catch {
      // Fall back to the legacy branded mugshot route if card generation fails.
    }
  }
  return {
    title: `${name} Booking Record - ${stored?.county ? `${formatCountyLabel(stored.county)}, KY` : "Big Sandy Region"}`,
    description,
    alternates: { canonical: `/records/${slug}` },
    openGraph: { title: `${name} Booking Record - Big Sandy Region`, description, url: `/records/${slug}`, type: "article", images: [{ url: openGraphImage }] },
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
          county: formatCountyName(stored.county) ?? "",
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
  const recordCountySlug = countySlug(record.county);
  const sourceInfo = findOfficialSourceByName(record.sourceName);
  let bookingCardImage: string | undefined;
  try {
    const cards = await ensureBookingCardImages({
      slug: record.slug,
      displayName: record.displayName,
      age: record.age,
      bookingDateTimeText: record.bookingDateTimeText,
      bookingTimeKnown: record.bookingTimeKnown,
      recordDate: record.recordDate,
      arrestingAgency: record.arrestingAgency,
      sourceName: record.sourceName,
      imageUrl: imageReference,
    });
    bookingCardImage = cards.fullPath;
  } catch {
    bookingCardImage = undefined;
  }

  return (
    <main>
      <article className="content-card">
        <p className="eyebrow">PUBLIC BOOKING RECORD</p>
        <h1>{record.displayName}</h1>
        {bookingCardImage ? (
          <div className="booking-report-card">
            <Image
              src={bookingCardImage}
              alt={`${record.displayName} booking report card`}
              width={1200}
              height={1200}
              sizes="(max-width: 800px) 100vw, 760px"
              priority
            />
          </div>
        ) : (
          <Mugshot src={imageReference} alt={`${record.displayName} booking image`} />
        )}

        <section className="booking-summary">
          <h2>Booking summary</h2>
          <p>
            <strong>Booking date:</strong> {bookingDisplayText(record)}
          </p>
          {record.age && <p><strong>Age:</strong> {record.age}</p>}
          {record.county && <p><strong>County:</strong> {formatCountyLabel(record.county)}</p>}
          {sourceInfo?.facilityCounty && formatCountyName(sourceInfo.facilityCounty) !== formatCountyName(record.county) && (
            <p><strong>Facility county:</strong> {formatCountyLabel(sourceInfo.facilityCounty)}</p>
          )}
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
          {record.charges.map((charge: (typeof record.charges)[number], index: number) => (
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
          {record.sourceUrl ? <p><a href={record.sourceUrl}>Open source link</a></p> : null}
          {sourceInfo?.facilityCounty ? <p>Facility county: {formatCountyLabel(sourceInfo.facilityCounty)}</p> : null}
        </section>
        <Link className="button" href={`/correction-request?record=${record.slug}`}>
          Request correction or de-index review
        </Link>

        <section className="related-records">
          <h2>Latest public records</h2>
          {record.county && recordCountySlug ? (
            <p>
              <Link className="county-link" href={`/county/${recordCountySlug}`}>
                Browse more {formatCountyLabel(record.county)} records
              </Link>
            </p>
          ) : null}
          {latest.map((item: (typeof latest)[number]) => (
            <p key={item.slug}>
              <Link href={`/records/${item.slug}`}>{item.displayName}{item.county?` - ${formatCountyLabel(item.county)}`:""}</Link>
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
