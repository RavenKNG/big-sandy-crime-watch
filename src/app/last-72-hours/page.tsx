import Link from "next/link";
import { AdSlot } from "@/components/AdSlot";
import { RecordCard } from "@/components/RecordCard";
import { counties as featuredCounties, countyDirectoryLabel } from "@/lib/content";
import { countySlug } from "@/lib/display-format";
import { getDb } from "@/lib/db";
import { last72HoursBounds, publishedRecordOrder, storedRecordToDemoRecord } from "@/lib/record-display";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Last 72 Hours of Big Sandy Regional Bookings", description: "Published Big Sandy regional booking records from the most recent three Eastern calendar days.", alternates: { canonical: "/last-72-hours" } };

export default async function Last72HoursPage() {
  const { start, end } = last72HoursBounds();
  const stored = await getDb().publicRecordDemo.findMany({
    where: { publishStatus: "PUBLISHED", bookingDate: { gte: start, lt: end } },
    include: { charges: { orderBy: { displayOrder: "asc" } } },
    orderBy: publishedRecordOrder,
  });
  const records = stored.map(storedRecordToDemoRecord);
  const counties = [...new Set([...featuredCounties, ...records.map((record) => countySlug(record.county)).filter(Boolean)])];
  return <main><p className="eyebrow">RECENT PUBLIC RECORDS</p><h1>Last 72 Hours of Big Sandy Regional Bookings</h1><p>{records.length} published {records.length===1?"record":"records"} from the most recent three Eastern calendar days, listed newest first.</p><div className="button-row"><Link className="secondary-button" href="/today">Today</Link><Link className="secondary-button" href="/county/rowan">Rowan lookup</Link></div>{counties.length>0&&<div className="filter-row">{counties.map((county: string)=><Link className="pill" href={`/county/${county}`} key={county}>{countyDirectoryLabel(county)}</Link>)}</div>}{records.length===0?<p>No published booking records are available for the last 72 hours.</p>:<div className="record-grid">{records.map((record: (typeof records)[number],index: number)=><div key={record.slug}><RecordCard record={record}/>{index===5&&<AdSlot placement="in-feed"/>}</div>)}</div>}<p className="notice">Charges are allegations. Individuals are presumed innocent unless proven guilty in court.</p></main>;
}
