import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the filings page with its idle prompt', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'EDGAR filings' })).toBeInTheDocument();
    expect(screen.getByText(/Enter a ticker or pick one/)).toBeInTheDocument();
  });
});
