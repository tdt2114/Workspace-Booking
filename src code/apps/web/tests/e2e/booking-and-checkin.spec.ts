import { expect, test } from "@playwright/test";
import {
  loginAsBookingFlowUser,
  requireBookingFlowCredentials,
} from "./fixtures";

test.describe("booking and check-in core flow", () => {
  test.skip(
    requireBookingFlowCredentials(),
    "Set E2E_BOOKING_EMAIL and E2E_BOOKING_PASSWORD to a clean account before running the booking/check-in E2E flow.",
  );

  test("creates a booking from the floor map and checks in with the matching QR value", async ({
    page,
  }) => {
    const candidateWorkspaceNames = [
      "Desk A-01",
      "Desk A-02",
      "Desk A-03",
      "Desk B-01",
      "Desk B-02",
      "Desk B-03",
    ];
    const uniqueStartDate = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
    uniqueStartDate.setSeconds(0, 0);
    uniqueStartDate.setMinutes(uniqueStartDate.getMinutes() + 7);

    const uniqueEndDate = new Date(uniqueStartDate.getTime() + 60 * 60 * 1000);
    const toDateTimeLocal = (date: Date) => {
      const localDate = new Date(
        date.getTime() - date.getTimezoneOffset() * 60_000,
      );
      return localDate.toISOString().slice(0, 16);
    };

    const viewStart = toDateTimeLocal(uniqueStartDate);
    const viewEnd = toDateTimeLocal(uniqueEndDate);

    await loginAsBookingFlowUser(page);

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

    let selectedWorkspaceName: string | null = null;

    for (const workspaceName of candidateWorkspaceNames) {
      await page.locator(`[data-workspace-name="${workspaceName}"]`).first().click();
      await expect(
        page.getByTestId("floor-map-selected-workspace-name"),
      ).toContainText(workspaceName);

      await page.getByTestId("floor-map-booking-start").fill(viewStart);
      await page.getByTestId("floor-map-booking-end").fill(viewEnd);

      const createButton = page.getByTestId("floor-map-create-booking");
      const disabled = await createButton.isDisabled();

      if (!disabled) {
        selectedWorkspaceName = workspaceName;
        break;
      }
    }

    expect(selectedWorkspaceName, "Expected at least one workspace to be bookable").not.toBeNull();

    const selectedWorkspaceQrValue = await page
      .getByTestId("floor-map-selected-workspace-qr")
      .textContent();

    expect(selectedWorkspaceQrValue?.trim(), "Expected selected workspace QR value").toBeTruthy();

    await page.getByTestId("floor-map-create-booking").click();

    await expect(page.getByTestId("floor-map-booking-success")).toContainText(
      "Booking created successfully.",
    );

    await page.goto(`/check-in?qr=${selectedWorkspaceQrValue?.trim()}`);
    await expect(page.getByTestId("check-in-page")).toBeVisible();
    await page.getByTestId("check-in-scan-time").fill(viewStart);

    await expect(page.getByTestId("check-in-matching-workspace")).toContainText(
      selectedWorkspaceName ?? "",
    );

    await page.getByTestId("check-in-submit").click();

    await expect(page.getByTestId("check-in-success")).toContainText(
      /Check-in successful|Booking was already checked in/,
    );
  });
});
