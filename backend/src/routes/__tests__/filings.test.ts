import { readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Submissions } from "../../clients/edgar";
import { EdgarUnavailable, TickerNotFound } from "../../errors";

vi.mock("../../clients/edgar", () => ({
  resolveTicker: vi.fn(),
  getSubmissions: vi.fn(),
}));

import { createApp } from "../../app";
import { getSubmissions, resolveTicker } from "../../clients/edgar";

// Real trimmed Apple submissions: 10 filings (4 x2, 144, 10-Q, 8-K x5, 10-K), newest first.
const apple = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "services", "__tests__", "fixtures", "apple-submissions.json"), "utf8"),
) as Submissions;

const app = createApp();

beforeEach(() => {
  vi.mocked(resolveTicker).mockReset();
  vi.mocked(getSubmissions).mockReset();
  vi.mocked(resolveTicker).mockImplementation(async (ticker: string) => {
    if (ticker.trim().toUpperCase() !== "AAPL") throw new TickerNotFound(ticker);
    return { cik: "0000320193", title: "Apple Inc." };
  });
  vi.mocked(getSubmissions).mockResolvedValue(apple);
});

describe("GET /companies/:ticker/filings", () => {
  it("returns 200 with the full envelope", async () => {
    const res = await request(app).get("/companies/aapl/filings");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      company: { ticker: "AAPL", cik: "0000320193", name: "Apple Inc." },
      total: 10,
      page: 1,
      limit: 25,
      totalPages: 1,
    });
    expect(res.body.items).toHaveLength(10);
    expect(res.body.items[0]).toEqual({
      accessionNumber: apple.filings.recent.accessionNumber[0],
      form: apple.filings.recent.form[0],
      filingDate: apple.filings.recent.filingDate[0],
      reportDate: apple.filings.recent.reportDate[0],
      primaryDocument: apple.filings.recent.primaryDocument[0],
      documentUrl: expect.stringMatching(/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/320193\//),
      filingIndexUrl: expect.stringMatching(/-index\.htm$/),
    });
    expect(res.body.availableForms).toEqual(["10-K", "10-Q", "144", "4", "8-K"]);
  });

  it("applies defaults: page 1, limit 25, sort desc", async () => {
    const res = await request(app).get("/companies/AAPL/filings");
    expect(res.body).toMatchObject({ page: 1, limit: 25 });
    const dates: string[] = res.body.items.map((f: { filingDate: string }) => f.filingDate);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("narrows by form (case-insensitive) and total reflects the filtered count", async () => {
    const res = await request(app).get("/companies/AAPL/filings?form=%208-k%20");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
    expect(res.body.items).toHaveLength(5);
    expect(res.body.items.every((f: { form: string }) => f.form === "8-K")).toBe(true);
  });

  it("returns 200 with empty items for a form the company never filed", async () => {
    const res = await request(app).get("/companies/AAPL/filings?form=20-F");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ items: [], total: 0, totalPages: 0 });
  });

  it("sorts ascending and descending", async () => {
    const asc = await request(app).get("/companies/AAPL/filings?sort=asc");
    const desc = await request(app).get("/companies/AAPL/filings?sort=desc");
    const ascDates: string[] = asc.body.items.map((f: { filingDate: string }) => f.filingDate);
    const descDates: string[] = desc.body.items.map((f: { filingDate: string }) => f.filingDate);
    expect(ascDates).toEqual([...ascDates].sort());
    expect(descDates).toEqual([...descDates].sort().reverse());
    expect(ascDates[0]).toBe(descDates[descDates.length - 1]);
  });

  it("slices by page and limit", async () => {
    const res = await request(app).get("/companies/AAPL/filings?limit=4&page=2&sort=desc");
    expect(res.body).toMatchObject({ page: 2, limit: 4, total: 10, totalPages: 3 });
    expect(res.body.items.map((f: { accessionNumber: string }) => f.accessionNumber)).toEqual(
      apple.filings.recent.accessionNumber.slice(4, 8),
    );
  });

  it("returns empty items with full totals for a page past the end", async () => {
    const res = await request(app).get("/companies/AAPL/filings?limit=4&page=9");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ items: [], total: 10, page: 9, limit: 4, totalPages: 3 });
  });

  it("computes availableForms before filtering", async () => {
    const unfiltered = await request(app).get("/companies/AAPL/filings");
    const filtered = await request(app).get("/companies/AAPL/filings?form=10-K");
    expect(filtered.body.total).toBe(1);
    expect(filtered.body.availableForms).toEqual(unfiltered.body.availableForms);
  });

  it.each([
    ["limit above 100", "limit=101", "limit"],
    ["limit 0", "limit=0", "limit"],
    ["page 0", "page=0", "page"],
    ["negative page", "page=-1", "page"],
    ["non-integer page", "page=1.5", "page"],
    ["non-numeric page", "page=abc", "page"],
    ["bad sort", "sort=sideways", "sort"],
  ])("returns 400 for %s, naming the field", async (_name, query, field) => {
    const res = await request(app).get(`/companies/AAPL/filings?${query}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_QUERY");
    expect(res.body.error.message).toContain(field);
  });

  it("returns 404 TICKER_NOT_FOUND for an unknown ticker", async () => {
    const res = await request(app).get("/companies/NOPE/filings");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TICKER_NOT_FOUND");
    expect(typeof res.body.error.message).toBe("string");
  });

  it("returns 502 EDGAR_UNAVAILABLE when the client fails", async () => {
    vi.mocked(getSubmissions).mockRejectedValue(new EdgarUnavailable("EDGAR responded with HTTP 503"));
    const res = await request(app).get("/companies/AAPL/filings");
    expect(res.status).toBe(502);
    expect(res.body).toEqual({
      error: { code: "EDGAR_UNAVAILABLE", message: "EDGAR responded with HTTP 503" },
    });
  });

  it("keeps /health working", async () => {
    expect((await request(app).get("/health")).body).toEqual({ status: "ok" });
  });
});
