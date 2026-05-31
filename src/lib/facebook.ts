import{formatDate}from"./content";import type{DemoRecord,NewsArticle}from"./types";
export const recordTemplates=[
"BOOKING UPDATE - BIG SANDY AREA","PUBLIC RECORD UPDATE - BIG SANDY AREA","NEW RECORD LISTING - BIG SANDY AREA","BIG SANDY AREA RECORD UPDATE","LOCAL PUBLIC RECORD UPDATE","BOOKING RECORD NOTICE - BIG SANDY AREA","BIG SANDY TRANSPARENCY UPDATE","RECENT BOOKING RECORD - BIG SANDY AREA","PUBLIC-SAFETY RECORD UPDATE","BIG SANDY AREA BOOKING NOTICE"
];
export const createRecordDraft=(r:DemoRecord,site="https://BigSandyCrimeWatch.com",templateIndex=0)=>`${recordTemplates[templateIndex%recordTemplates.length]}\n\n${r.displayName} appears in a synthetic public-record demo dated ${formatDate(r.recordDate)}.\n\nView the demo details:\n${site}/records/${r.slug}\n\nDemo fixture only. Charges are allegations. Individuals are presumed innocent unless proven guilty in court.`;
export const createArticleDraft=(a:NewsArticle,site="https://BigSandyCrimeWatch.com")=>`BIG SANDY PUBLIC-SAFETY UPDATE\n\n${a.title}\n\n${a.summary}\n\nRead more:\n${site}/news/${a.slug}`;
