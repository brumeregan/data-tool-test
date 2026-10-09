import { EdgarUnavailable } from "../../errors";
import { getJson } from "./http";
import { submissionsSchema } from "./schemas";
import { padCik } from "./tickers";
import type { Submissions } from "./types";

const CACHE_TTL_MS = 15 * 60 * 1000;

const cache = new Map<string, { expiresAt: number; value: Submissions }>();

export const getSubmissions = async (cik: string): Promise<Submissions> => {
  const paddedCik = padCik(cik);
  const cached = cache.get(paddedCik);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const url = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;
  const parsed = submissionsSchema.safeParse(await getJson(url));
  if (!parsed.success) {
    throw new EdgarUnavailable(
      `EDGAR submissions for CIK${paddedCik} failed validation (shape changed): ${parsed.error.message}`,
    );
  }
  cache.set(paddedCik, { expiresAt: Date.now() + CACHE_TTL_MS, value: parsed.data });
  return parsed.data;
};

export const resetSubmissionsCache = (): void => {
  cache.clear();
};
