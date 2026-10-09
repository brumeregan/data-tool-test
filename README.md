# Data Tool for EDGAR's API

A small full-stack scaffold: a React frontend and an Express backend, both TypeScript and both run as Docker containers.

## Prerequisites

- Docker with Docker Compose v2
- (Optional, for running outside Docker) Node.js 22+

## Run with Docker Compose

```bash
docker compose up --build
```

Open http://localhost:5173. The page provides a simple interface to query the backend for SEC filings data.

Source in `backend/src` and `frontend/src` is mounted into the containers, so edits hot-reload.

Set a real value for `SEC_USER_AGENT` in `docker-compose.yml`. The SEC requires a descriptive User-Agent with contact details on EDGAR requests.

## Run the tests

Inside the containers:

```bash
docker compose run --rm backend npm test
docker compose run --rm frontend npm test
```

Or locally, after `npm install` in each directory:

```bash
cd backend && npm test
cd frontend && npm test
```

## Port map

| Service  | Container port | Host port | URL                   |
|----------|----------------|-----------|-----------------------|
| frontend | 5173           | 5173      | http://localhost:5173 |
| backend  | 3000           | 3000      | http://localhost:3000 |

## Why the frontend uses the Vite proxy

The browser never calls the backend directly. It requests `/api/...` from the Vite dev server (same origin), and Vite forwards the request to `http://backend:3000`, stripping the `/api` prefix. That means:

- no CORS configuration is needed on the backend;
- the browser doesn't need to know the backend's address (`backend` is only resolvable on the Docker network);
- the frontend code uses relative URLs, so the same code works behind a reverse proxy later.
