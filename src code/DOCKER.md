# Docker Runbook

Project chay bang Docker Compose voi 2 service chinh:

- `api`: NestJS backend, expose `http://localhost:3001`
- `web-final`: Next.js frontend, expose `http://localhost:3002`

Supabase van dung Supabase Cloud. Compose doc bien moi truong tu file `.env` o thu muc `src code/`.

## Env

Tao file env:

```powershell
Copy-Item .env.example .env
```

Dien cac gia tri Supabase trong `.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SECRET_OR_SERVICE_ROLE_KEY
```

Voi Docker, frontend goi API qua Next.js rewrite proxy:

```env
NEXT_PUBLIC_API_BASE_URL=/api
API_PROXY_TARGET=http://api:3001
```

Khong can `apps/web-final/.env.local` khi build bang Docker Compose.

## Architecture

```txt
Browser -> web-final:3002 -> /api/* -> api:3001
                              Next.js rewrite proxy
```

Vi browser chi goi cung origin `/api`, dien thoai khong can truy cap truc tiep port `3001`.

## Chay tren may tinh

Tu thu muc `src code/`:

```powershell
docker compose up --build
```

Mo:

```txt
http://localhost:3002
```

Swagger API docs:

```txt
http://localhost:3001/docs
```

Dung lai:

```powershell
docker compose down
```

## Chay tren dien thoai de quet QR

Camera tren dien thoai can HTTPS. Neu mo bang `http://<IP-may-tinh>:3002`, trang co the load duoc nhung camera scanner se bi chan. Cach thay cho script `npm run mobile:up` la chay them profile `mobile` cua Docker Compose:

```powershell
docker compose --profile mobile up --build
```

Lay URL HTTPS cua Cloudflare tunnel trong log:

```powershell
docker compose logs -f mobile-tunnel
```

Tim dong co dang:

```txt
https://xxxx.trycloudflare.com
```

Tren dien thoai:

1. Mo URL `https://xxxx.trycloudflare.com/login`
2. Dang nhap user demo
3. Vao `/check-in`
4. Bam mo camera va quet QR

QR trong he thong chi can chua `qr_code_value`; app se doc gia tri QR va gui len `/api/check-in/scan` thong qua web proxy.

## Supabase redirect URLs

Neu dung email confirmation, magic link hoac OAuth, them tunnel URL vao Supabase:

```txt
Authentication -> URL Configuration -> Redirect URLs
https://xxxx.trycloudflare.com/**
```

Voi dang nhap email/password thong thuong va tat confirm email khi dev, buoc nay thuong khong can.

## Rebuild sach

```powershell
docker compose build --no-cache
docker compose up
```
