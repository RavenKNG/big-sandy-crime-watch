import { RecordCard } from "@/components/RecordCard";
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

  return <main><p className="eyebrow">TODAY&apos;S PUBLIC RECORDS</p><h1>Today&apos;s arrests</h1><p>Published booking records are listed newest first. Records with an unknown booking time appear after records with a known time.</p>{records.length === 0 ? <p>No published booking records are available for today.</p> : <div className="record-grid">{records.map((record) => <RecordCard key={record.slug} record={record} />)}</div>}</main>;
}
