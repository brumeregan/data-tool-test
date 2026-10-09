import { render, screen, within } from '@testing-library/react';
import { FilingsTable } from '../FilingsTable';
import { makeFiling, makeResponse } from './fixtures';

describe('FilingsTable', () => {
  it('renders a row for every filing', () => {
    render(<FilingsTable filings={makeResponse().items} />);
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3); // header + 2
    expect(within(rows[1]).getByText('10-K')).toBeInTheDocument();
    expect(within(rows[1]).getByText('2025-10-31')).toBeInTheDocument();
    expect(within(rows[1]).getByText('0000320193-25-000079')).toBeInTheDocument();
    expect(within(rows[2]).getByText('10-Q')).toBeInTheDocument();
  });

  it('renders a null reportDate as an em dash', () => {
    render(<FilingsTable filings={[makeFiling({ reportDate: null })]} />);
    const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell');
    expect(cells[2]).toHaveTextContent('—');
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('opens the document in a new tab safely', () => {
    render(<FilingsTable filings={[makeFiling()]} />);
    const link = screen.getByRole('link', { name: 'View' });
    expect(link).toHaveAttribute('href', makeFiling().documentUrl);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
