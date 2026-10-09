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
