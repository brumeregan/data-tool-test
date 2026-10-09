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
