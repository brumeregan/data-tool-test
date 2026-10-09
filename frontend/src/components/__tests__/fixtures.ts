import type { Filing, FilingsResponse } from '../../types';

export const makeFiling = (overrides: Partial<Filing> = {}): Filing => ({
  accessionNumber: '0000320193-25-000079',
  form: '10-K',
  filingDate: '2025-10-31',
  reportDate: '2025-09-27',
  primaryDocument: 'aapl-20250927.htm',
  documentUrl: 'https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm',
  filingIndexUrl:
    'https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/0000320193-25-000079-index.htm',
  ...overrides,
});

export const makeResponse = (overrides: Partial<FilingsResponse> = {}): FilingsResponse => ({
  company: { ticker: 'AAPL', cik: '0000320193', name: 'Apple Inc.' },
  items: [
    makeFiling(),
    makeFiling({
      accessionNumber: '0000320193-26-000020',
      form: '10-Q',
      filingDate: '2026-07-31',
      reportDate: null,
    }),
  ],
  total: 60,
  page: 1,
  limit: 25,
  totalPages: 3,
  availableForms: ['10-K', '10-Q', '8-K'],
  ...overrides,
});
