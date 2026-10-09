import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { App } from './App';

vi.mock('./api', () => ({
  apiGet: vi.fn().mockResolvedValue({ status: 'ok' }),
}));

describe('App', () => {
  it('renders backend health status', async () => {
    render(<App />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(await screen.findByText('Backend status: ok')).toBeInTheDocument();
  });
});
