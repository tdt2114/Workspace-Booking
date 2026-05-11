import { expect, test } from "@playwright/test";
import { loginAsRole, requireRoleCredentials } from "./fixtures";

test.describe("booking role access", () => {
  test.skip(
    requireRoleCredentials(["user", "space_owner", "admin"]),
    "Set user, space owner and admin E2E credentials before running role-access E2E tests.",
  );

  test("user cannot access system maintenance tools", async ({ page }) => {
    await loginAsRole(page, "user");

    await page.goto("/bookings");
    await expect(page.getByTestId("bookings-page")).toBeVisible();
    await expect(page.getByTestId("bookings-tab-my")).toBeVisible();
    await expect(page.getByTestId("bookings-tab-system")).toHaveCount(0);
    await expect(page.getByTestId("bookings-system-section")).toHaveCount(0);
  });

  test("space owner can view managed bookings but cannot access system maintenance tools", async ({ page }) => {
    await loginAsRole(page, "space_owner");

    await page.goto("/bookings");
    await expect(page.getByTestId("bookings-page")).toBeVisible();
    await page.getByTestId("bookings-tab-system").click();
    await expect(page.getByTestId("bookings-system-section")).toHaveCount(0);
    await expect(page.getByTestId("bookings-run-no-show")).toHaveCount(0);
    await expect(page.getByTestId("bookings-run-completed")).toHaveCount(0);
  });

  test("admin can access system maintenance tools", async ({ page }) => {
    await loginAsRole(page, "admin");

    await page.goto("/bookings");
    await expect(page.getByTestId("bookings-page")).toBeVisible();
    await page.getByTestId("bookings-tab-system").click();
    await expect(page.getByTestId("bookings-system-section")).toBeVisible();
    await expect(page.getByTestId("bookings-run-no-show")).toBeVisible();
    await expect(page.getByTestId("bookings-run-completed")).toBeVisible();
  });
});
