import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getSummary } from '../../api';
import { App } from '../../App';
import { SummaryPage } from '../SummaryPage';
import { makeSummary } from './fixtures';

vi.mock('../../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api')>()),
  getSummary: vi.fn(),
  getFilings: vi.fn(),
}));

const mockedGetSummary = vi.mocked(getSummary);
const lastTickers = () => mockedGetSummary.mock.calls[mockedGetSummary.mock.calls.length - 1][0];

const addTicker = (value: string) => {
  fireEvent.change(screen.getByLabelText('Add company'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
};

beforeEach(() => {
  mockedGetSummary.mockReset();
  mockedGetSummary.mockResolvedValue(makeSummary());
});

describe('SummaryPage', () => {
  it('defaults to AAPL, SPOT, JPM and fetches immediately', async () => {
    render(<SummaryPage />);
    expect(await screen.findByRole('rowheader', { name: /AAPL/ })).toBeInTheDocument();
    expect(mockedGetSummary).toHaveBeenCalledTimes(1);
    expect(lastTickers()).toEqual(['AAPL', 'SPOT', 'JPM']);
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['AAPL×', 'SPOT×', 'JPM×']);
  });

  it('renders per-ticker errors as notices while successful rows still display', async () => {
    mockedGetSummary.mockResolvedValue(
      makeSummary({
        errors: [{ ticker: 'NOTREAL', code: 'TICKER_NOT_FOUND', message: 'Ticker not found: NOTREAL' }],
      }),
    );
    render(<SummaryPage />);
    const notices = await screen.findByRole('list', { name: 'Companies that could not be loaded' });
    expect(within(notices).getByText('NOTREAL: no company found')).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: /AAPL/ })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: /SPOT/ })).toBeInTheDocument();
  });

  it('shows non-404 ticker errors with the backend message', async () => {
    mockedGetSummary.mockResolvedValue(
      makeSummary({ errors: [{ ticker: 'JPM', code: 'EDGAR_UNAVAILABLE', message: 'EDGAR responded with HTTP 503' }] }),
    );
    render(<SummaryPage />);
    expect(await screen.findByText('JPM: EDGAR responded with HTTP 503')).toBeInTheDocument();
  });

  it('refetches with the reduced set when a ticker is removed', async () => {
    render(<SummaryPage />);
    await screen.findByRole('rowheader', { name: /AAPL/ });
    fireEvent.click(screen.getByRole('button', { name: 'Remove SPOT' }));
    await waitFor(() => expect(lastTickers()).toEqual(['AAPL', 'JPM']));
    expect(mockedGetSummary).toHaveBeenCalledTimes(2);
  });

  it('adds a ticker (trimmed, uppercased) and refetches', async () => {
    render(<SummaryPage />);
    await screen.findByRole('rowheader', { name: /AAPL/ });
    addTicker('  msft ');
    await waitFor(() => expect(lastTickers()).toEqual(['AAPL', 'SPOT', 'JPM', 'MSFT']));
  });

  it('rejects a duplicate ticker without making a request', async () => {
    render(<SummaryPage />);
    await screen.findByRole('rowheader', { name: /AAPL/ });
    addTicker(' aapl');
    expect(screen.getByRole('alert')).toHaveTextContent('AAPL is already in the list');
    expect(mockedGetSummary).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('disables Add at the 10-company limit', async () => {
    mockedGetSummary.mockResolvedValue(makeSummary());
    render(<SummaryPage />);
    await screen.findByRole('rowheader', { name: /AAPL/ });
    for (const t of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
      addTicker(t);
      await waitFor(() => expect(lastTickers()).toContain(t));
      await screen.findByRole('rowheader', { name: /AAPL/ });
    }
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(screen.getByLabelText('Add company')).toBeDisabled();
  });

  it('prompts to add a company, not an error, when the set is empty', async () => {
    render(<SummaryPage />);
    for (const t of ['AAPL', 'SPOT', 'JPM']) {
      await waitFor(() => expect(screen.getByRole('button', { name: `Remove ${t}` })).toBeEnabled());
      fireEvent.click(screen.getByRole('button', { name: `Remove ${t}` }));
    }
    expect(await screen.findByText('Add a company to compare its filings.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Add company')).toBeEnabled();
  });

  it('shows the backend message and per-ticker errors when the whole request fails', async () => {
    mockedGetSummary.mockRejectedValue(
      new ApiError({
        status: 404,
        code: 'TICKER_NOT_FOUND',
        message: 'All 1 requested tickers failed',
        tickerErrors: [{ ticker: 'ZZZ', code: 'TICKER_NOT_FOUND', message: 'Ticker not found: ZZZ' }],
      }),
    );
    render(<SummaryPage />);
    expect(await screen.findByText('All 1 requested tickers failed')).toBeInTheDocument();
    expect(screen.getByText('ZZZ: no company found')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('keeps controls visible but disabled while loading', async () => {
    mockedGetSummary.mockImplementation(() => new Promise(() => {}));
    render(<SummaryPage />);
    expect(await screen.findByRole('status')).toHaveTextContent('Loading');
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove AAPL' })).toBeDisabled();
  });
});

describe('navigation', () => {
  it('switches between the filings list and the summary', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'EDGAR filings' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
    expect(await screen.findByRole('heading', { name: 'Filing summary' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filings' }));
    expect(screen.getByRole('heading', { name: 'EDGAR filings' })).toBeInTheDocument();
  });
});
