export class EdgarUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EdgarUnavailable";
  }
}

export class TickerNotFound extends Error {
  constructor(ticker: string) {
    super(`Ticker not found: ${ticker}`);
    this.name = "TickerNotFound";
  }
}

export type TickerError = { ticker: string; code: string; message: string };

// Thrown by the summary service when every requested ticker failed; the error handler maps it
// to a non-200 envelope that also carries the per-ticker errors.
export class AllTickersFailed extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors: TickerError[];

  constructor({ status, code, errors }: { status: number; code: string; errors: TickerError[] }) {
    super(`All ${errors.length} requested tickers failed`);
    this.name = "AllTickersFailed";
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}
