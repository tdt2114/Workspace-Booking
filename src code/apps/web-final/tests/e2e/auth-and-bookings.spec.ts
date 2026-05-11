import { expect, test } from "@playwright/test";
import { loginAsRegularUser, requireRoleCredentials } from "./fixtures";

test.describe("auth and bookings pages", () => {
  test.skip(
    requireRoleCredentials(["user"]),
    "Set user E2E credentials before running web-final frontend E2E tests.",
  );

  test("signs in and opens the bookings page", async ({ page }) => {
    await loginAsRegularUser(page);

    await page.getByTestId("dashboard-open-bookings").click();
    await page.waitForURL("**/bookings");

    await expect(page.getByTestId("bookings-page")).toBeVisible();
    await expect(page.getByTestId("bookings-tab-my")).toBeVisible();
  });
});
