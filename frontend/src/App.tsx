import { useState } from 'react';
import { FilingsPage } from './components/FilingsPage';
import { SummaryPage } from './components/SummaryPage';

type View = 'filings' | 'summary';

const VIEWS: { id: View; label: string }[] = [
  { id: 'filings', label: 'Filings' },
  { id: 'summary', label: 'Summary' },
];

export const App = () => {
  const [view, setView] = useState<View>('filings');

  return (
    <>
      <nav className="view-nav" aria-label="Views">
        {VIEWS.map(({ id, label }) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>
            {label}
          </button>
        ))}
      </nav>
      {view === 'filings' ? <FilingsPage /> : <SummaryPage />}
    </>
  );
};
