# Docker Runbook

This project runs with two containers:

- `api`: NestJS backend on port `3001`
- `web-final`: Next.js frontend on port `3002`

Supabase is expected to run in Supabase Cloud. The compose setup reads local env files and does not commit secrets.

## Required Env Files

Create these files before building:

```powershell
Copy-Item .env.example .env
Copy-Item apps/web-final/.env.example apps/web-final/.env.local
```

Fill in the Supabase values in both files.

For Docker, the frontend proxy is configured by `docker-compose.yml`:

```env
NEXT_PUBLIC_API_BASE_URL=/api
API_PROXY_TARGET=http://api:3001
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
