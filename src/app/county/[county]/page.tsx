import { RecordCard } from "@/components/RecordCard";
import { getDb } from "@/lib/db";
import { publishedRecordOrder, storedRecordToDemoRecord } from "@/lib/record-display";

export const dynamic = "force-dynamic";

export default async function CountyPage({ params }: { params: Promise<{ county: string }> }) {
  const county = (await params).county;
  const stored = await getDb().publicRecordDemo.findMany({
    where: { publishStatus: "PUBLISHED", county: { equals: county, mode: "insensitive" } },
    include: { charges: { orderBy: { displayOrder: "asc" } } },
    orderBy: publishedRecordOrder,
  });
  const records = stored.map(storedRecordToDemoRecord);

  return <main><p className="eyebrow">COUNTY DESK</p><h1>{county} County</h1>{records.length === 0 ? <p>No published records are available for this county.</p> : <div className="record-grid">{records.map((record) => <RecordCard key={record.slug} record={record} />)}</div>}</main>;
}
