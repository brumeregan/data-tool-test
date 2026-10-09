import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getFilings } from '../../api';
import type { FilingsResponse } from '../../types';
import { FilingsPage } from '../FilingsPage';
import { makeResponse } from './fixtures';

vi.mock('../../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api')>()),
  getFilings: vi.fn(),
}));

const mockedGetFilings = vi.mocked(getFilings);

const lastCall = () => mockedGetFilings.mock.calls[mockedGetFilings.mock.calls.length - 1][0];

const pick = (ticker: string) => fireEvent.click(screen.getByRole('button', { name: ticker }));

beforeEach(() => {
  mockedGetFilings.mockReset();
  mockedGetFilings.mockImplementation(async ({ ticker }) =>
    ticker === 'SPOT'
      ? makeResponse({
          company: { ticker: 'SPOT', cik: '0001639920', name: 'Spotify Technology S.A.' },
          availableForms: ['20-F', '6-K'],
        })
      : makeResponse(),
  );
});

describe('FilingsPage', () => {
  it('renders the rows returned by the API', async () => {
    render(<FilingsPage />);
    pick('AAPL');
    expect(await screen.findByText('0000320193-25-000079')).toBeInTheDocument();
    expect(screen.getByText('0000320193-26-000020')).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 3/)).toHaveTextContent('60 filings');
    expect(mockedGetFilings).toHaveBeenCalledWith(
      expect.objectContaining({ ticker: 'AAPL', form: '', page: 1, limit: 25, sort: 'desc' }),
    );
  });

  it('uppercases and trims typed tickers', async () => {
    render(<FilingsPage />);
    fireEvent.change(screen.getByLabelText('Ticker'), { target: { value: '  msft ' } });
    fireEvent.submit(screen.getByLabelText('Ticker').closest('form') as HTMLFormElement);
    await screen.findByText('0000320193-25-000079');
    expect(lastCall().ticker).toBe('MSFT');
  });

  it('populates the form dropdown from availableForms', async () => {
    render(<FilingsPage />);
    pick('AAPL');
    await screen.findByText('0000320193-25-000079');
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['All forms', '10-K', '10-Q', '8-K']);
  });

  it('changing the form filter resets the page to 1', async () => {
    render(<FilingsPage />);
    pick('AAPL');
    await screen.findByText('0000320193-25-000079');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(lastCall().page).toBe(2));
    await screen.findByText(/Page 2 of 3/);

    fireEvent.change(screen.getByLabelText('Form type'), { target: { value: '10-K' } });
    await waitFor(() => expect(lastCall()).toMatchObject({ form: '10-K', page: 1 }));
  });

  it('changing the sort resets the page to 1', async () => {
    render(<FilingsPage />);
    pick('AAPL');
    await screen.findByText('0000320193-25-000079');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText(/Page 2 of 3/);

    fireEvent.click(screen.getByRole('button', { name: /Filing date/ }));
    await waitFor(() => expect(lastCall()).toMatchObject({ sort: 'asc', page: 1 }));
  });

  it('changing company clears the form filter', async () => {
    render(<FilingsPage />);
    pick('AAPL');
    await screen.findByText('0000320193-25-000079');
    fireEvent.change(screen.getByLabelText('Form type'), { target: { value: '10-K' } });
    await waitFor(() => expect(lastCall().form).toBe('10-K'));
    await screen.findByText('0000320193-25-000079');

    pick('SPOT');
    await waitFor(() => expect(lastCall()).toMatchObject({ ticker: 'SPOT', form: '', page: 1 }));
    expect(await screen.findByText(/Spotify Technology/)).toBeInTheDocument();
    expect(screen.getByLabelText('Form type')).toHaveValue('');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['All forms', '20-F', '6-K']);
  });

  it('renders a friendly message for a 404, not a crash', async () => {
    mockedGetFilings.mockRejectedValue(
      new ApiError({ status: 404, code: 'TICKER_NOT_FOUND', message: 'Ticker not found: XYZ' }),
    );
    render(<FilingsPage />);
    fireEvent.change(screen.getByLabelText('Ticker'), { target: { value: 'xyz' } });
    fireEvent.submit(screen.getByLabelText('Ticker').closest('form') as HTMLFormElement);
    expect(await screen.findByRole('alert')).toHaveTextContent('No company found for ticker XYZ');
    expect(screen.getByLabelText('Ticker')).toBeInTheDocument();
  });

  it("shows the backend's message for other errors", async () => {
    mockedGetFilings.mockRejectedValue(
      new ApiError({ status: 502, code: 'EDGAR_UNAVAILABLE', message: 'EDGAR responded with HTTP 503' }),
    );
    render(<FilingsPage />);
    pick('AAPL');
    expect(await screen.findByRole('alert')).toHaveTextContent('EDGAR responded with HTTP 503');
  });

  it('renders the empty state, not the error state, for items: []', async () => {
    mockedGetFilings.mockResolvedValue(makeResponse({ items: [], total: 0, totalPages: 0 }));
    render(<FilingsPage />);
    pick('AAPL');
    expect(await screen.findByText('No filings match this filter')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Form type')).toBeEnabled();
  });

  it('keeps controls visible but disabled while loading', async () => {
    let resolve: (value: FilingsResponse) => void = () => {};
    mockedGetFilings.mockImplementation(() => new Promise((r) => { resolve = r; }));
    render(<FilingsPage />);
    pick('AAPL');
    expect(await screen.findByRole('status')).toHaveTextContent('Loading');
    expect(screen.getByLabelText('Form type')).toBeDisabled();
    resolve(makeResponse());
    await screen.findByText('0000320193-25-000079');
    expect(screen.getByLabelText('Form type')).toBeEnabled();
  });

  it('ignores a slow earlier response that arrives after a newer one', async () => {
    const resolvers: Record<string, (value: FilingsResponse) => void> = {};
    mockedGetFilings.mockImplementation(
      ({ ticker }) => new Promise((r) => { resolvers[ticker] = r; }),
    );
    render(<FilingsPage />);
    pick('AAPL');
    await waitFor(() => expect(resolvers.AAPL).toBeDefined());
    pick('SPOT');
    await waitFor(() => expect(resolvers.SPOT).toBeDefined());

    resolvers.SPOT(
      makeResponse({ company: { ticker: 'SPOT', cik: '0001639920', name: 'Spotify Technology S.A.' } }),
    );
    expect(await screen.findByText(/Spotify Technology/)).toBeInTheDocument();
    resolvers.AAPL(makeResponse());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByText(/Spotify Technology/)).toBeInTheDocument();
    expect(screen.queryByText(/Apple Inc\./)).not.toBeInTheDocument();
  });
});
