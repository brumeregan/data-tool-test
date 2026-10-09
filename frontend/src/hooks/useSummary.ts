import { useEffect, useState } from 'react';
import { ApiError, getSummary } from '../api';
import type { SummaryResponse, TickerError } from '../types';

export type SummaryState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  // Kept while a new request loads so the table doesn't vanish and the layout doesn't jump.
  data: SummaryResponse | null;
  // Set only when the whole request failed.
  error: { message: string; tickerErrors: TickerError[] } | null;
};

const idle: SummaryState = { status: 'idle', data: null, error: null };

export const useSummary = (tickers: string[]): SummaryState => {
  const [state, setState] = useState<SummaryState>(idle);
  const key = tickers.join(',');

  useEffect(() => {
    if (key === '') {
      setState(idle);
      return;
    }
    // Aborting on cleanup (and ignoring aborted results) keeps a slow earlier request
    // from overwriting the response for the current ticker set.
    const controller = new AbortController();
    setState((previous) => ({ status: 'loading', data: previous.data, error: null }));
    getSummary(key.split(','), controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: 'success', data, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          data: null,
          error: {
            message: error instanceof Error ? error.message : String(error),
            tickerErrors: error instanceof ApiError ? error.tickerErrors : [],
          },
        });
      });
    return () => controller.abort();
  }, [key]);

  return state;
};
