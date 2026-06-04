import { RecordCard } from "@/components/RecordCard";
import { AdSlot } from "@/components/AdSlot";
import Link from "next/link";
import { counties as featuredCounties, countyDirectoryLabel } from "@/lib/content";
import { countySlug } from "@/lib/display-format";
import { getDb } from "@/lib/db";
import { publishedRecordOrder, storedRecordToDemoRecord, todayBounds } from "@/lib/record-display";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Today's Big Sandy Regional Bookings", description: "Today's published Big Sandy regional booking records, listed newest first with county and booking details.", alternates: { canonical: "/today" } };

export default async function TodayPage() {
  const { start, end } = todayBounds();
  const stored = await getDb().publicRecordDemo.findMany({
    where: { publishStatus: "PUBLISHED", bookingDate: { gte: start, lt: end } },
    include: { charges: { orderBy: { displayOrder: "asc" } } },
    orderBy: publishedRecordOrder,
  });
  const records = stored.map(storedRecordToDemoRecord);
  const counties = [...new Set([...featuredCounties, ...records.map((record) => countySlug(record.county)).filter(Boolean)])];

  return <main><p className="eyebrow">TODAY&apos;S PUBLIC RECORDS</p><h1>Today&apos;s Big Sandy Regional Bookings</h1><p>{new Date().toLocaleDateString("en-US",{dateStyle:"long"})}. {records.length} published {records.length===1?"record":"records"}. Newest first; records with an unknown booking time appear after records with a known time.</p><div className="button-row"><Link className="secondary-button" href="/yesterday">Yesterday</Link><Link className="secondary-button" href="/last-72-hours">Last 72 Hours</Link><Link className="secondary-button" href="/county/rowan">Rowan lookup</Link></div>{counties.length>0&&<div className="filter-row">{counties.map((county: string)=><Link className="pill" href={`/county/${county}`} key={county}>{countyDirectoryLabel(county)}</Link>)}</div>}{records.length === 0 ? <p>No published booking records are available for today.</p> : <div className="record-grid">{records.map((record: (typeof records)[number], index: number) => <div key={record.slug}><RecordCard record={record} />{index === 5 && <AdSlot placement="in-feed" />}</div>)}</div>}<p className="notice">Charges are allegations. Individuals are presumed innocent unless proven guilty in court.</p></main>;
}
