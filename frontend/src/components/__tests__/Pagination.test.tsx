import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { Pagination } from '../Pagination';

const renderPagination = (page: number, totalPages = 3, onPageChange = vi.fn()) => {
  render(
    <Pagination page={page} totalPages={totalPages} total={60} disabled={false} onPageChange={onPageChange} />,
  );
  return onPageChange;
};

describe('Pagination', () => {
  it('shows page X of Y and the total', () => {
    renderPagination(2);
    expect(screen.getByText('Page 2 of 3 · 60 filings')).toBeInTheDocument();
  });

  it('disables Previous on the first page', () => {
    renderPagination(1);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('disables Next on the last page', () => {
    renderPagination(3);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
  });

  it('requests the adjacent page', () => {
    const onPageChange = renderPagination(2);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onPageChange.mock.calls).toEqual([[3], [1]]);
  });

  it('disables both buttons for a single page', () => {
    renderPagination(1, 1);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
