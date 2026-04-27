import { expect, test, type Page } from "@playwright/test";
import {
  buildLocalDateTimeValue,
  loginAsBookingFlowUser,
  requireBookingFlowCredentials,
} from "./fixtures";

type BookingItem = {
  id: string;
  workspace_id: string;
  start_time: string;
  end_time: string;
  status: string;
};

type WorkspaceItem = {
  id: string;
  floor_id: string;
  name: string;
  status: "available" | "maintenance" | "inactive";
  qr_code_value?: string;
};

type FloorItem = {
  id: string;
  floor_number: number;
  name: string | null;
};

type BookableWorkspaceFixture = {
  floorId: string;
  workspaceId: string;
  workspaceName: string;
  qrCodeValue: string;
};

async function readAccessToken(page: Page) {
  const token = await page.evaluate(() => {
    const authCookie = document.cookie
      .split("; ")
      .find((entry) => entry.includes("auth-token="));

    if (!authCookie) {
      return null;
    }

    const cookieValue = authCookie.split("=")[1];

    if (!cookieValue?.startsWith("base64-")) {
      return null;
    }

    try {
      const decodedValue = atob(cookieValue.slice("base64-".length));
      const parsedValue = JSON.parse(decodedValue) as { access_token?: string };
      return parsedValue.access_token ?? null;
    } catch {
      return null;
    }
  });

  expect(token).toBeTruthy();
  return token as string;
}

async function resolveApiBaseUrl(page: Page) {
  return page.evaluate(() => {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  });
}

async function requestApi<T>(
  page: Page,
  path: string,
  init?: {
    method?: string;
    body?: unknown;
  },
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const accessToken = await readAccessToken(page);
  const apiBaseUrl = await resolveApiBaseUrl(page);

  return page.evaluate(
    async ({ apiBaseUrl, token, path, init }) => {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method: init?.method ?? "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: init?.body ? JSON.stringify(init.body) : undefined,
      });

      let data: unknown = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      return {
        ok: response.ok,
        status: response.status,
        data: data as T | null,
      };
    },
    { apiBaseUrl, token: accessToken, path, init },
  );
}

async function cleanupActiveBookings(page: Page) {
  const bookingsResponse = await requestApi<{ items?: BookingItem[] }>(page, "/bookings/my");
  expect(bookingsResponse.ok).toBeTruthy();

  for (const booking of bookingsResponse.data?.items ?? []) {
    if (booking.status === "confirmed") {
      const cancelResponse = await requestApi<unknown>(
        page,
        `/bookings/${booking.id}/cancel`,
        {
          method: "PATCH",
          body: { cancelReason: "playwright-e2e-reset" },
        },
      );
      expect(cancelResponse.ok).toBeTruthy();
    }

    if (booking.status === "checked_in") {
      const releaseResponse = await requestApi<unknown>(
        page,
        `/bookings/${booking.id}/release`,
        { method: "PATCH" },
      );
      expect(releaseResponse.ok).toBeTruthy();
    }
  }
}

async function resolveBookableWorkspace(
  page: Page,
  startIso: string,
  endIso: string,
): Promise<BookableWorkspaceFixture | null> {
  const [floorsResponse, workspacesResponse] = await Promise.all([
    requestApi<{ items?: FloorItem[] }>(page, "/floors"),
    requestApi<{ items?: WorkspaceItem[] }>(page, "/workspaces"),
  ]);

  expect(floorsResponse.ok).toBeTruthy();
  expect(workspacesResponse.ok).toBeTruthy();

  const floors = floorsResponse.data?.items ?? [];
  const workspaces = workspacesResponse.data?.items ?? [];

  for (const floor of floors) {
    const floorStateResponse = await requestApi<{ items?: BookingItem[] }>(
      page,
      `/bookings/floor-state?floorId=${encodeURIComponent(floor.id)}&startTime=${encodeURIComponent(startIso)}&endTime=${encodeURIComponent(endIso)}`,
    );

    expect(floorStateResponse.ok).toBeTruthy();

    const reservedWorkspaceIds = new Set(
      (floorStateResponse.data?.items ?? []).map((item) => item.workspace_id),
    );

    const workspace = workspaces.find((item) => {
      return (
        item.floor_id === floor.id &&
        item.status === "available" &&
        !!item.qr_code_value &&
        !reservedWorkspaceIds.has(item.id)
      );
    });

    if (workspace?.qr_code_value) {
      return {
        floorId: floor.id,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        qrCodeValue: workspace.qr_code_value,
      };
    }
  }

  return null;
}

async function createBookingViaApi(
  page: Page,
  workspaceId: string,
  startIso: string,
  endIso: string,
) {
  const response = await requestApi<BookingItem>(page, "/bookings", {
    method: "POST",
    body: {
      workspaceId,
      startTime: startIso,
      endTime: endIso,
    },
  });

  expect(response.ok).toBeTruthy();
  return response.data;
}

test.describe("booking and check-in core flow", () => {
  test.skip(
    requireBookingFlowCredentials(),
    "Set booking-flow E2E credentials before running booking/check-in E2E tests.",
  );

  test("creates a booking from the floor map", async ({ page }) => {
    const bookingStartValue = buildLocalDateTimeValue(24 * 60 + 20);
    const bookingEndValue = buildLocalDateTimeValue(24 * 60 + 80);
    const bookingStartIso = new Date(bookingStartValue).toISOString();
    const bookingEndIso = new Date(bookingEndValue).toISOString();

    await loginAsBookingFlowUser(page);
    await cleanupActiveBookings(page);

    const bookableWorkspace = await resolveBookableWorkspace(
      page,
      bookingStartIso,
      bookingEndIso,
    );
    expect(
      bookableWorkspace,
      "Expected at least one available workspace fixture for booking E2E.",
    ).not.toBeNull();

    await page.goto("/floor-map");
    await expect(page.getByTestId("floor-map-page")).toBeVisible();
    await expect(page.getByTestId("floor-map-svg-container")).toBeVisible();

    const floorStateResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/bookings/floor-state") && response.ok(),
    );
    await page
      .getByTestId("floor-map-floor-select")
      .selectOption(bookableWorkspace!.floorId);
    await page.getByTestId("floor-map-view-start").fill(bookingStartValue);
    await page.getByTestId("floor-map-view-end").fill(bookingEndValue);
    await floorStateResponse;

    const workspaceTarget = page.locator(
      `[data-workspace-id="${bookableWorkspace!.workspaceId}"]`,
    );
    await expect(workspaceTarget).toBeVisible();
    await workspaceTarget.click();

    await expect(page.getByTestId("floor-map-selected-workspace-name")).toHaveText(
      bookableWorkspace!.workspaceName,
    );
    await page.getByTestId("floor-map-booking-start").fill(bookingStartValue);
    await page.getByTestId("floor-map-booking-end").fill(bookingEndValue);
    await page.getByTestId("floor-map-create-booking").click();

    await expect(page.getByTestId("floor-map-booking-success")).toBeVisible();
  });

  test("checks in manually with a deterministic scan time", async ({ page }) => {
    const bookingStartValue = buildLocalDateTimeValue(30);
    const bookingEndValue = buildLocalDateTimeValue(90);
    const bookingStartIso = new Date(bookingStartValue).toISOString();
    const bookingEndIso = new Date(bookingEndValue).toISOString();
    const scanValue = buildLocalDateTimeValue(31);

    await loginAsBookingFlowUser(page);
    await cleanupActiveBookings(page);

    const bookableWorkspace = await resolveBookableWorkspace(
      page,
      bookingStartIso,
      bookingEndIso,
    );
    expect(
      bookableWorkspace,
      "Expected an available workspace fixture for check-in E2E.",
    ).not.toBeNull();

    await createBookingViaApi(
      page,
      bookableWorkspace!.workspaceId,
      bookingStartIso,
      bookingEndIso,
    );

    await page.goto("/check-in?e2e=1");
    await expect(page.getByTestId("check-in-page")).toBeVisible();
    await page.getByTestId("check-in-toggle-manual").click();
    await expect(page.getByTestId("check-in-qr-input")).toBeVisible();
    await page.getByTestId("check-in-qr-input").fill(bookableWorkspace!.qrCodeValue);
    await page.getByTestId("check-in-scanned-at").fill(scanValue);
    await page.getByTestId("check-in-submit-manual").click();

    try {
      await expect(page.getByTestId("check-in-success")).toBeVisible({
        timeout: 10_000,
      });
    } catch {
      const errorBlock = page.getByTestId("check-in-error");
      await expect(errorBlock).toBeVisible({ timeout: 10_000 });
      const errorText = (await errorBlock.textContent())?.trim() ?? "Unknown check-in error";
      throw new Error(`Expected manual check-in to succeed, but received: ${errorText}`);
    }
  });
});
