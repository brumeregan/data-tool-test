import { useState } from 'react';
import { useFilings } from '../hooks/useFilings';
import type { SortDirection } from '../types';
import { CompanySelector } from '../components/CompanySelector';
import { FilingsControls } from '../components/FilingsControls';
import { FilingsTable } from '../components/FilingsTable';
import { Pagination } from '../components/Pagination';

const PAGE_SIZE = 25;

type Query = { ticker: string | null; form: string; sort: SortDirection; page: number };

const initialQuery: Query = { ticker: null, form: '', sort: 'desc', page: 1 };

export const FilingsPage = () => {
  const [query, setQuery] = useState<Query>(initialQuery);
  const { status, data, error } = useFilings(
    query.ticker === null
      ? null
      : { ticker: query.ticker, form: query.form, sort: query.sort, page: query.page, limit: PAGE_SIZE },
  );
  const loading = status === 'loading';

  // Company, form and sort changes all reset to page 1; a new company also clears the form filter
  // because availableForms differs per company.
  const selectCompany = (ticker: string) => setQuery({ ...initialQuery, ticker, sort: query.sort });
  const changeForm = (form: string) => setQuery({ ...query, form, page: 1 });
  const changeSort = (sort: SortDirection) => setQuery({ ...query, sort, page: 1 });
  const changePage = (page: number) => setQuery({ ...query, page });

  return (
    <main className="filings-page">
      <h1>EDGAR filings</h1>
      <CompanySelector onSelect={selectCompany} />

      {data !== null && <h2>{data.company.name} <span className="muted">({data.company.ticker}, CIK {data.company.cik})</span></h2>}

      <FilingsControls
        availableForms={data?.availableForms ?? []}
        form={query.form}
        sort={query.sort}
        disabled={loading || query.ticker === null}
        onFormChange={changeForm}
        onSortChange={changeSort}
      />

      <div className="results" aria-busy={loading}>
        {status === 'idle' && <p className="muted">Enter a ticker or pick one above to see its filings.</p>}
        {loading && <p role="status">Loading…</p>}
        {status === 'error' && <p role="alert" className="error">{error}</p>}
        {data !== null && status !== 'error' && data.items.length === 0 && !loading && (
          <p className="muted">No filings match this filter</p>
        )}
        {data !== null && status !== 'error' && data.items.length > 0 && (
          <div className={loading ? 'dimmed' : undefined}>
            <FilingsTable filings={data.items} />
          </div>
        )}
      </div>

      {data !== null && status !== 'error' && (
        <Pagination
          page={query.page}
          totalPages={data.totalPages}
          total={data.total}
          disabled={loading}
          onPageChange={changePage}
        />
      )}
    </main>
  );
};
