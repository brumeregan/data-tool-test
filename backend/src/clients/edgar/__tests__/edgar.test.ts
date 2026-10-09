import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EdgarUnavailable, TickerNotFound } from "../../../errors";
import { getSubmissions, resetSubmissionsCache } from "../submissions";
import { resetTickerCache, resolveTicker } from "../tickers";

const tickersFixture: unknown = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "company_tickers.json"), "utf8"),
);

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

const validSubmissions = {
  cik: "0000320193",
  name: "Apple Inc.",
  filings: {
    recent: {
      accessionNumber: ["0000320193-24-000123"],
      filingDate: ["2024-11-01"],
      reportDate: ["2024-09-28"],
      form: ["10-K"],
      primaryDocument: ["aapl-20240928.htm"],
    },
    files: [],
  },
};

const fetchMock = vi.fn();

beforeEach(() => {
  process.env.SEC_USER_AGENT = "Test test@example.com";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  resetTickerCache();
  resetSubmissionsCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveTicker", () => {
  it("returns the zero-padded CIK for a known ticker", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(tickersFixture));
    expect(await resolveTicker("AAPL")).toEqual({ cik: "0000320193", title: "Apple Inc." });
    expect(await resolveTicker("JPM")).toMatchObject({ cik: "0000019617" });
  });

  it("is case-insensitive and trims whitespace", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(tickersFixture));
    expect((await resolveTicker("aapl")).cik).toBe("0000320193");
    expect((await resolveTicker(" AAPL ")).cik).toBe("0000320193");
  });

  it("throws TickerNotFound for an unknown ticker", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(tickersFixture));
    await expect(resolveTicker("NOPE")).rejects.toBeInstanceOf(TickerNotFound);
  });

  it("downloads company_tickers.json only once, including concurrent calls", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(tickersFixture));
    await Promise.all([resolveTicker("AAPL"), resolveTicker("MSFT"), resolveTicker("spot")]);
    await resolveTicker("JPM");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends the User-Agent header", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(tickersFixture));
    await resolveTicker("AAPL");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ "User-Agent": "Test test@example.com" });
  });
});

describe("http error mapping", () => {
  it("maps a 403 response to EdgarUnavailable with the status", async () => {
    fetchMock.mockImplementation(async () => new Response("denied", { status: 403 }));
    const error = await resolveTicker("AAPL").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EdgarUnavailable);
    expect((error as Error).message).toContain("403");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once on 429 and then succeeds", async () => {
    fetchMock
      .mockImplementationOnce(async () => new Response("slow down", { status: 429 }))
      .mockImplementation(async () => jsonResponse(tickersFixture));
    expect((await resolveTicker("AAPL")).cik).toBe("0000320193");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("maps a network error to EdgarUnavailable", async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(resolveTicker("AAPL")).rejects.toBeInstanceOf(EdgarUnavailable);
  });
});

describe("getSubmissions", () => {
  it("returns validated submissions and caches per CIK", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(validSubmissions));
    const first = await getSubmissions("0000320193");
    await getSubmissions("0000320193");
    expect(first.name).toBe("Apple Inc.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://data.sec.gov/submissions/CIK0000320193.json");
  });

  it("throws EdgarUnavailable when the response fails zod validation", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ cik: "0000320193", name: "Apple" }));
    const error = await getSubmissions("0000320193").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EdgarUnavailable);
    expect((error as Error).message).toContain("validation");
  });
});
