import Link from "next/link";
import { countySlug, formatCountyLabel } from "@/lib/display-format";
import { bookingDisplayText } from "@/lib/record-display";
import type { DemoRecord } from "@/lib/types";
import { Mugshot } from "./Mugshot";

export function RecordCard({ record }: { record: DemoRecord }) {
  const countyLabel = formatCountyLabel(record.county);
  const countyHref = countySlug(record.county);

  return (
    <article className="record-card">
      <Mugshot src={record.imageUrl} alt={`${record.displayName} booking image`} compact />
      <div className="record-card-body">
        <p className="eyebrow">{bookingDisplayText(record)}</p>
        <h3>{record.displayName}</h3>
        <div className="record-meta-row">
          {countyLabel && countyHref ? (
            <Link className="pill county-pill" href={`/county/${countyHref}`}>
              {countyLabel}
            </Link>
          ) : null}
          {record.sourceName ? <span className="pill source-pill">{record.sourceName.replace(" Public Roster", "")}</span> : null}
        </div>
        {record.arrestingAgency && <p className="record-agency">{record.arrestingAgency}</p>}
        <div className="record-card-footer">
          <p className="count">Full booking details available.</p>
          <Link className="button" href={`/records/${record.slug}`}>View full booking details</Link>
        </div>
      </div>
    </article>
  );
}
