import { useState } from 'react';
import type { FormEvent } from 'react';

const QUICK_PICKS = ['AAPL', 'SPOT', 'JPM'];

type CompanySelectorProps = {
  onSelect: (ticker: string) => void;
};

export const CompanySelector = ({ onSelect }: CompanySelectorProps) => {
  const [input, setInput] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ticker = input.trim().toUpperCase();
    if (ticker !== '') onSelect(ticker);
  };

  return (
    <section className="company-selector">
      <form onSubmit={handleSubmit}>
        <label htmlFor="ticker-input">Ticker</label>
        <input
          id="ticker-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="e.g. MSFT"
          autoComplete="off"
        />
        <button type="submit">Load filings</button>
      </form>
      <div className="quick-picks">
        {QUICK_PICKS.map((ticker) => (
          <button
            key={ticker}
            type="button"
            onClick={() => {
              setInput(ticker);
              onSelect(ticker);
            }}
          >
            {ticker}
          </button>
        ))}
      </div>
    </section>
  );
};
