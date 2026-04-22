"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { getBrowserApiBaseUrl } from "@/lib/api-base-url";

type WorkspaceRecord = {
  id: string;
  floor_id: string;
  name: string;
  type: string;
  status: "available" | "maintenance";
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

type Html5QrcodeInstance = {
  start: (
    cameraConfig: unknown,
    configuration: unknown,
    onSuccess: (decodedText: string) => void,
    onError?: (errorMessage: string) => void,
  ) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => Promise<void>;
};

function buildDefaultScanTime() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function formatDateTimeValue(dateValue: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateValue));
}

const SERVER_BROWSER_ENVIRONMENT_SNAPSHOT = {
  apiBaseUrl: null as string | null,
  secureContext: false,
  cameraSupported: false,
  ready: false,
};

let clientBrowserEnvironmentSnapshot = SERVER_BROWSER_ENVIRONMENT_SNAPSHOT;

function subscribeBrowserEnvironment() {
  return () => {};
}

function getServerBrowserEnvironmentSnapshot() {
  return SERVER_BROWSER_ENVIRONMENT_SNAPSHOT;
}

function getClientBrowserEnvironmentSnapshot() {
  const nextSnapshot = {
    apiBaseUrl: getBrowserApiBaseUrl(),
    secureContext: window.isSecureContext,
    cameraSupported: Boolean(
      window.isSecureContext && navigator.mediaDevices?.getUserMedia,
    ),
    ready: true,
  };

  const cachedSnapshot = clientBrowserEnvironmentSnapshot;

  if (
    cachedSnapshot.apiBaseUrl === nextSnapshot.apiBaseUrl &&
    cachedSnapshot.secureContext === nextSnapshot.secureContext &&
    cachedSnapshot.cameraSupported === nextSnapshot.cameraSupported &&
    cachedSnapshot.ready === nextSnapshot.ready
  ) {
    return cachedSnapshot;
  }

  clientBrowserEnvironmentSnapshot = nextSnapshot;
  return clientBrowserEnvironmentSnapshot;
}

export default function CheckInPage() {
  const scannerRegionId = "check-in-camera-region";
  const searchParams = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrCodeValue, setQrCodeValue] = useState(
    searchParams.get("qr") ?? "desk_a_01",
  );
  const [scannedAt, setScannedAt] = useState(buildDefaultScanTime());
  const [submitting, setSubmitting] = useState(false);
  const [responseMessage, setResponseMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanResponse, setScanResponse] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const browserEnvironment = useSyncExternalStore(
    subscribeBrowserEnvironment,
    getClientBrowserEnvironmentSnapshot,
    getServerBrowserEnvironmentSnapshot,
  );
  const apiBaseUrl = browserEnvironment.apiBaseUrl;
  const cameraEnvironmentReady = browserEnvironment.ready;
  const secureContext = browserEnvironment.secureContext;
  const cameraSupported = browserEnvironment.cameraSupported;

  const matchingWorkspace = useMemo(
    () =>
      workspaces.find((workspace) => workspace.qr_code_value === qrCodeValue.trim()) ??
      null,
    [qrCodeValue, workspaces],
  );

  const scanDate = useMemo(() => new Date(scannedAt), [scannedAt]);

  const matchingWorkspaceBookings = useMemo(() => {
    if (!matchingWorkspace) {
      return [];
    }

    return bookings
      .filter((booking) => booking.workspace_id === matchingWorkspace.id)
      .filter((booking) => ["confirmed", "checked_in"].includes(booking.status))
      .sort(
        (left, right) =>
          new Date(left.start_time).getTime() - new Date(right.start_time).getTime(),
      );
  }, [bookings, matchingWorkspace]);

  const bookingAtScanTime = useMemo(() => {
    if (Number.isNaN(scanDate.getTime())) {
      return null;
    }

    return (
      matchingWorkspaceBookings.find((booking) => {
        const bookingStart = new Date(booking.start_time);
        const bookingEnd = new Date(booking.end_time);

        return scanDate >= bookingStart && scanDate <= bookingEnd;
      }) ?? null
    );
  }, [matchingWorkspaceBookings, scanDate]);

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
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadReferenceData() {
      if (!session?.access_token || !apiBaseUrl) {
        if (mounted) {
          setWorkspaces([]);
          setBookings([]);
        }
        return;
      }

      try {
        if (mounted) {
          setDataLoading(true);
        }

        const headers = {
          Authorization: `Bearer ${session.access_token}`,
        };

        const [workspacesResponse, bookingsResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/workspaces`, { headers }),
          fetch(`${apiBaseUrl}/bookings/my`, { headers }),
        ]);

        if (!workspacesResponse.ok || !bookingsResponse.ok) {
          throw new Error("Failed to load workspaces or bookings.");
        }

        const workspacesPayload =
          (await workspacesResponse.json()) satisfies WorkspacesResponse;
        const bookingsPayload =
          (await bookingsResponse.json()) satisfies BookingsResponse;

        if (!mounted) {
          return;
        }

        setWorkspaces(workspacesPayload.items);
        setBookings(bookingsPayload.items);
      } catch {
        if (mounted) {
          setErrorMessage(
            "Could not load workspace or booking context for check-in testing.",
          );
        }
      } finally {
        if (mounted) {
          setDataLoading(false);
        }
      }
    }

    void loadReferenceData();

    return () => {
      mounted = false;
    };
  }, [apiBaseUrl, session]);

  async function handleSubmit() {
    if (!session?.access_token) {
      setErrorMessage("Please sign in before testing check-in.");
      setResponseMessage(null);
      return;
    }

    if (!apiBaseUrl) {
      setErrorMessage("Missing NEXT_PUBLIC_API_BASE_URL.");
      setResponseMessage(null);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setResponseMessage(null);

    try {
      const response = await fetch(`${apiBaseUrl}/check-in/scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          qrCodeValue,
          scannedAt: new Date(scannedAt).toISOString(),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        const message =
          typeof payload?.message === "string"
            ? payload.message
            : "Check-in failed.";
        setErrorMessage(message);
        setScanResponse(JSON.stringify(payload, null, 2));
        return;
      }

      setResponseMessage(
        payload.alreadyCheckedIn
          ? "Booking was already checked in."
          : "Check-in successful.",
      );
      setScanResponse(JSON.stringify(payload, null, 2));

      const bookingsResponse = await fetch(`${apiBaseUrl}/bookings/my`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (bookingsResponse.ok) {
        const bookingsPayload =
          (await bookingsResponse.json()) satisfies BookingsResponse;
        setBookings(bookingsPayload.items);
      }
    } catch {
      setErrorMessage("Could not reach backend /check-in/scan endpoint.");
      setScanResponse(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function stopCamera() {
    const activeScanner = scannerRef.current;
    scannerRef.current = null;

    if (activeScanner) {
      try {
        await activeScanner.stop();
      } catch {
        // Ignore stop failures when the scanner is already idle.
      }

      try {
        await activeScanner.clear();
      } catch {
        // Ignore clear failures during teardown.
      }
    }

    setCameraActive(false);
    setCameraLoading(false);
  }

  function handleDetectedQr(detectedValue: string) {
    setQrCodeValue(detectedValue);
    setResponseMessage(null);
    setErrorMessage(null);
    setCameraError(null);
    setCameraStatus(`Detected QR: ${detectedValue}`);
  }

  async function startCamera() {
    if (!secureContext) {
      setCameraError(
        "Camera scanning requires HTTPS or localhost. This LAN URL is not a secure browser context, so use manual QR input for now.",
      );
      return;
    }

    if (!cameraSupported) {
      setCameraError(
        "This browser does not expose camera access for QR scanning. Use manual input for now.",
      );
      return;
    }

    try {
      await stopCamera();

      setCameraError(null);
      setCameraStatus("Requesting camera access...");
      setCameraLoading(true);
      const { Html5Qrcode } = await import("html5-qrcode");

      const scanner = new Html5Qrcode(scannerRegionId, {
        verbose: false,
      });
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: { exact: "environment" } },
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.777778,
          },
          (decodedText: string) => {
            handleDetectedQr(decodedText);
            void stopCamera();
          },
        );
      } catch {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.777778,
          },
          (decodedText: string) => {
            handleDetectedQr(decodedText);
            void stopCamera();
          },
        );
      }

      setCameraActive(true);
      setCameraLoading(false);
      setCameraStatus("Camera is live. Point it at a desk QR code.");
    } catch {
      await stopCamera();
      setCameraError(
        "Could not access the camera. Check browser permission and try again.",
      );
      setCameraStatus(null);
    }
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                QR Check-in Prototype
              </span>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
                Test desk check-in before wiring a real camera scanner.
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-600">
                This page simulates scanning a static desk QR by sending
                <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-800">
                  qrCodeValue
                </code>
                and an optional scan time to
                <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-800">
                  POST /check-in/scan
                </code>
                .
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
                href="/workspace-qr"
              >
                Open QR Manager
              </Link>
              <Link
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                href="/floor-map"
              >
                Open Floor Map
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Scanner input
            </p>

            <div className="mt-5 space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Camera scanner
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Use the browser camera when supported, or keep manual entry as
                      fallback.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!cameraActive ? (
                      <button
                        className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                        disabled={
                          !cameraEnvironmentReady || !cameraSupported || cameraLoading
                        }
                        onClick={() => void startCamera()}
                        type="button"
                      >
                        {cameraLoading ? "Opening camera..." : "Start camera scan"}
                      </button>
                    ) : (
                      <button
                        className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white"
                        onClick={() => void stopCamera()}
                        type="button"
                      >
                        Stop camera
                      </button>
                    )}
                  </div>
                </div>

                <div
                  className="mt-4 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-950 [&_video]:aspect-video [&_video]:w-full [&_video]:object-cover"
                  id={scannerRegionId}
                >
                  {!cameraActive ? <div className="aspect-video w-full" /> : null}
                </div>

                {cameraEnvironmentReady && !secureContext ? (
                  <p className="mt-3 text-sm text-amber-700">
                    Camera scanning on mobile browsers usually requires HTTPS or
                    localhost. Because this page is opened over a LAN HTTP URL,
                    manual QR input is the active fallback.
                  </p>
                ) : null}

                {cameraEnvironmentReady && secureContext && !cameraSupported ? (
                  <p className="mt-3 text-sm text-amber-700">
                    This browser does not expose camera scanning support here, so
                    manual QR input still works as fallback.
                  </p>
                ) : null}

                {cameraStatus ? (
                  <p className="mt-3 text-sm text-slate-600">{cameraStatus}</p>
                ) : null}

                {cameraError ? (
                  <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {cameraError}
                  </p>
                ) : null}
              </div>

              <label className="block space-y-2 text-sm text-slate-700">
                <span className="font-medium">Desk QR value</span>
                <input
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-500 focus:bg-white"
                  onChange={(event) => setQrCodeValue(event.target.value)}
                  placeholder="desk_a_01"
                  value={qrCodeValue}
                />
              </label>

              <label className="block space-y-2 text-sm text-slate-700">
                <span className="font-medium">Scan time (for testing)</span>
                <input
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-500 focus:bg-white"
                  onChange={(event) => setScannedAt(event.target.value)}
                  type="datetime-local"
                  value={scannedAt}
                />
              </label>

              {matchingWorkspace ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">
                    Matching workspace: {matchingWorkspace.name}
                  </p>
                  <p className="mt-1">
                    SVG id: {matchingWorkspace.svg_element_id}
                  </p>
                </div>
              ) : null}

              {bookingAtScanTime ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <p className="font-semibold text-emerald-900">
                    Booking matched for selected scan time
                  </p>
                  <p className="mt-1">
                    {formatDateTimeValue(bookingAtScanTime.start_time)} -{" "}
                    {formatDateTimeValue(bookingAtScanTime.end_time)}
                  </p>
                  <p className="mt-1">Status: {bookingAtScanTime.status}</p>
                </div>
              ) : matchingWorkspace ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  No confirmed or checked-in booking for this desk at the selected
                  scan time.
                </div>
              ) : null}

              <button
                className="w-full rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={loading || submitting || !session}
                onClick={() => void handleSubmit()}
                type="button"
              >
                {submitting ? "Checking in..." : "Submit check-in"}
              </button>

              {loading ? (
                <p className="text-sm text-slate-500">Loading session...</p>
              ) : !session ? (
                <p className="text-sm text-rose-700">
                  Please sign in before using the check-in test page.
                </p>
              ) : null}

              {responseMessage ? (
                <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {responseMessage}
                </p>
              ) : null}

              {errorMessage ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {errorMessage}
                </p>
              ) : null}
            </div>
          </section>

          <aside className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Expected flow
            </p>

            <div className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
              <p>1. Sign in with a user that has a confirmed booking.</p>
              <p>2. Enter the matching desk QR value, for example <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-800">desk_a_01</code>.</p>
              <p>3. Use a scan time that falls inside the booking window.</p>
              <p>4. The backend should update the booking status to <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-800">checked_in</code>.</p>
            </div>

            <div className="mt-6 rounded-3xl bg-slate-950 p-5 text-white">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Current user
              </p>
              <p className="mt-2 text-xl font-semibold">
                {session?.user.email ?? "No active session"}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                API base URL: {apiBaseUrl ?? "Missing"}
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Check-in context
              </p>

              {dataLoading ? (
                <p className="mt-3 text-sm text-slate-500">
                  Loading workspaces and your booking context...
                </p>
              ) : matchingWorkspaceBookings.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {matchingWorkspaceBookings.slice(0, 3).map((booking) => (
                    <div
                      key={booking.id}
                      className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700"
                    >
                      <p className="font-semibold text-slate-900">
                        {matchingWorkspace?.name ?? booking.workspace_id}
                      </p>
                      <p className="mt-1">
                        {formatDateTimeValue(booking.start_time)} -{" "}
                        {formatDateTimeValue(booking.end_time)}
                      </p>
                      <p className="mt-1">Status: {booking.status}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  No booking context found yet for the current QR value.
                </p>
              )}
            </div>

            {scanResponse ? (
              <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Backend response
                </p>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-xs leading-6 text-slate-700">
                  {scanResponse}
                </pre>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
