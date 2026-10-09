import { useState } from 'react';
import { useSummary } from '../hooks/useSummary';
import type { TickerError } from '../types';
import { SummaryTable } from './SummaryTable';
import { TickerInput } from './TickerInput';

const DEFAULT_TICKERS = ['AAPL', 'SPOT', 'JPM'];

export const describeTickerError = ({ ticker, code, message }: TickerError): string =>
  code === 'TICKER_NOT_FOUND' ? `${ticker}: no company found` : `${ticker}: ${message}`;

export const SummaryPage = () => {
  const [tickers, setTickers] = useState<string[]>(DEFAULT_TICKERS);
  const { status, data, error } = useSummary(tickers);
  const loading = status === 'loading';

  const addTicker = (ticker: string) => setTickers((current) => [...current, ticker]);
  const removeTicker = (ticker: string) =>
    setTickers((current) => current.filter((existing) => existing !== ticker));

  const tickerErrors = status === 'error' ? (error?.tickerErrors ?? []) : (data?.errors ?? []);

  return (
    <main className="summary-page">
      <h1>Filing summary</h1>
      <TickerInput tickers={tickers} disabled={loading} onAdd={addTicker} onRemove={removeTicker} />

      <div className="results" aria-busy={loading}>
        {status === 'idle' && <p className="muted">Add a company to compare its filings.</p>}
        {loading && <p role="status">Loading…</p>}
        {status === 'error' && <p role="alert" className="error">{error?.message}</p>}
        {tickerErrors.length > 0 && !loading && (
          <ul className="notices" aria-label="Companies that could not be loaded">
            {tickerErrors.map((tickerError) => (
              <li key={tickerError.ticker} role="alert" className="error">
                {describeTickerError(tickerError)}
              </li>
            ))}
          </ul>
        )}
        {data !== null && status !== 'error' && (
          <div className={loading ? 'dimmed' : undefined}>
            <SummaryTable companies={data.companies} />
          </div>
        )}
      </div>
    </main>
  );
};
