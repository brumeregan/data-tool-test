import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Submissions } from "../../clients/edgar";
import {
  assertAlignedArrays,
  buildFilingUrls,
  filterByForm,
  normalizeFilings,
  paginate,
  sortByFilingDate,
} from "../normalize";
import type { Filing } from "../types";

// Real EDGAR response (trimmed); it was validated by the edgar client's schema when captured.
const loadFixture = (): Submissions =>
  JSON.parse(readFileSync(join(__dirname, "fixtures", "apple-submissions.json"), "utf8")) as Submissions;

const source = loadFixture();
const recent = source.filings.recent;
const filings = normalizeFilings(source);

const makeFiling = (overrides: Partial<Filing>): Filing => ({
  accessionNumber: "0000000000-00-000000",
  form: "8-K",
  filingDate: "2024-01-01",
  reportDate: null,
  primaryDocument: "doc.htm",
  documentUrl: "",
  filingIndexUrl: "",
  ...overrides,
});

describe("normalizeFilings", () => {
  it("returns one filing per index", () => {
    expect(filings).toHaveLength(recent.form.length);
    expect(filings).toHaveLength(10);
  });

  it("keeps form, date and accession number aligned to the same source index", () => {
    expect(filings[2]).toMatchObject({
      form: recent.form[2],
      filingDate: recent.filingDate[2],
      accessionNumber: recent.accessionNumber[2],
      primaryDocument: recent.primaryDocument[2],
    });
    filings.forEach((filing, i) => {
      expect(filing.accessionNumber).toBe(recent.accessionNumber[i]);
      expect(filing.form).toBe(recent.form[i]);
      expect(filing.filingDate).toBe(recent.filingDate[i]);
    });
  });

  it("preserves EDGAR's original ordering", () => {
    expect(filings.map((f) => f.accessionNumber)).toEqual(recent.accessionNumber);
  });

  it("builds the exact documentUrl for a known real 10-K", () => {
    const tenK = filings.find((f) => f.form === "10-K");
    expect(tenK?.documentUrl).toBe(
      "https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm",
    );
  });

  it("builds the exact filingIndexUrl for a known real 10-K", () => {
    const tenK = filings.find((f) => f.form === "10-K");
    expect(tenK?.filingIndexUrl).toBe(
      "https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/0000320193-25-000079-index.htm",
    );
  });

  it("strips CIK leading zeros in the archive path", () => {
    expect(source.cik).toBe("0000320193");
    for (const filing of filings) {
      expect(filing.documentUrl).toContain("/data/320193/");
      expect(filing.filingIndexUrl).toContain("/data/320193/");
      expect(filing.documentUrl).not.toContain("/0000320193/");
    }
  });

  it("converts an empty reportDate to null", () => {
    expect(recent.reportDate).toContain("");
    const empty = filings.filter((f) => f.reportDate === null);
    expect(empty).toHaveLength(recent.reportDate.filter((d) => d === "").length);
    expect(empty.length).toBeGreaterThan(0);
    expect(filings.some((f) => f.reportDate === "")).toBe(false);
  });

  it("falls back to the index URL when primaryDocument is empty", () => {
    const blank: Submissions = {
      ...source,
      filings: {
        ...source.filings,
        recent: { ...recent, primaryDocument: recent.primaryDocument.map(() => "") },
      },
    };
    const [first] = normalizeFilings(blank);
    expect(first.primaryDocument).toBe("");
    expect(first.documentUrl).toBe(first.filingIndexUrl);
    expect(first.documentUrl.endsWith("/")).toBe(false);
  });

  it("trims whitespace on string fields", () => {
    const padded: Submissions = {
      ...source,
      filings: {
        ...source.filings,
        recent: {
          ...recent,
          form: recent.form.map((f) => ` ${f} `),
          reportDate: recent.reportDate.map(() => "  "),
        },
      },
    };
    const [first] = normalizeFilings(padded);
    expect(first.form).toBe(recent.form[0]);
    expect(first.reportDate).toBeNull();
  });

  it("throws, naming the mismatch, when parallel arrays differ in length", () => {
    const broken: Submissions = {
      ...source,
      filings: {
        ...source.filings,
        recent: { ...recent, reportDate: recent.reportDate.slice(1) },
      },
    };
    expect(() => normalizeFilings(broken)).toThrow(/mismatched lengths.*reportDate=9/);
  });
});

describe("assertAlignedArrays", () => {
  it("returns the shared length", () => {
    expect(assertAlignedArrays({ a: [1, 2], b: ["x", "y"] })).toBe(2);
  });

  it("throws on mismatch and names every array", () => {
    expect(() => assertAlignedArrays({ a: [1, 2], b: ["x"] })).toThrow(/a=2, b=1/);
  });
});

describe("buildFilingUrls", () => {
  it("builds both URLs from the dashed accession number", () => {
    expect(
      buildFilingUrls({
        cik: "0000019617",
        accessionNumber: "0000019617-24-000123",
        primaryDocument: "x.htm",
      }),
    ).toEqual({
      documentUrl: "https://www.sec.gov/Archives/edgar/data/19617/000001961724000123/x.htm",
      filingIndexUrl:
        "https://www.sec.gov/Archives/edgar/data/19617/000001961724000123/0000019617-24-000123-index.htm",
    });
  });
});

describe("filterByForm", () => {
  const mixed = [
    makeFiling({ form: "10-K", accessionNumber: "a" }),
    makeFiling({ form: "10-K/A", accessionNumber: "b" }),
    makeFiling({ form: "10-Q", accessionNumber: "c" }),
    makeFiling({ form: "10-K", accessionNumber: "d" }),
  ];

  it("returns only exact matches and excludes 10-K/A by default", () => {
    const result = filterByForm({ filings: mixed, form: "10-K" });
    expect(result.map((f) => f.accessionNumber)).toEqual(["a", "d"]);
  });

  it("includes the amendment when includeAmendments is true", () => {
    const result = filterByForm({ filings: mixed, form: "10-K", includeAmendments: true });
    expect(result.map((f) => f.accessionNumber)).toEqual(["a", "b", "d"]);
  });

  it("works on the real fixture", () => {
    expect(filterByForm({ filings, form: "8-K" }).every((f) => f.form === "8-K")).toBe(true);
    expect(filterByForm({ filings, form: "8-K" }).length).toBeGreaterThanOrEqual(3);
    expect(filterByForm({ filings, form: "10-K" })).toHaveLength(1);
  });

  it("does not mutate its input", () => {
    const copy = [...mixed];
    filterByForm({ filings: mixed, form: "10-K" });
    expect(mixed).toEqual(copy);
  });
});

describe("sortByFilingDate", () => {
  const items = [
    makeFiling({ accessionNumber: "a", filingDate: "2024-03-01" }),
    makeFiling({ accessionNumber: "b", filingDate: "2024-01-01" }),
    makeFiling({ accessionNumber: "c", filingDate: "2024-03-01" }),
    makeFiling({ accessionNumber: "d", filingDate: "2024-02-01" }),
  ];

  it("sorts ascending, keeping ties in original order", () => {
    expect(sortByFilingDate(items, "asc").map((f) => f.accessionNumber)).toEqual(["b", "d", "a", "c"]);
  });

  it("sorts descending, keeping ties in original order", () => {
    expect(sortByFilingDate(items, "desc").map((f) => f.accessionNumber)).toEqual(["a", "c", "d", "b"]);
  });

  it("does not mutate its input", () => {
    const before = items.map((f) => f.accessionNumber);
    sortByFilingDate(items, "asc");
    expect(items.map((f) => f.accessionNumber)).toEqual(before);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 25 }, (_, i) => i);

  it("returns the requested page with totals", () => {
    expect(paginate({ items, page: 2, limit: 10 })).toEqual({
      items: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
      total: 25,
      page: 2,
      limit: 10,
      totalPages: 3,
    });
  });

  it("returns a partial last page", () => {
    expect(paginate({ items, page: 3, limit: 10 }).items).toEqual([20, 21, 22, 23, 24]);
  });

  it("returns empty items but correct totals for a page past the end", () => {
    expect(paginate({ items, page: 9, limit: 10 })).toEqual({
      items: [],
      total: 25,
      page: 9,
      limit: 10,
      totalPages: 3,
    });
  });

  it("handles an empty list", () => {
    expect(paginate({ items: [], page: 1, limit: 10 })).toMatchObject({ items: [], total: 0, totalPages: 0 });
  });

  it("rejects invalid page or limit", () => {
    expect(() => paginate({ items, page: 0, limit: 10 })).toThrow(RangeError);
    expect(() => paginate({ items, page: 1, limit: 0 })).toThrow(RangeError);
    expect(() => paginate({ items, page: 1.5, limit: 10 })).toThrow(RangeError);
  });
});
