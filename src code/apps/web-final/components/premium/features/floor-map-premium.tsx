"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ZoomIn, ZoomOut, Maximize2, Map as MapIcon, ChevronRight, Calendar, Clock, AlertCircle, CheckCircle2, Building, Layers, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase/client"
import { getBrowserApiBaseUrl } from "@/lib/api-base-url"
import { readApiError } from "@/lib/http-feedback"
import { Button } from "@/components/premium/ui/button"
import { Card } from "@/components/premium/ui/card"
import { Input } from "@/components/premium/ui/input"
import { Skeleton } from "@/components/premium/ui/skeleton"
import { useToast } from "@/components/premium/ui/toast"
import { useLanguage } from "@/components/premium/language-provider"
import { cn } from "@/lib/utils"

// --- Types ---
interface BuildingRecord {
  id: string
  name: string
  address: string | null
  total_floors: number
  open_time: string | null
  close_time: string | null
}

interface FloorRecord {
  id: string
  building_id: string
  floor_number: number
  name: string | null
  svg_map_url: string | null
}

interface WorkspaceRecord {
  id: string
  floor_id: string
  name: string
  type: string
  status: 'available' | 'maintenance' | 'inactive'
  svg_element_id: string
  qr_code_value?: string
}

interface BookingRecord {
  id: string
  workspace_id: string
  start_time: string
  end_time: string
  status: string
  user_email?: string | null
  user_full_name?: string | null
  user_id?: string | null
}

type FloorMapStatus = WorkspaceRecord["status"] | "reserved"

interface MeResponse {
  role?: string
}

interface FloorsResponse {
  items: FloorRecord[]
}

interface BuildingsResponse {
  items: BuildingRecord[]
}

interface WorkspacesResponse {
  items: WorkspaceRecord[]
}

interface FloorStateResponse {
  items: BookingRecord[]
}

const statusStyleMap: Record<FloorMapStatus, { fill: string; stroke: string; glow: string }> = {
  available: { fill: "rgba(16, 185, 129, 0.1)", stroke: "rgba(16, 185, 129, 0.5)", glow: "rgba(16, 185, 129, 0.2)" },
  maintenance: { fill: "rgba(245, 158, 11, 0.1)", stroke: "rgba(245, 158, 11, 0.5)", glow: "rgba(245, 158, 11, 0.2)" },
  inactive: { fill: "rgba(100, 116, 139, 0.1)", stroke: "rgba(100, 116, 139, 0.5)", glow: "transparent" },
  reserved: { fill: "rgba(239, 68, 68, 0.1)", stroke: "rgba(239, 68, 68, 0.5)", glow: "rgba(239, 68, 68, 0.2)" },
}

// --- Utils ---
function formatDateTimeValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

function buildDefaultTimeWindow() {
  const roundedStart = new Date()
  roundedStart.setMinutes(0, 0, 0)
  roundedStart.setHours(roundedStart.getHours() + 1)
  const roundedEnd = new Date(roundedStart)
  roundedEnd.setHours(roundedEnd.getHours() + 2)
  return {
    start: formatDateTimeValue(roundedStart),
    end: formatDateTimeValue(roundedEnd),
  }
}

export function FloorMapPremium() {
  const { locale, t } = useLanguage()
  const { toast } = useToast()
  const router = useRouter()
  const [session, setSession] = React.useState<Session | null>(null)
  const [currentRole, setCurrentRole] = React.useState<string | null>(null)
  const [buildings, setBuildings] = React.useState<BuildingRecord[]>([])
  const [floors, setFloors] = React.useState<FloorRecord[]>([])
  const [workspaces, setWorkspaces] = React.useState<WorkspaceRecord[]>([])
  const [floorBookings, setFloorBookings] = React.useState<BookingRecord[]>([])
  const [selectedBuildingId, setSelectedBuildingId] = React.useState<string | null>(null)
  const [selectedFloorId, setSelectedFloorId] = React.useState<string>("")
  const [selectedWorkspaceId, setSelectedWorkspaceId] = React.useState<string | null>(null)
  const [hoveredId, setHoveredId] = React.useState<string | null>(null)
  const [baseSvgMarkup, setBaseSvgMarkup] = React.useState<string | null>(null)
  
  const [viewStart, setViewStart] = React.useState(() => buildDefaultTimeWindow().start)
  const [viewEnd, setViewEnd] = React.useState(() => buildDefaultTimeWindow().end)
  const [bookingStart, setBookingStart] = React.useState(() => buildDefaultTimeWindow().start)
  const [bookingEnd, setBookingEnd] = React.useState(() => buildDefaultTimeWindow().end)
  
  const [loading, setLoading] = React.useState(true)
  const [bookingLoading, setBookingLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const apiBaseUrl = React.useMemo(() => getBrowserApiBaseUrl(), [])

  const selectedBuilding = React.useMemo(() => buildings.find(b => b.id === selectedBuildingId) ?? null, [buildings, selectedBuildingId])
  const floorsForSelectedBuilding = React.useMemo(
    () => selectedBuildingId ? floors.filter(f => f.building_id === selectedBuildingId) : [],
    [floors, selectedBuildingId],
  )
  const selectedFloor = React.useMemo(() => floors.find(f => f.id === selectedFloorId), [floors, selectedFloorId])
  const filteredWorkspaces = React.useMemo(() => workspaces.filter(w => w.floor_id === selectedFloorId), [workspaces, selectedFloorId])
  const selectedWorkspace = React.useMemo(() => filteredWorkspaces.find(w => w.id === selectedWorkspaceId), [filteredWorkspaces, selectedWorkspaceId])
  const selectedWorkspaceBooking = React.useMemo(
    () => selectedWorkspaceId ? floorBookings.find(booking => booking.workspace_id === selectedWorkspaceId) ?? null : null,
    [floorBookings, selectedWorkspaceId],
  )
  const isMyBooking = React.useMemo(() => {
    if (!session || !selectedWorkspaceBooking) return false
    return session.user.id === selectedWorkspaceBooking.user_id
  }, [session, selectedWorkspaceBooking])
  const canSeeOccupantDetails = currentRole === "admin" || currentRole === "space_owner"
  const selectedWorkspaceIsReserved = Boolean(selectedWorkspaceBooking)
  const dateLocale = locale === "vi" ? "vi-VN" : undefined
  const currentStep = !selectedBuildingId ? 1 : success ? 4 : selectedWorkspaceId ? 3 : 2
  const floorReservedWorkspaceIds = React.useMemo(
    () => new Set(floorBookings.map(booking => booking.workspace_id)),
    [floorBookings],
  )
  const selectedFloorStats = React.useMemo(() => {
    const activeWorkspaces = filteredWorkspaces.filter(workspace => workspace.status === "available")
    const reservedCount = activeWorkspaces.filter(workspace => floorReservedWorkspaceIds.has(workspace.id)).length

    return {
      total: filteredWorkspaces.length,
      available: Math.max(activeWorkspaces.length - reservedCount, 0),
      reserved: reservedCount,
    }
  }, [filteredWorkspaces, floorReservedWorkspaceIds])

  const getBuildingStats = React.useCallback((buildingId: string) => {
    const buildingFloors = floors.filter(floor => floor.building_id === buildingId)
    const floorIds = new Set(buildingFloors.map(floor => floor.id))
    const buildingWorkspaces = workspaces.filter(workspace => floorIds.has(workspace.floor_id))

    return {
      floorCount: buildingFloors.length,
      workspaceCount: buildingWorkspaces.length,
      availableCount: buildingWorkspaces.filter(workspace => workspace.status === "available").length,
    }
  }, [floors, workspaces])

  const updateSelectionUrl = React.useCallback((buildingId: string | null, floorId?: string) => {
    if (!buildingId) {
      router.replace("/floor-map", { scroll: false })
      return
    }

    const params = new URLSearchParams({ buildingId })

    if (floorId) {
      params.set("floorId", floorId)
    }

    router.replace(`/floor-map?${params.toString()}`, { scroll: false })
  }, [router])

  const handleSelectBuilding = React.useCallback((buildingId: string) => {
    const firstFloorId = floors.find(floor => floor.building_id === buildingId)?.id ?? ""

    setSelectedBuildingId(buildingId)
    setSelectedFloorId(firstFloorId)
    setSelectedWorkspaceId(null)
    setBaseSvgMarkup(null)
    setError(null)
    setSuccess(null)
    updateSelectionUrl(buildingId, firstFloorId)
  }, [floors, updateSelectionUrl])

  const handleBackToLocations = React.useCallback(() => {
    setSelectedBuildingId(null)
    setSelectedFloorId("")
    setSelectedWorkspaceId(null)
    setBaseSvgMarkup(null)
    setFloorBookings([])
    setError(null)
    setSuccess(null)
    updateSelectionUrl(null)
  }, [updateSelectionUrl])

  const handleSelectFloor = React.useCallback((floorId: string) => {
    setSelectedFloorId(floorId)
    setSelectedWorkspaceId(null)
    setBaseSvgMarkup(null)
    setError(null)
    setSuccess(null)
    updateSelectionUrl(selectedBuildingId, floorId)
  }, [selectedBuildingId, updateSelectionUrl])

  const handleBookAnother = React.useCallback(() => {
    setSelectedWorkspaceId(null)
    setError(null)
    setSuccess(null)
  }, [])

  // --- Data Fetching ---
  React.useEffect(() => {
    const bootstrap = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) return
      setSession(currentSession)

      try {
        const headers = { Authorization: `Bearer ${currentSession.access_token}` }
        const [meRes, buildingsRes, floorsRes, workspacesRes] = await Promise.all([
          fetch(`${apiBaseUrl}/me`, { headers }),
          fetch(`${apiBaseUrl}/buildings`, { headers }),
          fetch(`${apiBaseUrl}/floors`, { headers }),
          fetch(`${apiBaseUrl}/workspaces`, { headers })
        ])

        if (meRes.ok) {
          const meData = await meRes.json() as MeResponse
          setCurrentRole(meData.role ?? null)
        }

        if (buildingsRes.ok && floorsRes.ok && workspacesRes.ok) {
          const buildingsData = await buildingsRes.json() as BuildingsResponse
          const floorsData = await floorsRes.json() as FloorsResponse
          const workspacesData = await workspacesRes.json() as WorkspacesResponse
          const query = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams()
          const requestedBuildingId = query.get("buildingId")
          const requestedFloorId = query.get("floorId")
          const requestedWorkspaceId = query.get("workspaceId")
          const requestedStartTime = query.get("startTime")
          const requestedEndTime = query.get("endTime")

          const buildingItems = buildingsData.items
          const floorItems = floorsData.items
          const workspaceItems = workspacesData.items

          let initialBuildingId = buildingItems.some(building => building.id === requestedBuildingId)
            ? requestedBuildingId
            : null
          let initialFloorId = initialBuildingId && floorItems.some(floor => floor.id === requestedFloorId && floor.building_id === initialBuildingId)
            ? requestedFloorId ?? ""
            : initialBuildingId
              ? floorItems.find(floor => floor.building_id === initialBuildingId)?.id ?? ""
              : ""

          let initialWorkspaceId = null
          if (requestedWorkspaceId && workspaceItems.some(w => w.id === requestedWorkspaceId)) {
            initialWorkspaceId = requestedWorkspaceId
            const matchedWorkspace = workspaceItems.find(w => w.id === requestedWorkspaceId)
            if (matchedWorkspace) {
              const matchedFloor = floorItems.find(f => f.id === matchedWorkspace.floor_id)
              if (matchedFloor) {
                initialFloorId = matchedFloor.id
                initialBuildingId = matchedFloor.building_id
              }
            }
          }

          let initialViewStart = buildDefaultTimeWindow().start
          let initialViewEnd = buildDefaultTimeWindow().end
          if (requestedStartTime && !Number.isNaN(Date.parse(requestedStartTime))) {
            initialViewStart = formatDateTimeValue(new Date(requestedStartTime))
          }
          if (requestedEndTime && !Number.isNaN(Date.parse(requestedEndTime))) {
            initialViewEnd = formatDateTimeValue(new Date(requestedEndTime))
          }

          setBuildings(buildingItems)
          setFloors(floorItems)
          setWorkspaces(workspaceItems)
          setSelectedBuildingId(initialBuildingId)
          setSelectedFloorId(initialFloorId)
          setSelectedWorkspaceId(initialWorkspaceId)
          setViewStart(initialViewStart)
          setViewEnd(initialViewEnd)
          setBookingStart(initialViewStart)
          setBookingEnd(initialViewEnd)
        }
      } catch (err) {
        console.error("Bootstrap error:", err)
      } finally {
        setLoading(false)
      }
    }
    bootstrap()
  }, [apiBaseUrl])

  // --- Fetch Floor State (Bookings) ---
  const fetchFloorState = React.useCallback(async () => {
    if (!session || !selectedFloorId) return

    const params = new URLSearchParams({
      floorId: selectedFloorId,
      startTime: new Date(viewStart).toISOString(),
      endTime: new Date(viewEnd).toISOString(),
    })

    try {
      const res = await fetch(`${apiBaseUrl}/bookings/floor-state?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      if (res.ok) {
        const data = await res.json() as FloorStateResponse
        setFloorBookings(data.items)
      }
    } catch (err) {
      console.error("Floor state error:", err)
    }
  }, [apiBaseUrl, session, selectedFloorId, viewStart, viewEnd])

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchFloorState()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchFloorState])

  // --- Load SVG ---
  React.useEffect(() => {
    const loadSvg = async () => {
      setBaseSvgMarkup(null)

      if (!selectedFloor?.svg_map_url || !session) return

      try {
        const res = await fetch(`${apiBaseUrl}/floors/${selectedFloor.id}/svg`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        })
        if (res.ok) {
          const rawSvg = await res.text()
          setBaseSvgMarkup(rawSvg)
        }
      } catch (err) {
        console.error("SVG load error:", err)
      }
    }
    loadSvg()
  }, [apiBaseUrl, selectedFloor, session])

  // --- Realtime ---
  React.useEffect(() => {
    if (!session) return
    const channel = supabase.channel(`floor-map-${selectedFloorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        void fetchFloorState()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session, selectedFloorId, fetchFloorState])

  // --- SVG Manipulation ---
  const processedSvg = React.useMemo(() => {
    if (!baseSvgMarkup) return null
    const parser = new DOMParser()
    const doc = parser.parseFromString(baseSvgMarkup, "image/svg+xml")

    filteredWorkspaces.forEach(workspace => {
      const el = doc.getElementById(workspace.svg_element_id)
      if (!el) return

      const isReserved = floorBookings.some(b => b.workspace_id === workspace.id)
      const status: FloorMapStatus = isReserved ? "reserved" : workspace.status
      const style = statusStyleMap[status]
      const isSelected = workspace.id === selectedWorkspaceId
      const isHovered = workspace.id === hoveredId

      el.style.fill = style.fill
      el.style.stroke = isSelected ? "#3b82f6" : isHovered ? "white" : style.stroke
      el.style.strokeWidth = isSelected ? "4" : isHovered ? "3" : "2"
      el.setAttribute("data-workspace-id", workspace.id)
      el.style.cursor = "pointer"
      el.style.transition = "all 0.2s ease"

      // Add a glow effect if selected
      if (isSelected) {
        el.style.filter = `drop-shadow(0 0 8px ${style.glow})`
      }
    })

    return new XMLSerializer().serializeToString(doc.documentElement)
  }, [baseSvgMarkup, filteredWorkspaces, floorBookings, selectedWorkspaceId, hoveredId])

  // --- Event Handlers ---
  const handleSvgClick = (e: React.MouseEvent) => {
    const target = e.target as SVGElement
    const workspaceId = target.getAttribute("data-workspace-id") || target.parentElement?.getAttribute("data-workspace-id")
    if (workspaceId) {
      setSelectedWorkspaceId(workspaceId)
      setBookingStart(viewStart)
      setBookingEnd(viewEnd)
      setError(null)
      setSuccess(null)
    } else {
      setSelectedWorkspaceId(null)
    }
  }

  const handleBooking = async () => {
    if (!selectedWorkspace || !session) return
    if (selectedWorkspaceIsReserved) {
      setError(t("floorMap.occupiedForRange"))
      return
    }
    setBookingLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`${apiBaseUrl}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          workspaceId: selectedWorkspace.id,
          startTime: new Date(bookingStart).toISOString(),
          endTime: new Date(bookingEnd).toISOString(),
        })
      })

        if (res.ok) {
          setSuccess(t("floorMap.reservedSuccess"))
          toast({
            title: t("floorMap.reservedSuccess"),
            description: selectedWorkspace.name,
            variant: "success",
          })
          void fetchFloorState()
        } else {
          const message = await readApiError(res, t("floorMap.createFailed"))
          setError(message)
          toast({
            title: t("floorMap.createFailed"),
            description: message,
            variant: "error",
          })
        }
    } catch {
      setError(t("floorMap.unexpectedError"))
      toast({
        title: t("floorMap.createFailed"),
        description: t("floorMap.unexpectedError"),
        variant: "error",
      })
    } finally {
      setBookingLoading(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col h-full space-y-8">
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-2 w-full rounded-full" />
        ))}
      </div>

      <div className="space-y-3">
        <Skeleton className="h-8 w-40 rounded-full" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-80 rounded-[2rem]" />
        ))}
      </div>
    </div>
  )

  if (!selectedBuildingId) {
    return (
      <div className="flex flex-col h-full space-y-8" data-testid="floor-map-location-step">
        <BookingStepIndicator currentStep={currentStep} />

        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-blue-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-400">
            <Building size={14} />
            {t("floorMap.chooseLocation")}
          </div>
          <p className="max-w-2xl text-sm font-semibold text-slate-500 dark:text-slate-400">{t("floorMap.chooseLocationDescription")}</p>
        </div>

        {buildings.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {buildings.map((building) => {
              const stats = getBuildingStats(building.id)
              const openHours = building.open_time && building.close_time
                ? `${building.open_time.slice(0, 5)} - ${building.close_time.slice(0, 5)}`
                : t("floorMap.notConfigured")

              return (
                <motion.button
                  key={building.id}
                  type="button"
                  data-testid="floor-map-building-card"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => handleSelectBuilding(building.id)}
                  className="group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 text-left shadow-sm shadow-slate-200/60 transition-all hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-100 dark:border-white/10 dark:bg-white/5 dark:hover:border-primary-500/40 dark:hover:bg-primary-500/10"
                >
                  <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-100 blur-2xl transition-opacity group-hover:opacity-100 dark:bg-primary-500/10" />
                  <div className="relative z-10 space-y-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-200 dark:bg-primary-500/10 dark:text-primary-500 dark:ring-primary-500/20">
                        <Building size={28} />
                      </div>
                      <ChevronRight className="text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-blue-600 dark:text-slate-500 dark:group-hover:text-primary-400" size={22} />
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-slate-950 dark:text-white">{building.name}</h3>
                      <p className="min-h-10 text-sm font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
                        {building.address || t("admin.noAddress")}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/5 dark:bg-white/5">
                        <p className="text-lg font-black text-slate-950 dark:text-white">{stats.floorCount}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-500">{t("admin.floorsLabel")}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/5 dark:bg-white/5">
                        <p className="text-lg font-black text-slate-950 dark:text-white">{stats.workspaceCount}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t("layout.nav.bookSpace")}</p>
                      </div>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/10 dark:bg-emerald-500/10">
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{stats.availableCount}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/80 dark:text-emerald-500/80">{t("floorMap.available")}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200 pt-5 dark:border-white/5">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("floorMap.openHours")}</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{openHours}</p>
                      </div>
                      <span className="rounded-full bg-blue-600 px-4 py-2 text-xs font-black text-white shadow-lg shadow-blue-500/20">
                        {t("floorMap.continueToMap")}
                      </span>
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        ) : (
          <Card className="flex min-h-[320px] items-center justify-center border-dashed border-slate-200 bg-white p-10 text-center dark:border-white/10 dark:bg-slate-950">
            <div className="space-y-4 text-slate-500">
              <Building size={64} className="mx-auto opacity-30" />
              <p className="font-bold">{t("floorMap.locationsEmpty")}</p>
            </div>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full space-y-6" data-testid="floor-map-shell">
      <BookingStepIndicator currentStep={currentStep} />

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Filters Bar */}
      <aside className="space-y-4 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-slate-950/80">
        <button
          type="button"
          onClick={handleBackToLocations}
          className="touch-manipulation flex w-full items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 transition-all hover:border-blue-300 hover:text-blue-700 dark:border-white/10 dark:text-slate-400 dark:hover:border-primary-500/30 dark:hover:text-white"
        >
          <ArrowLeft size={18} />
          {t("floorMap.backToLocations")}
        </button>

        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
          <Building size={18} className="text-blue-600 dark:text-primary-400" />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("floorMap.selectedLocation")}</p>
            <p className="truncate text-sm font-black text-slate-950 dark:text-white">{selectedBuilding?.name}</p>
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <Layers size={16} className="text-blue-600 dark:text-slate-400" />
            {t("floorMap.chooseFloor")}
          </label>
          <select 
            data-testid="floor-map-floor-select"
            className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            aria-label={t("floorMap.chooseFloor")}
            onChange={(e) => handleSelectFloor(e.target.value)}
            value={selectedFloorId}
          >
            {floorsForSelectedBuilding.map(f => (
              <option key={f.id} value={f.id} className="bg-slate-900 text-white">
                {f.name || t("common.floorFallback").replace("{number}", String(f.floor_number))}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <Clock size={16} className="text-blue-600 dark:text-slate-400" />
            {t("floorMap.timeRange")}
          </label>
          <div className="grid gap-2">
            <input 
              data-testid="floor-map-view-start"
              type="datetime-local" 
              className="min-w-0 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:[color-scheme:dark]"
              value={viewStart}
              onChange={(e) => setViewStart(e.target.value)}
            />
            <input 
              data-testid="floor-map-view-end"
              type="datetime-local" 
              className="min-w-0 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:[color-scheme:dark]"
              value={viewEnd}
              onChange={(e) => setViewEnd(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900">
            <p className="text-xl font-black text-slate-950 dark:text-white">{selectedFloorStats.total}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{selectedFloorStats.available}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/70 dark:text-emerald-500/80">{t("floorMap.available")}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/20 dark:bg-rose-500/10">
            <p className="text-xl font-black text-rose-600 dark:text-rose-400">{selectedFloorStats.reserved}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-700/70 dark:text-rose-500/80">{t("floorMap.occupied")}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
          <StatusBadge color="bg-emerald-500" label={t("floorMap.available")} />
          <StatusBadge color="bg-red-500" label={t("floorMap.occupied")} />
        </div>
      </aside>

      <div className="relative flex min-h-[500px] flex-col gap-6 lg:flex-1 lg:flex-row">
        {/* Map Container */}
        <Card className="relative flex min-h-[360px] flex-1 items-center justify-center overflow-hidden border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70 sm:min-h-[520px] sm:p-8 lg:min-h-[620px] dark:border-white/10 dark:bg-slate-950">
          {processedSvg ? (
            <div 
              data-testid="floor-map-svg-container"
              className="w-full h-full flex items-center justify-center transition-all duration-500"
              dangerouslySetInnerHTML={{ __html: processedSvg }}
              onClick={handleSvgClick}
              onMouseMove={(e) => {
                const target = e.target as SVGElement
                const id = target.getAttribute("data-workspace-id")
                setHoveredId(id)
              }}
              onMouseLeave={() => setHoveredId(null)}
            />
          ) : (
            <div className="text-center space-y-4 opacity-20">
              <MapIcon size={80} className="mx-auto text-primary-500" />
              <p className="text-xl font-bold">{t("floorMap.selectFloor")}</p>
            </div>
          )}

          {/* Zoom Controls Overlay */}
          <div className="absolute bottom-4 left-4 flex items-center rounded-xl border-white/10 p-1 glass sm:bottom-6 sm:left-6">
            <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-500 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-white"><ZoomIn size={20} /></Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-500 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-white"><ZoomOut size={20} /></Button>
            <div className="mx-1 h-6 w-[1px] bg-slate-200 dark:bg-white/10" />
            <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-500 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-white"><Maximize2 size={20} /></Button>
          </div>
        </Card>

        {/* Sidebar Selection Panel */}
        <AnimatePresence>
          {selectedWorkspaceId && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[70] bg-slate-950/45 backdrop-blur-[2px] lg:hidden"
                onClick={() => setSelectedWorkspaceId(null)}
              />
              <motion.div
                initial={{ y: 32, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 32, opacity: 0 }}
                className="fixed inset-x-0 bottom-0 z-[80] max-h-[86dvh] shrink-0 overflow-y-auto px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] lg:static lg:z-auto lg:max-h-none lg:w-80 lg:overflow-visible lg:px-0 lg:pb-0"
              >
              <Card className="booking-sheet-panel flex flex-col overflow-hidden rounded-t-[2rem] shadow-2xl shadow-black/50 lg:h-full lg:rounded-[1.5rem] lg:shadow-none">
                <div className="booking-sheet-header flex items-center justify-between p-5 sm:p-6">
                  <div className="space-y-2">
                    <div className="mx-auto h-1.5 w-14 rounded-full bg-white/15 lg:hidden" />
                    <h3 className="text-xl font-bold text-white">{success ? t("floorMap.bookingConfirmed") : t("floorMap.bookingDetails")}</h3>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedWorkspaceId(null)} className="text-slate-500 hover:text-white">
                    <ChevronRight />
                  </Button>
                </div>
                
                <div className="flex-1 space-y-6 p-5 sm:space-y-8 sm:p-6">
                  <div className="space-y-4">
                    <div className="booking-sheet-preview flex aspect-video w-full items-center justify-center rounded-2xl">
                      <Layers size={48} className="text-primary-500 opacity-90" />
                    </div>
                    <div>
                      <h4 data-testid="floor-map-selected-workspace-name" className="text-2xl font-black text-white break-words">{selectedWorkspace?.name}</h4>
                      <p className="text-slate-400 text-sm font-medium">{selectedFloor?.name || t("common.floorFallback").replace("{number}", String(selectedFloor?.floor_number ?? ""))}</p>
                      {selectedWorkspace?.qr_code_value ? (
                        <p data-testid="floor-map-selected-workspace-qr" className="mt-2 break-all text-xs font-mono text-slate-500">
                          {selectedWorkspace.qr_code_value}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {selectedWorkspaceIsReserved && selectedWorkspaceBooking ? (
                    <motion.div
                      data-testid="floor-map-occupancy-details"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={cn(
                        "space-y-4 rounded-2xl border p-4",
                        isMyBooking 
                          ? "border-blue-500/20 bg-blue-500/10 dark:border-primary-500/20 dark:bg-primary-500/10" 
                          : "border-rose-500/20 bg-rose-500/10"
                      )}
                    >
                      <div className="flex gap-3">
                        <AlertCircle className={cn("mt-0.5 shrink-0", isMyBooking ? "text-blue-500 dark:text-primary-500" : "text-rose-500")} size={20} />
                        <div className="min-w-0 space-y-1">
                          <p className={cn("font-black", isMyBooking ? "text-blue-500 dark:text-primary-500" : "text-rose-500")}>
                            {isMyBooking ? t("floorMap.myBookingDetailsTitle") : t("floorMap.occupiedDetailsTitle")}
                          </p>
                          <p className="text-sm font-medium leading-relaxed text-slate-400">
                            {isMyBooking
                              ? t("floorMap.myBookingDetailsUser")
                              : canSeeOccupantDetails
                                ? t("floorMap.occupiedDetailsAdmin")
                                : t("floorMap.occupiedDetailsUser")}
                          </p>
                        </div>
                      </div>
                      <div className="grid gap-3 rounded-xl border border-white/5 bg-white/5 p-3 text-sm">
                        {(canSeeOccupantDetails || isMyBooking) && (
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("floorMap.bookedBy")}</p>
                            <p className="mt-1 truncate font-bold text-white">
                              {selectedWorkspaceBooking.user_full_name || selectedWorkspaceBooking.user_email || t("floorMap.privateOccupant")}
                            </p>
                            {selectedWorkspaceBooking.user_email && selectedWorkspaceBooking.user_full_name ? (
                              <p className="truncate text-xs font-semibold text-slate-500">{selectedWorkspaceBooking.user_email}</p>
                            ) : null}
                          </div>
                        )}
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("floorMap.status")}</p>
                            <p className="mt-1 font-bold text-white">{t(`bookings.status.${selectedWorkspaceBooking.status === "checked_in" ? "checkedIn" : "confirmed"}`)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("floorMap.timeRange")}</p>
                            <p className="mt-1 font-bold text-white">
                              {new Date(selectedWorkspaceBooking.start_time).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}
                              {" - "}
                              {new Date(selectedWorkspaceBooking.end_time).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}

                  {!selectedWorkspaceIsReserved && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">{t("floorMap.startTime")}</label>
                      <div className="relative group">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-500" size={18} />
                        <Input 
                          data-testid="floor-map-booking-start"
                          type="datetime-local" 
                          className="booking-sheet-input h-12 rounded-xl pl-12 transition-all focus:border-primary-500"
                          value={bookingStart}
                          onChange={(e) => setBookingStart(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">{t("floorMap.endTime")}</label>
                      <div className="relative group">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-500" size={18} />
                        <Input 
                          data-testid="floor-map-booking-end"
                          type="datetime-local" 
                          className="booking-sheet-input h-12 rounded-xl pl-12 transition-all focus:border-primary-500"
                          value={bookingEnd}
                          onChange={(e) => setBookingEnd(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  )}

                  {error && (
                    <motion.div data-testid="floor-map-booking-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm flex gap-3">
                      <AlertCircle size={18} className="shrink-0" />
                      <p>{error}</p>
                    </motion.div>
                  )}
                  {success && (
                    <motion.div data-testid="floor-map-booking-success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-500">
                      <div className="flex gap-3">
                      <CheckCircle2 size={18} className="shrink-0" />
                      <p>{success}</p>
                      </div>
                      <p className="text-xs font-medium leading-relaxed text-slate-400">{t("floorMap.afterBookingHint")}</p>
                    </motion.div>
                  )}
                </div>

                <div className="booking-sheet-footer sticky bottom-0 p-5 sm:p-6 lg:static">
                  {success ? (
                    <div className="grid gap-3">
                      <Button className="h-12 w-full bg-emerald-600 font-black hover:bg-emerald-700" onClick={() => router.push("/bookings")}>
                        {t("floorMap.viewMyBookings")}
                      </Button>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        <Button variant="secondary" className="h-11 font-bold" onClick={handleBookAnother}>
                          {t("floorMap.bookAnother")}
                        </Button>
                        <Button variant="outline" className="h-11 font-bold" onClick={() => router.push("/check-in")}>
                          {t("floorMap.goCheckIn")}
                        </Button>
                      </div>
                    </div>
                  ) : selectedWorkspaceIsReserved ? (
                    <Button
                      data-testid="floor-map-occupied-disabled"
                      className={cn(
                        "h-12 w-full cursor-not-allowed font-black",
                        isMyBooking
                          ? "bg-blue-600/20 text-blue-500 border border-blue-500/20 dark:bg-primary-500/20 dark:text-primary-500 dark:border-primary-500/20"
                          : "bg-slate-500/20 text-slate-400"
                      )}
                      disabled
                    >
                      {isMyBooking ? t("floorMap.yourBookingForRange") : t("floorMap.occupiedForRange")}
                    </Button>
                  ) : (
                    <Button 
                      data-testid="floor-map-create-booking"
                      className="w-full bg-primary-600 hover:bg-primary-700 h-14 font-black text-lg shadow-lg shadow-primary-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
                      onClick={handleBooking}
                      isLoading={bookingLoading}
                      loadingText={t("floorMap.processing")}
                    >
                      {t("floorMap.confirmBooking")}
                    </Button>
                  )}
                </div>
              </Card>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
      </div>
    </div>
  )
}

function BookingStepIndicator({ currentStep }: { currentStep: number }) {
  const { t } = useLanguage()
  const steps = [
    t("floorMap.steps.location"),
    t("floorMap.steps.schedule"),
    t("floorMap.steps.workspace"),
    t("floorMap.steps.confirm"),
  ]

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/60 dark:border-white/5 dark:bg-white/[0.03]">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((label, index) => {
          const stepNumber = index + 1
          const isActive = currentStep === stepNumber
          const isDone = currentStep > stepNumber

          return (
            <div
              key={label}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all",
                isActive ? "border-blue-200 bg-blue-50 text-blue-800 dark:border-primary-500/40 dark:bg-primary-500/10 dark:text-white" : "border-slate-200 bg-slate-50 text-slate-500 dark:border-white/5 dark:bg-white/[0.02]",
                isDone ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400" : "",
              )}
            >
              <div className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black",
                isActive ? "bg-blue-600 text-white dark:bg-primary-600" : "bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400",
                isDone ? "bg-emerald-500 text-white" : "",
              )}>
                {isDone ? <CheckCircle2 size={15} /> : stepNumber}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest sm:text-xs">{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatusBadge({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm dark:border-white/5 dark:bg-white/5">
      <div className={cn("w-2 h-2 rounded-full", color)} />
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  )
}
