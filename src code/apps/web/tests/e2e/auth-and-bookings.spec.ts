import { expect, test } from "@playwright/test";
import { loginAsE2EUser, requireE2ECredentials } from "./fixtures";

test.describe("auth and bookings pages", () => {
  test.skip(
    requireE2ECredentials(),
    "Set E2E_EMAIL and E2E_PASSWORD before running frontend E2E tests.",
  );

  test("signs in and opens the bookings page", async ({ page }) => {
    await loginAsE2EUser(page);

    await page.getByTestId("dashboard-open-bookings").click();
    await page.waitForURL("**/bookings");

    await expect(page.getByTestId("bookings-page")).toBeVisible();
    await expect(page.getByTestId("bookings-current-user-email")).toContainText(
      process.env.E2E_EMAIL ?? "",
    );
    await expect(page.getByTestId("bookings-my-list")).toBeVisible();
  });
});
