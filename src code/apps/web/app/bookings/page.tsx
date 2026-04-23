"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { getBrowserApiBaseUrl } from "@/lib/api-base-url";
import { buildLoginRedirectUrl } from "@/lib/auth-redirect";

type AuthProfile = {
  id: string;
  email: string;
  role: "admin" | "manager" | "employee";
  fullName: string;
};

type FloorRecord = {
  id: string;
  building_id: string;
  floor_number: number;
  name: string | null;
  svg_map_url: string | null;
};

type FloorsResponse = {
  count: number;
  items: FloorRecord[];
};

type WorkspaceRecord = {
  id: string;
  floor_id: string;
  name: string;
  type: string;
  status: "available" | "maintenance" | "inactive";
  svg_element_id: string;
  qr_code_value: string;
  capacity: number;
  features: Record<string, unknown>;
};

type WorkspacesResponse = {
  count: number;
  items: WorkspaceRecord[];
};

type BookingRecord = {
  id: string;
  user_id: string;
  workspace_id: string;
  start_time: string;
  end_time: string;
  status: "confirmed" | "checked_in" | "completed" | "cancelled" | "no_show";
  checked_in_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
};

type ManagedBookingRecord = BookingRecord & {
  user_email: string | null;
  user_full_name: string | null;
};

type BookingsResponse = {
  count: number;
  items: BookingRecord[];
};

type ManagedBookingsResponse = {
  count: number;
  items: ManagedBookingRecord[];
};

type BookingLifecycleResponse = {
  effectiveAt: string;
  count: number;
  items: BookingRecord[];
};

type BookingStatusFilter =
  | "all"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "cancelled"
  | "no_show";

const statusOptions: Array<{
  value: BookingStatusFilter;
  label: string;
}> = [
  { value: "all", label: "All statuses" },
  { value: "confirmed", label: "Confirmed" },
  { value: "checked_in", label: "Checked in" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No show" },
];

function formatDateTimeValue(dateValue: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateValue));
}

function buildDefaultEffectiveAt() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

export default function BookingsPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [managedBookings, setManagedBookings] = useState<ManagedBookingRecord[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [floors, setFloors] = useState<FloorRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<BookingStatusFilter>("all");
  const [searchText, setSearchText] = useState("");
  const [managedStatusFilter, setManagedStatusFilter] =
    useState<BookingStatusFilter>("all");
  const [managedSearchText, setManagedSearchText] = useState("");
  const [managedUserFilter, setManagedUserFilter] = useState("all");
  const [managedWorkspaceFilter, setManagedWorkspaceFilter] = useState("all");
  const [managedStartDate, setManagedStartDate] = useState("");
  const [managedEndDate, setManagedEndDate] = useState("");
  const [cancelLoadingId, setCancelLoadingId] = useState<string | null>(null);
  const [releaseLoadingId, setReleaseLoadingId] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [effectiveAt, setEffectiveAt] = useState(buildDefaultEffectiveAt());
  const [lifecycleLoading, setLifecycleLoading] = useState<
    "no_show" | "completed" | null
  >(null);
  const [lifecycleResult, setLifecycleResult] =
    useState<BookingLifecycleResponse | null>(null);

  const canRunLifecycle =
    profile?.role === "admin" || profile?.role === "manager";
  const canManageSystemBookings = canRunLifecycle;
  const activeQuotaBookings = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          booking.status === "confirmed" || booking.status === "checked_in",
      ),
    [bookings],
  );

  const bookingStats = useMemo(() => {
    return bookings.reduce(
      (accumulator, booking) => {
        accumulator.total += 1;
        accumulator[booking.status] += 1;
        return accumulator;
      },
      {
        total: 0,
        confirmed: 0,
        checked_in: 0,
        completed: 0,
        cancelled: 0,
        no_show: 0,
      },
    );
  }, [bookings]);

  const managedBookingStats = useMemo(() => {
    return managedBookings.reduce(
      (accumulator, booking) => {
        accumulator.total += 1;
        accumulator[booking.status] += 1;
        return accumulator;
      },
      {
        total: 0,
        confirmed: 0,
        checked_in: 0,
        completed: 0,
        cancelled: 0,
        no_show: 0,
      },
    );
  }, [managedBookings]);

  const filteredBookings = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return bookings.filter((booking) => {
      if (statusFilter !== "all" && booking.status !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const workspace = workspaces.find(
        (workspaceItem) => workspaceItem.id === booking.workspace_id,
      );
      const floor = floors.find(
        (floorItem) => floorItem.id === workspace?.floor_id,
      );

      return [
        booking.id,
        booking.status,
        workspace?.name ?? "",
        workspace?.qr_code_value ?? "",
        workspace?.svg_element_id ?? "",
        floor?.name ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [bookings, floors, searchText, statusFilter, workspaces]);

  const manageableUsers = useMemo(() => {
    const uniqueUsers = new Map<
      string,
      { id: string; email: string; fullName: string | null }
    >();

    for (const booking of managedBookings) {
      if (!uniqueUsers.has(booking.user_id)) {
        uniqueUsers.set(booking.user_id, {
          id: booking.user_id,
          email: booking.user_email ?? booking.user_id,
          fullName: booking.user_full_name,
        });
      }
    }

    return [...uniqueUsers.values()].sort((left, right) =>
      left.email.localeCompare(right.email),
    );
  }, [managedBookings]);

  const filteredManagedBookings = useMemo(() => {
    const normalizedSearch = managedSearchText.trim().toLowerCase();

    return managedBookings.filter((booking) => {
      if (
        managedStatusFilter !== "all" &&
        booking.status !== managedStatusFilter
      ) {
        return false;
      }

      if (managedUserFilter !== "all" && booking.user_id !== managedUserFilter) {
        return false;
      }

      if (
        managedWorkspaceFilter !== "all" &&
        booking.workspace_id !== managedWorkspaceFilter
      ) {
        return false;
      }

      const bookingStartDateOnly = booking.start_time.slice(0, 10);
      if (managedStartDate && bookingStartDateOnly < managedStartDate) {
        return false;
      }

      if (managedEndDate && bookingStartDateOnly > managedEndDate) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const workspace = workspaces.find(
        (workspaceItem) => workspaceItem.id === booking.workspace_id,
      );
      const floor = floors.find(
        (floorItem) => floorItem.id === workspace?.floor_id,
      );

      return [
        booking.id,
        booking.status,
        booking.user_email ?? "",
        booking.user_full_name ?? "",
        workspace?.name ?? "",
        workspace?.qr_code_value ?? "",
        workspace?.svg_element_id ?? "",
        floor?.name ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [
    floors,
    managedBookings,
    managedEndDate,
    managedSearchText,
    managedStartDate,
    managedStatusFilter,
    managedUserFilter,
    managedWorkspaceFilter,
    workspaces,
  ]);

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
      if (mounted) {
        setSession(updatedSession);
        setLoading(false);
      }
    });

    void supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (mounted) {
        setSession(currentSession);
        setLoading(false);
        if (!currentSession) {
          router.replace(buildLoginRedirectUrl());
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    let mounted = true;

    async function loadPageData() {
      if (!session?.access_token) {
        if (mounted) {
          setProfile(null);
          setBookings([]);
          setManagedBookings([]);
          setWorkspaces([]);
          setFloors([]);
        }
        return;
      }

      const apiBaseUrl = getBrowserApiBaseUrl();

      if (!apiBaseUrl) {
        if (mounted) {
          setErrorMessage("Missing API base URL.");
        }
        return;
      }

      try {
        if (mounted) {
          setRefreshing(true);
          setErrorMessage(null);
        }

        const headers = {
          Authorization: `Bearer ${session.access_token}`,
        };

        const [profileResponse, bookingsResponse, workspacesResponse, floorsResponse] =
          await Promise.all([
            fetch(`${apiBaseUrl}/me`, { headers }),
            fetch(`${apiBaseUrl}/bookings/my`, { headers }),
            fetch(`${apiBaseUrl}/workspaces`, { headers }),
            fetch(`${apiBaseUrl}/floors`, { headers }),
          ]);

        if (
          !profileResponse.ok ||
          !bookingsResponse.ok ||
          !workspacesResponse.ok ||
          !floorsResponse.ok
        ) {
          throw new Error("Failed to load bookings page data.");
        }

        const profilePayload =
          (await profileResponse.json()) satisfies AuthProfile;
        const bookingsPayload =
          (await bookingsResponse.json()) satisfies BookingsResponse;
        const workspacesPayload =
          (await workspacesResponse.json()) satisfies WorkspacesResponse;
        const floorsPayload =
          (await floorsResponse.json()) satisfies FloorsResponse;

        if (!mounted) {
          return;
        }

        setProfile(profilePayload);
        setBookings(bookingsPayload.items);
        setWorkspaces(workspacesPayload.items);
        setFloors(floorsPayload.items);

        if (profilePayload.role === "admin" || profilePayload.role === "manager") {
          const managedBookingsResponse = await fetch(
            `${apiBaseUrl}/bookings/manage`,
            { headers },
          );

          if (!managedBookingsResponse.ok) {
            throw new Error("Failed to load system bookings.");
          }

          const managedBookingsPayload =
            (await managedBookingsResponse.json()) satisfies ManagedBookingsResponse;

          if (!mounted) {
            return;
          }

          setManagedBookings(managedBookingsPayload.items);
        } else {
          setManagedBookings([]);
        }
      } catch {
        if (mounted) {
          setErrorMessage(
            "Could not load booking history. Check the backend and your authenticated session.",
          );
        }
      } finally {
        if (mounted) {
          setRefreshing(false);
        }
      }
    }

    void loadPageData();

    return () => {
      mounted = false;
    };
  }, [session]);

  async function refreshPageData() {
    if (!session?.access_token) {
      return;
    }

    const apiBaseUrl = getBrowserApiBaseUrl();

    if (!apiBaseUrl) {
      setErrorMessage("Missing API base URL.");
      return;
    }

    try {
      setRefreshing(true);
      setErrorMessage(null);

      const headers = {
        Authorization: `Bearer ${session.access_token}`,
      };

      const [bookingsResponse, workspacesResponse, floorsResponse] =
        await Promise.all([
          fetch(`${apiBaseUrl}/bookings/my`, { headers }),
          fetch(`${apiBaseUrl}/workspaces`, { headers }),
          fetch(`${apiBaseUrl}/floors`, { headers }),
        ]);

      if (!bookingsResponse.ok || !workspacesResponse.ok || !floorsResponse.ok) {
        throw new Error("Failed to refresh bookings page data.");
      }

      const bookingsPayload =
        (await bookingsResponse.json()) satisfies BookingsResponse;
      const workspacesPayload =
        (await workspacesResponse.json()) satisfies WorkspacesResponse;
      const floorsPayload = (await floorsResponse.json()) satisfies FloorsResponse;

      setBookings(bookingsPayload.items);
      setWorkspaces(workspacesPayload.items);
      setFloors(floorsPayload.items);

      if (canManageSystemBookings) {
        const managedBookingsResponse = await fetch(
          `${apiBaseUrl}/bookings/manage`,
          { headers },
        );

        if (!managedBookingsResponse.ok) {
          throw new Error("Failed to refresh system bookings.");
        }

        const managedBookingsPayload =
          (await managedBookingsResponse.json()) satisfies ManagedBookingsResponse;

        setManagedBookings(managedBookingsPayload.items);
      }
    } catch {
      setErrorMessage("Could not refresh bookings right now.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCancelBooking(bookingId: string) {
    if (!session?.access_token) {
      setErrorMessage("Please sign in before cancelling a booking.");
      return;
    }

    const apiBaseUrl = getBrowserApiBaseUrl();

    if (!apiBaseUrl) {
      setErrorMessage("Missing API base URL.");
      return;
    }

    try {
      setCancelLoadingId(bookingId);
      setErrorMessage(null);
      setPageMessage(null);

      const response = await fetch(`${apiBaseUrl}/bookings/${bookingId}/cancel`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setErrorMessage(payload.message ?? "Failed to cancel booking.");
        return;
      }

      setPageMessage("Booking cancelled successfully.");
      await refreshPageData();
    } catch {
      setErrorMessage("Could not cancel booking right now.");
    } finally {
      setCancelLoadingId(null);
    }
  }

  async function handleReleaseBooking(bookingId: string) {
    if (!session?.access_token) {
      setErrorMessage("Please sign in before releasing a workspace.");
      return;
    }

    const apiBaseUrl = getBrowserApiBaseUrl();

    if (!apiBaseUrl) {
      setErrorMessage("Missing API base URL.");
      return;
    }

    try {
      setReleaseLoadingId(bookingId);
      setErrorMessage(null);
      setPageMessage(null);

      const response = await fetch(
        `${apiBaseUrl}/bookings/${bookingId}/release`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setErrorMessage(payload.message ?? "Failed to release workspace.");
        return;
      }

      setPageMessage("Workspace released successfully.");
      await refreshPageData();
    } catch {
      setErrorMessage("Could not release workspace right now.");
    } finally {
      setReleaseLoadingId(null);
    }
  }

  async function handleRunLifecycle(mode: "no_show" | "completed") {
    if (!session?.access_token || !canRunLifecycle) {
      return;
    }

    const apiBaseUrl = getBrowserApiBaseUrl();

    if (!apiBaseUrl) {
      setErrorMessage("Missing API base URL.");
      return;
    }

    try {
      setLifecycleLoading(mode);
      setErrorMessage(null);
      setPageMessage(null);
      setLifecycleResult(null);

      const endpoint =
        mode === "no_show"
          ? `${apiBaseUrl}/bookings/run-no-show`
          : `${apiBaseUrl}/bookings/run-completed`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          effectiveAt: new Date(effectiveAt).toISOString(),
        }),
      });

      const payload = (await response.json()) as
        | BookingLifecycleResponse
        | { message?: string };

      if (!response.ok || !("count" in payload)) {
        setErrorMessage(
          "message" in payload && payload.message
            ? payload.message
            : "Lifecycle job failed.",
        );
        return;
      }

      setLifecycleResult(payload);
      setPageMessage(
        mode === "no_show"
          ? "No-show job completed."
          : "Completion job completed.",
      );
      await refreshPageData();
    } catch {
      setErrorMessage("Could not run lifecycle job right now.");
    } finally {
      setLifecycleLoading(null);
    }
  }

  function getWorkspaceDetails(workspaceId: string) {
    const workspace = workspaces.find((item) => item.id === workspaceId) ?? null;
    const floor = floors.find((item) => item.id === workspace?.floor_id) ?? null;

    return {
      workspace,
      floor,
    };
  }

  function resetMyBookingFilters() {
    setStatusFilter("all");
    setSearchText("");
  }

  function resetManagedFilters() {
    setManagedStatusFilter("all");
    setManagedSearchText("");
    setManagedUserFilter("all");
    setManagedWorkspaceFilter("all");
    setManagedStartDate("");
    setManagedEndDate("");
  }

  return (
    <main className="min-h-screen px-6 py-12" data-testid="bookings-page">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3">
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                Booking Management
              </span>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
                Review your booking history in one place.
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-600">
                This screen centralizes booking history, status filters, cancel
                actions, and manager lifecycle tools so booking operations are no
                longer hidden only inside the floor map prototype.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                href="/dashboard"
              >
                Back to Dashboard
              </Link>
              <Link
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                href="/floor-map"
              >
                Open Floor Map
              </Link>
              <Link
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                href="/check-in"
              >
                Open Check-in
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Total", value: bookingStats.total },
            { label: "Confirmed", value: bookingStats.confirmed },
            { label: "Checked in", value: bookingStats.checked_in },
            { label: "Completed", value: bookingStats.completed },
            { label: "Cancelled", value: bookingStats.cancelled },
            { label: "No show", value: bookingStats.no_show },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {item.label}
              </p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {canManageSystemBookings ? (
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "System total", value: managedBookingStats.total },
              { label: "System confirmed", value: managedBookingStats.confirmed },
              {
                label: "System checked in",
                value: managedBookingStats.checked_in,
              },
              {
                label: "System completed",
                value: managedBookingStats.completed,
              },
              {
                label: "System cancelled",
                value: managedBookingStats.cancelled,
              },
              { label: "System no show", value: managedBookingStats.no_show },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.05)]"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {item.label}
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  My bookings
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Filter by status, search by workspace or QR value, then cancel any
                  confirmed booking directly from this list.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <select
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-500 focus:bg-white"
                  onChange={(event) =>
                    setStatusFilter(event.target.value as BookingStatusFilter)
                  }
                  value={statusFilter}
                >
                  {statusOptions.map((statusOption) => (
                    <option key={statusOption.value} value={statusOption.value}>
                      {statusOption.label}
                    </option>
                  ))}
                </select>

                <input
                  className="min-w-64 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-500 focus:bg-white"
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search Desk A-01, workspace_a_01..."
                  value={searchText}
                />

                <button
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={refreshing}
                  onClick={() => void refreshPageData()}
                  type="button"
                >
                  {refreshing ? "Refreshing..." : "Refresh"}
                </button>

                <button
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  onClick={resetMyBookingFilters}
                  type="button"
                >
                  Reset filters
                </button>
              </div>
            </div>

            {loading ? (
              <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Loading session and booking history...
              </p>
            ) : !session ? (
              <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                Please sign in before opening booking management.
              </p>
            ) : null}

            {pageMessage ? (
              <p className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {pageMessage}
              </p>
            ) : null}

            {errorMessage ? (
              <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </p>
            ) : null}

            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Active booking quota
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Only bookings with status <code>confirmed</code> or <code>checked_in</code>{" "}
                still count against the active booking limit. Historical rows such as{" "}
                <code>completed</code>, <code>cancelled</code>, and <code>no_show</code> stay
                visible here but no longer block new reservations.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  Active bookings currently holding quota:{" "}
                  <span className="font-semibold text-slate-900">
                    {activeQuotaBookings.length}
                  </span>
                </div>
                {activeQuotaBookings.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {activeQuotaBookings.slice(0, 4).map((booking) => {
                      const { workspace } = getWorkspaceDetails(booking.workspace_id);

                      return (
                        <span
                          className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                          key={booking.id}
                        >
                          {workspace?.name ?? booking.workspace_id} · {booking.status}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                    No active quota is being held right now.
                  </span>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-4" data-testid="bookings-my-list">
              {filteredBookings.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                  No bookings match the current filters yet.
                </div>
              ) : (
                filteredBookings.map((booking) => {
                  const { workspace, floor } = getWorkspaceDetails(
                    booking.workspace_id,
                  );

                  return (
                    <article
                      key={booking.id}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {floor?.name ?? "Unknown floor"}
                          </p>
                          <h2 className="text-2xl font-semibold text-slate-900">
                            {workspace?.name ?? booking.workspace_id}
                          </h2>
                          <p className="text-sm text-slate-600">
                            {formatDateTimeValue(booking.start_time)} -{" "}
                            {formatDateTimeValue(booking.end_time)}
                          </p>
                        </div>

                        <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">
                          {booking.status}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl bg-white p-4 text-sm text-slate-700">
                          <p>
                            QR value:{" "}
                            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-800">
                              {workspace?.qr_code_value ?? "Unknown"}
                            </code>
                          </p>
                          <p className="mt-2">
                            SVG id:{" "}
                            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-800">
                              {workspace?.svg_element_id ?? "Unknown"}
                            </code>
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white p-4 text-sm text-slate-700">
                          <p>Created: {formatDateTimeValue(booking.created_at)}</p>
                          <p className="mt-2">
                            Checked in at:{" "}
                            {booking.checked_in_at
                              ? formatDateTimeValue(booking.checked_in_at)
                              : "Not checked in"}
                          </p>
                          <p className="mt-2">
                            Cancelled at:{" "}
                            {booking.cancelled_at
                              ? formatDateTimeValue(booking.cancelled_at)
                              : "Not cancelled"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        {booking.status === "confirmed" ? (
                          <button
                            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={cancelLoadingId === booking.id}
                            onClick={() => void handleCancelBooking(booking.id)}
                            type="button"
                          >
                            {cancelLoadingId === booking.id
                              ? "Cancelling..."
                              : "Cancel booking"}
                          </button>
                        ) : null}

                        {booking.status === "checked_in" ? (
                          <button
                            className="rounded-full border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={releaseLoadingId === booking.id}
                            onClick={() => void handleReleaseBooking(booking.id)}
                            type="button"
                          >
                            {releaseLoadingId === booking.id
                              ? "Releasing..."
                              : "Release workspace"}
                          </button>
                        ) : null}

                        {workspace ? (
                          <Link
                            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                            href={`/check-in?qr=${encodeURIComponent(
                              workspace.qr_code_value,
                            )}`}
                          >
                            Open in Check-in
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Current user
              </p>
              <div className="mt-4 rounded-3xl bg-slate-950 p-5 text-white">
                <p className="text-2xl font-semibold">
                  {profile?.email ?? session?.user.email ?? "No active session"}
                </p>
                <p className="sr-only" data-testid="bookings-current-user-email">
                  {profile?.email ?? session?.user.email ?? "No active session"}
                </p>
                <p
                  className="mt-2 text-sm text-slate-300"
                  data-testid="bookings-current-user-role"
                >
                  Role: {profile?.role ?? "unknown"}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  {profile?.fullName ? `Full name: ${profile.fullName}` : "No full name yet"}
                </p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Lifecycle tools
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Managers and admins can simulate scheduled jobs here without
                leaving the UI.
              </p>

              {!canRunLifecycle ? (
                <p
                  className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                  data-testid="bookings-lifecycle-disabled"
                >
                  This panel is only enabled for manager and admin roles.
                </p>
              ) : (
                <div className="mt-5 space-y-4">
                  <label className="block space-y-2 text-sm text-slate-700">
                    <span className="font-medium">Effective time</span>
                    <input
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-500 focus:bg-white"
                      onChange={(event) => setEffectiveAt(event.target.value)}
                      type="datetime-local"
                      value={effectiveAt}
                    />
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <button
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                      data-testid="bookings-run-no-show"
                      disabled={lifecycleLoading !== null}
                      onClick={() => void handleRunLifecycle("no_show")}
                      type="button"
                    >
                      {lifecycleLoading === "no_show"
                        ? "Running no-show..."
                        : "Run no-show"}
                    </button>

                    <button
                      className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      data-testid="bookings-run-completed"
                      disabled={lifecycleLoading !== null}
                      onClick={() => void handleRunLifecycle("completed")}
                      type="button"
                    >
                      {lifecycleLoading === "completed"
                        ? "Running completed..."
                        : "Run completed"}
                    </button>
                  </div>

                  {lifecycleResult ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">
                        Updated bookings: {lifecycleResult.count}
                      </p>
                      <p className="mt-2">
                        Effective at: {formatDateTimeValue(lifecycleResult.effectiveAt)}
                      </p>
                      {lifecycleResult.items.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {lifecycleResult.items.slice(0, 5).map((booking) => {
                            const workspace = workspaces.find(
                              (workspaceItem) =>
                                workspaceItem.id === booking.workspace_id,
                            );

                            return (
                              <div
                                key={booking.id}
                                className="rounded-2xl border border-slate-200 bg-white p-3"
                              >
                                <p className="font-semibold text-slate-900">
                                  {workspace?.name ?? booking.workspace_id}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {booking.status}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </aside>
        </div>

        {canManageSystemBookings ? (
          <section
            className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]"
            data-testid="bookings-system-section"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  System bookings
                </p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  This manager view exposes bookings across the whole system so
                  admins and managers can filter by user, workspace, status, and
                  date without leaving the browser.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_1.4fr]">
              <select
                className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-500 focus:bg-white"
                onChange={(event) =>
                  setManagedStatusFilter(event.target.value as BookingStatusFilter)
                }
                value={managedStatusFilter}
              >
                {statusOptions.map((statusOption) => (
                  <option key={statusOption.value} value={statusOption.value}>
                    {statusOption.label}
                  </option>
                ))}
              </select>

              <select
                className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-500 focus:bg-white"
                onChange={(event) => setManagedUserFilter(event.target.value)}
                value={managedUserFilter}
              >
                <option value="all">All users</option>
                {manageableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email}
                  </option>
                ))}
              </select>

              <select
                className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-500 focus:bg-white"
                onChange={(event) => setManagedWorkspaceFilter(event.target.value)}
                value={managedWorkspaceFilter}
              >
                <option value="all">All workspaces</option>
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>

              <input
                className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-500 focus:bg-white"
                onChange={(event) => setManagedStartDate(event.target.value)}
                type="date"
                value={managedStartDate}
              />

              <input
                className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-500 focus:bg-white"
                onChange={(event) => setManagedEndDate(event.target.value)}
                type="date"
                value={managedEndDate}
              />

              <input
                className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-500 focus:bg-white"
                onChange={(event) => setManagedSearchText(event.target.value)}
                placeholder="Search email, workspace, QR, SVG..."
                value={managedSearchText}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm leading-6 text-slate-600">
                Use this panel to inspect cross-user booking state. Reset filters before demos
                if an old user/workspace/date combination is hiding recent rows.
              </p>
              <button
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white"
                onClick={resetManagedFilters}
                type="button"
              >
                Reset management filters
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {filteredManagedBookings.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                  No system bookings match the current management filters.
                </div>
              ) : (
                filteredManagedBookings.map((booking) => {
                  const { workspace, floor } = getWorkspaceDetails(
                    booking.workspace_id,
                  );

                  return (
                    <article
                      key={booking.id}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {floor?.name ?? "Unknown floor"}
                          </p>
                          <h2 className="text-2xl font-semibold text-slate-900">
                            {workspace?.name ?? booking.workspace_id}
                          </h2>
                          <p className="text-sm text-slate-600">
                            User: {booking.user_email ?? booking.user_id}
                          </p>
                          <p className="text-sm text-slate-600">
                            {formatDateTimeValue(booking.start_time)} -{" "}
                            {formatDateTimeValue(booking.end_time)}
                          </p>
                        </div>

                        <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">
                          {booking.status}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-3">
                        <div className="rounded-2xl bg-white p-4 text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">
                            Requester
                          </p>
                          <p className="mt-2">
                            Email: {booking.user_email ?? booking.user_id}
                          </p>
                          <p className="mt-2">
                            Full name: {booking.user_full_name ?? "Not set"}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white p-4 text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">
                            Workspace
                          </p>
                          <p className="mt-2">
                            QR:{" "}
                            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-800">
                              {workspace?.qr_code_value ?? "Unknown"}
                            </code>
                          </p>
                          <p className="mt-2">
                            SVG:{" "}
                            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-800">
                              {workspace?.svg_element_id ?? "Unknown"}
                            </code>
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white p-4 text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">
                            Audit details
                          </p>
                          <p className="mt-2">
                            Created: {formatDateTimeValue(booking.created_at)}
                          </p>
                          <p className="mt-2">
                            Checked in:{" "}
                            {booking.checked_in_at
                              ? formatDateTimeValue(booking.checked_in_at)
                              : "Not checked in"}
                          </p>
                          <p className="mt-2">
                            Cancelled:{" "}
                            {booking.cancelled_at
                              ? formatDateTimeValue(booking.cancelled_at)
                              : "Not cancelled"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        {booking.status === "confirmed" ? (
                          <button
                            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={cancelLoadingId === booking.id}
                            onClick={() => void handleCancelBooking(booking.id)}
                            type="button"
                          >
                            {cancelLoadingId === booking.id
                              ? "Cancelling..."
                              : "Cancel as manager"}
                          </button>
                        ) : null}

                        {booking.status === "checked_in" ? (
                          <button
                            className="rounded-full border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={releaseLoadingId === booking.id}
                            onClick={() => void handleReleaseBooking(booking.id)}
                            type="button"
                          >
                            {releaseLoadingId === booking.id
                              ? "Releasing..."
                              : "Release as manager"}
                          </button>
                        ) : null}

                        {workspace ? (
                          <Link
                            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                            href={`/check-in?qr=${encodeURIComponent(
                              workspace.qr_code_value,
                            )}`}
                          >
                            Open matching QR
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
