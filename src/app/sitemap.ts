import type { MetadataRoute } from "next";
import { articles } from "@/lib/demo-data";
import { categories, counties } from "@/lib/content";
import { getDb } from "@/lib/db";

const base = "https://BigSandyCrimeWatch.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = process.env.DATABASE_URL ? getDb() : null;
  const [saved, dynamicCounties] = db
    ? await Promise.all([
        db.publicRecordDemo.findMany({
          where: { publishStatus: "PUBLISHED" },
          select: { slug: true, updatedAt: true },
        }),
        db.publicRecordDemo.findMany({
          where: { publishStatus: "PUBLISHED", county: { not: null } },
          select: { county: true },
          distinct: ["county"],
        }),
      ])
    : [[], []];

  const countySlugs = [
    ...new Set([
      ...counties,
      ...dynamicCounties
        .map((county: (typeof dynamicCounties)[number]) => county.county?.toLowerCase())
        .filter((county: string | undefined): county is string => Boolean(county)),
    ]),
  ];

  return [
    { url: base },
    { url: `${base}/today` },
    { url: `${base}/yesterday` },
    { url: `${base}/last-72-hours` },
    { url: `${base}/disclaimer` },
    { url: `${base}/correction-request` },
    { url: `${base}/contact` },
    { url: `${base}/privacy` },
    { url: `${base}/search` },
    ...articles.map((article: (typeof articles)[number]) => ({
      url: `${base}/news/${article.slug}`,
    })),
    ...saved.map((record: (typeof saved)[number]) => ({
      url: `${base}/records/${record.slug}`,
      lastModified: record.updatedAt,
    })),
    ...countySlugs.map((county: string) => ({ url: `${base}/county/${county}` })),
    ...categories.map((category: (typeof categories)[number]) => ({
      url: `${base}/category/${category}`,
    })),
  ];
}
