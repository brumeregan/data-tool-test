type PaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  disabled: boolean;
  onPageChange: (page: number) => void;
};

export const Pagination = ({ page, totalPages, total, disabled, onPageChange }: PaginationProps) => (
  <nav className="pagination" aria-label="Pagination">
    <button type="button" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
      Previous
    </button>
    <span>
      Page {page} of {Math.max(totalPages, 1)} · {total.toLocaleString('en-US')} filings
    </span>
    <button
      type="button"
      disabled={disabled || page >= totalPages}
      onClick={() => onPageChange(page + 1)}
    >
      Next
    </button>
  </nav>
);
