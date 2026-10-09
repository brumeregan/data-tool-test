import { z } from "zod";

// company_tickers.json is an object keyed by stringified index, not an array.
export const tickerEntrySchema = z.object({
  cik_str: z.number().int().nonnegative(),
  ticker: z.string(),
  title: z.string(),
});

export const companyTickersSchema = z.record(z.string(), tickerEntrySchema);

export const recentFilingsSchema = z.looseObject({
  accessionNumber: z.array(z.string()),
  filingDate: z.array(z.string()),
  reportDate: z.array(z.string()),
  form: z.array(z.string()),
  primaryDocument: z.array(z.string()),
});

export const filingsFileSchema = z.looseObject({
  name: z.string(),
  filingCount: z.number(),
  filingFrom: z.string(),
  filingTo: z.string(),
});

export const submissionsSchema = z.looseObject({
  cik: z.string(),
  name: z.string(),
  filings: z.looseObject({
    recent: recentFilingsSchema,
    files: z.array(filingsFileSchema),
  }),
});
