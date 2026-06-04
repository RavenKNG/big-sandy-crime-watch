import { RecordCard } from "@/components/RecordCard";
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
  return <main><p className="eyebrow">YESTERDAY&apos;S PUBLIC RECORDS</p><h1>Yesterday&apos;s Big Sandy Regional Bookings</h1>{records.length===0?<p>No published booking records are available for yesterday.</p>:<div className="record-grid">{records.map((record: (typeof records)[number])=><RecordCard record={record} key={record.slug}/>)}</div>}</main>;
}
