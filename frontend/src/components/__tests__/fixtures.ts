import type { Filing, FilingsResponse, SummaryCompany, SummaryResponse } from '../../types';

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

export const makeSummaryCompany = (overrides: Partial<SummaryCompany> = {}): SummaryCompany => ({
  ticker: 'AAPL',
  cik: '0000320193',
  name: 'Apple Inc.',
  countsByForm: { '10-K': 1, '10-Q': 3, '8-K': 8, '4': 50 },
  totalLast12Months: 62,
  latest10K: {
    filingDate: '2025-10-31',
    documentUrl: 'https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm',
  },
  latestAnnualReport: null,
  ...overrides,
});

export const makeSpotify = (): SummaryCompany =>
  makeSummaryCompany({
    ticker: 'SPOT',
    cik: '0001639920',
    name: 'Spotify Technology S.A.',
    countsByForm: { '6-K': 14, '20-F': 1, '3': 16 },
    totalLast12Months: 31,
    latest10K: null,
    latestAnnualReport: {
      form: '20-F',
      filingDate: '2026-02-10',
      documentUrl: 'https://www.sec.gov/Archives/edgar/data/1639920/000162828026006874/ck0001639920-20251231.htm',
    },
  });

export const makeSummary = (overrides: Partial<SummaryResponse> = {}): SummaryResponse => ({
  companies: [makeSummaryCompany(), makeSpotify()],
  errors: [],
  ...overrides,
});
