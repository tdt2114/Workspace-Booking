import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config } from 'dotenv';
import { AppModule } from './app.module';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const DEV_FRONTEND_PORTS = new Set(['3000', '3002']);

function loadEnvironment() {
  const candidates = [
    join(process.cwd(), '.env'),
    join(process.cwd(), '..', '.env'),
    join(process.cwd(), '..', '..', '.env'),
  ];

  const envPath = candidates.find((candidate) => existsSync(candidate));

  if (envPath) {
    config({ path: envPath });
  }
}

function isPrivateIpv4(hostname: string) {
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  const match = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);

  if (!match) {
    return false;
  }

  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}

function parseConfiguredOrigins() {
  return (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin: string) {
  const configuredOrigins = parseConfiguredOrigins();

  if (configuredOrigins.includes(origin)) {
    return true;
  }

  try {
    const parsedOrigin = new URL(origin);

    if (LOCAL_HOSTS.has(parsedOrigin.hostname)) {
      return DEV_FRONTEND_PORTS.has(parsedOrigin.port);
    }

    if (isPrivateIpv4(parsedOrigin.hostname)) {
      return DEV_FRONTEND_PORTS.has(parsedOrigin.port);
    }

    return false;
  } catch {
    return false;
  }
}

async function bootstrap() {
  loadEnvironment();
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}
void bootstrap();
