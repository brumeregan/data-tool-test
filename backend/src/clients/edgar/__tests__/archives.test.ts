import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EdgarUnavailable } from "../../../errors";
import type { Submissions } from "../types";
import {
  getArchiveChunk,
  getFullSubmissions,
  listArchiveFiles,
  resetSubmissionsCache,
} from "../submissions";

const columns = (prefix: string, forms: string[], dates: string[]) => ({
  accessionNumber: forms.map((_, i) => `${prefix}-${i}`),
  filingDate: dates,
  reportDate: forms.map(() => ""),
  form: forms,
  primaryDocument: forms.map((_, i) => `${prefix}-${i}.htm`),
});

const NEW_FILE = { name: "CIK0000320193-submissions-002.json", filingCount: 2, filingFrom: "2020-01-01", filingTo: "2023-12-31" };
const OLD_FILE = { name: "CIK0000320193-submissions-001.json", filingCount: 1, filingFrom: "1995-01-01", filingTo: "2019-12-31" };

// Real shape: the main document wraps columns in filings.recent; archive files are bare columns.
// The extra "items" array stands in for the other parallel arrays EDGAR ships.
const mainDoc: Submissions = {
  cik: "0000320193",
  name: "Apple Inc.",
  filings: {
    recent: { ...columns("recent", ["10-K", "8-K"], ["2025-10-31", "2025-08-01"]), items: ["", "2.02"] },
    files: [OLD_FILE, NEW_FILE], // listed oldest-first on purpose
  },
};
const newArchive = { ...columns("new", ["10-Q", "10-K"], ["2023-08-04", "2022-10-28"]), items: ["", ""] };
const oldArchive = { ...columns("old", ["10-K"], ["1996-12-01"]), items: [""] };

const fetchMock = vi.fn();
const urls = () => fetchMock.mock.calls.map(([url]) => String(url));

const serve = (overrides: Record<string, () => Response> = {}) =>
  fetchMock.mockImplementation(async (url: string) => {
    const override = overrides[url];
    if (override) return override();
    if (url.endsWith("CIK0000320193.json")) return new Response(JSON.stringify(mainDoc));
    if (url.endsWith(NEW_FILE.name)) return new Response(JSON.stringify(newArchive));
    if (url.endsWith(OLD_FILE.name)) return new Response(JSON.stringify(oldArchive));
    return new Response("not found", { status: 404 });
  });

beforeEach(() => {
  process.env.SEC_USER_AGENT = "Test test@example.com";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  resetSubmissionsCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listArchiveFiles", () => {
  it("orders archive files newest first regardless of listing order", () => {
    const files = listArchiveFiles(mainDoc);
    expect(files.map((f) => f.name)).toEqual([NEW_FILE.name, OLD_FILE.name]);
  });
});

describe("getFullSubmissions", () => {
  it("merges recent and every archive file, recent first, then newest archive to oldest", async () => {
    serve();
    const full = await getFullSubmissions("0000320193");
    const { recent } = full.filings;
    expect(recent.form).toEqual(["10-K", "8-K", "10-Q", "10-K", "10-K"]);
    expect(recent.filingDate).toEqual(["2025-10-31", "2025-08-01", "2023-08-04", "2022-10-28", "1996-12-01"]);
    expect(recent.accessionNumber).toEqual(["recent-0", "recent-1", "new-0", "new-1", "old-0"]);
    expect(urls()).toEqual(
      expect.arrayContaining([
        "https://data.sec.gov/submissions/CIK0000320193.json",
        `https://data.sec.gov/submissions/${NEW_FILE.name}`,
        `https://data.sec.gov/submissions/${OLD_FILE.name}`,
      ]),
    );
  });

  it("keeps all five columns the same length, dropping unmerged extra arrays", async () => {
    serve();
    const { recent } = (await getFullSubmissions("0000320193")).filings;
    const lengths = [recent.accessionNumber, recent.filingDate, recent.reportDate, recent.form, recent.primaryDocument].map((c) => c.length);
    expect(new Set(lengths)).toEqual(new Set([5]));
    expect(recent).not.toHaveProperty("items");
  });

  it("makes no archive request when the company has no archive files", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ...mainDoc, filings: { ...mainDoc.filings, files: [] } })));
    const full = await getFullSubmissions("0000320193");
    expect(full.filings.recent.form).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("downloads each file once across repeated and concurrent calls", async () => {
    serve();
    await Promise.all([getFullSubmissions("0000320193"), getFullSubmissions("0000320193")]);
    await getFullSubmissions("0000320193");
    expect(fetchMock).toHaveBeenCalledTimes(3); // main + 2 archives
  });

  it("fails the whole call, never returning truncated history, when an archive is unavailable", async () => {
    serve({ [`https://data.sec.gov/submissions/${OLD_FILE.name}`]: () => new Response("busy", { status: 503 }) });
    await expect(getFullSubmissions("0000320193")).rejects.toBeInstanceOf(EdgarUnavailable);
  });

  it("retries a failed archive on the next call instead of caching the failure", async () => {
    serve({ [`https://data.sec.gov/submissions/${OLD_FILE.name}`]: () => new Response("nope", { status: 403 }) });
    await expect(getFullSubmissions("0000320193")).rejects.toBeInstanceOf(EdgarUnavailable);
    serve();
    expect((await getFullSubmissions("0000320193")).filings.recent.form).toHaveLength(5);
  });

  it("throws a validation EdgarUnavailable when an archive changes shape", async () => {
    serve({ [`https://data.sec.gov/submissions/${NEW_FILE.name}`]: () => new Response(JSON.stringify({ form: ["10-K"] })) });
    const error = await getFullSubmissions("0000320193").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EdgarUnavailable);
    expect((error as Error).message).toContain("validation");
  });
});

describe("getArchiveChunk", () => {
  it("wraps one archive file as a Submissions-shaped object for the normalizer", async () => {
    serve();
    const chunk = await getArchiveChunk({ submissions: mainDoc, file: OLD_FILE });
    expect(chunk.cik).toBe("0000320193");
    expect(chunk.filings.recent.form).toEqual(["10-K"]);
    expect(chunk.filings.files).toEqual([]);
  });
});
