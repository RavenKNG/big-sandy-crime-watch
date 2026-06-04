import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { officialSourceAdapterStatus } from "@/lib/importers";
import { getOfficialSourceStatuses } from "@/lib/official-source-status";
import type { MappingReport } from "@/lib/adapters/bsrdc-mapping-report";

export const dynamic = "force-dynamic";

async function getReport(name: string) {
  try {
    return JSON.parse(await readFile(join(process.cwd(), "work", name), "utf8")) as MappingReport;
  } catch {
    return undefined;
  }
}

export default async function ImportPage() {
  const [fileReport, fixtureReport, sourceStatuses] = await Promise.all([
    getReport("bsrdc-file-mapping-report.json"),
    getReport("bsrdc-mapping-report.json"),
    getOfficialSourceStatuses(),
  ]);
  const report = fileReport ?? fixtureReport;
  const automaticOfficialSourceEnabled =
    process.env.OFFICIAL_SOURCE_FETCH_ENABLED === "true" &&
    process.env.AUTO_IMPORT_OFFICIAL_RECORDS === "true" &&
    process.env.AUTO_PUBLISH_VALID_IMPORTED_RECORDS === "true";

  return (
    <main>
      <section className="content-card">
        <p className="eyebrow">REVIEWED OFFICIAL-SOURCE IMPORT</p>
        <h1>Reviewed arrest record intake</h1>
        <p>Automatic public-roster intake: <span className="pill">{automaticOfficialSourceEnabled ? "enabled" : "disabled"}</span></p>
        <p>The recurring worker imports valid official public-roster records, publishes their public detail pages, and queues Facebook drafts before posting the next due item.</p>
        <p>Place a human-reviewed <code>record.json</code> or <code>record.csv</code> file in a folder under <code>work/approved-imports</code>. Records are deduplicated and remain drafts unless reviewed auto-publishing is explicitly enabled.</p>
        <pre>npm run import:approved-folder -- --folder work/approved-imports/person-folder --move{"\n"}npm run reviewed-import:scan{"\n"}npm run bsrdc:map-file -- --file path-to-human-reviewed-local-snapshot.json</pre>

        <h2>BSRDC mapping dry-run</h2>
        <p className="notice">Dry-run mapping does not write to the database, publish records, download images, or queue Facebook posts.</p>
        <p>Adapter status: <span className="pill">{officialSourceAdapterStatus.enabled ? "enabled" : "disabled"}</span></p>
        <p>{officialSourceAdapterStatus.message}</p>
        {report ? <div className="admin-card"><h3>Last {fileReport ? "file-" : ""}mapping report</h3><p>{report.mode} - generated {report.generatedAt}</p><p>{report.rowsFound} rows, {report.detailPagesDetected} detail references, {report.chargeRows} charge rows.</p><p>Image status: {report.imageStatus}</p><p>Warnings: {report.warnings.length}</p></div> : <p>No mapping report generated on this server.</p>}

        <h2>Reviewed CSV columns</h2>
        <p>fullName, age, gender, city, countyArrested, state, intakeDate, bookingDateTimeText, bookingTimeKnown, arrestingAgency, arrestingOfficer, sourceName, sourceUrl, sourceTimestamp, sourceRecordId, imageUrl, offense, statute, chargeDescription, caseNumber</p>
        <p className="notice">Reviewed files remain available as a fallback ingestion boundary. Official-source automation is controlled by server environment flags.</p>

        <h2>Official source status</h2>
        {sourceStatuses.map((source: (typeof sourceStatuses)[number]) => (
          <div className="admin-card" key={source.slug}>
            <h3>{source.sourceName}</h3>
            <p>Automation enabled: <span className="pill">{source.automationEnabled ? "yes" : "no"}</span></p>
            <p>Type: {source.sourceType}</p>
            <p>Facility county: {source.facilityCounty}{source.facilityCity ? ` (${source.facilityCity})` : ""}</p>
            <p>Last import attempt: {source.lastAttemptAt?.toISOString() ?? "never"}</p>
            <p>Last successful import: {source.lastSuccessAt?.toISOString() ?? "never"}</p>
            <p>Records found: {source.recordsFound}</p>
            <p>Records created: {source.recordsCreated}</p>
            <p>Duplicates skipped: {source.recordsSkipped}</p>
            <p>Queued for Facebook: {source.recordsQueuedForFacebook}</p>
            <p>Detected counties: {source.detectedCounties.join(", ") || "none yet"}</p>
            <p>Detected agencies: {source.detectedAgencies.join(", ") || "none yet"}</p>
            <p>{source.message ?? "No current source warning."}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
