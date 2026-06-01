import{createFacebookRecordCaption}from"./facebook-record-caption";import type{DemoRecord,NewsArticle}from"./types";
export const recordTemplates=[
"BOOKING UPDATE - BIG SANDY AREA","PUBLIC RECORD UPDATE - BIG SANDY AREA","NEW RECORD LISTING - BIG SANDY AREA","BIG SANDY AREA RECORD UPDATE","LOCAL PUBLIC RECORD UPDATE","BOOKING RECORD NOTICE - BIG SANDY AREA","BIG SANDY TRANSPARENCY UPDATE","RECENT BOOKING RECORD - BIG SANDY AREA","PUBLIC-SAFETY RECORD UPDATE","BIG SANDY AREA BOOKING NOTICE"
];
export const createRecordDraft=(r:DemoRecord,site="https://BigSandyCrimeWatch.com",templateIndex=0)=>`${createFacebookRecordCaption(r,`${site}/records/${r.slug}`).replace("BOOKING UPDATE - BIG SANDY AREA",recordTemplates[templateIndex%recordTemplates.length])}\n\nDemo fixture only. This is a synthetic public-record demo.`;
export const createArticleDraft=(a:NewsArticle,site="https://BigSandyCrimeWatch.com")=>`BIG SANDY PUBLIC-SAFETY UPDATE\n\n${a.title}\n\n${a.summary}\n\nRead more:\n${site}/news/${a.slug}`;
