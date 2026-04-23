"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
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

export default function WorkspaceQrPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [floors, setFloors] = useState<FloorRecord[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string>("all");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null,
  );
  const [qrImageMap, setQrImageMap] = useState<Record<string, string>>({});
  const [searchText, setSearchText] = useState("");
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const apiBaseUrl = useMemo(() => getBrowserApiBaseUrl(), []);

  const filteredWorkspaces = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return workspaces.filter((workspace) => {
      const matchesFloor =
        selectedFloorId === "all" || workspace.floor_id === selectedFloorId;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        workspace.name.toLowerCase().includes(normalizedSearch) ||
        workspace.qr_code_value.toLowerCase().includes(normalizedSearch) ||
        workspace.svg_element_id.toLowerCase().includes(normalizedSearch);

      return matchesFloor && matchesSearch;
    });
  }, [searchText, selectedFloorId, workspaces]);

  const selectedWorkspace = useMemo(
    () =>
      filteredWorkspaces.find((workspace) => workspace.id === selectedWorkspaceId) ??
      filteredWorkspaces[0] ??
      null,
    [filteredWorkspaces, selectedWorkspaceId],
  );

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
      if (mounted) {
        setSession(updatedSession);
      }
    });

    void supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (mounted) {
        setSession(currentSession);
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

    async function bootstrap() {
      if (!session?.access_token) {
        setProfile(null);
        setFloors([]);
        setWorkspaces([]);
        setSelectedFloorId("all");
        setSelectedWorkspaceId(null);
        setQrImageMap({});
        setErrorMessage("Please sign in before opening the QR workspace page.");
        setLoading(false);
        return;
      }

      if (!apiBaseUrl) {
        setErrorMessage("Missing NEXT_PUBLIC_API_BASE_URL.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMessage(null);

        const headers = {
          Authorization: `Bearer ${session.access_token}`,
        };

        const [profileResponse, floorsResponse, workspacesResponse] =
          await Promise.all([
            fetch(`${apiBaseUrl}/me`, { headers }),
            fetch(`${apiBaseUrl}/floors`, { headers }),
            fetch(`${apiBaseUrl}/workspaces`, { headers }),
          ]);

        if (
          !profileResponse.ok ||
          !floorsResponse.ok ||
          !workspacesResponse.ok
        ) {
          throw new Error("Failed to load profile, floors, or workspaces.");
        }

        const profilePayload =
          (await profileResponse.json()) satisfies AuthProfile;
        const floorsPayload =
          (await floorsResponse.json()) satisfies FloorsResponse;
        const workspacesPayload =
          (await workspacesResponse.json()) satisfies WorkspacesResponse;

        if (!mounted) {
          return;
        }

        setProfile(profilePayload);
        setFloors(floorsPayload.items);
        setWorkspaces(workspacesPayload.items);
        setSelectedFloorId((currentValue) =>
          currentValue === "all" ? "all" : currentValue,
        );
        setSelectedWorkspaceId(workspacesPayload.items[0]?.id ?? null);
      } catch {
        if (mounted) {
          setErrorMessage(
            "Could not load profile or workspace data. Check the backend and your Supabase connection.",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [apiBaseUrl, session]);

  useEffect(() => {
    let active = true;

    async function buildQrImages() {
      if (filteredWorkspaces.length === 0) {
        setQrImageMap({});
        return;
      }

      const nextEntries = await Promise.all(
        filteredWorkspaces.map(async (workspace) => {
          const dataUrl = await QRCode.toDataURL(workspace.qr_code_value, {
            width: 280,
            margin: 1,
            color: {
              dark: "#0f172a",
              light: "#ffffff",
            },
          });

          return [workspace.id, dataUrl] as const;
        }),
      );

      if (active) {
        setQrImageMap(Object.fromEntries(nextEntries));
      }
    }

    void buildQrImages();

    return () => {
      active = false;
    };
  }, [filteredWorkspaces]);

  async function handleCopyQrValue(qrCodeValue: string) {
    await navigator.clipboard.writeText(qrCodeValue);
    setCopyMessage(`Copied QR value: ${qrCodeValue}`);
    window.setTimeout(() => {
      setCopyMessage((currentMessage) =>
        currentMessage === `Copied QR value: ${qrCodeValue}` ? null : currentMessage,
      );
    }, 2500);
  }

  async function handleDownloadQr(workspace: WorkspaceRecord) {
    const dataUrl = qrImageMap[workspace.id];

    if (!dataUrl) {
      return;
    }

    const qrImage = new Image();
    qrImage.src = dataUrl;

    await new Promise<void>((resolve, reject) => {
      qrImage.onload = () => resolve();
      qrImage.onerror = () => reject(new Error("Failed to prepare QR image."));
    });

    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 860;

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = "#e2e8f0";
    context.lineWidth = 4;
    context.strokeRect(22, 22, canvas.width - 44, canvas.height - 44);

    context.fillStyle = "#0f172a";
    context.font = "600 30px Arial";
    context.textAlign = "center";
    context.fillText("Workspace Booking", canvas.width / 2, 80);

    context.drawImage(qrImage, 160, 130, 320, 320);

    context.fillStyle = "#0f172a";
    context.font = "700 48px Arial";
    context.fillText(workspace.name, canvas.width / 2, 560);

    context.fillStyle = "#64748b";
    context.font = "400 22px Arial";
    context.fillText(
      "Print and attach this label to the matching workspace.",
      canvas.width / 2,
      760,
    );

    const anchor = document.createElement("a");
    anchor.href = canvas.toDataURL("image/png");
    anchor.download = `${workspace.name.toLowerCase().replace(/\s+/g, "-")}-qr.png`;
    anchor.click();
  }

  const canManageQr =
    profile?.role === "admin" || profile?.role === "manager";

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3">
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                Static QR Management
              </span>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
                Generate, review, and download workspace QR codes for printing.
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-600">
                This screen turns each workspace
                <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-800">
                  qr_code_value
                </code>
                into a printable QR image. It supports the current MVP model where
                each workspace keeps one static QR label.
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
                href="/check-in"
              >
                Open Check-in Prototype
              </Link>
            </div>
          </div>
        </div>

        {copyMessage ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {copyMessage}
          </p>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Workspace QR list
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Filter by floor or search by workspace name, SVG id, or QR value.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <select
                  className="min-w-52 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-500 focus:bg-white"
                  onChange={(event) => setSelectedFloorId(event.target.value)}
                  value={selectedFloorId}
                >
                  <option value="all">All floors</option>
                  {floors.map((floor) => (
                    <option key={floor.id} value={floor.id}>
                      {floor.name ?? `Floor ${floor.floor_number}`}
                    </option>
                  ))}
                </select>

                <input
                  className="min-w-64 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-500 focus:bg-white"
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search workspace_a_01, Desk A-01..."
                  value={searchText}
                />
              </div>
            </div>

            <div className="mt-6">
              {loading ? (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Loading QR management data...
                </p>
              ) : errorMessage ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {errorMessage}
                </p>
              ) : !canManageQr ? (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Only admin or manager accounts can access QR management.
                </p>
              ) : filteredWorkspaces.length === 0 ? (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  No workspaces match the current filters.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredWorkspaces.map((workspace) => {
                    const floor = floors.find(
                      (item) => item.id === workspace.floor_id,
                    );
                    const isSelected = workspace.id === selectedWorkspace?.id;

                    return (
                      <button
                        key={workspace.id}
                        className={`rounded-[1.5rem] border p-4 text-left transition ${
                          isSelected
                            ? "border-slate-900 bg-slate-950 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-white"
                        }`}
                        onClick={() => setSelectedWorkspaceId(workspace.id)}
                        type="button"
                      >
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          {floor?.name ?? "Unknown floor"}
                        </p>
                        <p className="mt-2 text-xl font-semibold">{workspace.name}</p>
                        <p
                          className={`mt-2 text-sm ${
                            isSelected ? "text-slate-300" : "text-slate-600"
                          }`}
                        >
                          QR value: {workspace.qr_code_value}
                        </p>
                        <p
                          className={`mt-1 text-sm ${
                            isSelected ? "text-slate-300" : "text-slate-600"
                          }`}
                        >
                          SVG id: {workspace.svg_element_id}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <aside className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              QR preview
            </p>

            {selectedWorkspace && qrImageMap[selectedWorkspace.id] ? (
              <div className="mt-5 space-y-5">
                <div className="rounded-3xl bg-slate-950 p-5 text-white">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Selected workspace
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {selectedWorkspace.name}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    QR value: {selectedWorkspace.qr_code_value}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    SVG id: {selectedWorkspace.svg_element_id}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="mx-auto flex w-full max-w-72 flex-col items-center rounded-[2rem] border border-slate-200 bg-white px-5 py-5 text-center shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={`QR code for ${selectedWorkspace.name}`}
                      className="h-auto w-full max-w-60"
                      src={qrImageMap[selectedWorkspace.id]}
                    />
                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <p className="text-2xl font-semibold tracking-tight text-slate-900">
                        {selectedWorkspace.name}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                    href={`/check-in?qr=${encodeURIComponent(
                      selectedWorkspace.qr_code_value,
                    )}`}
                  >
                    Open in Check-in
                  </Link>
                  <button
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    onClick={() => handleDownloadQr(selectedWorkspace)}
                    type="button"
                  >
                    Download QR
                  </button>
                  <button
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    onClick={() =>
                      void handleCopyQrValue(selectedWorkspace.qr_code_value)
                    }
                    type="button"
                  >
                    Copy QR value
                  </button>
                </div>

                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm leading-7 text-slate-600">
                  <p className="font-semibold text-slate-900">Print note</p>
                  <p className="mt-2">
                    Print this QR and place it on the physical workspace that matches
                    <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-800">
                      {selectedWorkspace.name}
                    </code>
                    . The check-in prototype currently expects the static workspace QR
                    value, not a booking-specific QR.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                Select a workspace on the left to preview and download its QR code.
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
