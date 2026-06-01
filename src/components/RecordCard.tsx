import Link from "next/link";
import { bookingDisplayText } from "@/lib/record-display";
import type { DemoRecord } from "@/lib/types";
import { Mugshot } from "./Mugshot";

export function RecordCard({ record }: { record: DemoRecord }) {
  return (
    <article className="record-card">
      <Mugshot src={record.imageUrl} alt={`${record.displayName} booking image`} compact />
      <div>
        <p className="eyebrow">{bookingDisplayText(record)}</p>
        <h3>{record.displayName}</h3>
        {record.county && <p><Link className="county-link" href={`/county/${record.county.toLowerCase()}`}>{record.county} County</Link></p>}
        {record.arrestingAgency && <p>{record.arrestingAgency}</p>}
        <p className="count">Full booking details available.</p>
        <Link className="button" href={`/records/${record.slug}`}>View full booking details</Link>
      </div>
    </article>
  );
}
