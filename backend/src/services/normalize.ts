import type { Submissions } from "../clients/edgar";
import type { Filing, Page, SortDirection } from "./types";

const ARCHIVE_BASE = "https://www.sec.gov/Archives/edgar/data";

const stripLeadingZeros = (cik: string): string => cik.trim().replace(/^0+(?=\d)/, "");

type BuildUrlsParams = { cik: string; accessionNumber: string; primaryDocument: string };

export const buildFilingUrls = ({
  cik,
  accessionNumber,
  primaryDocument,
}: BuildUrlsParams): { documentUrl: string; filingIndexUrl: string } => {
  const folder = `${ARCHIVE_BASE}/${stripLeadingZeros(cik)}/${accessionNumber.replaceAll("-", "")}`;
  const filingIndexUrl = `${folder}/${accessionNumber}-index.htm`;
  // An empty primaryDocument would yield a trailing-slash URL with no file.
  const documentUrl = primaryDocument === "" ? filingIndexUrl : `${folder}/${primaryDocument}`;
  return { documentUrl, filingIndexUrl };
};

export const assertAlignedArrays = (arrays: Record<string, readonly unknown[]>): number => {
  const lengths = Object.entries(arrays).map(([name, values]) => `${name}=${values.length}`);
  const expected = Object.values(arrays)[0]?.length ?? 0;
  if (Object.values(arrays).some((values) => values.length !== expected)) {
    throw new Error(`filings.recent arrays have mismatched lengths: ${lengths.join(", ")}`);
  }
  return expected;
};

// Zips the columnar filings.recent arrays into one Filing per index, in EDGAR's original order.
export const normalizeFilings = (submissions: Submissions): Filing[] => {
  const { accessionNumber, form, filingDate, reportDate, primaryDocument } =
    submissions.filings.recent;
  const count = assertAlignedArrays({
    accessionNumber,
    form,
    filingDate,
    reportDate,
    primaryDocument,
  });

  return Array.from({ length: count }, (_, i): Filing => {
    const accession = accessionNumber[i].trim();
    const document = primaryDocument[i].trim();
    const report = reportDate[i].trim();
    return {
      accessionNumber: accession,
      form: form[i].trim(),
      filingDate: filingDate[i].trim(),
      reportDate: report === "" ? null : report,
      primaryDocument: document,
      ...buildFilingUrls({
        cik: submissions.cik,
        accessionNumber: accession,
        primaryDocument: document,
      }),
    };
  });
};

type FilterByFormParams = {
  filings: readonly Filing[];
  form: string;
  // Default false: "10-K" means original 10-K filings only. An amendment (10-K/A) is a
  // different form type, and including it by default would double-count a fiscal year.
  includeAmendments?: boolean;
};

export const filterByForm = ({
  filings,
  form,
  includeAmendments = false,
}: FilterByFormParams): Filing[] => {
  const wanted = form.trim();
  return filings.filter(
    (filing) => filing.form === wanted || (includeAmendments && filing.form === `${wanted}/A`),
  );
};

// Array.prototype.sort is stable, so equal dates keep their original relative order.
export const sortByFilingDate = (
  filings: readonly Filing[],
  direction: SortDirection,
): Filing[] => {
  const sign = direction === "asc" ? 1 : -1;
  return [...filings].sort((a, b) => sign * a.filingDate.localeCompare(b.filingDate));
};

type PaginateParams<T> = { items: readonly T[]; page: number; limit: number };

export const paginate = <T>({ items, page, limit }: PaginateParams<T>): Page<T> => {
  if (!Number.isInteger(page) || page < 1) throw new RangeError(`page must be an integer >= 1, got ${page}`);
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError(`limit must be an integer >= 1, got ${limit}`);
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    total: items.length,
    page,
    limit,
    totalPages: Math.ceil(items.length / limit),
  };
};
