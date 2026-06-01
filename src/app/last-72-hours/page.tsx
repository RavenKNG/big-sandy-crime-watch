import Link from "next/link";
import { AdSlot } from "@/components/AdSlot";
import { RecordCard } from "@/components/RecordCard";
import { getDb } from "@/lib/db";
import { last72HoursBounds, publishedRecordOrder, storedRecordToDemoRecord } from "@/lib/record-display";

export const dynamic = "force-dynamic";

export default async function Last72HoursPage() {
  const { start, end } = last72HoursBounds();
  const stored = await getDb().publicRecordDemo.findMany({
    where: { publishStatus: "PUBLISHED", bookingDate: { gte: start, lt: end } },
    include: { charges: { orderBy: { displayOrder: "asc" } } },
    orderBy: publishedRecordOrder,
  });
  const records = stored.map(storedRecordToDemoRecord);
  const counties = [...new Set(records.map((record) => record.county).filter(Boolean))].sort();
  return <main><p className="eyebrow">RECENT PUBLIC RECORDS</p><h1>Last 72 Hours</h1><p>Recent Big Sandy regional bookings are listed newest first.</p>{counties.length>0&&<div className="filter-row">{counties.map((county)=><Link className="pill" href={`/county/${county.toLowerCase()}`} key={county}>{county} County</Link>)}</div>}{records.length===0?<p>No published booking records are available for the last 72 hours.</p>:<div className="record-grid">{records.map((record,index)=><div key={record.slug}><RecordCard record={record}/>{index===5&&<AdSlot placement="in-feed"/>}</div>)}</div>}<p className="notice">Charges are allegations. Individuals are presumed innocent unless proven guilty in court.</p></main>;
}
