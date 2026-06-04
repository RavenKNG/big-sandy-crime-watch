import { articles, demoRecords } from "./demo-data";
import { formatCountyLabel } from "./display-format";
import type { DemoRecord } from "./types";

export const innocenceNotice =
  "Charges are allegations. Individuals are presumed innocent unless proven guilty in court.";

export const counties = ["johnson", "martin", "magoffin", "lawrence", "pike", "rowan"] as const;

export const categories = [
  "bookings",
  "drug-arrests",
  "dui",
  "public-intoxication",
  "serious-charges",
  "breaking-news",
  "public-safety",
] as const;

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function dedupeKey(record: DemoRecord) {
  return `${slugify(record.displayName)}:${record.recordDate}:${record.charges
    .map((charge) => slugify(charge.offense))
    .sort()
    .join(",")}`;
}

export const getPublishedRecords = () => demoRecords.filter((record) => record.publishStatus === "PUBLISHED");
export const getRecord = (slug: string) => demoRecords.find((record) => record.slug === slug);
export const getArticle = (slug: string) => articles.find((article) => article.slug === slug);

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

export const formatCounty = formatCountyLabel;

export function countyDirectoryLabel(county: string) {
  return county === "rowan" ? "Rowan County Detention Center Inmates" : formatCounty(county);
}

export function categorize(record: DemoRecord) {
  const haystack = record.charges
    .map((charge) => `${charge.offense} ${charge.chargeDescription}`)
    .join(" ")
    .toLowerCase();

  return [
    "bookings",
    ...(haystack.includes("drug") ? ["drug-arrests"] : []),
    ...(haystack.includes("dui") ? ["dui"] : []),
    ...(haystack.includes("intox") ? ["public-intoxication"] : []),
  ];
}
