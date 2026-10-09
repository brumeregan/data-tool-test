# Prompts

## Prompt 1 — Scaffold

Data-tool for EDGARs API

Lets scaffold an application that contains frontend and backend parts. all parts should be deployed as containerized services.
for frontend use ReactJs with named export functions.
for backend - express with REST API, transpile to CommonJS
Both backend and frontend uses typescript
Requirements:

* no default exports (if possible)
* only named arrow functions
* if function has  more than 2 arguments, it should be an object

*  Tests: Vitest on both sides, plus supertest on the backend


Frontend:
- Vite dev server must bind host 0.0.0.0 or the container is unreachable
- Vite proxy: /api -> http://backend:3000, rewriting away the /api prefix, so
  the browser makes same-origin requests and we need no CORS config
- src/api.ts exports a small typed helper that fetches relative to /api and
  throws on non-2xx
- App.tsx: nothing but a component that calls /api/health and renders the
  result, as an end-to-end proof the proxy works
- One trivial Vitest test so the harness is proven

Docker:
- Dev-focused images, node:22-alpine, no multi-stage build
- compose mounts ./backend/src and ./frontend/src as volumes for hot reload
- Backend on 3000, frontend on 5173, frontend depends_on backend
- SEC_USER_AGENT set in compose as an env var with a placeholder value

Docs:
- README: prerequisites, how to run with docker compose, how to run tests,
  the port map, and a short note on why the frontend talks to the backend
  through the Vite proxy rather than calling it directly
- PROMPTS.md: create it and paste this and future prompts there

Use 2 agents with Sonnet 5 to make this task. one agent for frontend, second - for Backend

after creating scaffolding, verify that everything works

## Prompt 2 — EDGAR HTTP client and ticker-to-CIK resolution

next task:
Implement the EDGAR HTTP client and ticker-to-CIK resolution

structure:
backend/src/clients/edgar
subflders:
http.ts - only place where fetch is called
tickerts.ts - ticker to CIK resolution
submissions.ts   -CIK to raw submissions document
schemas.ts   -  zod schemas for EDGAR response shapes
types.ts   for types inferred from those schemas
 index.ts    for re-export the public API only

 http.ts
- Sends a User-Agent header on every request, read from process.env.SEC_USER_AGENT.
  The SEC requires a declared User-Agent with contact info; anonymous clients
  get 403s.
- Exposes getJson(url: string): Promise<unknown> returning parsed JSON. It
  must NOT know about zod or about specific EDGAR shapes — callers validate.
- Maps failures to the typed errors in src/errors.ts:
  - 403 or 429 -> EdgarUnavailable, status included in the message
  - 5xx -> EdgarUnavailable
  - network error or timeout -> EdgarUnavailable
  - 10s request timeout via AbortSignal.timeout
- Throttle: the SEC's ceiling is 10 req/s. Enforce a minimum ~120ms gap between
  outbound requests with a simple promise chain or small queue. No external
  rate-limit library.
- Retry once on 429 or 5xx with a short backoff, then give up.
- Not exported from index.ts,  it's internal to the client.

tickers.ts
- Source: https://www.sec.gov/files/company_tickers.json
- Note the shape: a JSON OBJECT keyed by stringified index, not an array. Each
  value is { cik_str: number, ticker: string, title: string }. cik_str is a
  plain number with no zero-padding.
- Validate with a zod schema from ./schemas before use.
- Build an in-memory Map<string, { cik: string; title: string }> keyed by
  UPPERCASED ticker, with cik already zero-padded to 10 digits since that's the
  format the submissions URL needs.
- Load lazily on first use, cache for the process lifetime. Concurrent first
  calls must not trigger two downloads — share the in-flight promise.
- Export resolveTicker(ticker: string). Case-insensitive, trims whitespace.
  Unknown ticker throws TickerNotFound.
- Export a reset/reload function so tests aren't stuck with cached state.

submissions.ts
- URL: https://data.sec.gov/submissions/CIK{paddedCik}.json
- Validate with a zod schema from ./schemas covering at minimum: cik, name, and
  filings.recent with its parallel arrays (accessionNumber, filingDate,
  reportDate, form, primaryDocument), plus filings.files.
- Return the validated object, typed. Do NOT transform or flatten it — that's
  the normalizer's job in M2.
- A zod parse failure means EDGAR changed shape: throw EdgarUnavailable with a
  message making clear it's a validation failure, not a network one.
- Cache per CIK in memory with a 15 min TTL so the summary endpoint hitting
  several companies doesn't refetch.

### index.ts
Export only: resolveTicker, its reset helper, the submissions fetcher, and the
inferred types. Do not re-export getJson or the schemas.

## Tests (Vitest)
Do not hit the live SEC API in tests — mock fetch.
Place them in backend/src/clients/edgar/__tests__/.

- resolveTicker returns the correct padded CIK for a known ticker
- lookup is case-insensitive ("aapl" and " AAPL " both work)
- unknown ticker throws TickerNotFound
- company_tickers.json is downloaded only once across multiple calls,
  including concurrent ones
- a 403 response is mapped to EdgarUnavailable
- a submissions response failing zod validation throws EdgarUnavailable

Save a trimmed real fixture of company_tickers.json (~5 entries, real key and
field names preserved) under __tests__/fixtures/ and mock against it rather
than inventing a shape.

## Acceptance criteria
1. test passes in backend/
2. A temporary scratch script resolves AAPL, SPOT and JPM to the correct
   10-digit CIKs against the live API and fetches each one's submissions
   without error. Run it yourself to confirm, then delete it.
3. No any types. No fetch calls outside clients/edgar/http.ts.
4. Nothing outside clients/edgar imports from its internal files.

Then stop and wait for instructions
