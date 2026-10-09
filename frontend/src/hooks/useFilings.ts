import { useEffect, useState } from 'react';
import { ApiError, getFilings } from '../api';
import type { FilingsQuery, FilingsResponse } from '../types';

export type FilingsState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  // Kept while a new request is loading so controls (and their options) don't jump.
  data: FilingsResponse | null;
  error: string | null;
};

const idle: FilingsState = { status: 'idle', data: null, error: null };

export const describeError = (error: unknown, ticker: string): string => {
  if (error instanceof ApiError && error.status === 404) {
    return `No company found for ticker ${ticker}`;
  }
  return error instanceof Error ? error.message : String(error);
};

export const useFilings = (query: FilingsQuery | null): FilingsState => {
  const [state, setState] = useState<FilingsState>(idle);
  const ticker = query?.ticker;
  const form = query?.form;
  const page = query?.page;
  const limit = query?.limit;
  const sort = query?.sort;

  useEffect(() => {
    if (ticker === undefined || form === undefined || page === undefined || limit === undefined || sort === undefined) {
      setState(idle);
      return;
    }
    // Aborting on cleanup (and ignoring aborted results) stops a slow earlier request
    // from overwriting the response for a newer query.
    const controller = new AbortController();
    setState((previous) => ({ status: 'loading', data: previous.data, error: null }));
    getFilings({ ticker, form, page, limit, sort, signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: 'success', data, error: null });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: 'error', data: null, error: describeError(error, ticker) });
        }
      });
    return () => controller.abort();
  }, [ticker, form, page, limit, sort]);

  return state;
};
