export type Filing = {
  accessionNumber: string;
  form: string;
  filingDate: string;
  reportDate: string | null;
  primaryDocument: string;
  documentUrl: string;
  filingIndexUrl: string;
};

export type SortDirection = "asc" | "desc";

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
