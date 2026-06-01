import { RecordCard } from "@/components/RecordCard";
import { getDb } from "@/lib/db";
import { publishedRecordOrder, storedRecordToDemoRecord } from "@/lib/record-display";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const stored = await getDb().publicRecordDemo.findMany({
    where: { publishStatus: "PUBLISHED" },
    include: { charges: { orderBy: { displayOrder: "asc" } } },
    orderBy: publishedRecordOrder,
    take: 100,
  });
  const records = stored.map(storedRecordToDemoRecord);

  return <main><p className="eyebrow">PUBLIC RECORDS</p><h1>Browse published records</h1>{records.length === 0 ? <p>No published booking records are available.</p> : <div className="record-grid">{records.map((record) => <RecordCard key={record.slug} record={record} />)}</div>}</main>;
}
