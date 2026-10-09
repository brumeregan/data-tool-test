import type { FilingsQuery, FilingsResponse, SummaryResponse, TickerError } from './types';

type ErrorBody = { error?: { code?: string; message?: string }; errors?: TickerError[] };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  // Per-ticker failures the backend attaches when every ticker in a summary request fails.
  readonly tickerErrors: TickerError[];

  constructor({
    status,
    code,
    message,
    tickerErrors = [],
  }: {
    status: number;
    code: string | null;
    message: string;
    tickerErrors?: TickerError[];
  }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.tickerErrors = tickerErrors;
  }
}

const readErrorBody = async (response: Response): Promise<ErrorBody> => {
  try {
    return (await response.json()) as ErrorBody;
  } catch {
    return {};
  }
};

export const apiGet = async <T>(path: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(`/api${path}`, { signal });
  if (!response.ok) {
    const { error, errors } = await readErrorBody(response);
    throw new ApiError({
      status: response.status,
      code: error?.code ?? null,
      message: error?.message ?? `Request failed: ${response.status} ${response.statusText}`,
      tickerErrors: errors ?? [],
    });
  }
  return (await response.json()) as T;
};

type GetFilingsParams = FilingsQuery & { signal?: AbortSignal };

export const getFilings = ({ ticker, form, page, limit, sort, signal }: GetFilingsParams) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit), sort });
  if (form !== '') params.set('form', form);
  return apiGet<FilingsResponse>(
    `/companies/${encodeURIComponent(ticker)}/filings?${params.toString()}`,
    signal,
  );
};

export const getSummary = (tickers: string[], signal?: AbortSignal) =>
  apiGet<SummaryResponse>(`/filings/summary?tickers=${encodeURIComponent(tickers.join(','))}`, signal);
