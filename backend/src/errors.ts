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
