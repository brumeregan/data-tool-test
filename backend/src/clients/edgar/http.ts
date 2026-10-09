import { EdgarUnavailable } from "../../errors";

const MIN_GAP_MS = 120;
const TIMEOUT_MS = 10_000;
const RETRY_BACKOFF_MS = 500;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

let chain: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

// Throttle requests to EDGAR to avoid being blocked, useful for large requests or several requests in a row (summary page)
const throttle = (): Promise<void> => {
  const next = chain.then(async () => {
    const wait = lastRequestAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
  });
  chain = next;
  return next;
};

const isRetriable = (status: number): boolean =>
  status === 429 || status >= 500;

const fetchHandler = async (
  url: string,
  userAgent: string,
): Promise<Response> => {
  await throttle();
  try {
    return await fetch(url, {
      headers: { "User-Agent": userAgent, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new EdgarUnavailable(
      `EDGAR request failed (network or timeout): ${reason}`,
    );
  }
};

export const getJson = async (url: string): Promise<unknown> => {
  const userAgent = process.env.SEC_USER_AGENT;
  if (!userAgent) {
    throw new EdgarUnavailable(
      "SEC_USER_AGENT is not set; EDGAR rejects anonymous clients",
    );
  }

  let response = await fetchHandler(url, userAgent);
  if (isRetriable(response.status)) {
    await sleep(RETRY_BACKOFF_MS);
    response = await fetchHandler(url, userAgent);
  }

  if (!response.ok) {
    throw new EdgarUnavailable(
      `EDGAR responded with HTTP ${response.status} for ${url}`,
    );
  }

  try {
    return await response.json();
  } catch {
    throw new EdgarUnavailable(`EDGAR returned invalid JSON for ${url}`);
  }
};
