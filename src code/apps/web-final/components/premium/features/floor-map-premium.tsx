"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ZoomIn, ZoomOut, Maximize2, Map as MapIcon, ChevronRight, Calendar, Clock, AlertCircle, CheckCircle2, Building, Layers } from "lucide-react"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase/client"
import { getBrowserApiBaseUrl } from "@/lib/api-base-url"
import { Button } from "@/components/premium/ui/button"
import { Card } from "@/components/premium/ui/card"
import { Input } from "@/components/premium/ui/input"
import { cn } from "@/lib/utils"

// --- Types ---
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
  user_id: string
  start_time: string
  end_time: string
  status: string
}

type FloorMapStatus = WorkspaceRecord["status"] | "reserved"

interface FloorsResponse {
  items: FloorRecord[]
}

interface WorkspacesResponse {
  items: WorkspaceRecord[]
}

interface FloorStateResponse {
  items: BookingRecord[]
}

interface BookingResponse {
  message?: string
}

const statusStyleMap: Record<FloorMapStatus, { fill: string; stroke: string; label: string; glow: string }> = {
  available: { fill: "rgba(16, 185, 129, 0.1)", stroke: "rgba(16, 185, 129, 0.5)", label: "Available", glow: "rgba(16, 185, 129, 0.2)" },
  maintenance: { fill: "rgba(245, 158, 11, 0.1)", stroke: "rgba(245, 158, 11, 0.5)", label: "Maintenance", glow: "rgba(245, 158, 11, 0.2)" },
  inactive: { fill: "rgba(100, 116, 139, 0.1)", stroke: "rgba(100, 116, 139, 0.5)", label: "Inactive", glow: "transparent" },
  reserved: { fill: "rgba(239, 68, 68, 0.1)", stroke: "rgba(239, 68, 68, 0.5)", label: "Occupied", glow: "rgba(239, 68, 68, 0.2)" },
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
  const [session, setSession] = React.useState<Session | null>(null)
  const [floors, setFloors] = React.useState<FloorRecord[]>([])
  const [workspaces, setWorkspaces] = React.useState<WorkspaceRecord[]>([])
  const [floorBookings, setFloorBookings] = React.useState<BookingRecord[]>([])
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

  const selectedFloor = React.useMemo(() => floors.find(f => f.id === selectedFloorId), [floors, selectedFloorId])
  const filteredWorkspaces = React.useMemo(() => workspaces.filter(w => w.floor_id === selectedFloorId), [workspaces, selectedFloorId])
  const selectedWorkspace = React.useMemo(() => filteredWorkspaces.find(w => w.id === selectedWorkspaceId), [filteredWorkspaces, selectedWorkspaceId])

  // --- Data Fetching ---
  React.useEffect(() => {
    const bootstrap = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) return
      setSession(currentSession)

      try {
        const headers = { Authorization: `Bearer ${currentSession.access_token}` }
        const [floorsRes, workspacesRes] = await Promise.all([
          fetch(`${apiBaseUrl}/floors`, { headers }),
          fetch(`${apiBaseUrl}/workspaces`, { headers })
        ])

        if (floorsRes.ok && workspacesRes.ok) {
          const floorsData = await floorsRes.json() as FloorsResponse
          const workspacesData = await workspacesRes.json() as WorkspacesResponse
          setFloors(floorsData.items)
          setWorkspaces(workspacesData.items)
          if (floorsData.items.length > 0) setSelectedFloorId(floorsData.items[0].id)
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

      el.setAttribute("fill", style.fill)
      el.setAttribute("stroke", isSelected ? "#3b82f6" : isHovered ? "white" : style.stroke)
      el.setAttribute("stroke-width", isSelected ? "4" : isHovered ? "3" : "2")
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

        const data = await res.json() as BookingResponse
        if (res.ok) {
          setSuccess("Workspace reserved successfully!")
          void fetchFloorState()
          setTimeout(() => setSelectedWorkspaceId(null), 2000)
        } else {
          setError(data.message || "Failed to create booking.")
        }
    } catch {
      setError("An unexpected error occurred.")
    } finally {
      setBookingLoading(false)
    }
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="flex flex-col h-full space-y-6" data-testid="floor-map-shell">
      {/* Filters Bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="flex items-center gap-2 glass px-4 py-2 rounded-2xl border-white/5">
          <Building size={18} className="text-slate-400" />
          <select 
            data-testid="floor-map-floor-select"
            className="min-w-0 flex-1 bg-transparent text-white text-sm font-medium focus:outline-none cursor-pointer"
            onChange={(e) => setSelectedFloorId(e.target.value)}
            value={selectedFloorId}
          >
            {floors.map(f => (
              <option key={f.id} value={f.id} className="bg-slate-900 text-white">
                {f.name || `Floor ${f.floor_number}`}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-3 glass px-4 py-3 rounded-2xl border-white/5 sm:flex-row sm:items-center">
          <Clock size={18} className="text-slate-400" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
            <input 
              data-testid="floor-map-view-start"
              type="datetime-local" 
              className="min-w-0 bg-transparent text-white text-xs font-medium focus:outline-none cursor-pointer [color-scheme:dark]"
              value={viewStart}
              onChange={(e) => setViewStart(e.target.value)}
            />
            <span className="text-slate-600 text-xs uppercase tracking-[0.2em]">to</span>
            <input 
              data-testid="floor-map-view-end"
              type="datetime-local" 
              className="min-w-0 bg-transparent text-white text-xs font-medium focus:outline-none cursor-pointer [color-scheme:dark]"
              value={viewEnd}
              onChange={(e) => setViewEnd(e.target.value)}
            />
          </div>
        </div>

        <div className="hidden flex-1 lg:block" />

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge color="bg-emerald-500" label="Available" />
          <StatusBadge color="bg-red-500" label="Occupied" />
        </div>
      </div>

      <div className="relative flex min-h-[500px] flex-col gap-6 lg:flex-1 lg:flex-row">
        {/* Map Container */}
        <Card className="relative flex min-h-[320px] flex-1 items-center justify-center overflow-hidden border-white/5 p-4 glass-panel sm:min-h-[420px] sm:p-8 lg:min-h-0">
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
              <p className="text-xl font-bold">Select a floor to view map</p>
            </div>
          )}

          {/* Zoom Controls Overlay */}
          <div className="absolute bottom-4 left-4 flex items-center rounded-xl border-white/10 p-1 glass sm:bottom-6 sm:left-6">
            <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-white transition-colors"><ZoomIn size={20} /></Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-white transition-colors"><ZoomOut size={20} /></Button>
            <div className="w-[1px] h-6 bg-white/10 mx-1" />
            <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-white transition-colors"><Maximize2 size={20} /></Button>
          </div>
        </Card>

        {/* Sidebar Selection Panel */}
        <AnimatePresence>
          {selectedWorkspaceId && (
            <motion.div
              initial={{ x: 350, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 350, opacity: 0 }}
              className="w-full shrink-0 lg:w-80"
            >
              <Card className="flex flex-col overflow-hidden border-white/10 glass-panel lg:h-full">
                <div className="flex items-center justify-between border-b border-white/5 bg-primary-500/5 p-5 sm:p-6">
                  <h3 className="text-xl font-bold text-white">Booking Details</h3>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedWorkspaceId(null)} className="text-slate-500 hover:text-white">
                    <ChevronRight />
                  </Button>
                </div>
                
                <div className="flex-1 space-y-6 p-5 sm:space-y-8 sm:p-6">
                  <div className="space-y-4">
                    <div className="w-full aspect-video rounded-2xl bg-gradient-to-br from-blue-600/20 to-primary-600/20 flex items-center justify-center border border-primary-500/10">
                      <Layers size={48} className="text-primary-500 opacity-50" />
                    </div>
                    <div>
                      <h4 data-testid="floor-map-selected-workspace-name" className="text-2xl font-black text-white break-words">{selectedWorkspace?.name}</h4>
                      <p className="text-slate-400 text-sm font-medium">{selectedFloor?.name || `Floor ${selectedFloor?.floor_number}`}</p>
                      {selectedWorkspace?.qr_code_value ? (
                        <p data-testid="floor-map-selected-workspace-qr" className="mt-2 break-all text-xs font-mono text-slate-500">
                          {selectedWorkspace.qr_code_value}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Start Time</label>
                      <div className="relative group">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-500" size={18} />
                        <Input 
                          data-testid="floor-map-booking-start"
                          type="datetime-local" 
                          className="pl-12 bg-white/5 border-white/10 h-12 rounded-xl focus:border-primary-500 transition-all text-white [color-scheme:dark]"
                          value={bookingStart}
                          onChange={(e) => setBookingStart(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">End Time</label>
                      <div className="relative group">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-500" size={18} />
                        <Input 
                          data-testid="floor-map-booking-end"
                          type="datetime-local" 
                          className="pl-12 bg-white/5 border-white/10 h-12 rounded-xl focus:border-primary-500 transition-all text-white [color-scheme:dark]"
                          value={bookingEnd}
                          onChange={(e) => setBookingEnd(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {error && (
                    <motion.div data-testid="floor-map-booking-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm flex gap-3">
                      <AlertCircle size={18} className="shrink-0" />
                      <p>{error}</p>
                    </motion.div>
                  )}
                  {success && (
                    <motion.div data-testid="floor-map-booking-success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm flex gap-3">
                      <CheckCircle2 size={18} className="shrink-0" />
                      <p>{success}</p>
                    </motion.div>
                  )}
                </div>

                <div className="sticky bottom-0 border-t border-white/5 bg-[#111722]/95 p-5 pb-28 backdrop-blur sm:p-6 sm:pb-28 lg:static lg:bg-white/5 lg:pb-6 lg:backdrop-blur-0">
                  <Button 
                    data-testid="floor-map-create-booking"
                    className="w-full bg-primary-600 hover:bg-primary-700 h-14 font-black text-lg shadow-lg shadow-primary-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
                    onClick={handleBooking}
                    disabled={bookingLoading}
                  >
                    {bookingLoading ? "Processing..." : "Confirm Booking"}
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function StatusBadge({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass border-white/5">
      <div className={cn("w-2 h-2 rounded-full", color)} />
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    </div>
  )
}
