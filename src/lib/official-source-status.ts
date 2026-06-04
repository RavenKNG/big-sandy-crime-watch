import { getDb } from "./db";
import { officialSources } from "./official-sources";

type ImportRunJson = {
  skipped?: boolean;
  blocked?: boolean;
  reason?: string;
  found?: number;
  created?: number;
  updated?: number;
  duplicatesSkipped?: number;
  failed?: number;
  imagesSaved?: number;
  missingImages?: number;
  draftsCreated?: number;
  detectedCounties?: string[];
  detectedAgencies?: string[];
};

export async function getOfficialSourceStatuses() {
  const db = getDb();
  const runs = await db.sourceImportRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 100,
    select: {
      sourceName: true,
      startedAt: true,
      finishedAt: true,
      recordsFound: true,
      recordsCreated: true,
      recordsSkipped: true,
      errorsJson: true,
    },
  });

  return officialSources.map((source) => {
    const sourceRuns = runs.filter((run) => run.sourceName === source.sourceName);
    const lastAttempt = sourceRuns[0];
    const lastSuccess = sourceRuns.find((run) => {
      const payload = (run.errorsJson as ImportRunJson | null) ?? null;
      return payload && !payload.blocked && !payload.skipped && (payload.failed ?? 0) === 0;
    });
    const payload = (lastAttempt?.errorsJson as ImportRunJson | null) ?? null;

    return {
      slug: source.slug,
      sourceName: source.sourceName,
      sourceType: source.sourceType,
      sourceUrl: source.sourceUrl,
      facilityCounty: source.facilityCounty,
      facilityCity: source.facilityCity,
      regionLabel: source.regionLabel,
      automationEnabled: source.automationEnabled,
      message: payload?.reason ?? source.message ?? null,
      lastAttemptAt: lastAttempt?.startedAt ?? null,
      lastSuccessAt: lastSuccess?.finishedAt ?? null,
      recordsFound: payload?.found ?? lastAttempt?.recordsFound ?? 0,
      recordsCreated: payload?.created ?? lastAttempt?.recordsCreated ?? 0,
      recordsSkipped: payload?.duplicatesSkipped ?? lastAttempt?.recordsSkipped ?? 0,
      recordsQueuedForFacebook: payload?.draftsCreated ?? 0,
      detectedCounties: payload?.detectedCounties ?? [],
      detectedAgencies: payload?.detectedAgencies ?? [],
      blocked: Boolean(payload?.blocked),
      skipped: Boolean(payload?.skipped),
    };
  });
}
