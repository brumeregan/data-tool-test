# Prompts

## Prompt 1 — Scaffold

Data-tool for EDGARs API

Lets scaffold an application that contains frontend and backend parts. all parts should be deployed as containerized services.
for frontend use ReactJs
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
- src/api.ts handle all fetches to the backend, returning parsed JSON or throwing an ApiError with the status code and message
- App.tsx: nothing but a component that calls /api/health and renders the
  result, as an end-to-end proof the proxy works
- One trivial Vitest test so the harness is proven

Docker:
- Dev-focused images, node:22-alpine, no multi-stage build
- compose mounts ./backend/src and ./frontend/src as volumes for hot reload
- Backend on 3000, frontend on 5173, frontend depends on backend
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
submissions.ts   - CIK to raw submissions document
schemas.ts   -  zod schemas for EDGAR response shapes
types.ts   for types inferred from those schemas
index.ts    for re-export the public API only

http.ts
- Sends a User-Agent header on every request, read from process.env.SEC_USER_AGENT.
  The SEC requires a declared User-Agent with contact info; anonymous clients
  get 403s.
- Exposes getJson(url: string): Promise<unknown> returning parsed JSON. It
  must NOT know about zod or about specific EDGAR shapes — callers validate.
- Maps failures to the typed errors in src/errors.ts to EdgarUnavailable
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
- Return the validated object, typed
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

## Prompt 4 — GET /companies/:ticker/filings

Implement GET /companies/:ticker/filings. Create EDGAR client  and normalizer into a real route. Do NOT implement
/filings/summary or any UI; those come next and I want them separate.

Do NOT modify normalize.ts, paginate(), or their tests. The existing
paginate(filings, page, limit) -> { items, total, page, limit, totalPages }
signature stays as it is; build on top of it.

## Layering
Add a thin service layer between the route and everything below it:

backend/src/services/filings.ts
  getFilings({ ticker, form, page, limit, sort })
    -> resolveTicker -> fetch submissions -> normalize -> filter -> sort
       -> paginate

The route handler stays thin: validate input, call the service, send the
response. No EDGAR knowledge, no array manipulation in the route.

backend/src/routes/filings.ts holds the Express router.

## Request contract
GET /companies/:ticker/filings

Query params, validated with zod in backend/src/schemas.ts:
- form    optional string, e.g. "10-K". Uppercased and trimmed before use.
- page    optional integer >= 1, default 1. Use z.coerce.number() — query
          params arrive as strings.
- limit   optional integer 1..100, default 25
- sort    optional "asc" | "desc", default "desc" (newest first)

Invalid params return 400 with a message naming the bad field.

## Response contract
200:
{
  "company": { "ticker": "AAPL", "cik": "0000320193", "name": "Apple Inc." },
  "items": [ /* Filing objects from the normalizer */ ],
  "total": 412,
  "page": 1,
  "limit": 25,
  "totalPages": 17
}

- total is the count after the form filter is applied, not the company's total
  filing count. The frontend needs it to know whether more pages exist.
- items is always an array, never null.
- A ticker with no filings matching the filter returns 200 with items: [] and
  total: 0 — not a 404. Only an unresolvable ticker is a 404.

Also return the set of distinct form types present for this company, so the
frontend can populate its filter dropdown without a second request. Add it as
a sibling field, e.g. "availableForms": ["10-K", "10-Q", "8-K", ...], sorted.
Compute it from the full normalized list BEFORE filtering.

## Errors
Use the existing error-handling middleware. Do not try/catch in the route.
- TickerNotFound   -> 404, { error: { code: "TICKER_NOT_FOUND", message } }
- EdgarUnavailable -> 502, { error: { code: "EDGAR_UNAVAILABLE", message } }
- zod validation failure -> 400, { error: { code: "INVALID_QUERY", message } }
One consistent error envelope across all of them.

## Wiring
Mount the router in src/index.ts. Keep /health working.

## Tests (Vitest + supertest)
Location: backend/src/routes/__tests__/filings.test.ts
Mock the EDGAR client module — no live network calls in tests.

- 200 with the correct envelope shape for a known ticker
- form filter narrows results and total reflects the filtered count
- sort=asc and sort=desc both return correctly ordered items
- page and limit slice correctly; a page past the end gives items: [] with the
  full total and correct totalPages still reported
- defaults apply when params are omitted (page 1, limit 25, sort desc)
- limit above 100 is a 400
- page 0 or negative is a 400
- unknown ticker gives 404 with the right error code
- EdgarUnavailable from the client surfaces as 502
- availableForms is computed before filtering, so it's identical whether or not
  a form filter is applied

## Acceptance criteria
1. npm test passes in backend/, including the pre-existing tests, unchanged
2. Against the live API, verify by hand and show me the output:
   - /companies/AAPL/filings?form=10-K&limit=5
   - /companies/JPM/filings?limit=10&page=2
   - /companies/SPOT/filings?limit=5   (foreign issuer, files 20-F not 10-K)
   - /companies/NOTAREALTICKER/filings  (expect 404)
   Open one returned documentUrl in a browser and confirm it actually loads on
   sec.gov.
3. No any types. No EDGAR or array logic inside the route handler.

## Prompt 5 — GET /filings/summary

Implement GET /filings/summary with Sonnet 5 agent.   Do not modify any other existed routes

## What it does
Given a set of companies, return for each: the number of filings per form type
over the last 12 months, and the date of its latest 10-K.

## Layering
backend/src/services/summary.ts holds the aggregation.
backend/src/routes/summary.ts holds the Express router.
Reuse the existing service/client/normalizer — no new EDGAR fetching code.

## Request contract
GET /filings/summary?tickers=AAPL,SPOT,JPM

- tickers: required, comma-separated, 1..10 entries. Validate with zod in
  backend/src/schemas.ts. Trim, uppercase, deduplicate. Empty or >10 is a 400.

## Response contract
200:
{
  "companies": [
    {
      "ticker": "AAPL",
      "cik": "0000320193",
      "name": "Apple Inc.",
      "countsByForm": { "8-K": 11, "10-Q": 3, "10-K": 1, "4": 47 },
      "totalLast12Months": 62,
      "latest10K": { "filingDate": "2024-11-01", "documentUrl": "https://..." }
    },
    {
      "ticker": "SPOT",
      "cik": "0001639920",
      "name": "Spotify Technology S.A.",
      "countsByForm": { "6-K": 8, "20-F": 1 },
      "totalLast12Months": 9,
      "latest10K": null,
      "note": "Foreign private issuer — files 20-F instead of 10-K"
    }
  ],
  "errors": [
    { "ticker": "NOTREAL", "code": "TICKER_NOT_FOUND", "message": "..." }
  ]
}

Critical details:
- SPOTIFY HAS NO 10-K. It's a foreign private issuer and files 20-F. latest10K
  must be null, not an error, not a crash. Surface the equivalent annual form
  in a way the UI can use — either the "note" field above or a separate
  latestAnnualReport field carrying the 20-F. Pick one, and comment the choice.
- latest10K searches the FULL filing history, not just the last 12 months —
  a company's most recent 10-K may be 13 months old.
- The 12-month window applies only to countsByForm and totalLast12Months.
  Define the window as "filingDate >= today minus 12 months", compute the
  cutoff once per request, and comment the boundary choice (inclusive).
- countsByForm counts EVERY form type present in the window, not a fixed list.
- ONE FAILING COMPANY MUST NOT FAIL THE WHOLE RESPONSE. Use
  Promise.allSettled, put successes in companies[] and failures in errors[],
  and still return 200 as long as at least one succeeded. If every ticker
  fails, return the appropriate error status instead.

## Performance
- Fetch companies in parallel, but rely on the existing throttle in the client
  so we stay under the SEC's 10 req/s ceiling.
- The per-CIK submissions cache must be doing its work here: calling
  this endpoint twice in a row with the same tickers should produce no second
  round of network requests. Verify this.

## Wiring
Mount the router in src/index.ts. Keep all routes working.

## Tests (Vitest + supertest)
Location: backend/src/routes/__tests__/summary.test.ts
Mock the EDGAR client — no live network in tests. Build fixtures with dates
relative to a frozen clock (vi.useFakeTimers) so the 12-month window stays
deterministic.

- multiple tickers return in one response
- countsByForm excludes a filing dated 13 months ago and includes one dated
  11 months ago
- latest10K picks the most recent 10-K even when it falls outside the 12-month
  window
- latest10K is null for a company whose history contains no 10-K, and the
  response still succeeds
- a "10-K/A" amendment is not mistaken for a 10-K
- one unknown ticker among valid ones lands in errors[] while the rest succeed,
  status still 200
- all tickers failing returns a non-200
- duplicate tickers in the query are deduplicated
- more than 10 tickers is a 400
- missing tickers param is a 400

## Acceptance criteria
1. npm test passes in backend/, all earlier tests unchanged and still green
2. Against the live API, run and show me the output of:
   /filings/summary?tickers=AAPL,SPOT,JPM
   Confirm Spotify returns latest10K: null without an error, and that Apple's
   latest10K date matches what's on sec.gov.
3. Call it twice and confirm the second call hits the cache rather than the
   network — log or otherwise demonstrate this.
4. No any types.

Then stop. Don't start the frontend.

## Prompt 6 — Filings list UI

Build the filings list UI ONLY.  Do not modify anything in backend/.

## Stack constraints
- React + TypeScript, strict. No any.
- No component library, no Tailwind, no CSS framework. Plain CSS modules or a
  single stylesheet. Keep it clean and readable.
- No state management library. useState/useEffect is enough at this size.
- All requests go through the existing src/api.ts helper, which fetches
  relative to /api and is proxied to the backend by Vite. Never hardcode
  http://localhost:3000 — that breaks the containerized setup.

## Types
Create frontend/src/types.ts mirroring the backend response contract exactly:
Filing, Company, and the filings list envelope
{ company, items, total, page, limit, totalPages, availableForms }.
Hand-write these to match the backend; don't import across the repo boundary.

## Structure
src/
 api.ts                     # extend: add getFilings(params)
types.ts
hooks/useFilings.ts          # fetch + loading/error/data state
components/
  -FilingsPage.tsx        # owns query state, composes the rest
  -CompanySelector.tsx
   - FilingsControls.tsx    # form filter + sort toggle
   - FilingsTable.tsx
   - Pagination.tsx

Keep components presentational where possible - FilingsPage owns the state and
passes values plus callbacks down.

## Behaviour

CompanySelector:
- A text input for a ticker plus a submit button (Enter also submits).
- Three quick-pick buttons: AAPL, SPOT, JPM.
- Uppercase and trim before sending.

FilingsControls:
- Form-type dropdown populated from availableForms in the last response, with
  an "All forms" option. Do not hardcode the list of form types.
- Sort toggle for filing date, asc/desc, defaulting to desc.

FilingsTable:
- Columns: form, filing date, report date, accession number, and a link.
- reportDate is nullable — render "—" rather than "null" or an empty cell.
- The link opens documentUrl in a new tab (target="_blank",
  rel="noopener noreferrer").

Pagination:
- Previous / Next plus "Page X of Y" and the total count.
- Disable Previous on page 1 and Next on the last page.

## State rules — these are where this kind of UI usually goes wrong
- Changing company, form filter, or sort MUST reset page to 1. Otherwise you
  land on page 7 of a 2-page result and see an empty table.
- Changing company must clear the form filter, since availableForms differs
  per company and a stale filter can produce a confusing empty list.
- Handle out-of-order responses: if the user switches company quickly, a slow
  earlier request must not overwrite a newer one. Use an AbortController or an
  incrementing request id in useFilings.
- Debounce nothing; requests fire on explicit submit or control change, not
  on every keystroke.

## Required states - render all four properly
- loading: a simple indicator; keep the controls visible and disabled rather
  than unmounting them, so the layout doesn't jump
- error: show the backend's error message. A 404 for an unknown ticker should
  read as "No company found for ticker XYZ", not as a raw error dump.
- empty: items: [] with a valid company is NOT an error. Show "No filings
  match this filter" and keep the controls usable.
- success: the table

## Tests (Vitest + @testing-library/react)
Location: frontend/src/components/__tests__/
Mock the api module — no real network calls.
- table renders the rows returned by a mocked response
- null reportDate renders as "—"
- changing the form filter resets page to 1
- changing company clears the form filter
- a 404 from the API renders the friendly not-found message, not a crash
- empty items renders the empty state, not the error state

## Acceptance criteria
1. test passes in frontend/
2. Running docker compose up, in the browser:
   - AAPL loads and shows filings
   - filtering to 10-K narrows the list and the total updates
   - flipping the sort reverses the order
   - Next/Previous page through JPM's history correctly
   - switching to SPOT works and the form dropdown now shows 20-F and 6-K
   - typing NOTAREALTICKER shows the friendly not-found message
   - clicking a filing link opens the real document on sec.gov
   Confirm each of these yourself before telling me you're done.
3. No any types. No hardcoded backend URL.

Then stop. Don't build the summary view.

## Prompt 7 — Summary view

Build the summary view. Do not modify anything in backend/,
and do not change the filings list beyond adding navigation between the two
views.

## Design decision, made deliberately
The assignment says to display the summary "in whatever form you find most
useful". We're choosing a matrix table: one row per company, one column per
form type, counts in the cells, plus a latest-10-K column. Rationale: the
point of the endpoint is cross-company comparison over a common set of form
types, and a matrix makes a missing form type visible as a gap in a column
rather than as an absence you have to notice. Put this rationale in a short
comment at the top of the component — I'll be asked to justify it.

No charts. Counts across a handful of companies are read, not eyeballed.

## Types
Extend frontend/src/types.ts to mirror the backend summary contract exactly:
the companies[] entries with countsByForm, totalLast12Months, latest10K
(nullable), the optional note field, and the errors[] array.

## Structure
src/
├── api.ts                      # extend: add getSummary(tickers)
├── hooks/
│   └── useSummary.ts
└── components/
    ├── SummaryPage.tsx         # owns ticker set + fetch state
    ├── TickerInput.tsx         # manage the set of companies to compare
    └── SummaryTable.tsx        # the matrix

Add simple navigation between the filings list and the summary — two tabs or
two buttons at the top level. No router library; a single piece of view state
in App.tsx is enough.

## Behaviour

TickerInput:
- Manage a SET of tickers, not one. Add via input + button, remove via an × on
  each chip.
- Default the set to AAPL, SPOT, JPM on first load and fetch immediately, so
  the view is never empty on arrival.
- Uppercase, trim, reject duplicates client-side.
- Enforce the backend's cap of 10 and disable Add at the limit.

SummaryTable:
- Rows: companies. Columns: the union of every form type across all returned
  companies, so the matrix is rectangular.
- Column ordering: put the meaningful annual/quarterly/current forms first
  (10-K, 10-Q, 8-K, 20-F, 6-K), then everything else alphabetically. Companies
  file a lot of Form 4s and similar noise; don't let that lead.
- A company with no filings of a given form shows 0 or "—", visibly distinct
  from a real count. Pick one and be consistent.
- Include the totalLast12Months column and a latest 10-K column.

## The Spotify case — handle this explicitly
latest10K is null for foreign private issuers. The cell must NOT render as
blank, "null", or an error. Render something that explains itself, e.g.
"—" with the backend's note shown as a tooltip or a small caption beneath,
making clear the company files 20-F instead. A reviewer will look straight at
this cell.

## The errors[] array — do not ignore it
The endpoint returns 200 with a partial result when some tickers fail. Render
those failures as a small notice above or below the table ("NOTREAL: no
company found"), with the successful rows still shown. Silently dropping them
is the failure mode to avoid here.

## Required states
- loading: indicator, controls stay visible and disabled
- error: only when the whole request fails; show the backend message
- partial: table plus the per-ticker error notices — this is the interesting one
- empty ticker set: prompt to add a company, not an error

Reuse whatever loading/error presentation you built in previous steps rather than
inventing a second style.

## Tests (Vitest + @testing-library/react)
Location: frontend/src/components/__tests__/
Mock the api module.
- matrix renders one row per company and a column per distinct form type
- a company missing a form type renders the zero/dash cell, not a blank
- null latest10K renders the explanatory cell, not "null"
- entries in errors[] render as notices while successful rows still display
- removing a ticker refetches with the reduced set
- adding a duplicate ticker is rejected without a request

## Acceptance criteria
1. npm test passes in frontend/, all tests unchanged and still green
2. With docker compose up, in the browser:
   - the summary loads AAPL, SPOT, JPM by default
   - Spotify's latest-10-K cell explains itself rather than showing null
   - adding a bogus ticker shows a notice while the other rows survive
   - removing a ticker refetches correctly
   - both views are reachable via the navigation and each still works
   Confirm all of these yourself before reporting done.
3. No any types. No hardcoded backend URL.
