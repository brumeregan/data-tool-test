import type { FilingsQuery, FilingsResponse } from './types';

type ErrorBody = { error?: { code?: string; message?: string } };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor({ status, code, message }: { status: number; code: string | null; message: string }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
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
    const { error } = await readErrorBody(response);
    throw new ApiError({
      status: response.status,
      code: error?.code ?? null,
      message: error?.message ?? `Request failed: ${response.status} ${response.statusText}`,
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
