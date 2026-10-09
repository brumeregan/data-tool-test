import { getFullSubmissions, resolveTicker } from "../clients/edgar";
import { filterByForm, normalizeFilings, paginate, sortByFilingDate } from "./normalize";
import type { Filing, Page, SortDirection } from "./types";

type GetFilingsParams = {
  ticker: string;
  form?: string;
  page: number;
  limit: number;
  sort: SortDirection;
};

export type FilingsResult = Page<Filing> & {
  company: { ticker: string; cik: string; name: string };
  availableForms: string[];
};

export const getFilings = async ({
  ticker,
  form,
  page,
  limit,
  sort,
}: GetFilingsParams): Promise<FilingsResult> => {
  const { cik } = await resolveTicker(ticker);
  // Full history (recent + archive files) so total, availableForms and filters cover every filing.
  const submissions = await getFullSubmissions(cik);
  const all = normalizeFilings(submissions);

  // Computed before filtering so the dropdown always lists every form the company has filed.
  const availableForms = [...new Set(all.map((filing) => filing.form))].sort();

  const filtered = form === undefined ? all : filterByForm({ filings: all, form });
  const sorted = sortByFilingDate(filtered, sort);

  return {
    company: { ticker: ticker.trim().toUpperCase(), cik, name: submissions.name },
    availableForms,
    ...paginate({ items: sorted, page, limit }),
  };
};
