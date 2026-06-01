import Link from "next/link";
import { bookingDisplayText } from "@/lib/record-display";
import type { DemoRecord } from "@/lib/types";
import { Mugshot } from "./Mugshot";

export function RecordCard({ record }: { record: DemoRecord }) {
  return (
    <article className="record-card">
      <Mugshot src={record.imageUrl} alt={`${record.displayName} booking image`} compact />
      <div>
        <p className="eyebrow">{record.county ? `${record.county} County - ` : ""}{bookingDisplayText(record)}</p>
        <h3>{record.displayName}</h3>
        {record.arrestingAgency && <p>{record.arrestingAgency}</p>}
        <p className="count">{record.charges.length} listed charge{record.charges.length === 1 ? "" : "s"}. View full booking details.</p>
        <Link className="button" href={`/records/${record.slug}`}>View Full Details</Link>
      </div>
    </article>
  );
}
