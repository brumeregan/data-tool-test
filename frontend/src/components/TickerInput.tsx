import { useState } from 'react';
import type { FormEvent } from 'react';

export const MAX_TICKERS = 10; // the backend rejects more than 10 tickers per request

type TickerInputProps = {
  tickers: string[];
  disabled: boolean;
  onAdd: (ticker: string) => void;
  onRemove: (ticker: string) => void;
};

export const TickerInput = ({ tickers, disabled, onAdd, onRemove }: TickerInputProps) => {
  const [input, setInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const atLimit = tickers.length >= MAX_TICKERS;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ticker = input.trim().toUpperCase();
    if (ticker === '') return;
    if (tickers.includes(ticker)) {
      setMessage(`${ticker} is already in the list`);
      return;
    }
    setMessage(null);
    setInput('');
    onAdd(ticker);
  };

  return (
    <section className="ticker-input">
      <ul className="chips" aria-label="Companies to compare">
        {tickers.map((ticker) => (
          <li key={ticker} className="chip">
            {ticker}
            <button
              type="button"
              aria-label={`Remove ${ticker}`}
              disabled={disabled}
              onClick={() => onRemove(ticker)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <label htmlFor="summary-ticker">Add company</label>
        <input
          id="summary-ticker"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="e.g. MSFT"
          autoComplete="off"
          disabled={disabled || atLimit}
        />
        <button type="submit" disabled={disabled || atLimit}>
          Add
        </button>
        {atLimit && <span className="muted">Limit of {MAX_TICKERS} companies reached</span>}
      </form>
      {message !== null && <p role="alert" className="error">{message}</p>}
    </section>
  );
};
