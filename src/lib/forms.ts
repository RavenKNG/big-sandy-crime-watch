import { z } from "zod";

export const recordFormSchema = z.object({
  displayName: z.string().trim().min(2),
  county: z.string().trim().min(2),
  recordDate: z.string().min(1),
  sourceName: z.string().trim().min(2),
  sourceUrl: z.string().trim().url().or(z.literal("")),
  sourceTimestamp: z.string().min(1),
  imageUrl: z.string().trim().or(z.literal("")),
  complianceNotes: z.string().trim().min(5),
  charges: z.string().trim().min(2),
});

export function parseChargeLines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, displayOrder) => {
    const [offense, statute = "", chargeDescription = offense] = line.split("|").map((part) => part.trim());
    return { offense, statute: statute || null, chargeDescription, displayOrder };
  });
}

export const correctionFormSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  requestType: z.enum(["CORRECTION", "HIDE", "DEINDEX", "EXPUNGEMENT", "OTHER"]),
  relatedUrl: z.string().trim().url().or(z.literal("")),
  message: z.string().trim().min(10),
});
