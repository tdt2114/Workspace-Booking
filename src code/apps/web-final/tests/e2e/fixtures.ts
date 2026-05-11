import { expect, Page } from "@playwright/test";

export type E2ERole = "user" | "space_owner" | "admin";

type E2ECredentials = {
  email: string;
  password: string;
};

function resolveRoleCredentials(role: E2ERole): E2ECredentials {
  const sharedPassword = process.env.E2E_PASSWORD ?? "";

  switch (role) {
    case "admin":
      return {
        email: process.env.E2E_ADMIN_EMAIL ?? "admin@demo.com",
        password: process.env.E2E_ADMIN_PASSWORD ?? sharedPassword,
      };
    case "space_owner":
      return {
        email: process.env.E2E_SPACE_OWNER_EMAIL ?? "space-owner@demo.com",
        password: process.env.E2E_SPACE_OWNER_PASSWORD ?? sharedPassword,
      };
    case "user":
    default:
      return {
        email:
          process.env.E2E_USER_EMAIL ??
          process.env.E2E_EMAIL ??
          "user@demo.com",
        password: process.env.E2E_USER_PASSWORD ?? sharedPassword,
      };
  }
}

export function requireRoleCredentials(roles: E2ERole[]) {
  return roles.some((role) => {
    const credentials = resolveRoleCredentials(role);
    return !credentials.email || !credentials.password;
  });
}

function resolveBookingFlowCredentials(): E2ECredentials {
  const userCredentials = resolveRoleCredentials("user");

  return {
    email: process.env.E2E_BOOKING_EMAIL ?? userCredentials.email,
    password:
      process.env.E2E_BOOKING_PASSWORD ??
      userCredentials.password ??
      process.env.E2E_PASSWORD ??
      "",
  };
}

export function requireBookingFlowCredentials() {
  const credentials = resolveBookingFlowCredentials();
  return !credentials.email || !credentials.password;
}

export async function loginAsUser(page: Page, credentials: E2ECredentials) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(credentials.email);
  await page.getByTestId("login-password").fill(credentials.password);
  await page.getByTestId("login-submit").click();

  await Promise.race([
    page.waitForURL("**/dashboard", { timeout: 15_000 }),
    expect(page.getByTestId("dashboard-page")).toBeVisible({ timeout: 15_000 }),
  ]);

  if (!page.url().includes("/dashboard")) {
    await page.goto("/dashboard");
  }

  await expect(page.getByTestId("dashboard-page")).toBeVisible();
}

export async function loginAsRole(page: Page, role: E2ERole) {
  await loginAsUser(page, resolveRoleCredentials(role));
}

export async function loginAsRegularUser(page: Page) {
  await loginAsRole(page, "user");
}

export async function loginAsBookingFlowUser(page: Page) {
  await loginAsUser(page, resolveBookingFlowCredentials());
}

export function buildLocalDateTimeValue(offsetMinutes: number) {
  const date = new Date(Date.now() + offsetMinutes * 60_000);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}
