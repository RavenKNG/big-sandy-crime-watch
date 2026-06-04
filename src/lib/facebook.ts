import { createFacebookRecordCaption } from "./facebook-record-caption";
import type { DemoRecord, NewsArticle } from "./types";

export const recordTemplates = [
  "BIG SANDY REGIONAL BOOKING UPDATE",
  "REGIONAL PUBLIC RECORD UPDATE",
  "NEW BIG SANDY BOOKING RECORD",
  "BIG SANDY REGIONAL RECORD UPDATE",
  "LOCAL PUBLIC RECORD UPDATE",
  "REGIONAL BOOKING RECORD NOTICE",
  "BIG SANDY TRANSPARENCY UPDATE",
  "RECENT REGIONAL BOOKING RECORD",
  "PUBLIC-SAFETY RECORD UPDATE",
  "BIG SANDY BOOKING NOTICE",
];

export const createRecordDraft = (
  record: DemoRecord,
  site = "https://bigsandycrimewatch.com",
  templateIndex = 0,
) =>
  `${createFacebookRecordCaption(record, `${site}/records/${record.slug}`).replace(
    "BIG SANDY REGIONAL BOOKING UPDATE",
    recordTemplates[templateIndex % recordTemplates.length],
  )}\n\nDemo fixture only. This is a synthetic public-record demo.`;

export const createArticleDraft = (article: NewsArticle, site = "https://bigsandycrimewatch.com") =>
  `BIG SANDY PUBLIC-SAFETY UPDATE\n\n${article.title}\n\n${article.summary}\n\nRead more:\n${site}/news/${article.slug}`;
