import { EdgarUnavailable } from "../../errors";
import { getJson } from "./http";
import { recentFilingsSchema, submissionsSchema } from "./schemas";
import { cikForSubmissionsUrl } from "./tickers";
import type { FilingsFile, RecentFilings, Submissions } from "./types";

const CACHE_TTL_MS = 15 * 60 * 1000; // 15min

// Caches promises, so concurrent requests for one CIK share a single download; failures are evicted.
const cache = new Map<string, { expiresAt: number; value: Promise<Submissions> }>();

const loadSubmissions = async (paddedCik: string): Promise<Submissions> => {
  const url = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;
  const parsed = submissionsSchema.safeParse(await getJson(url));
  if (!parsed.success) {
    throw new EdgarUnavailable(
      `EDGAR submissions for CIK${paddedCik} failed validation (shape changed): ${parsed.error.message}`,
    );
  }
  return parsed.data;
};

export const getSubmissions = (cik: string): Promise<Submissions> => {
  const paddedCik = cikForSubmissionsUrl(cik);
  const cached = cache.get(paddedCik);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = loadSubmissions(paddedCik);
  cache.set(paddedCik, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  value.catch(() => cache.delete(paddedCik));
  return value;
};

// filings.recent holds only the newest filings (at least a year's worth, or 1,000, whichever is
// more). Everything older lives in the files listed under filings.files; each of those documents
// is the same set of parallel arrays, directly at the top level (no "filings" wrapper).
const ARCHIVE_BASE = "https://data.sec.gov/submissions";

const archiveCache = new Map<string, { expiresAt: number; value: Promise<RecentFilings> }>();

const loadArchive = (name: string): Promise<RecentFilings> => {
  const cached = archiveCache.get(name);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = (async () => {
    const parsed = recentFilingsSchema.safeParse(await getJson(`${ARCHIVE_BASE}/${name}`));
    if (!parsed.success) {
      throw new EdgarUnavailable(
        `EDGAR archive ${name} failed validation (shape changed): ${parsed.error.message}`,
      );
    }
    return parsed.data;
  })();
  archiveCache.set(name, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  value.catch(() => archiveCache.delete(name));
  return value;
};

// Newest archive first, so callers searching for "the latest X" can stop at the first hit.
export const listArchiveFiles = (submissions: Submissions): FilingsFile[] =>
  [...submissions.filings.files].sort((a, b) => b.filingTo.localeCompare(a.filingTo));

type ArchiveChunkParams = { submissions: Submissions; file: FilingsFile };

// One archive file wrapped as a Submissions-shaped object so the normalizer can consume it unchanged.
export const getArchiveChunk = async ({ submissions, file }: ArchiveChunkParams): Promise<Submissions> => ({
  ...submissions,
  filings: { recent: await loadArchive(file.name), files: [] },
});

const COLUMNS = ["accessionNumber", "filingDate", "reportDate", "form", "primaryDocument"] as const;

// The complete history: we only process needed columns. Any failing archive fails the whole call, so history is
// never silently truncated.
export const getFullSubmissions = async (cik: string): Promise<Submissions> => {
  const submissions = await getSubmissions(cik);
  const archives = await Promise.all(listArchiveFiles(submissions).map((file) => loadArchive(file.name)));
  if (archives.length === 0) return submissions;

  const parts: RecentFilings[] = [submissions.filings.recent, ...archives];
  const merged = Object.fromEntries(
    COLUMNS.map((column) => [column, parts.flatMap((part) => part[column])]),
  ) as Pick<RecentFilings, (typeof COLUMNS)[number]>;
  return { ...submissions, filings: { ...submissions.filings, recent: merged } };
};

export const resetSubmissionsCache = (): void => {
  cache.clear();
  archiveCache.clear();
};
