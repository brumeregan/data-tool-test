import { render, screen, within } from '@testing-library/react';
import { orderForms, SummaryTable } from '../SummaryTable';
import { makeSpotify, makeSummaryCompany } from './fixtures';

const rowFor = (ticker: string) =>
  screen.getByRole('rowheader', { name: new RegExp(`^${ticker}`) }).closest('tr') as HTMLElement;

describe('SummaryTable', () => {
  it('renders one row per company and one column per distinct form type', () => {
    render(<SummaryTable companies={[makeSummaryCompany(), makeSpotify()]} />);
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    // Union of both companies' forms, priority forms first, noise alphabetically after.
    expect(headers).toEqual([
      'Company', 'Latest 10-K', 'Total (12 mo)',
      '10-K', '10-Q', '8-K', '20-F', '6-K', '3', '4',
    ]);
    expect(screen.getAllByRole('row')).toHaveLength(3); // header + 2 companies
    expect(within(rowFor('AAPL')).getByText('62')).toBeInTheDocument();
  });

  it('renders a dash, not a blank, for a form the company never filed', () => {
    render(<SummaryTable companies={[makeSummaryCompany(), makeSpotify()]} />);
    const cells = within(rowFor('AAPL')).getAllByRole('cell');
    // cells after latest-10-K and total: 10-K 10-Q 8-K 20-F 6-K 3 4
    expect(cells.slice(2).map((c) => c.textContent)).toEqual(['1', '3', '8', '—', '—', '—', '50']);
    for (const cell of cells) expect(cell.textContent).not.toBe('');
  });

  it('explains a null latest10K instead of rendering null or blank', () => {
    render(<SummaryTable companies={[makeSummaryCompany(), makeSpotify()]} />);
    const cell = within(rowFor('SPOT')).getAllByRole('cell')[0];
    expect(cell).toHaveTextContent('—');
    expect(cell).toHaveTextContent('Files 20-F instead');
    expect(within(cell).getByRole('link', { name: '2026-02-10' })).toHaveAttribute('target', '_blank');
    expect(cell).not.toHaveTextContent('null');
  });

  it('says so when a company has neither a 10-K nor an annual report', () => {
    render(<SummaryTable companies={[makeSummaryCompany({ latest10K: null })]} />);
    expect(screen.getByText('No 10-K on record')).toBeInTheDocument();
  });

  it('links the latest 10-K date to the document', () => {
    render(<SummaryTable companies={[makeSummaryCompany()]} />);
    const link = screen.getByRole('link', { name: '2025-10-31' });
    expect(link).toHaveAttribute('href', expect.stringContaining('aapl-20250927.htm'));
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('orderForms', () => {
  it('puts the priority forms first in a fixed order, then the rest alphabetically', () => {
    expect(orderForms(['4', '6-K', '8-K', 'SC 13G', '10-K', '144', '4', '20-F', '10-Q'])).toEqual([
      '10-K', '10-Q', '8-K', '20-F', '6-K', '144', '4', 'SC 13G',
    ]);
  });
});
