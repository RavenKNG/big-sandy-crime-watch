import { RecordCard } from "@/components/RecordCard";
import Link from "next/link";
import { counties as featuredCounties, countyDirectoryLabel } from "@/lib/content";
import { countySlug } from "@/lib/display-format";
import { getDb } from "@/lib/db";
import { dayBounds, publishedRecordOrder, storedRecordToDemoRecord } from "@/lib/record-display";

export const dynamic = "force-dynamic";

export default async function YesterdayPage() {
  const { start, end } = dayBounds(1);
  const stored = await getDb().publicRecordDemo.findMany({
    where: { publishStatus: "PUBLISHED", bookingDate: { gte: start, lt: end } },
    include: { charges: { orderBy: { displayOrder: "asc" } } },
    orderBy: publishedRecordOrder,
  });
  const records = stored.map(storedRecordToDemoRecord);
  const counties = [...new Set([...featuredCounties, ...records.map((record) => countySlug(record.county)).filter(Boolean)])];
  return <main><p className="eyebrow">YESTERDAY&apos;S PUBLIC RECORDS</p><h1>Yesterday&apos;s Big Sandy Regional Bookings</h1><div className="button-row"><Link className="secondary-button" href="/today">Today</Link><Link className="secondary-button" href="/county/rowan">Rowan lookup</Link></div>{counties.length>0&&<div className="filter-row">{counties.map((county: string)=><Link className="pill" href={`/county/${county}`} key={county}>{countyDirectoryLabel(county)}</Link>)}</div>}{records.length===0?<p>No published booking records are available for yesterday.</p>:<div className="record-grid">{records.map((record: (typeof records)[number])=><RecordCard record={record} key={record.slug}/>)}</div>}</main>;
}
