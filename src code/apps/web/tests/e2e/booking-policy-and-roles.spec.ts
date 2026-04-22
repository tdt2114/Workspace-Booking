import { expect, test, type Page } from "@playwright/test";
import { loginAsRole, requireRoleCredentials } from "./fixtures";

const candidateWorkspaceNames = [
  "Desk A-01",
  "Desk A-02",
  "Desk A-03",
  "Desk B-01",
  "Desk B-02",
  "Desk B-03",
];

function toDateTimeLocal(date: Date) {
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );
  return localDate.toISOString().slice(0, 16);
}

async function openFloorMapWithWindow(
  page: Page,
  startDate: Date,
  endDate: Date,
) {
  const viewStart = toDateTimeLocal(startDate);
  const viewEnd = toDateTimeLocal(endDate);

  await page.goto("/floor-map");
  await expect(page.getByTestId("floor-map-page")).toBeVisible();
  await expect(page.getByTestId("floor-map-svg-container")).toBeVisible();

  await page.getByTestId("floor-map-view-start").fill(viewStart);
  const floorStateResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/bookings/floor-state") && response.ok(),
  );
  await page.getByTestId("floor-map-view-end").fill(viewEnd);
  await floorStateResponse;

  for (const workspaceName of candidateWorkspaceNames) {
    await page
      .locator(`[data-workspace-name="${workspaceName}"]`)
      .first()
      .click();
    await expect(
      page.getByTestId("floor-map-selected-workspace-name"),
    ).toContainText(workspaceName);

    await page.getByTestId("floor-map-booking-start").fill(viewStart);
    await page.getByTestId("floor-map-booking-end").fill(viewEnd);

    if (!(await page.getByTestId("floor-map-create-booking").isDisabled())) {
      return;
    }
  }

  throw new Error("Expected at least one candidate workspace to be selectable.");
}

test.describe("booking policy and role access", () => {
  test.skip(
    requireRoleCredentials(["employee", "manager", "admin"]),
    "Set E2E_PASSWORD and optional role-specific emails/passwords before running frontend E2E tests.",
  );

  test("employee sees personal bookings but cannot access manager lifecycle tools", async ({
    page,
  }) => {
    await loginAsRole(page, "employee");

    await page.goto("/bookings");
    await expect(page.getByTestId("bookings-page")).toBeVisible();
    await expect(page.getByTestId("bookings-current-user-email")).toContainText(
      "employee@demo.com",
    );
    await expect(page.getByTestId("bookings-current-user-role")).toContainText(
      "Role: employee",
    );
    await expect(page.getByTestId("bookings-my-list")).toBeVisible();
    await expect(page.getByTestId("bookings-lifecycle-disabled")).toContainText(
      "This panel is only enabled for manager and admin roles.",
    );
    await expect(
      page.getByTestId("bookings-system-section"),
    ).toHaveCount(0);
  });

  test("manager can access lifecycle tools and system booking management", async ({
    page,
  }) => {
    await loginAsRole(page, "manager");

    await page.goto("/bookings");
    await expect(page.getByTestId("bookings-page")).toBeVisible();
    await expect(page.getByTestId("bookings-current-user-email")).toContainText(
      "manager@demo.com",
    );
    await expect(page.getByTestId("bookings-current-user-role")).toContainText(
      "Role: manager",
    );
    await expect(page.getByTestId("bookings-run-no-show")).toBeVisible();
    await expect(page.getByTestId("bookings-run-completed")).toBeVisible();
    await expect(page.getByTestId("bookings-system-section")).toBeVisible();
  });

  test("admin can access lifecycle tools and system booking management", async ({
    page,
  }) => {
    await loginAsRole(page, "admin");

    await page.goto("/bookings");
    await expect(page.getByTestId("bookings-page")).toBeVisible();
    await expect(page.getByTestId("bookings-current-user-email")).toContainText(
      "admin@demo.com",
    );
    await expect(page.getByTestId("bookings-current-user-role")).toContainText(
      "Role: admin",
    );
    await expect(page.getByTestId("bookings-run-no-show")).toBeVisible();
    await expect(page.getByTestId("bookings-run-completed")).toBeVisible();
    await expect(page.getByTestId("bookings-system-section")).toBeVisible();
  });

  test("booking creation shows the minimum lead-time validation error", async ({
    page,
  }) => {
    const startDate = new Date(Date.now() + 10 * 60 * 1000);
    startDate.setSeconds(0, 0);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    await loginAsRole(page, "employee");
    await openFloorMapWithWindow(page, startDate, endDate);

    await page.getByTestId("floor-map-create-booking").click();

    await expect(page.getByTestId("floor-map-booking-error")).toContainText(
      "Bookings must be created at least 15 minutes before the start time",
    );
  });

  test("booking creation shows the maximum duration validation error", async ({
    page,
  }) => {
    const startDate = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
    startDate.setSeconds(0, 0);
    startDate.setMinutes(startDate.getMinutes() + 20);
    const endDate = new Date(startDate.getTime() + 9 * 60 * 60 * 1000);

    await loginAsRole(page, "employee");
    await openFloorMapWithWindow(page, startDate, endDate);

    await page.getByTestId("floor-map-create-booking").click();

    await expect(page.getByTestId("floor-map-booking-error")).toContainText(
      "Booking duration must not exceed 8 hours",
    );
  });
});
