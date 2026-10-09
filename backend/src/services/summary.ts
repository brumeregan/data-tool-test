import { getSubmissions, resolveTicker } from "../clients/edgar";
import { AllTickersFailed, EdgarUnavailable, TickerNotFound } from "../errors";
import type { TickerError } from "../errors";
import { normalizeFilings } from "./normalize";
import type { Filing } from "./types";

export type CompanySummary = {
  ticker: string;
  cik: string;
  name: string;
  countsByForm: Record<string, number>;
  totalLast12Months: number;
  latest10K: { filingDate: string; documentUrl: string } | null;
  // Foreign private issuers (e.g. Spotify) file 20-F / 40-F instead of a 10-K. A structured field
  // (rather than a free-text note) lets clients render or filter on it without parsing prose.
  latestAnnualReport: { form: string; filingDate: string; documentUrl: string } | null;
};

export type SummaryResult = { companies: CompanySummary[]; errors: TickerError[] };

const FOREIGN_ANNUAL_FORMS: readonly string[] = ["20-F", "40-F"];

const pad = (value: number): string => String(value).padStart(2, "0");

// ISO date (UTC) exactly 12 calendar months before `now`; Feb 29 clamps to Feb 28.
export const twelveMonthsAgo = (now: Date): string => {
  const year = now.getUTCFullYear() - 1;
  const month = now.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(now.getUTCDate(), daysInMonth);
  return `${year}-${pad(month + 1)}-${pad(day)}`;
};

// Most recent by filingDate; ties keep the first one encountered (EDGAR order).
const latestOf = (filings: readonly Filing[]): Filing | undefined =>
  filings.reduce<Filing | undefined>(
    (best, filing) => (best === undefined || filing.filingDate > best.filingDate ? filing : best),
    undefined,
  );

type SummarizeParams = { ticker: string; cutoff: string };

const summarizeCompany = async ({ ticker, cutoff }: SummarizeParams): Promise<CompanySummary> => {
  const { cik } = await resolveTicker(ticker);
  const submissions = await getSubmissions(cik);
  const filings = normalizeFilings(submissions);

  // Boundary is inclusive: a filing dated exactly on the cutoff day counts. ISO dates compare lexically.
  const countsByForm: Record<string, number> = {};
  for (const filing of filings) {
    if (filing.filingDate >= cutoff) countsByForm[filing.form] = (countsByForm[filing.form] ?? 0) + 1;
  }
  const totalLast12Months = Object.values(countsByForm).reduce((sum, count) => sum + count, 0);

  // Searched over the full history; exact match so a 10-K/A is never mistaken for a 10-K.
  const tenK = latestOf(filings.filter((filing) => filing.form === "10-K"));
  const annual = latestOf(filings.filter((filing) => FOREIGN_ANNUAL_FORMS.includes(filing.form)));

  return {
    ticker,
    cik,
    name: submissions.name,
    countsByForm,
    totalLast12Months,
    latest10K: tenK ? { filingDate: tenK.filingDate, documentUrl: tenK.documentUrl } : null,
    latestAnnualReport: annual
      ? { form: annual.form, filingDate: annual.filingDate, documentUrl: annual.documentUrl }
      : null,
  };
};

const toTickerError = (ticker: string, reason: unknown): TickerError => {
  if (reason instanceof TickerNotFound) {
    return { ticker, code: "TICKER_NOT_FOUND", message: reason.message };
  }
  if (reason instanceof EdgarUnavailable) {
    return { ticker, code: "EDGAR_UNAVAILABLE", message: reason.message };
  }
  console.error(reason);
  return { ticker, code: "INTERNAL_ERROR", message: "Unexpected server error" };
};

const allFailedStatus = (errors: readonly TickerError[]): { status: number; code: string } => {
  if (errors.every((error) => error.code === "TICKER_NOT_FOUND")) {
    return { status: 404, code: "TICKER_NOT_FOUND" };
  }
  if (errors.some((error) => error.code === "EDGAR_UNAVAILABLE")) {
    return { status: 502, code: "EDGAR_UNAVAILABLE" };
  }
  return { status: 500, code: "INTERNAL_ERROR" };
};

// `tickers` must already be normalized and deduplicated (see summaryQuerySchema).
export const getFilingsSummary = async (tickers: readonly string[]): Promise<SummaryResult> => {
  const cutoff = twelveMonthsAgo(new Date()); // computed once so every company uses the same window
  const settled = await Promise.allSettled(
    tickers.map((ticker) => summarizeCompany({ ticker, cutoff })),
  );

  const companies: CompanySummary[] = [];
  const errors: TickerError[] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") companies.push(result.value);
    else errors.push(toTickerError(tickers[i], result.reason));
  });

  if (companies.length === 0) throw new AllTickersFailed({ ...allFailedStatus(errors), errors });
  return { companies, errors };
};
