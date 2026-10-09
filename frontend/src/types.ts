// Hand-written to mirror the backend's GET /companies/:ticker/filings contract.
export type Filing = {
  accessionNumber: string;
  form: string;
  filingDate: string;
  reportDate: string | null;
  primaryDocument: string;
  documentUrl: string;
  filingIndexUrl: string;
};

export type Company = {
  ticker: string;
  cik: string;
  name: string;
};

export type SortDirection = 'asc' | 'desc';

export type FilingsResponse = {
  company: Company;
  items: Filing[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  availableForms: string[];
};

export type FilingsQuery = {
  ticker: string;
  form: string;
  page: number;
  limit: number;
  sort: SortDirection;
};

// Mirrors the backend's GET /filings/summary contract. Foreign private issuers have latest10K: null
// and carry their 20-F/40-F in latestAnnualReport (the backend uses this instead of a free-text note).
export type SummaryCompany = {
  ticker: string;
  cik: string;
  name: string;
  countsByForm: Record<string, number>;
  totalLast12Months: number;
  latest10K: { filingDate: string; documentUrl: string } | null;
  latestAnnualReport: { form: string; filingDate: string; documentUrl: string } | null;
};

export type TickerError = {
  ticker: string;
  code: string;
  message: string;
};

export type SummaryResponse = {
  companies: SummaryCompany[];
  errors: TickerError[];
};
