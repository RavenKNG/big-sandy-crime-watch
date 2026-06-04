import{articles,demoRecords}from"./demo-data";import type{DemoRecord}from"./types";
export const innocenceNotice="Charges are allegations. Individuals are presumed innocent unless proven guilty in court.";
export const counties=["johnson","martin","magoffin","lawrence","pike","rowan"];export const categories=["bookings","drug-arrests","dui","public-intoxication","serious-charges","breaking-news","public-safety"];
export function slugify(v:string){return v.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")}
export function dedupeKey(r:DemoRecord){return`${slugify(r.displayName)}:${r.recordDate}:${r.charges.map(c=>slugify(c.offense)).sort().join(",")}`}
export const getPublishedRecords=()=>demoRecords.filter(r=>r.publishStatus==="PUBLISHED");export const getRecord=(s:string)=>demoRecords.find(r=>r.slug===s);export const getArticle=(s:string)=>articles.find(a=>a.slug===s);
export const formatDate=(v:string)=>new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(new Date(v));
export function categorize(r:DemoRecord){const t=r.charges.map(c=>`${c.offense} ${c.chargeDescription}`).join(" ").toLowerCase();return["bookings",...(t.includes("drug")?["drug-arrests"]:[]),...(t.includes("dui")?["dui"]:[]),...(t.includes("intox")?["public-intoxication"]:[])]}
