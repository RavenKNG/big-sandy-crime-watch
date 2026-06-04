import { RecordCard } from "@/components/RecordCard";
import Link from "next/link";
import { counties, countyDirectoryLabel } from "@/lib/content";
import { getDb } from "@/lib/db";
import { publishedRecordOrder, storedRecordToDemoRecord } from "@/lib/record-display";

export const dynamic = "force-dynamic";

export default async function SearchPage({searchParams}:{searchParams:Promise<{q?:string;county?:string;agency?:string}>}) {
  const filters=await searchParams;
  const q=filters.q?.trim()||"";
  const county=filters.county?.trim()||"";
  const agency=filters.agency?.trim()||"";
  const stored = await getDb().publicRecordDemo.findMany({
    where: { publishStatus: "PUBLISHED", ...(q?{displayName:{contains:q,mode:"insensitive" as const}}:{}), ...(county?{county:{equals:county,mode:"insensitive" as const}}:{}), ...(agency?{arrestingAgency:{contains:agency,mode:"insensitive" as const}}:{}) },
    include: { charges: { orderBy: { displayOrder: "asc" } } },
    orderBy: publishedRecordOrder,
    take: 100,
  });
  const records = stored.map(storedRecordToDemoRecord);

  return <main><p className="eyebrow">PUBLIC RECORDS</p><h1>Search published booking records</h1><form className="search-panel"><label>Name<input name="q" defaultValue={q} placeholder="Search by name"/></label><label>County<input name="county" defaultValue={county} placeholder="Filter by county"/></label><label>Agency<input name="agency" defaultValue={agency} placeholder="Filter by arresting agency"/></label><button type="submit">Search records</button></form><div className="filter-row">{counties.map((entry)=><Link className="pill" href={`/county/${entry}`} key={entry}>{countyDirectoryLabel(entry)}</Link>)}</div><p>{records.length} published {records.length===1?"record":"records"} found. <Link className="county-link" href="/search">Clear filters</Link></p>{records.length === 0 ? <p>No published booking records match those filters.</p> : <div className="record-grid">{records.map((record: (typeof records)[number]) => <RecordCard key={record.slug} record={record} />)}</div>}</main>;
}
