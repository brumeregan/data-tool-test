import { EdgarUnavailable, TickerNotFound } from "../../errors";
import { getJson } from "./http";
import { companyTickersSchema } from "./schemas";
import type { ResolvedTicker } from "./types";

const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";

type TickerMap = Map<string, ResolvedTicker>;

let loading: Promise<TickerMap> | null = null;

export const cikForSubmissionsUrl = (cik: number | string): string =>
  String(cik).padStart(10, "0");

const loadTickers = async (): Promise<TickerMap> => {
  const data = await getJson(TICKERS_URL);
  const parsed = companyTickersSchema.safeParse(data);
  if (!parsed.success) {
    throw new EdgarUnavailable(
      `EDGAR company_tickers.json failed validation (shape changed): ${parsed.error.message}`,
    );
  }
  const map: TickerMap = new Map();
  for (const entry of Object.values(parsed.data)) {
    const key = entry.ticker.toUpperCase();
    if (!map.has(key))
      map.set(key, {
        cik: cikForSubmissionsUrl(entry.cik_str),
        title: entry.title,
      });
  }
  return map;
};

// Shares the in-flight promise so concurrent first calls trigger one download.
const getTickers = (): Promise<TickerMap> => {
  if (!loading) {
    loading = loadTickers().catch((error: unknown) => {
      loading = null;
      throw error;
    });
  }
  return loading;
};

export const resolveTicker = async (
  ticker: string,
): Promise<ResolvedTicker> => {
  const tickersMap = await getTickers();
  const found = tickersMap.get(ticker.trim().toUpperCase());
  if (!found) throw new TickerNotFound(ticker);
  return found;
};

export const resetTickerCache = (): void => {
  loading = null;
};
