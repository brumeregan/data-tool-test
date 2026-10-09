import { z } from "zod";

export const filingsQuerySchema = z.object({
  form: z
    .string()
    .trim()
    .toUpperCase()
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(["asc", "desc"]).default("desc"),
});

export type FilingsQuery = z.infer<typeof filingsQuerySchema>;

export const MAX_SUMMARY_TICKERS = 10;

// Comma-separated list: trimmed, uppercased, empty segments dropped, deduplicated in first-seen order.
export const summaryQuerySchema = z.object({
  tickers: z
    .string()
    .transform((value) => [
      ...new Set(
        value
          .split(",")
          .map((ticker) => ticker.trim().toUpperCase())
          .filter((ticker) => ticker !== ""),
      ),
    ])
    .pipe(z.array(z.string()).min(1).max(MAX_SUMMARY_TICKERS)),
});

export type SummaryQuery = z.infer<typeof summaryQuerySchema>;
