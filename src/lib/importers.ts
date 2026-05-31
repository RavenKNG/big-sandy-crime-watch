import{dedupeKey,slugify}from"./content";import type{DemoRecord}from"./types";
export interface DemoImporter{name:string;import():Promise<DemoRecord[]>}
export function normalizeDraft(r:DemoRecord):DemoRecord{return{...r,slug:r.slug||`${slugify(r.displayName)}-${r.recordDate.slice(0,10)}`,publishStatus:"DRAFT"}}
export function dedupe(records:DemoRecord[]){const seen=new Set<string>();return records.filter(r=>{const k=dedupeKey(r);if(seen.has(k))return false;seen.add(k);return true})}
export class JsonFixtureImporter implements DemoImporter{name="synthetic-json-fixture";constructor(private records:DemoRecord[]){}async import(){return dedupe(this.records.map(normalizeDraft))}}
export const officialSourceAdapterStatus={enabled:false,message:"Disabled pending human legal and platform review. Implement as a separate adapter without changing the fixture importer contract."};
