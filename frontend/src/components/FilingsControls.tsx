import type { SortDirection } from '../types';

type FilingsControlsProps = {
  availableForms: string[];
  form: string;
  sort: SortDirection;
  disabled: boolean;
  onFormChange: (form: string) => void;
  onSortChange: (sort: SortDirection) => void;
};

export const FilingsControls = ({
  availableForms,
  form,
  sort,
  disabled,
  onFormChange,
  onSortChange,
}: FilingsControlsProps) => (
  <div className="filings-controls">
    <label htmlFor="form-filter">Form type</label>
    <select
      id="form-filter"
      value={form}
      disabled={disabled}
      onChange={(event) => onFormChange(event.target.value)}
    >
      <option value="">All forms</option>
      {availableForms.map((available) => (
        <option key={available} value={available}>
          {available}
        </option>
      ))}
    </select>
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSortChange(sort === 'desc' ? 'asc' : 'desc')}
    >
      Filing date: {sort === 'desc' ? 'newest first ↓' : 'oldest first ↑'}
    </button>
  </div>
);
