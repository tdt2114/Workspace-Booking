import { expect, test } from "@playwright/test";
import { loginAsEmployee, requireRoleCredentials } from "./fixtures";

test.describe("auth and bookings pages", () => {
  test.skip(
    requireRoleCredentials(["employee"]),
    "Set employee E2E credentials before running web-final frontend E2E tests.",
  );

  test("signs in and opens the bookings page", async ({ page }) => {
    await loginAsEmployee(page);

    await page.getByTestId("dashboard-open-bookings").click();
    await page.waitForURL("**/bookings");

    await expect(page.getByTestId("bookings-page")).toBeVisible();
    await expect(page.getByTestId("bookings-tab-my")).toBeVisible();
  });
});
