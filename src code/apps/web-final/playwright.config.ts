import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

[
  resolve(process.cwd(), ".env.e2e"),
  resolve(process.cwd(), ".env.local.e2e"),
  resolve(process.cwd(), "../web/.env.e2e"),
  resolve(process.cwd(), "../web/.env.local.e2e"),
  resolve(process.cwd(), "../../.env.e2e"),
  resolve(process.cwd(), "../../.env.local.e2e"),
].forEach(loadEnvFile);

const baseURL =
  process.env.E2E_BASE_URL_FINAL ??
  process.env.WEB_FINAL_E2E_BASE_URL ??
  "http://localhost:3002";
const apiURL = process.env.E2E_API_URL ?? "http://localhost:3001";

const useWebServer = process.env.PW_SKIP_WEBSERVER !== "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: useWebServer
    ? [
        {
          command: "npm run start:dev",
          cwd: resolve(process.cwd(), "../api"),
          url: `${apiURL}/health`,
          reuseExistingServer: true,
          timeout: 120_000,
        },
        {
          command: "npm run dev -- --port 3002",
          cwd: process.cwd(),
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      ]
    : undefined,
});
