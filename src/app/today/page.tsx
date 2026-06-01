import { RecordCard } from "@/components/RecordCard";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { publishedRecordOrder, storedRecordToDemoRecord, todayBounds } from "@/lib/record-display";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const { start, end } = todayBounds();
  const stored = await getDb().publicRecordDemo.findMany({
    where: { publishStatus: "PUBLISHED", bookingDate: { gte: start, lt: end } },
    include: { charges: { orderBy: { displayOrder: "asc" } } },
    orderBy: publishedRecordOrder,
  });
  const records = stored.map(storedRecordToDemoRecord);
  const counties = [...new Set(records.map((record) => record.county).filter(Boolean))].sort();

  return <main><p className="eyebrow">TODAY&apos;S PUBLIC RECORDS</p><h1>Today&apos;s Big Sandy Regional Bookings</h1><p>{new Date().toLocaleDateString("en-US",{dateStyle:"long"})}. Published records are listed newest first. Records with an unknown booking time appear after records with a known time.</p>{counties.length>0&&<div className="filter-row">{counties.map((county)=><Link className="pill" href={`/county/${county.toLowerCase()}`} key={county}>{county} County</Link>)}</div>}{records.length === 0 ? <p>No published booking records are available for today.</p> : <div className="record-grid">{records.map((record) => <RecordCard key={record.slug} record={record} />)}</div>}<p className="notice">Charges are allegations. Individuals are presumed innocent unless proven guilty in court.</p></main>;
}
