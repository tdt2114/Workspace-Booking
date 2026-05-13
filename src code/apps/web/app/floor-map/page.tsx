"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { getBrowserApiBaseUrl } from "@/lib/api-base-url";
import { buildLoginRedirectUrl } from "@/lib/auth-redirect";

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

type BookingsResponse = {
  count: number;
  items: BookingRecord[];
};

type FloorMapStatus = WorkspaceRecord["status"] | "reserved";

const statusStyleMap: Record<
  FloorMapStatus,
  { fill: string; stroke: string; label: string }
> = {
  available: {
    fill: "#dbe9cb",
    stroke: "#4d6932",
    label: "Available",
  },
  maintenance: {
    fill: "#fde5b2",
    stroke: "#8a5b00",
    label: "Maintenance",
  },
  inactive: {
    fill: "#e5e7eb",
    stroke: "#64748b",
    label: "Inactive",
  },
  reserved: {
    fill: "#dce6fb",
    stroke: "#31598f",
    label: "Reserved",
  },
};

function formatDateTimeValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function formatBookingDate(dateValue: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateValue));
}

function buildDefaultTimeWindow() {
  const roundedStart = new Date();
  roundedStart.setMinutes(0, 0, 0);
  roundedStart.setHours(roundedStart.getHours() + 1);

  const roundedEnd = new Date(roundedStart);
  roundedEnd.setHours(roundedEnd.getHours() + 2);

  return {
    start: formatDateTimeValue(roundedStart),
    end: formatDateTimeValue(roundedEnd),
  };
}

export default function FloorMapPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [floors, setFloors] = useState<FloorRecord[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string>("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null,
  );
  const [baseSvgMarkup, setBaseSvgMarkup] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewStart, setViewStart] = useState(() => buildDefaultTimeWindow().start);
  const [viewEnd, setViewEnd] = useState(() => buildDefaultTimeWindow().end);
  const [bookingStart, setBookingStart] = useState(() => buildDefaultTimeWindow().start);
  const [bookingEnd, setBookingEnd] = useState(() => buildDefaultTimeWindow().end);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [cancelLoadingId, setCancelLoadingId] = useState<string | null>(null);
  const [releaseLoadingId, setReleaseLoadingId] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [floorBookings, setFloorBookings] = useState<BookingRecord[]>([]);
  const [floorStateLoading, setFloorStateLoading] = useState(false);
  const [floorStateError, setFloorStateError] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastRealtimeSyncAt, setLastRealtimeSyncAt] = useState<string | null>(
    null,
  );
  const svgContainerRef = useRef<HTMLDivElement | null>(null);

  const apiBaseUrl = useMemo(() => getBrowserApiBaseUrl(), []);

  const selectedFloor = useMemo(
    () => floors.find((floor) => floor.id === selectedFloorId) ?? null,
    [floors, selectedFloorId],
  );

  const filteredWorkspaces = useMemo(
    () => workspaces.filter((workspace) => workspace.floor_id === selectedFloorId),
    [selectedFloorId, workspaces],
  );

  const selectedWorkspace = useMemo(
    () =>
      filteredWorkspaces.find((workspace) => workspace.id === selectedWorkspaceId) ??
      null,
    [filteredWorkspaces, selectedWorkspaceId],
  );

  const selectedWorkspaceBookings = useMemo(
    () =>
      bookings.filter((booking) => booking.workspace_id === selectedWorkspaceId),
    [bookings, selectedWorkspaceId],
  );

  const selectedWorkspaceReservedInView = useMemo(
    () =>
      floorBookings.some((booking) => booking.workspace_id === selectedWorkspaceId),
    [floorBookings, selectedWorkspaceId],
  );

  const selectedWorkspaceReservedBookings = useMemo(
    () =>
      floorBookings.filter((booking) => booking.workspace_id === selectedWorkspaceId),
    [floorBookings, selectedWorkspaceId],
  );

  const selectedWorkspaceOwnReservationsInView = useMemo(
    () =>
      selectedWorkspaceReservedBookings.filter(
        (booking) => booking.user_id === session?.user.id,
      ),
    [selectedWorkspaceReservedBookings, session?.user.id],
  );

  const selectedWorkspaceReservedByCurrentUser =
    selectedWorkspaceOwnReservationsInView.length > 0;

  const applyWorkspaceSelection = useCallback((workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    setBookingStart(viewStart);
    setBookingEnd(viewEnd);
    setBookingError(null);
    setBookingSuccess(null);
  }, [viewEnd, viewStart]);

  const loadMyBookings = useCallback(async (accessToken: string) => {
    if (!apiBaseUrl) {
      return;
    }

    const response = await fetch(`${apiBaseUrl}/bookings/my`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load current user bookings.");
    }

    const payload = (await response.json()) satisfies BookingsResponse;
    setBookings(payload.items);
  }, [apiBaseUrl]);

  const loadFloorBookings = useCallback(async (
    accessToken: string,
    floorId: string,
    startTime: string,
    endTime: string,
  ) => {
    if (!apiBaseUrl) {
      return;
    }

    const params = new URLSearchParams({
      floorId,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
    });

    const response = await fetch(`${apiBaseUrl}/bookings/floor-state?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load floor booking state.");
    }

    const payload = (await response.json()) satisfies BookingsResponse;
    setFloorBookings(payload.items);
  }, [apiBaseUrl]);

  const refreshBookingState = useCallback(
    async (
      accessToken: string,
      options?: {
        floorId?: string;
        startTime?: string;
        endTime?: string;
      },
    ) => {
      await loadMyBookings(accessToken);

      if (
        options?.floorId &&
        options.startTime &&
        options.endTime
      ) {
        await loadFloorBookings(
          accessToken,
          options.floorId,
          options.startTime,
          options.endTime,
        );
      }

      setLastRealtimeSyncAt(new Date().toISOString());
    },
    [loadFloorBookings, loadMyBookings],
  );

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        if (!apiBaseUrl) {
          setErrorMessage("Missing NEXT_PUBLIC_API_BASE_URL.");
          setLoading(false);
          return;
        }

        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!currentSession) {
          if (mounted) {
            router.replace(buildLoginRedirectUrl());
            setLoading(false);
          }
          return;
        }

        const headers = {
          Authorization: `Bearer ${currentSession.access_token}`,
        };

        const [floorsResponse, workspacesResponse, bookingsResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/floors`, { headers }),
          fetch(`${apiBaseUrl}/workspaces`, { headers }),
          fetch(`${apiBaseUrl}/bookings/my`, { headers }),
        ]);

        if (!floorsResponse.ok || !workspacesResponse.ok || !bookingsResponse.ok) {
          if (mounted) {
            setErrorMessage(
              "Failed to load floors, workspaces, or bookings from the API.",
            );
            setLoading(false);
          }
          return;
        }

        const floorsPayload =
          (await floorsResponse.json()) satisfies FloorsResponse;
        const workspacesPayload =
          (await workspacesResponse.json()) satisfies WorkspacesResponse;
        const bookingsPayload =
          (await bookingsResponse.json()) satisfies BookingsResponse;

        if (!mounted) {
          return;
        }

        setSession(currentSession);
        setFloors(floorsPayload.items);
        setWorkspaces(workspacesPayload.items);
        setBookings(bookingsPayload.items);
        setSelectedFloorId(floorsPayload.items[0]?.id ?? "");
        setLoading(false);
      } catch {
        if (mounted) {
          setErrorMessage(
            "Could not reach the backend API. Check that http://localhost:3001 is running.",
          );
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [apiBaseUrl, router]);

  useEffect(() => {
    let mounted = true;

    async function refreshFloorState() {
      try {
        if (!session || !selectedFloorId || !viewStart || !viewEnd) {
          return;
        }

        if (!mounted) {
          return;
        }

        const startDate = new Date(viewStart);
        const endDate = new Date(viewEnd);

        if (
          Number.isNaN(startDate.getTime()) ||
          Number.isNaN(endDate.getTime())
        ) {
          setFloorBookings([]);
          setFloorStateError(null);
          return;
        }

        if (startDate >= endDate) {
          setFloorBookings([]);
          setFloorStateError("Start time must be earlier than end time.");
          return;
        }

        setFloorStateLoading(true);
        setFloorStateError(null);

        const params = new URLSearchParams({
          floorId: selectedFloorId,
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        });

        const response = await fetch(`${apiBaseUrl}/bookings/floor-state?${params}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          if (mounted) {
            setErrorMessage(
              "Failed to load reserved workspace state for the selected time range.",
            );
          }
          return;
        }

        const payload = (await response.json()) satisfies BookingsResponse;

        if (!mounted) {
          return;
        }

        setFloorBookings(payload.items);
        setFloorStateError(null);
      } catch {
        if (mounted) {
          setFloorBookings([]);
          setFloorStateError(
            "Could not load reserved workspace state. Check the backend and selected time range.",
          );
        }
      } finally {
        if (mounted) {
          setFloorStateLoading(false);
        }
      }
    }

    void refreshFloorState();

    return () => {
      mounted = false;
    };
  }, [apiBaseUrl, selectedFloorId, session, viewEnd, viewStart]);

  useEffect(() => {
    if (!session?.access_token) {
      return;
    }

    const channel = supabase
      .channel(`floor-map-bookings-${session.user.id}-${selectedFloorId || "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
        },
        () => {
          void (async () => {
            try {
              await refreshBookingState(session.access_token, {
                floorId: selectedFloorId,
                startTime: viewStart,
                endTime: viewEnd,
              });
            } catch {
              // Keep the current UI state and let explicit API actions surface errors.
            }
          })();
        },
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      setRealtimeConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [
    refreshBookingState,
    selectedFloorId,
    session,
    viewEnd,
    viewStart,
  ]);

  useEffect(() => {
    if (!session?.access_token || !selectedFloorId || !viewStart || !viewEnd) {
      return;
    }

    const accessToken = session.access_token;
    let active = true;

    async function syncVisibleTab() {
      if (!active || document.visibilityState !== "visible") {
        return;
      }

      try {
        await refreshBookingState(accessToken, {
          floorId: selectedFloorId,
          startTime: viewStart,
          endTime: viewEnd,
        });
      } catch {
        // Silent fallback: explicit actions and on-screen errors already cover failures.
      }
    }

    const intervalId = window.setInterval(() => {
      void syncVisibleTab();
    }, 5000);

    function handleVisibilityChange() {
      void syncVisibleTab();
    }

    function handleWindowFocus() {
      void syncVisibleTab();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [
    refreshBookingState,
    selectedFloorId,
    session,
    viewEnd,
    viewStart,
  ]);

  useEffect(() => {
    let mounted = true;

    async function loadSvg() {
      try {
        if (!selectedFloor?.svg_map_url) {
          setBaseSvgMarkup(null);
          setSelectedWorkspaceId(null);
          return;
        }

        if (!session || !apiBaseUrl) {
          setBaseSvgMarkup(null);
          return;
        }

        setErrorMessage(null);
        setBaseSvgMarkup(null);

        const response = await fetch(`${apiBaseUrl}/floors/${selectedFloor.id}/svg`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          if (mounted) {
            setErrorMessage("Failed to load SVG from the protected floor map API.");
          }
          return;
        }

        const rawSvg = await response.text();

        if (!mounted) {
          return;
        }
        setBaseSvgMarkup(rawSvg);
      } catch {
        if (mounted) {
          setErrorMessage(
            "Could not load the floor SVG. Check that the backend is running and the floor has a valid uploaded SVG.",
          );
        }
      }
    }

    void loadSvg();

    return () => {
      mounted = false;
    };
  }, [
    apiBaseUrl,
    selectedFloor,
    session,
  ]);

  const svgMarkup = useMemo(() => {
    if (!baseSvgMarkup) {
      return null;
    }

    const parser = new DOMParser();
    const parsedDocument = parser.parseFromString(baseSvgMarkup, "image/svg+xml");

    filteredWorkspaces.forEach((workspace) => {
      const target = parsedDocument.getElementById(workspace.svg_element_id);

      if (!target) {
        return;
      }

      const hasReservationInView = floorBookings.some(
        (booking) => booking.workspace_id === workspace.id,
      );
      const resolvedStatus: FloorMapStatus = hasReservationInView
        ? "reserved"
        : workspace.status;
      const styles = statusStyleMap[resolvedStatus];
      const isSelected = workspace.id === selectedWorkspaceId;
      target.setAttribute("fill", styles.fill);
      target.setAttribute("stroke", isSelected ? "#0f172a" : styles.stroke);
      target.setAttribute("stroke-width", isSelected ? "6" : "4");
      target.setAttribute("data-workspace-id", workspace.id);
      target.setAttribute("data-workspace-name", workspace.name);
      target.setAttribute("role", "button");
      target.style.cursor = "pointer";

      const matchingLabels = Array.from(
        parsedDocument.querySelectorAll("text"),
      ).filter((label) => label.textContent?.trim() === workspace.svg_element_id);

      matchingLabels.forEach((label) => {
        label.setAttribute("data-workspace-id", workspace.id);
        label.setAttribute("data-workspace-name", workspace.name);
        label.setAttribute("role", "button");
        label.style.cursor = "pointer";
        label.style.pointerEvents = "none";
        label.setAttribute("fill", isSelected ? "#0f172a" : "#1E293B");
      });
    });

    const serializer = new XMLSerializer();
    return serializer.serializeToString(parsedDocument.documentElement);
  }, [baseSvgMarkup, filteredWorkspaces, floorBookings, selectedWorkspaceId]);

  useEffect(() => {
    const container = svgContainerRef.current;

    if (!container || !svgMarkup) {
      return;
    }

    function findWorkspaceIdFromTarget(target: Element | null) {
      let current: Element | null = target;

      while (current) {
        const matchedWorkspaceId = current.getAttribute("data-workspace-id");

        if (matchedWorkspaceId) {
          return matchedWorkspaceId;
        }

        current = current.parentElement;
      }

      return null;
    }

    function handleNativeSvgClick(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const workspaceId = findWorkspaceIdFromTarget(target);

      if (workspaceId) {
        applyWorkspaceSelection(workspaceId);
        return;
      }

      const svgElementId =
        target.getAttribute("id") ??
        target.closest("[id]")?.getAttribute("id") ??
        (target.tagName.toLowerCase() === "text"
          ? target.textContent?.trim()
          : null);

      if (!svgElementId) {
        return;
      }

      const matchedWorkspace = filteredWorkspaces.find(
        (workspace) => workspace.svg_element_id === svgElementId,
      );

      if (matchedWorkspace) {
        applyWorkspaceSelection(matchedWorkspace.id);
      }
    }

    container.addEventListener("click", handleNativeSvgClick);

    return () => {
      container.removeEventListener("click", handleNativeSvgClick);
    };
  }, [applyWorkspaceSelection, filteredWorkspaces, svgMarkup]);

  function handleBookingStartChange(value: string) {
    setBookingStart(value);
    setBookingError(null);
    setBookingSuccess(null);
  }

  function handleBookingEndChange(value: string) {
    setBookingEnd(value);
    setBookingError(null);
    setBookingSuccess(null);
  }

  async function handleCreateBooking() {
    if (!selectedWorkspace || !session || !apiBaseUrl) {
      return;
    }

    setBookingError(null);
    setBookingSuccess(null);
    setBookingLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          workspaceId: selectedWorkspace.id,
          startTime: new Date(bookingStart).toISOString(),
          endTime: new Date(bookingEnd).toISOString(),
        }),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setBookingError(payload.message ?? "Failed to create booking.");
        return;
      }

      setBookingSuccess("Booking created successfully.");
      await refreshBookingState(session.access_token, {
        floorId: selectedFloorId,
        startTime: viewStart,
        endTime: viewEnd,
      });
    } catch {
      setBookingError("Could not create booking. Check that the backend is running.");
    } finally {
      setBookingLoading(false);
    }
  }

  async function handleCancelBooking(bookingId: string) {
    if (!session || !apiBaseUrl) {
      return;
    }

    setBookingError(null);
    setBookingSuccess(null);
    setCancelLoadingId(bookingId);

    try {
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
        setBookingError(payload.message ?? "Failed to cancel booking.");
        return;
      }

      setBookingSuccess("Booking cancelled successfully.");
      await refreshBookingState(session.access_token, {
        floorId: selectedFloorId,
        startTime: viewStart,
        endTime: viewEnd,
      });
    } catch {
      setBookingError("Could not cancel booking. Check that the backend is running.");
    } finally {
      setCancelLoadingId(null);
    }
  }

  async function handleReleaseBooking(bookingId: string) {
    if (!session || !apiBaseUrl) {
      return;
    }

    setBookingError(null);
    setBookingSuccess(null);
    setReleaseLoadingId(bookingId);

    try {
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
        setBookingError(payload.message ?? "Failed to release workspace.");
        return;
      }

      setBookingSuccess("Workspace released successfully.");
      await refreshBookingState(session.access_token, {
        floorId: selectedFloorId,
        startTime: viewStart,
        endTime: viewEnd,
      });
    } catch {
      setBookingError("Could not release workspace. Check that the backend is running.");
    } finally {
      setReleaseLoadingId(null);
    }
  }

  return (
    <main className="min-h-screen px-6 py-12" data-testid="floor-map-page">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3">
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                Floor Map Prototype
              </span>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
                Interactive floor map is now wired to real workspace data.
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-600">
                This screen loads floors and workspaces through the protected API,
                fetches the private SVG map through the backend, and binds
                <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-800">
                  svg_element_id
                </code>
                to workspace records.
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
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                href="/login"
              >
                Switch User
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Floor selection
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Pick a floor with an uploaded SVG map, then choose a time window
                  to visualize bound workspaces and reserved spaces.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <input
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-500 focus:bg-white"
                  data-testid="floor-map-view-start"
                  onChange={(event) => setViewStart(event.target.value)}
                  type="datetime-local"
                  value={viewStart}
                />
                <input
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-500 focus:bg-white"
                  data-testid="floor-map-view-end"
                  onChange={(event) => setViewEnd(event.target.value)}
                  type="datetime-local"
                  value={viewEnd}
                />
                <select
                  className="min-w-64 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-500 focus:bg-white"
                  data-testid="floor-map-floor-select"
                  disabled={loading || floors.length === 0}
                  onChange={(event) => {
                    setSelectedFloorId(event.target.value);
                    setSelectedWorkspaceId(null);
                    setBookingStart("");
                    setBookingEnd("");
                    setBookingError(null);
                    setBookingSuccess(null);
                  }}
                  value={selectedFloorId}
                >
                  {floors.map((floor) => (
                    <option key={floor.id} value={floor.id}>
                      {floor.name ?? `Floor ${floor.floor_number}`}
                      {floor.svg_map_url ? "" : " (no SVG yet)"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              {loading ? (
                <p className="text-sm text-slate-500">Loading floor map data...</p>
              ) : errorMessage ? (
                <p className="text-sm text-rose-700">{errorMessage}</p>
              ) : !session ? (
                <p className="text-sm text-slate-500">
                  No authenticated session was found.
                </p>
              ) : !selectedFloor ? (
                <p className="text-sm text-slate-500">No floor data available.</p>
              ) : !selectedFloor.svg_map_url ? (
                <div className="space-y-3 text-sm text-slate-600">
                  <p>This floor does not have an SVG map yet.</p>
                  <p>
                    Upload one through
                    <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-slate-800">
                      POST /floors/:id/svg
                    </code>
                    before testing the interactive map.
                  </p>
                </div>
              ) : !svgMarkup ? (
                <p className="text-sm text-slate-500">Loading SVG map...</p>
              ) : (
                <div
                  ref={svgContainerRef}
                  data-testid="floor-map-svg-container"
                  className="overflow-auto rounded-[1.25rem] bg-white p-4 [&_svg]:h-auto [&_svg]:min-w-[760px] [&_svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: svgMarkup }}
                />
              )}
            </div>

            {floorStateError ? (
              <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {floorStateError}
              </p>
            ) : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {Object.entries(statusStyleMap).map(([status, styles]) => (
                <div
                  key={status}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <span
                    className="h-4 w-4 rounded-sm border"
                    style={{
                      backgroundColor: styles.fill,
                      borderColor: styles.stroke,
                    }}
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {styles.label}
                    </p>
                    <p className="text-xs text-slate-500">{status}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Workspace details
            </p>

            {selectedFloor ? (
              <div className="mt-4 rounded-3xl bg-slate-950 p-5 text-white">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Selected floor
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {selectedFloor.name ?? `Floor ${selectedFloor.floor_number}`}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Floor ID: {selectedFloor.id}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  SVG path: {selectedFloor.svg_map_url ?? "Not uploaded"}
                </p>
              </div>
            ) : null}

            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              {selectedWorkspace ? (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Selected workspace
                    </p>
                    <p
                      className="text-2xl font-semibold text-slate-900"
                      data-testid="floor-map-selected-workspace-name"
                    >
                      {selectedWorkspace.name}
                    </p>
                    <p className="text-sm text-slate-600">
                      Status:{" "}
                      <span className="font-semibold text-slate-900">
                        {selectedWorkspace.status}
                      </span>
                    </p>
                    <p className="text-sm text-slate-600">
                      SVG element:{" "}
                      <code className="rounded bg-white px-1.5 py-0.5 text-slate-800">
                        {selectedWorkspace.svg_element_id}
                      </code>
                    </p>
                    <p className="text-sm text-slate-600">
                      QR code value:{" "}
                      <code
                        className="rounded bg-white px-1.5 py-0.5 text-slate-800"
                        data-testid="floor-map-selected-workspace-qr"
                      >
                        {selectedWorkspace.qr_code_value}
                      </code>
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Booking drawer
                    </p>
                    <div className="mt-4 space-y-4">
                      <label className="block space-y-2 text-sm text-slate-700">
                        <span className="font-medium">Start time</span>
                        <input
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
                          data-testid="floor-map-booking-start"
                          onChange={(event) => handleBookingStartChange(event.target.value)}
                          type="datetime-local"
                          value={bookingStart}
                        />
                      </label>
                      <label className="block space-y-2 text-sm text-slate-700">
                        <span className="font-medium">End time</span>
                        <input
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
                          data-testid="floor-map-booking-end"
                          onChange={(event) => handleBookingEndChange(event.target.value)}
                          type="datetime-local"
                          value={bookingEnd}
                        />
                      </label>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-600">
                        Booking policy: at least 15 minutes in advance, from 30
                        minutes to 8 hours, up to 7 days ahead, and a maximum of
                        2 active bookings per user.
                      </div>

                      {bookingError ? (
                        <p
                          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                          data-testid="floor-map-booking-error"
                        >
                          {bookingError}
                        </p>
                      ) : null}

                      {bookingSuccess ? (
                        <p
                          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                          data-testid="floor-map-booking-success"
                        >
                          {bookingSuccess}
                        </p>
                      ) : null}

                      <button
                        className="w-full rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        data-testid="floor-map-create-booking"
                        disabled={
                          bookingLoading ||
                          selectedWorkspace.status !== "available" ||
                          selectedWorkspaceReservedInView ||
                          !bookingStart ||
                          !bookingEnd
                        }
                        onClick={handleCreateBooking}
                        type="button"
                      >
                        {bookingLoading ? "Creating booking..." : "Create booking"}
                      </button>

                      {selectedWorkspace.status !== "available" ? (
                        <p className="text-sm text-amber-700">
                          This workspace is not available for booking.
                        </p>
                      ) : selectedWorkspaceReservedByCurrentUser ? (
                        <div className="space-y-2">
                          <p className="text-sm text-emerald-700">
                            You already have this workspace reserved in the selected time range.
                          </p>
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                            <p className="font-semibold">Your matching reservation</p>
                            <div className="mt-2 space-y-2">
                              {selectedWorkspaceOwnReservationsInView.map((booking) => (
                                <div key={booking.id}>
                                  <p>{formatBookingDate(booking.start_time)} - {formatBookingDate(booking.end_time)}</p>
                                  <p className="text-xs text-emerald-800">
                                    Status: {booking.status}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : selectedWorkspaceReservedInView ? (
                        <div className="space-y-2">
                          <p className="text-sm text-amber-700">
                            This workspace is already reserved in the selected time range.
                          </p>
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            <p className="font-semibold">Matching reservations</p>
                            <div className="mt-2 space-y-2">
                              {selectedWorkspaceReservedBookings.map((booking) => (
                                <div key={booking.id}>
                                  <p>{formatBookingDate(booking.start_time)} - {formatBookingDate(booking.end_time)}</p>
                                  <p className="text-xs text-amber-800">
                                    Status: {booking.status}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Selected workspace
                  </p>
                  <p className="text-lg font-semibold text-slate-900">
                    Click a highlighted workspace on the map.
                  </p>
                  <p className="text-sm leading-6 text-slate-600">
                    The page will match the clicked SVG element to a workspace
                    record through
                    <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-slate-800">
                      svg_element_id
                    </code>
                    and show its metadata here.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                My recent bookings
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${
                    realtimeConnected
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      realtimeConnected ? "bg-emerald-500" : "bg-slate-400"
                    }`}
                  />
                  Realtime {realtimeConnected ? "connected" : "disconnected"}
                </span>

                {lastRealtimeSyncAt ? (
                  <span>
                    Last sync: {formatBookingDate(lastRealtimeSyncAt)}
                  </span>
                ) : null}
              </div>

              {floorStateLoading ? (
                <p className="mt-3 text-sm text-slate-500">
                  Refreshing reserved workspace state for the selected time range...
                </p>
              ) : null}

              {bookings.length === 0 ? (
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  No bookings yet. Create your first booking from the selected
                  workspace drawer.
                </p>
              ) : (
                <div className="mt-4 space-y-3" data-testid="floor-map-recent-bookings">
                  {(selectedWorkspaceBookings.length > 0
                    ? selectedWorkspaceBookings
                    : bookings.slice(0, 4)
                  ).map((booking) => (
                    <div
                      key={booking.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {workspaces.find((workspace) => workspace.id === booking.workspace_id)
                          ?.name ?? booking.workspace_id}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatBookingDate(booking.start_time)} -{" "}
                        {formatBookingDate(booking.end_time)}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        Status:{" "}
                        <span className="font-semibold text-slate-900">
                          {booking.status}
                        </span>
                      </p>

                      {booking.status === "confirmed" ? (
                        <button
                          className="mt-3 rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
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
                          className="mt-3 rounded-full border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={releaseLoadingId === booking.id}
                          onClick={() => void handleReleaseBooking(booking.id)}
                          type="button"
                        >
                          {releaseLoadingId === booking.id
                            ? "Releasing..."
                            : "Release workspace"}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
