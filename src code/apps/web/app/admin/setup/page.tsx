"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { getBrowserApiBaseUrl } from "@/lib/api-base-url";
import { buildLoginRedirectUrl } from "@/lib/auth-redirect";

type Profile = {
  id: string;
  email: string;
  role: "admin" | "space_owner" | "user";
  fullName: string;
};

type Building = {
  id: string;
  name: string;
  address: string | null;
  total_floors: number;
  open_time: string | null;
  close_time: string | null;
};

type Floor = {
  id: string;
  building_id: string;
  floor_number: number;
  name: string | null;
  svg_map_url: string | null;
};

type Workspace = {
  id: string;
  floor_id: string;
  name: string;
  type: string;
  status: string;
  svg_element_id: string;
  qr_code_value: string;
  capacity: number;
  features: Record<string, unknown>;
};

type SvgElementCandidate = {
  id: string;
  tagName: string;
};

type BuildingFormState = {
  name: string;
  address: string;
  totalFloors: string;
  openTime: string;
  closeTime: string;
};

type FloorFormState = {
  buildingId: string;
  floorNumber: string;
  name: string;
};

type WorkspaceFormState = {
  floorId: string;
  name: string;
  type: string;
  status: string;
  svgElementId: string;
  qrCodeValue: string;
  capacity: string;
  features: string;
};

const defaultBuildingForm: BuildingFormState = {
  name: "",
  address: "",
  totalFloors: "1",
  openTime: "08:00",
  closeTime: "18:00",
};

const defaultFloorForm: FloorFormState = {
  buildingId: "",
  floorNumber: "1",
  name: "",
};

const defaultWorkspaceForm: WorkspaceFormState = {
  floorId: "",
  name: "",
  type: "desk",
  status: "available",
  svgElementId: "",
  qrCodeValue: "",
  capacity: "1",
  features: "{}",
};

function formatErrorMessage(payload: unknown, fallbackMessage: string) {
  if (typeof payload === "string") {
    return payload;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    Array.isArray(payload.message)
  ) {
    return payload.message.join(", ");
  }

  return fallbackMessage;
}

function toTimeInputValue(value: string | null) {
  if (!value) {
    return "";
  }

  return value.length >= 5 ? value.slice(0, 5) : value;
}

function prettyJson(value: Record<string, unknown>) {
  return JSON.stringify(value ?? {}, null, 2);
}

const ignoredSvgTagNames = new Set([
  "defs",
  "desc",
  "filter",
  "lineargradient",
  "marker",
  "mask",
  "metadata",
  "pattern",
  "radialgradient",
  "script",
  "style",
  "symbol",
  "title",
]);

function isInsideIgnoredSvgContainer(element: Element) {
  let parent = element.parentElement;

  while (parent) {
    if (ignoredSvgTagNames.has(parent.tagName.toLowerCase())) {
      return true;
    }

    parent = parent.parentElement;
  }

  return false;
}

function parseSvgElementCandidates(svgText: string) {
  const document = new DOMParser().parseFromString(svgText, "image/svg+xml");

  if (document.querySelector("parsererror")) {
    throw new Error("Could not parse SVG file. Check that the file is valid SVG.");
  }

  const seenIds = new Set<string>();
  const candidates: SvgElementCandidate[] = [];

  document.querySelectorAll("[id]").forEach((element) => {
    const id = element.getAttribute("id")?.trim();
    const tagName = element.tagName.toLowerCase();

    if (
      !id ||
      seenIds.has(id) ||
      ignoredSvgTagNames.has(tagName) ||
      isInsideIgnoredSvgContainer(element)
    ) {
      return;
    }

    seenIds.add(id);
    candidates.push({ id, tagName });
  });

  return candidates;
}

function titleFromSvgId(svgId: string) {
  return svgId
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function AdminSetupPage() {
  const router = useRouter();
  const apiBaseUrl = useMemo(() => getBrowserApiBaseUrl(), []);

  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  const [editingBuildingId, setEditingBuildingId] = useState<string | null>(null);
  const [editingFloorId, setEditingFloorId] = useState<string | null>(null);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);

  const [buildingForm, setBuildingForm] =
    useState<BuildingFormState>(defaultBuildingForm);
  const [floorForm, setFloorForm] = useState<FloorFormState>(defaultFloorForm);
  const [workspaceForm, setWorkspaceForm] =
    useState<WorkspaceFormState>(defaultWorkspaceForm);

  const [buildingAction, setBuildingAction] = useState<"save" | null>(null);
  const [floorAction, setFloorAction] = useState<"save" | null>(null);
  const [workspaceAction, setWorkspaceAction] = useState<"save" | null>(null);
  const [svgAction, setSvgAction] = useState<"upload" | null>(null);

  const [deletingBuildingId, setDeletingBuildingId] = useState<string | null>(null);
  const [deletingFloorId, setDeletingFloorId] = useState<string | null>(null);
  const [deletingWorkspaceId, setDeletingWorkspaceId] = useState<string | null>(null);

  const [svgUploadFloorId, setSvgUploadFloorId] = useState("");
  const [svgFile, setSvgFile] = useState<File | null>(null);
  const [svgCandidates, setSvgCandidates] = useState<SvgElementCandidate[]>([]);
  const [svgAnalysisLoading, setSvgAnalysisLoading] = useState(false);
  const [svgAnalysisError, setSvgAnalysisError] = useState<string | null>(null);

  const canManageSetup =
    profile?.role === "admin" || profile?.role === "space_owner";

  const floorsWithBuilding = useMemo(() => {
    return floors.map((floor) => {
      const building = buildings.find((item) => item.id === floor.building_id);
      return {
        ...floor,
        buildingName: building?.name ?? "Unknown building",
      };
    });
  }, [buildings, floors]);

  const workspacesWithFloor = useMemo(() => {
    return workspaces.map((workspace) => {
      const floor = floors.find((item) => item.id === workspace.floor_id);
      const building = floor
        ? buildings.find((item) => item.id === floor.building_id)
        : null;

      return {
        ...workspace,
        floorName: floor?.name ?? `Floor ${floor?.floor_number ?? "?"}`,
        buildingName: building?.name ?? "Unknown building",
      };
    });
  }, [buildings, floors, workspaces]);

  const selectedSvgFloor = useMemo(() => {
    return floorsWithBuilding.find((floor) => floor.id === svgUploadFloorId) ?? null;
  }, [floorsWithBuilding, svgUploadFloorId]);

  const selectedFloorWorkspaces = useMemo(() => {
    if (!svgUploadFloorId) {
      return [];
    }

    return workspaces.filter((workspace) => workspace.floor_id === svgUploadFloorId);
  }, [svgUploadFloorId, workspaces]);

  const selectedFloorWorkspaceBySvgId = useMemo(() => {
    return new Map(
      selectedFloorWorkspaces.map((workspace) => [workspace.svg_element_id, workspace]),
    );
  }, [selectedFloorWorkspaces]);

  const svgMappingRows = useMemo(() => {
    return svgCandidates.map((candidate) => ({
      ...candidate,
      workspace: selectedFloorWorkspaceBySvgId.get(candidate.id) ?? null,
    }));
  }, [selectedFloorWorkspaceBySvgId, svgCandidates]);

  const mappedSvgCount = useMemo(() => {
    return svgMappingRows.filter((row) => row.workspace).length;
  }, [svgMappingRows]);

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
      if (!mounted) {
        return;
      }

      setSession(updatedSession);
      if (!updatedSession) {
        setProfile(null);
      }
      setLoadingSession(false);
    });

    void supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!mounted) {
        return;
      }

      setSession(currentSession);
      if (!currentSession) {
        setProfile(null);
        router.replace(buildLoginRedirectUrl());
      }
      setLoadingSession(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!session?.access_token || !apiBaseUrl) {
      return;
    }

    const accessToken = session.access_token;
    let active = true;

    async function loadProfile() {
      try {
        const response = await fetch(`${apiBaseUrl}/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const payload = (await response.json()) as Profile | { message?: string };

        if (!active) {
          return;
        }

        if (!response.ok) {
          setPageError(formatErrorMessage(payload, "Could not load current profile."));
          setProfile(null);
          return;
        }

        setProfile(payload as Profile);
        setPageError(null);
      } catch {
        if (!active) {
          return;
        }

        setPageError("Could not reach backend profile endpoint.");
        setProfile(null);
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [apiBaseUrl, session]);

  const loadAdminData = useCallback(
    async (accessToken: string) => {
      if (!apiBaseUrl) {
        return;
      }

      setLoadingData(true);
      setPageError(null);

      try {
        const [buildingsResponse, floorsResponse, workspacesResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/buildings`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch(`${apiBaseUrl}/floors`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch(`${apiBaseUrl}/workspaces`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        ]);

        const buildingsPayload = await buildingsResponse.json();
        const floorsPayload = await floorsResponse.json();
        const workspacesPayload = await workspacesResponse.json();

        if (!buildingsResponse.ok) {
          throw new Error(
            formatErrorMessage(buildingsPayload, "Could not load buildings."),
          );
        }

        if (!floorsResponse.ok) {
          throw new Error(formatErrorMessage(floorsPayload, "Could not load floors."));
        }

        if (!workspacesResponse.ok) {
          throw new Error(
            formatErrorMessage(workspacesPayload, "Could not load workspaces."),
          );
        }

        const nextBuildings = (buildingsPayload.items ?? []) as Building[];
        const nextFloors = (floorsPayload.items ?? []) as Floor[];
        const nextWorkspaces = (workspacesPayload.items ?? []) as Workspace[];

        setBuildings(nextBuildings);
        setFloors(nextFloors);
        setWorkspaces(nextWorkspaces);

        setFloorForm((current) =>
          current.buildingId || nextBuildings.length === 0
            ? current
            : { ...current, buildingId: nextBuildings[0]?.id ?? "" },
        );
        setSvgUploadFloorId((current) =>
          current || nextFloors.length === 0 ? current : (nextFloors[0]?.id ?? "")
        );
        setWorkspaceForm((current) =>
          current.floorId || nextFloors.length === 0
            ? current
            : { ...current, floorId: nextFloors[0]?.id ?? "" },
        );
      } catch (error) {
        setPageError(
          error instanceof Error
            ? error.message
            : "Could not load admin setup data.",
        );
      } finally {
        setLoadingData(false);
      }
    },
    [apiBaseUrl],
  );

  useEffect(() => {
    if (!session?.access_token || !apiBaseUrl || !canManageSetup) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadAdminData(session.access_token);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [apiBaseUrl, canManageSetup, loadAdminData, session]);

  useEffect(() => {
    const controller = new AbortController();

    if (
      !session?.access_token ||
      !apiBaseUrl ||
      !canManageSetup ||
      !selectedSvgFloor?.id ||
      !selectedSvgFloor.svg_map_url
    ) {
      const timeoutId = window.setTimeout(() => {
        setSvgCandidates([]);
        setSvgAnalysisError(null);
        setSvgAnalysisLoading(false);
      }, 0);

      return () => {
        controller.abort();
        window.clearTimeout(timeoutId);
      };
    }

    const accessToken = session.access_token;
    const floorId = selectedSvgFloor.id;

    async function loadSvgAnalysis() {
      setSvgAnalysisLoading(true);
      setSvgAnalysisError(null);

      try {
        const response = await fetch(`${apiBaseUrl}/floors/${floorId}/svg`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          signal: controller.signal,
        });

        const svgText = await response.text();

        if (!response.ok) {
          throw new Error(svgText || "Could not load floor SVG for mapping analysis.");
        }

        setSvgCandidates(parseSvgElementCandidates(svgText));
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setSvgCandidates([]);
        setSvgAnalysisError(
          error instanceof Error
            ? error.message
            : "Could not analyze floor SVG ids.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setSvgAnalysisLoading(false);
        }
      }
    }

    const timeoutId = window.setTimeout(() => {
      void loadSvgAnalysis();
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [apiBaseUrl, canManageSetup, selectedSvgFloor, session]);

  function resetBuildingForm() {
    setEditingBuildingId(null);
    setBuildingForm(defaultBuildingForm);
  }

  function resetFloorForm() {
    setEditingFloorId(null);
    setFloorForm({
      ...defaultFloorForm,
      buildingId: buildings[0]?.id ?? "",
    });
  }

  function resetWorkspaceForm() {
    setEditingWorkspaceId(null);
    setWorkspaceForm({
      ...defaultWorkspaceForm,
      floorId: floors[0]?.id ?? "",
    });
  }

  function prepareWorkspaceFromSvgId(svgId: string) {
    setEditingWorkspaceId(null);
    setWorkspaceForm({
      ...defaultWorkspaceForm,
      floorId: svgUploadFloorId,
      name: titleFromSvgId(svgId),
      svgElementId: svgId,
      qrCodeValue: svgId,
      features: "{}",
    });
    setPageMessage(`Prepared workspace form from SVG id "${svgId}". Review and save it.`);
    setPageError(null);
  }

  async function handleBuildingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.access_token || !apiBaseUrl) {
      setPageError("No active authenticated session.");
      return;
    }

    setBuildingAction("save");
    setPageError(null);
    setPageMessage(null);

    try {
      const payload = {
        name: buildingForm.name.trim(),
        address: buildingForm.address.trim() || undefined,
        totalFloors: Number(buildingForm.totalFloors),
        openTime: buildingForm.openTime || undefined,
        closeTime: buildingForm.closeTime || undefined,
      };

      const response = await fetch(
        editingBuildingId
          ? `${apiBaseUrl}/buildings/${editingBuildingId}`
          : `${apiBaseUrl}/buildings`,
        {
          method: editingBuildingId ? "PATCH" : "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const responsePayload = await response.json();

      if (!response.ok) {
        throw new Error(
          formatErrorMessage(responsePayload, "Could not save building."),
        );
      }

      await loadAdminData(session.access_token);
      resetBuildingForm();
      setPageMessage(
        editingBuildingId
          ? "Building updated successfully."
          : "Building created successfully.",
      );
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Could not save building.",
      );
    } finally {
      setBuildingAction(null);
    }
  }

  async function handleFloorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.access_token || !apiBaseUrl) {
      setPageError("No active authenticated session.");
      return;
    }

    setFloorAction("save");
    setPageError(null);
    setPageMessage(null);

    try {
      const payload = {
        buildingId: floorForm.buildingId,
        floorNumber: Number(floorForm.floorNumber),
        name: floorForm.name.trim() || undefined,
      };

      const response = await fetch(
        editingFloorId ? `${apiBaseUrl}/floors/${editingFloorId}` : `${apiBaseUrl}/floors`,
        {
          method: editingFloorId ? "PATCH" : "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const responsePayload = await response.json();

      if (!response.ok) {
        throw new Error(formatErrorMessage(responsePayload, "Could not save floor."));
      }

      await loadAdminData(session.access_token);
      resetFloorForm();
      setPageMessage(
        editingFloorId ? "Floor updated successfully." : "Floor created successfully.",
      );
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not save floor.");
    } finally {
      setFloorAction(null);
    }
  }

  async function handleWorkspaceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.access_token || !apiBaseUrl) {
      setPageError("No active authenticated session.");
      return;
    }

    setWorkspaceAction("save");
    setPageError(null);
    setPageMessage(null);

    try {
      const parsedFeatures = JSON.parse(workspaceForm.features) as Record<
        string,
        unknown
      >;

      const payload = {
        floorId: workspaceForm.floorId,
        name: workspaceForm.name.trim(),
        type: workspaceForm.type,
        status: workspaceForm.status,
        svgElementId: workspaceForm.svgElementId.trim(),
        qrCodeValue: workspaceForm.qrCodeValue.trim(),
        capacity: Number(workspaceForm.capacity),
        features: parsedFeatures,
      };

      const response = await fetch(
        editingWorkspaceId
          ? `${apiBaseUrl}/workspaces/${editingWorkspaceId}`
          : `${apiBaseUrl}/workspaces`,
        {
          method: editingWorkspaceId ? "PATCH" : "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const responsePayload = await response.json();

      if (!response.ok) {
        throw new Error(
          formatErrorMessage(responsePayload, "Could not save workspace."),
        );
      }

      await loadAdminData(session.access_token);
      resetWorkspaceForm();
      setPageMessage(
        editingWorkspaceId
          ? "Workspace updated successfully."
          : "Workspace created successfully.",
      );
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Could not save workspace. Check features JSON.",
      );
    } finally {
      setWorkspaceAction(null);
    }
  }

  async function handleSvgUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.access_token || !apiBaseUrl) {
      setPageError("No active authenticated session.");
      return;
    }

    if (!svgUploadFloorId || !svgFile) {
      setPageError("Choose a floor and select one SVG file first.");
      return;
    }

    if (selectedSvgFloor?.svg_map_url) {
      const confirmed = window.confirm(
        `The selected floor "${selectedSvgFloor.buildingName} - ${selectedSvgFloor.name ?? `Floor ${selectedSvgFloor.floor_number}`}" already has an active SVG map. Uploading a new file will replace the current svg_map_url for that floor. Do you want to continue?`,
      );

      if (!confirmed) {
        return;
      }
    }

    setSvgAction("upload");
    setPageError(null);
    setPageMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", svgFile);

      const response = await fetch(`${apiBaseUrl}/floors/${svgUploadFloorId}/svg`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const responsePayload = await response.json();

      if (!response.ok) {
        throw new Error(
          formatErrorMessage(responsePayload, "Could not upload floor SVG."),
        );
      }

      await loadAdminData(session.access_token);
      setSvgFile(null);
      setPageMessage("SVG map uploaded successfully.");
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Could not upload floor SVG.",
      );
    } finally {
      setSvgAction(null);
    }
  }

  async function handleDeleteBuilding(id: string) {
    if (!session?.access_token || !apiBaseUrl) {
      setPageError("No active authenticated session.");
      return;
    }

    setDeletingBuildingId(id);
    setPageError(null);
    setPageMessage(null);

    try {
      const response = await fetch(`${apiBaseUrl}/buildings/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const responsePayload = await response.json();

      if (!response.ok) {
        throw new Error(
          formatErrorMessage(responsePayload, "Could not delete building."),
        );
      }

      await loadAdminData(session.access_token);
      if (editingBuildingId === id) {
        resetBuildingForm();
      }
      setPageMessage("Building deleted successfully.");
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Could not delete building.",
      );
    } finally {
      setDeletingBuildingId(null);
    }
  }

  async function handleDeleteFloor(id: string) {
    if (!session?.access_token || !apiBaseUrl) {
      setPageError("No active authenticated session.");
      return;
    }

    setDeletingFloorId(id);
    setPageError(null);
    setPageMessage(null);

    try {
      const response = await fetch(`${apiBaseUrl}/floors/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const responsePayload = await response.json();

      if (!response.ok) {
        throw new Error(formatErrorMessage(responsePayload, "Could not delete floor."));
      }

      await loadAdminData(session.access_token);
      if (editingFloorId === id) {
        resetFloorForm();
      }
      setPageMessage("Floor deleted successfully.");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not delete floor.");
    } finally {
      setDeletingFloorId(null);
    }
  }

  async function handleDeleteWorkspace(id: string) {
    if (!session?.access_token || !apiBaseUrl) {
      setPageError("No active authenticated session.");
      return;
    }

    setDeletingWorkspaceId(id);
    setPageError(null);
    setPageMessage(null);

    try {
      const response = await fetch(`${apiBaseUrl}/workspaces/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const responsePayload = await response.json();

      if (!response.ok) {
        throw new Error(
          formatErrorMessage(responsePayload, "Could not delete workspace."),
        );
      }

      await loadAdminData(session.access_token);
      if (editingWorkspaceId === id) {
        resetWorkspaceForm();
      }
      setPageMessage("Workspace deleted successfully.");
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Could not delete workspace.",
      );
    } finally {
      setDeletingWorkspaceId(null);
    }
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3">
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                Admin Setup Prototype
              </span>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
                Manage buildings, floors, workspaces, and floor SVG uploads from one screen.
              </h1>
              <p className="max-w-4xl text-base leading-7 text-slate-600">
                This is the next MVP operations screen. It keeps the current prototype
                style, but moves day-to-day setup for buildings, floors,
                workspaces, and SVG floor maps into the web app so admin and
                space owner accounts do not need to
                rely on Supabase dashboard or manual API calls.
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
                href="/bookings"
              >
                Open Bookings
              </Link>
              <Link
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                href="/workspace-qr"
              >
                Open QR Assets
              </Link>
            </div>
          </div>
        </section>

        {pageMessage ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {pageMessage}
          </p>
        ) : null}

        {pageError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {pageError}
          </p>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Current user
              </p>
              <div className="mt-4 rounded-3xl bg-slate-950 p-6 text-slate-100">
                {loadingSession ? (
                  <p className="text-sm text-slate-300">Loading session...</p>
                ) : !session ? (
                  <p className="text-sm text-slate-300">
                    No active authenticated session.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-2xl font-semibold">
                      {profile?.email ?? session.user.email}
                    </p>
                    <p className="text-sm text-slate-300">
                      Role: {profile?.role ?? "unknown"}
                    </p>
                    <p className="text-sm text-slate-300">
                      {profile?.fullName ? `Full name: ${profile.fullName}` : "No full name yet"}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Buildings
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">
                    {buildings.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Floors
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">
                    {floors.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Workspaces
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">
                    {workspaces.length}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!session?.access_token || !canManageSetup || loadingData}
                  onClick={() => {
                    if (session?.access_token) {
                      void loadAdminData(session.access_token);
                    }
                  }}
                  type="button"
                >
                  {loadingData ? "Refreshing..." : "Refresh data"}
                </button>
              </div>

              {!canManageSetup && !loadingSession ? (
                <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Only admin or space owner accounts can use this setup screen.
                </p>
              ) : null}
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                SVG upload
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Upload one SVG floor map and attach it directly to the selected floor.
              </p>
              <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">Important before uploading a new SVG</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-800">
                  <li>The selected floor keeps only one active SVG map reference at a time.</li>
                  <li>Uploading a new file replaces the current map used by the floor map page.</li>
                  <li>Uploading an SVG does not create workspaces automatically.</li>
                  <li>
                    Clickable areas only work when the SVG element <code>id</code> matches a
                    workspace <code>svg_element_id</code>.
                  </li>
                </ul>
              </div>

              <form className="mt-5 space-y-4" onSubmit={(event) => void handleSvgUpload(event)}>
                <label className="block space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Floor</span>
                  <select
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-500 focus:bg-white"
                    onChange={(event) => setSvgUploadFloorId(event.target.value)}
                    value={svgUploadFloorId}
                  >
                    <option value="">Select floor</option>
                    {floorsWithBuilding.map((floor) => (
                      <option key={floor.id} value={floor.id}>
                        {floor.buildingName} - {floor.name ?? `Floor ${floor.floor_number}`}{" "}
                        {floor.svg_map_url ? "(SVG uploaded)" : "(no SVG yet)"}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedSvgFloor ? (
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      selectedSvgFloor.svg_map_url
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  >
                    <p className="font-semibold">
                      Selected floor: {selectedSvgFloor.buildingName} -{" "}
                      {selectedSvgFloor.name ?? `Floor ${selectedSvgFloor.floor_number}`}
                    </p>
                    <p className="mt-1">
                      Current SVG status:{" "}
                      {selectedSvgFloor.svg_map_url ? "uploaded" : "not uploaded yet"}
                    </p>
                    <p className="mt-1 break-all text-xs">
                      {selectedSvgFloor.svg_map_url ?? "No svg_map_url attached yet."}
                    </p>
                    {selectedSvgFloor.svg_map_url ? (
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em]">
                        Uploading a new file will replace the active SVG map for this floor.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <label className="block space-y-2 text-sm text-slate-700">
                  <span className="font-medium">SVG file</span>
                  <input
                    accept=".svg,image/svg+xml"
                    className="block w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-700 focus:border-slate-500 focus:bg-white"
                    onChange={(event) => setSvgFile(event.target.files?.[0] ?? null)}
                    type="file"
                  />
                </label>

                <button
                  className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={!canManageSetup || svgAction !== null}
                  type="submit"
                >
                  {svgAction === "upload"
                    ? "Uploading SVG..."
                    : selectedSvgFloor?.svg_map_url
                      ? "Replace SVG"
                      : "Upload SVG"}
                </button>
              </form>

              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                      SVG mapping
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      The floor map only becomes clickable when an SVG element id
                      matches a workspace <code>svg_element_id</code> on the same floor.
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Use <span className="font-semibold">Prepare workspace</span> to prefill the
                      workspace form from an unmapped SVG id, then save the matching workspace
                      record below.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                    <span className="font-semibold">{mappedSvgCount}</span> /{" "}
                    <span className="font-semibold">{svgMappingRows.length}</span> mapped
                  </div>
                </div>

                {!selectedSvgFloor ? (
                  <p className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    Select a floor to inspect SVG ids and workspace mappings.
                  </p>
                ) : !selectedSvgFloor.svg_map_url ? (
                  <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    This floor has no active SVG yet. Upload an SVG first, then map its
                    element ids to workspaces.
                  </p>
                ) : svgAnalysisLoading ? (
                  <p className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    Loading SVG ids...
                  </p>
                ) : svgAnalysisError ? (
                  <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {svgAnalysisError}
                  </p>
                ) : svgMappingRows.length === 0 ? (
                  <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    No usable SVG element ids were found. Check the SVG creation rules
                    and make sure bookable shapes have stable id attributes.
                  </p>
                ) : (
                  <div className="mt-4 max-h-96 space-y-2 overflow-auto pr-1">
                    {svgMappingRows.map((row) => (
                      <div
                        className={`rounded-2xl border px-4 py-3 ${
                          row.workspace
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-amber-200 bg-amber-50"
                        }`}
                        key={`${row.tagName}-${row.id}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-mono text-sm font-semibold text-slate-900">
                              {row.id}
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              SVG tag: {row.tagName}
                            </p>
                          </div>

                          {row.workspace ? (
                            <div className="text-right text-sm">
                              <p className="font-semibold text-emerald-800">mapped</p>
                              <p className="text-slate-700">{row.workspace.name}</p>
                              <p className="text-xs text-slate-500">
                                {row.workspace.type} | {row.workspace.status}
                              </p>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                                missing workspace
                              </span>
                              <button
                                className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                                onClick={() => prepareWorkspaceFromSvgId(row.id)}
                                type="button"
                              >
                                Prepare workspace
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </aside>

          <div className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Buildings
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Create, update, and remove office buildings.
                  </p>
                </div>
                <button
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  onClick={resetBuildingForm}
                  type="button"
                >
                  Reset form
                </button>
              </div>

              <form className="mt-5 grid gap-3 lg:grid-cols-2" onSubmit={(event) => void handleBuildingSubmit(event)}>
                <input
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-500 focus:bg-white"
                  onChange={(event) =>
                    setBuildingForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Head Office"
                  value={buildingForm.name}
                />
                <input
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-500 focus:bg-white"
                  onChange={(event) =>
                    setBuildingForm((current) => ({
                      ...current,
                      address: event.target.value,
                    }))
                  }
                  placeholder="Bangkok"
                  value={buildingForm.address}
                />
                <input
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-500 focus:bg-white"
                  min={1}
                  onChange={(event) =>
                    setBuildingForm((current) => ({
                      ...current,
                      totalFloors: event.target.value,
                    }))
                  }
                  type="number"
                  value={buildingForm.totalFloors}
                />
                <input
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-500 focus:bg-white"
                  onChange={(event) =>
                    setBuildingForm((current) => ({
                      ...current,
                      openTime: event.target.value,
                    }))
                  }
                  type="time"
                  value={buildingForm.openTime}
                />
                <input
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-500 focus:bg-white lg:col-start-2"
                  onChange={(event) =>
                    setBuildingForm((current) => ({
                      ...current,
                      closeTime: event.target.value,
                    }))
                  }
                  type="time"
                  value={buildingForm.closeTime}
                />

                <div className="lg:col-span-2">
                  <button
                    className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                    disabled={!canManageSetup || buildingAction !== null}
                    type="submit"
                  >
                    {buildingAction === "save"
                      ? "Saving building..."
                      : editingBuildingId
                        ? "Update building"
                        : "Create building"}
                  </button>
                </div>
              </form>

              <div className="mt-6 space-y-3">
                {buildings.map((building) => (
                  <div
                    key={building.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-slate-900">{building.name}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {building.address || "No address"}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          Floors: {building.total_floors} | Open:{" "}
                          {toTimeInputValue(building.open_time) || "--:--"} | Close:{" "}
                          {toTimeInputValue(building.close_time) || "--:--"}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white"
                          onClick={() => {
                            setEditingBuildingId(building.id);
                            setBuildingForm({
                              name: building.name,
                              address: building.address ?? "",
                              totalFloors: String(building.total_floors),
                              openTime: toTimeInputValue(building.open_time),
                              closeTime: toTimeInputValue(building.close_time),
                            });
                          }}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-full border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={deletingBuildingId === building.id}
                          onClick={() => void handleDeleteBuilding(building.id)}
                          type="button"
                        >
                          {deletingBuildingId === building.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Floors
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Create floors, assign them to buildings, and track SVG upload status.
                  </p>
                </div>
                <button
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  onClick={resetFloorForm}
                  type="button"
                >
                  Reset form
                </button>
              </div>

              <form className="mt-5 grid gap-3 lg:grid-cols-3" onSubmit={(event) => void handleFloorSubmit(event)}>
                <select
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-500 focus:bg-white"
                  onChange={(event) =>
                    setFloorForm((current) => ({ ...current, buildingId: event.target.value }))
                  }
                  value={floorForm.buildingId}
                >
                  <option value="">Select building</option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-500 focus:bg-white"
                  onChange={(event) =>
                    setFloorForm((current) => ({
                      ...current,
                      floorNumber: event.target.value,
                    }))
                  }
                  type="number"
                  value={floorForm.floorNumber}
                />
                <input
                  className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-500 focus:bg-white"
                  onChange={(event) =>
                    setFloorForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Floor 2"
                  value={floorForm.name}
                />

                <div className="lg:col-span-3">
                  <button
                    className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                    disabled={!canManageSetup || floorAction !== null}
                    type="submit"
                  >
                    {floorAction === "save"
                      ? "Saving floor..."
                      : editingFloorId
                        ? "Update floor"
                        : "Create floor"}
                  </button>
                </div>
              </form>

              <div className="mt-6 space-y-3">
                {floorsWithBuilding.map((floor) => (
                  <div
                    key={floor.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-slate-900">
                          {floor.name ?? `Floor ${floor.floor_number}`}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">{floor.buildingName}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          Floor number: {floor.floor_number} | SVG:{" "}
                          {floor.svg_map_url ? "uploaded" : "not uploaded"}
                        </p>
                        <p className="mt-1 break-all text-xs text-slate-400">
                          {floor.svg_map_url ?? "No svg_map_url yet"}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white"
                          onClick={() => {
                            setEditingFloorId(floor.id);
                            setFloorForm({
                              buildingId: floor.building_id,
                              floorNumber: String(floor.floor_number),
                              name: floor.name ?? "",
                            });
                            setSvgUploadFloorId(floor.id);
                          }}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-full border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={deletingFloorId === floor.id}
                          onClick={() => void handleDeleteFloor(floor.id)}
                          type="button"
                        >
                          {deletingFloorId === floor.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Workspaces
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Manage bookable spaces, SVG ids, static QR values, and workspace
                    status.
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    For the floor map to work correctly, the workspace name is only a display
                    label. The actual binding is driven by <code>svg_element_id</code> and the
                    static <code>qr_code_value</code>.
                  </p>
                </div>
                <button
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  onClick={resetWorkspaceForm}
                  type="button"
                >
                  Reset form
                </button>
              </div>

              <form className="mt-5 grid gap-3 lg:grid-cols-2" onSubmit={(event) => void handleWorkspaceSubmit(event)}>
                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Floor</span>
                  <select
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-500 focus:bg-white"
                    onChange={(event) =>
                      setWorkspaceForm((current) => ({ ...current, floorId: event.target.value }))
                    }
                    value={workspaceForm.floorId}
                  >
                    <option value="">Select floor</option>
                    {floorsWithBuilding.map((floor) => (
                      <option key={floor.id} value={floor.id}>
                        {floor.buildingName} - {floor.name ?? `Floor ${floor.floor_number}`}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">
                    Choose the floor that owns this workspace.
                  </p>
                </label>

                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Workspace display name</span>
                  <input
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-500 focus:bg-white"
                    onChange={(event) =>
                      setWorkspaceForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Desk A-01"
                    value={workspaceForm.name}
                  />
                  <p className="text-xs text-slate-500">
                    This is the label users see in the UI.
                  </p>
                </label>

                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Workspace type</span>
                  <select
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-500 focus:bg-white"
                    onChange={(event) =>
                      setWorkspaceForm((current) => ({ ...current, type: event.target.value }))
                    }
                    value={workspaceForm.type}
                  >
                    <option value="desk">desk</option>
                    <option value="meeting_room">meeting_room</option>
                    <option value="focus_room">focus_room</option>
                    <option value="lab">lab</option>
                    <option value="room">room</option>
                    <option value="parking">parking</option>
                  </select>
                  <p className="text-xs text-slate-500">
                    Use <code>desk</code> for single seats, or choose room/lab/meeting_room for
                    larger bookable spaces.
                  </p>
                </label>

                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Workspace status</span>
                  <select
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-500 focus:bg-white"
                    onChange={(event) =>
                      setWorkspaceForm((current) => ({ ...current, status: event.target.value }))
                    }
                    value={workspaceForm.status}
                  >
                    <option value="available">available</option>
                    <option value="maintenance">maintenance</option>
                    <option value="inactive">inactive</option>
                  </select>
                  <p className="text-xs text-slate-500">
                    Inactive spaces stay in the system but should not be used for live booking.
                  </p>
                </label>

                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">SVG element id</span>
                  <input
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-500 focus:bg-white"
                    onChange={(event) =>
                      setWorkspaceForm((current) => ({
                        ...current,
                        svgElementId: event.target.value,
                      }))
                    }
                    placeholder="desk_a_01"
                    value={workspaceForm.svgElementId}
                  />
                  <p className="text-xs text-slate-500">
                    Must match the SVG <code>id</code> exactly for click binding on the floor map.
                  </p>
                </label>

                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Static QR value</span>
                  <input
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-500 focus:bg-white"
                    onChange={(event) =>
                      setWorkspaceForm((current) => ({
                        ...current,
                        qrCodeValue: event.target.value,
                      }))
                    }
                    placeholder="desk_a_01"
                    value={workspaceForm.qrCodeValue}
                  />
                  <p className="text-xs text-slate-500">
                    Current MVP uses one fixed QR per workspace for check-in.
                  </p>
                </label>

                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Capacity</span>
                  <input
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-500 focus:bg-white"
                    min={1}
                    onChange={(event) =>
                      setWorkspaceForm((current) => ({
                        ...current,
                        capacity: event.target.value,
                      }))
                    }
                    type="number"
                    value={workspaceForm.capacity}
                  />
                  <p className="text-xs text-slate-500">
                    For a single desk use <code>1</code>; for meeting rooms use the room capacity.
                  </p>
                </label>

                <label className="space-y-2 text-sm text-slate-700 lg:col-span-2">
                  <span className="font-medium">Features JSON</span>
                  <textarea
                    className="min-h-32 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 font-mono text-sm outline-none transition focus:border-slate-500 focus:bg-white"
                    onChange={(event) =>
                      setWorkspaceForm((current) => ({
                        ...current,
                        features: event.target.value,
                      }))
                    }
                    placeholder={`{\n  "monitor": true\n}`}
                    value={workspaceForm.features}
                  />
                  <p className="text-xs text-slate-500">
                    Optional JSON metadata such as equipment, room category, or extra labels.
                  </p>
                </label>

                <div className="lg:col-span-2">
                  <button
                    className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                    disabled={!canManageSetup || workspaceAction !== null}
                    type="submit"
                  >
                    {workspaceAction === "save"
                      ? "Saving workspace..."
                      : editingWorkspaceId
                        ? "Update workspace"
                        : "Create workspace"}
                  </button>
                </div>
              </form>

              <div className="mt-6 space-y-3">
                {workspacesWithFloor.map((workspace) => (
                  <div
                    key={workspace.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-slate-900">{workspace.name}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {workspace.buildingName} - {workspace.floorName}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-white px-2 py-1">
                            {workspace.status}
                          </span>
                          <span className="rounded-full bg-white px-2 py-1">
                            {workspace.type}
                          </span>
                          <span className="rounded-full bg-white px-2 py-1">
                            cap {workspace.capacity}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          SVG id: {workspace.svg_element_id}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          QR value: {workspace.qr_code_value}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white"
                          onClick={() => {
                            setEditingWorkspaceId(workspace.id);
                            setWorkspaceForm({
                              floorId: workspace.floor_id,
                              name: workspace.name,
                              type: workspace.type,
                              status: workspace.status,
                              svgElementId: workspace.svg_element_id,
                              qrCodeValue: workspace.qr_code_value,
                              capacity: String(workspace.capacity),
                              features: prettyJson(workspace.features ?? {}),
                            });
                          }}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-full border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={deletingWorkspaceId === workspace.id}
                          onClick={() => void handleDeleteWorkspace(workspace.id)}
                          type="button"
                        >
                          {deletingWorkspaceId === workspace.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
