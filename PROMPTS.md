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

## Prompt 3 — Filing normalizer

As a next task implement the filling nomalizer - the main transformation for this project.

## Context
EDGAR returns filings in a COLUMNAR format: filings.recent is an object of
parallel arrays (form, filingDate, reportDate, accessionNumber,
primaryDocument, ...), all index-aligned, rather than an array of objects.
The job here is to zip index i across every array into one object per filing.

## Where it goes
backend/src/services/normalize.ts . It takes an already-validated submissions object as input and
returns our own domain type. It must be a PURE function.

Define the Filing domain type in backend/src/services/types.ts.

## The Filing shape
Each normalized filing should carry at least:
- accessionNumber   (as-is, with dashes)
- form              e.g. "10-K", "10-Q", "8-K", "20-F", "10-K/A"
- filingDate        ISO date string
- reportDate        ISO date string or null — this field IS sometimes empty
                    in real EDGAR data, so model it as nullable
- primaryDocument   filename, may be an empty string
- documentUrl       constructed, see below
- filingIndexUrl    constructed, see below

## URL construction — get this exactly right
Two different shapes of the accession number are needed:
- documentUrl:
  https://www.sec.gov/Archives/edgar/data/{cikNoLeadingZeros}/{accessionNoDashes}/{primaryDocument}
- filingIndexUrl:
  https://www.sec.gov/Archives/edgar/data/{cikNoLeadingZeros}/{accessionNoDashes}/{accessionWithDashes}-index.htm

Note the CIK has leading zeros STRIPPED in the archive path, while the
submissions API URL needs it zero-padded to 10 digits. Don't mix them up.

If primaryDocument is an empty string, documentUrl must fall back to
filingIndexUrl rather than producing a URL with a trailing slash and no file.

## Correctness requirements
- Assert all parallel arrays have the same length before zipping. If they
  don't, throw a clear error naming the mismatch - silent misalignment would
  attribute the wrong date to the wrong filing, which is the worst possible
  failure mode here.
- Empty reportDate ("") must become null, not "".
- Preserve EDGAR's original ordering; do not sort here. Sorting is a route
  concern.
- Trim whitespace on string fields.

## Also implement, as separate pure functions in the same module
- filterByForm(filings, form): exact match on the form string. Add a documented
  option for whether "10-K" should also match its amendment "10-K/A" — default
  to NOT matching, and put a one-line comment explaining the choice, since this
  is a judgment call I'll be asked about.
- sortByFilingDate(filings, direction): stable sort, "asc" | "desc".
- paginate(filings, page, limit): returns { items, total, page, limit,
  totalPages }.

Keep each one small and independently testable.

## Tests (Vitest) — this is the most important test file in the project
Location: backend/src/domain/__tests__/normalize.test.ts

Save a REAL trimmed fixture: fetch Apple's submissions document, cut
filings.recent down to about 10 filings (keeping all the parallel arrays
consistently trimmed), and save it under __tests__/fixtures/apple-submissions.json.
Include at least one 10-K, a few 8-Ks, and one entry with an empty reportDate.
Use real data, not invented data.

Cover:
- correct number of filings out
- field alignment: filing at index 2 has the form, date AND accession number
  that all belong to index 2 in the source arrays
- documentUrl is constructed exactly right for a known real filing (assert the
  full literal string)
- filingIndexUrl is constructed exactly right
- CIK leading zeros are stripped in the archive path
- empty reportDate becomes null
- empty primaryDocument falls back to the index URL
- mismatched array lengths throw
- filterByForm returns only exact matches, and excludes "10-K/A" when filtering
  for "10-K" by default
- sortByFilingDate works both directions and is stable
- paginate returns correct totals and handles a page past the end (empty items,
  correct total)

## Acceptance criteria
1. npm test passes
2. normalize.ts imports nothing that performs I/O
3. No any types
4. Every function in the module is exported and directly tested

Then stop. Don't wire it into a route yet.
