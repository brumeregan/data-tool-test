import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Submissions } from "../../clients/edgar";
import { EdgarUnavailable, TickerNotFound } from "../../errors";

vi.mock("../../clients/edgar", () => ({
  resolveTicker: vi.fn(),
  getSubmissions: vi.fn(),
}));

import { createApp } from "../../app";
import { getSubmissions, resolveTicker } from "../../clients/edgar";

// Frozen clock: cutoff = 2025-10-09 (12 calendar months earlier, inclusive).
const NOW = "2026-10-09T12:00:00Z";
const CUTOFF = "2025-10-09";
const ELEVEN_MONTHS_AGO = "2025-11-09";
const THIRTEEN_MONTHS_AGO = "2025-09-09";
const DAY_BEFORE_CUTOFF = "2025-10-08";

type Row = { form: string; filingDate: string };

const makeSubmissions = ({ cik, name, rows }: { cik: string; name: string; rows: Row[] }): Submissions => ({
  cik,
  name,
  filings: {
    recent: {
      accessionNumber: rows.map((_, i) => `${cik}-26-${String(i).padStart(6, "0")}`),
      filingDate: rows.map((row) => row.filingDate),
      reportDate: rows.map(() => ""),
      form: rows.map((row) => row.form),
      primaryDocument: rows.map((row, i) => `doc${i}.htm`),
    },
    files: [],
  },
});

const COMPANIES: Record<string, { cik: string; name: string; rows: Row[] }> = {
  AAPL: {
    cik: "0000320193",
    name: "Apple Inc.",
    rows: [
      { form: "8-K", filingDate: ELEVEN_MONTHS_AGO },
      { form: "8-K", filingDate: THIRTEEN_MONTHS_AGO },
      { form: "10-K", filingDate: "2025-01-15" }, // outside the window, still the latest 10-K
      { form: "10-K", filingDate: "2023-11-03" },
    ],
  },
  SPOT: {
    cik: "0001639920",
    name: "Spotify Technology S.A.",
    rows: [
      { form: "6-K", filingDate: ELEVEN_MONTHS_AGO },
      { form: "20-F", filingDate: "2026-02-10" },
      { form: "20-F", filingDate: "2025-02-11" },
    ],
  },
  JPM: {
    cik: "0000019617",
    name: "JPMorgan Chase & Co",
    rows: [
      { form: "10-K/A", filingDate: "2026-06-01" },
      { form: "10-K", filingDate: "2026-02-20" },
    ],
  },
};

const app = createApp();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
  vi.mocked(resolveTicker).mockReset();
  vi.mocked(getSubmissions).mockReset();
  vi.mocked(resolveTicker).mockImplementation(async (ticker: string) => {
    const company = COMPANIES[ticker];
    if (!company) throw new TickerNotFound(ticker);
    return { cik: company.cik, title: company.name };
  });
  vi.mocked(getSubmissions).mockImplementation(async (cik: string) => {
    const company = Object.values(COMPANIES).find((c) => c.cik === cik);
    if (!company) throw new Error(`unexpected cik ${cik}`);
    return makeSubmissions(company);
  });
});

afterEach(() => {
  vi.useRealTimers();
});

type CompanyBody = {
  ticker: string;
  countsByForm: Record<string, number>;
  totalLast12Months: number;
  latest10K: { filingDate: string; documentUrl: string } | null;
  latestAnnualReport: { form: string; filingDate: string; documentUrl: string } | null;
};

const summarize = async (query: string) => request(app).get(`/filings/summary?${query}`);
const only = (body: { companies: CompanyBody[] }, ticker: string): CompanyBody => {
  const company = body.companies.find((c) => c.ticker === ticker);
  if (!company) throw new Error(`no ${ticker} in response`);
  return company;
};

describe("GET /filings/summary", () => {
  it("returns several tickers in one response, in request order", async () => {
    const res = await summarize("tickers=AAPL,SPOT,JPM");
    expect(res.status).toBe(200);
    expect(res.body.companies.map((c: CompanyBody) => c.ticker)).toEqual(["AAPL", "SPOT", "JPM"]);
    expect(res.body.errors).toEqual([]);
    expect(res.body.companies[0]).toMatchObject({ cik: "0000320193", name: "Apple Inc." });
  });

  it("counts only filings inside the 12-month window", async () => {
    const aapl = only((await summarize("tickers=AAPL")).body, "AAPL");
    // The 8-K 11 months ago counts; the 8-K 13 months ago and all 10-Ks are outside.
    expect(aapl.countsByForm).toEqual({ "8-K": 1 });
    expect(aapl.totalLast12Months).toBe(1);
  });

  it("includes a filing dated exactly on the cutoff day and excludes the day before", async () => {
    COMPANIES.AAPL.rows.push(
      { form: "4", filingDate: CUTOFF },
      { form: "SC 13G", filingDate: DAY_BEFORE_CUTOFF },
    );
    try {
      const aapl = only((await summarize("tickers=AAPL")).body, "AAPL");
      expect(aapl.countsByForm).toEqual({ "8-K": 1, "4": 1 });
      expect(aapl.totalLast12Months).toBe(2);
    } finally {
      COMPANIES.AAPL.rows.length -= 2;
    }
  });

  it("counts amendments as their own form key and sums the total", async () => {
    const jpm = only((await summarize("tickers=JPM")).body, "JPM");
    expect(jpm.countsByForm).toEqual({ "10-K/A": 1, "10-K": 1 });
    expect(jpm.totalLast12Months).toBe(2);
  });

  it("picks the most recent 10-K even when it is outside the window", async () => {
    const aapl = only((await summarize("tickers=AAPL")).body, "AAPL");
    expect(aapl.latest10K).toEqual({
      filingDate: "2025-01-15",
      documentUrl: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000002/doc2.htm",
    });
  });

  it("does not assume array order when picking the latest 10-K", async () => {
    COMPANIES.AAPL.rows.reverse();
    try {
      const aapl = only((await summarize("tickers=AAPL")).body, "AAPL");
      expect(aapl.latest10K?.filingDate).toBe("2025-01-15");
    } finally {
      COMPANIES.AAPL.rows.reverse();
    }
  });

  it("returns null latest10K with 200 for a foreign issuer and reports its 20-F", async () => {
    const res = await summarize("tickers=SPOT");
    expect(res.status).toBe(200);
    expect(res.body.errors).toEqual([]);
    const spot = only(res.body, "SPOT");
    expect(spot.latest10K).toBeNull();
    expect(spot.latestAnnualReport).toMatchObject({ form: "20-F", filingDate: "2026-02-10" });
    expect(spot.latestAnnualReport?.documentUrl).toMatch(/^https:\/\/www\.sec\.gov\/Archives\//);
  });

  it("does not mistake a 10-K/A for a 10-K", async () => {
    const jpm = only((await summarize("tickers=JPM")).body, "JPM");
    expect(jpm.latest10K?.filingDate).toBe("2026-02-20"); // not the newer 10-K/A from 2026-06-01
    expect(jpm.latestAnnualReport).toBeNull();

    COMPANIES.JPM.rows.pop();
    try {
      expect(only((await summarize("tickers=JPM")).body, "JPM").latest10K).toBeNull();
    } finally {
      COMPANIES.JPM.rows.push({ form: "10-K", filingDate: "2026-02-20" });
    }
  });

  it("reports an unknown ticker in errors[] while still returning 200 for the rest", async () => {
    const res = await summarize("tickers=AAPL,NOPE,JPM");
    expect(res.status).toBe(200);
    expect(res.body.companies.map((c: CompanyBody) => c.ticker)).toEqual(["AAPL", "JPM"]);
    expect(res.body.errors).toEqual([
      { ticker: "NOPE", code: "TICKER_NOT_FOUND", message: expect.stringContaining("NOPE") },
    ]);
  });

  it("maps an EDGAR failure for one ticker into errors[]", async () => {
    vi.mocked(getSubmissions).mockImplementation(async (cik: string) => {
      if (cik === COMPANIES.SPOT.cik) throw new EdgarUnavailable("EDGAR responded with HTTP 503");
      return makeSubmissions(COMPANIES.AAPL);
    });
    const res = await summarize("tickers=AAPL,SPOT");
    expect(res.status).toBe(200);
    expect(res.body.errors).toEqual([
      { ticker: "SPOT", code: "EDGAR_UNAVAILABLE", message: "EDGAR responded with HTTP 503" },
    ]);
  });

  it("returns 404 with the error envelope and errors[] when every ticker is unknown", async () => {
    const res = await summarize("tickers=NOPE,NADA");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TICKER_NOT_FOUND");
    expect(res.body.errors.map((e: { ticker: string; code: string }) => [e.ticker, e.code])).toEqual([
      ["NOPE", "TICKER_NOT_FOUND"],
      ["NADA", "TICKER_NOT_FOUND"],
    ]);
  });

  it("returns 502 when every ticker fails and at least one failure is an EDGAR outage", async () => {
    vi.mocked(getSubmissions).mockRejectedValue(new EdgarUnavailable("EDGAR responded with HTTP 503"));
    const res = await summarize("tickers=AAPL,NOPE");
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("EDGAR_UNAVAILABLE");
    expect(res.body.errors.map((e: { code: string }) => e.code)).toEqual([
      "EDGAR_UNAVAILABLE",
      "TICKER_NOT_FOUND",
    ]);
  });

  it("returns 500 when every ticker fails with an unexpected error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(getSubmissions).mockRejectedValue(new Error("boom"));
    const res = await summarize("tickers=AAPL");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(res.body.errors[0]).toMatchObject({ ticker: "AAPL", code: "INTERNAL_ERROR" });
    spy.mockRestore();
  });

  it("deduplicates tickers and fetches once per unique ticker", async () => {
    const res = await summarize("tickers=AAPL,aapl,%20AAPL%20,SPOT,AAPL");
    expect(res.status).toBe(200);
    expect(res.body.companies.map((c: CompanyBody) => c.ticker)).toEqual(["AAPL", "SPOT"]);
    expect(resolveTicker).toHaveBeenCalledTimes(2);
    expect(getSubmissions).toHaveBeenCalledTimes(2);
  });

  it("normalizes lowercase, whitespace and empty segments", async () => {
    const res = await summarize("tickers=%20aapl%20,,%20spot,");
    expect(res.status).toBe(200);
    expect(res.body.companies.map((c: CompanyBody) => c.ticker)).toEqual(["AAPL", "SPOT"]);
    expect(resolveTicker).toHaveBeenCalledWith("AAPL");
  });

  it("accepts exactly 10 unique tickers and applies the limit after deduplication", async () => {
    const ten = Array.from({ length: 10 }, (_, i) => `T${i}`);
    const ok = await summarize(`tickers=${[...ten, ...ten].join(",")}`);
    // 20 entries, 10 unique: passes validation (all are unknown, hence 404 with 10 errors, not 400).
    expect(ok.status).toBe(404);
    expect(ok.body.errors).toHaveLength(10);
  });

  it.each([
    ["more than 10 unique tickers", "tickers=A,B,C,D,E,F,G,H,I,J,K"],
    ["missing tickers", ""],
    ["empty tickers", "tickers="],
    ["only separators and whitespace", "tickers=%20,,%20"],
  ])("returns 400 INVALID_QUERY for %s, naming the field", async (_name, query) => {
    const res = await summarize(query);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_QUERY");
    expect(res.body.error.message).toContain("tickers");
    expect(resolveTicker).not.toHaveBeenCalled();
  });
});
