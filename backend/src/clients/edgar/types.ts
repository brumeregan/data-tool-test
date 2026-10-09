import type { z } from "zod";
import type {
  companyTickersSchema,
  filingsFileSchema,
  recentFilingsSchema,
  submissionsSchema,
  tickerEntrySchema,
} from "./schemas";

export type TickerEntry = z.infer<typeof tickerEntrySchema>;
export type CompanyTickers = z.infer<typeof companyTickersSchema>;
export type RecentFilings = z.infer<typeof recentFilingsSchema>;
export type FilingsFile = z.infer<typeof filingsFileSchema>;
export type Submissions = z.infer<typeof submissionsSchema>;
export type ResolvedTicker = { cik: string; title: string };
