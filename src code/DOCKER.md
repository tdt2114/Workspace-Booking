# Docker Runbook

This project runs with two containers:

- `api`: NestJS backend on port `3001`
- `web-final`: Next.js frontend on port `3002` (standalone output)

Supabase is expected to run in Supabase Cloud. The compose setup reads local env files and does not commit secrets.

## Required Env Files

Create these files before building:

```powershell
Copy-Item .env.example .env
```

Fill in the Supabase values in `.env`.

> **Note:** `NEXT_PUBLIC_*` variables are baked into the Next.js bundle at **build time** via Docker build args in `docker-compose.yml`. You do **not** need a separate `.env.local` for the Docker build — they are read automatically from `.env` via `${VAR}` interpolation in compose.

For Docker, the frontend proxy is configured by `docker-compose.yml`:

```env
NEXT_PUBLIC_API_BASE_URL=/api
API_PROXY_TARGET=http://api:3001
```

## Architecture

```
Browser → web-final:3002 → /api/* → api:3001
                            (Next.js rewrite proxy)
Both services share the isolated `workspace-net` bridge network.
```

## Run

From the `src code/` directory:

```powershell
docker compose up --build
```

Open:

```text
http://localhost:3002
```

Swagger API docs:

```text
http://localhost:3001/docs
```

> **Note:** `web-final` waits for `api` to pass its healthcheck before starting (`depends_on: condition: service_healthy`). First boot may take ~40–60 s.

For protected endpoints, sign in at `http://localhost:3002/login`, copy the Supabase `access_token` from browser local storage, then use Swagger's `Authorize` button with a Bearer token.

## Stop

```powershell
docker compose down
```

## Rebuild From Scratch

```powershell
docker compose build --no-cache
docker compose up
```

## Image Size (expected after standalone output)

| Service | Before | After |
|---|---|---|
| `web-final` | ~1–2 GB | ~200–400 MB |
| `api` | ~600 MB | ~400–500 MB |
