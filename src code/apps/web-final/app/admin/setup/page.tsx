"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Building2, Layers, MapPin, Plus, Save, Trash2, Upload, AlertCircle, ChevronRight, FileCode, Info } from "lucide-react"
import { useRouter } from "next/navigation"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase/client"
import { getBrowserApiBaseUrl } from "@/lib/api-base-url"
import { DashboardLayout } from "@/components/premium/layout/dashboard-layout"
import { Button } from "@/components/premium/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/premium/ui/card"
import { Input } from "@/components/premium/ui/input"
import { useLanguage } from "@/components/premium/language-provider"
import { cn } from "@/lib/utils"

// --- Types ---
type Tab = "buildings" | "floors" | "workspaces" | "svg-mapping"

interface Building {
  id: string
  name: string
  address: string | null
  total_floors: number
  open_time: string | null
  close_time: string | null
}

interface Floor {
  id: string
  building_id: string
  floor_number: number
  name: string | null
  svg_map_url: string | null
}

interface Workspace {
  id: string
  floor_id: string
  name: string
  type: string
  status: string
  svg_element_id: string
  capacity: number
}

interface ListResponse<T> {
  items?: T[]
}

interface TabButtonProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}

interface BuildingManagerProps {
  buildings: Building[]
  onRefresh: () => Promise<void>
  apiBaseUrl: string
  token: string
}

interface FloorManagerProps {
  floors: Floor[]
  buildings: Building[]
  onRefresh: () => Promise<void>
  apiBaseUrl: string
  token: string
}

interface WorkspaceManagerProps {
  workspaces: Workspace[]
  floors: Floor[]
  buildings: Building[]
  onRefresh: () => Promise<void>
  apiBaseUrl: string
  token: string
}

interface SvgMapperProps {
  floors: Floor[]
  apiBaseUrl: string
  token: string
}

// --- Main Component ---
export default function AdminSetupPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const apiBaseUrl = React.useMemo(() => getBrowserApiBaseUrl(), [])
  const [session, setSession] = React.useState<Session | null>(null)
  const [activeTab, setActiveTab] = React.useState<Tab>("buildings")
  
  const [buildings, setBuildings] = React.useState<Building[]>([])
  const [floors, setFloors] = React.useState<Floor[]>([])
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const accessToken = session?.access_token ?? null
  const tokenForUi: string = accessToken ?? ""

  const loadData = React.useCallback(async (token: string) => {
    if (!token) return
    setLoading(true)
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [bRes, fRes, wRes] = await Promise.all([
        fetch(`${apiBaseUrl}/buildings`, { headers }),
        fetch(`${apiBaseUrl}/floors`, { headers }),
        fetch(`${apiBaseUrl}/workspaces`, { headers })
      ])
      
      if (bRes.ok && fRes.ok && wRes.ok) {
        const b = await bRes.json() as ListResponse<Building>
        const f = await fRes.json() as ListResponse<Floor>
        const w = await wRes.json() as ListResponse<Workspace>
        setBuildings(b.items || [])
        setFloors(f.items || [])
        setWorkspaces(w.items || [])
      }
    } catch {
      setError(t("admin.loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [apiBaseUrl, t])

  // Auth & Initial Data
  React.useEffect(() => {
    const bootstrap = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        router.push("/login")
        return
      }
      setSession(currentSession)
      await loadData(currentSession.access_token ?? "")
    }
    void bootstrap()
  }, [loadData, router])

  if (loading && !session) return null

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-white mb-2 tracking-tight">{t("admin.title")}</h1>
            <p className="text-slate-400 font-medium">{t("admin.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2 glass p-1.5 rounded-2xl border-white/5 overflow-x-auto no-scrollbar">
            <TabButton active={activeTab === "buildings"} onClick={() => setActiveTab("buildings")} icon={<Building2 size={16} />} label={t("admin.tabs.buildings")} />
            <TabButton active={activeTab === "floors"} onClick={() => setActiveTab("floors")} icon={<Layers size={16} />} label={t("admin.tabs.floors")} />
            <TabButton active={activeTab === "workspaces"} onClick={() => setActiveTab("workspaces")} icon={<MapPin size={16} />} label={t("admin.tabs.workspaces")} />
            <TabButton active={activeTab === "svg-mapping"} onClick={() => setActiveTab("svg-mapping")} icon={<Upload size={16} />} label={t("admin.tabs.svgMapping")} />
          </div>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-medium">
            <AlertCircle size={18} />
            {error}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {activeTab === "buildings" ? (accessToken ? <BuildingManager buildings={buildings} onRefresh={() => loadData(tokenForUi)} apiBaseUrl={apiBaseUrl} token={tokenForUi} /> : null) : null}
            {activeTab === "floors" ? (accessToken ? <FloorManager floors={floors} buildings={buildings} onRefresh={() => loadData(tokenForUi)} apiBaseUrl={apiBaseUrl} token={tokenForUi} /> : null) : null}
            {activeTab === "workspaces" ? (accessToken ? <WorkspaceManager workspaces={workspaces} floors={floors} buildings={buildings} onRefresh={() => loadData(tokenForUi)} apiBaseUrl={apiBaseUrl} token={tokenForUi} /> : null) : null}
            {activeTab === "svg-mapping" ? (accessToken ? <SvgMapper floors={floors} apiBaseUrl={apiBaseUrl} token={tokenForUi} /> : null) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </DashboardLayout>
  )
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
        active ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20 scale-105" : "text-slate-400 hover:text-white hover:bg-white/5"
      )}
    >
      {icon}
      {label}
    </button>
  )
}

// --- Specialized Managers ---

function BuildingManager({ buildings, onRefresh, apiBaseUrl, token }: BuildingManagerProps) {
  const { t } = useLanguage()
  const [isSaving, setIsSaving] = React.useState(false)
  const [form, setForm] = React.useState({ name: "", address: "", totalFloors: 1, openTime: "08:00", closeTime: "18:00" })

  const handleCreate = async () => {
    if (!token) return
    setIsSaving(true)
    try {
      const res = await fetch(`${apiBaseUrl}/buildings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      })
      if (res.ok) {
        await onRefresh()
        setForm({ name: "", address: "", totalFloors: 1, openTime: "08:00", closeTime: "18:00" })
      }
    } finally { setIsSaving(false) }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <Card className="lg:col-span-2 glass-panel border-white/5">
        <CardHeader>
          <CardTitle>{t("admin.activeFacilities")}</CardTitle>
          <CardDescription>{t("admin.activeFacilitiesDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {buildings.map((b: Building) => (
            <div key={b.id} className="flex items-center justify-between p-5 rounded-2xl border border-white/5 bg-white/5 hover:border-primary-500/30 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary-500/10 flex items-center justify-center text-primary-500 group-hover:scale-110 transition-transform">
                  <Building2 size={28} />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-white">{b.name}</h4>
                  <p className="text-sm text-slate-500">{b.address || t("admin.noAddress")}</p>
                  <p className="text-xs text-slate-600">
                    {b.open_time && b.close_time ? `${b.open_time.slice(0, 5)} - ${b.close_time.slice(0, 5)}` : t("floorMap.notConfigured")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right mr-4">
                  <p className="text-xs font-bold text-slate-500 uppercase">{t("admin.floorsLabel")}</p>
                  <p className="text-white font-black">{b.total_floors}</p>
                </div>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white"><Plus size={20} /></Button>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-400"><Trash2 size={20} /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="glass-panel border-white/5 h-fit sticky top-8">
        <CardHeader>
          <CardTitle>{t("admin.addFacility")}</CardTitle>
          <CardDescription>{t("admin.addFacilityDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t("admin.buildingName")}</label>
            <Input placeholder={t("admin.buildingPlaceholder")} className="bg-white/5 border-white/10 h-12 rounded-xl" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t("admin.address")}</label>
            <Input placeholder={t("admin.addressPlaceholder")} className="bg-white/5 border-white/10 h-12 rounded-xl" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t("admin.totalFloors")}</label>
            <Input type="number" className="bg-white/5 border-white/10 h-12 rounded-xl" value={form.totalFloors} onChange={e => setForm({...form, totalFloors: parseInt(e.target.value)})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t("admin.openTime")}</label>
              <Input type="time" className="bg-white/5 border-white/10 h-12 rounded-xl [color-scheme:dark]" value={form.openTime} onChange={e => setForm({...form, openTime: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t("admin.closeTime")}</label>
              <Input type="time" className="bg-white/5 border-white/10 h-12 rounded-xl [color-scheme:dark]" value={form.closeTime} onChange={e => setForm({...form, closeTime: e.target.value})} />
            </div>
          </div>
          <Button className="w-full mt-4 bg-primary-600 hover:bg-primary-700 h-14 font-black text-lg shadow-lg shadow-primary-500/20" onClick={handleCreate} disabled={isSaving}>
            {isSaving ? t("admin.saving") : <><Save className="mr-2" size={20} /> {t("admin.createBuilding")}</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function FloorManager({ floors, buildings, onRefresh, apiBaseUrl, token }: FloorManagerProps) {
  const { t } = useLanguage()
  const [isSaving, setIsSaving] = React.useState(false)
  const [form, setForm] = React.useState({
    buildingId: buildings[0]?.id ?? "",
    floorNumber: 1,
    name: "",
  })
  const effectiveBuildingId = form.buildingId || buildings[0]?.id || ""

  const handleCreate = async () => {
    if (!token || !effectiveBuildingId) return
    setIsSaving(true)
    try {
      const res = await fetch(`${apiBaseUrl}/floors`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          buildingId: effectiveBuildingId,
          floorNumber: form.floorNumber,
          name: form.name || undefined,
        }),
      })

      if (res.ok) {
        await onRefresh()
        setForm((current) => ({ ...current, floorNumber: current.floorNumber + 1, name: "" }))
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <Card className="lg:col-span-2 glass-panel border-white/5">
        <CardHeader>
          <CardTitle>{t("admin.levelManagement")}</CardTitle>
          <CardDescription>{t("admin.levelManagementDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {floors.map((f: Floor) => (
            <div key={f.id} className="flex items-center justify-between p-5 rounded-2xl border border-white/5 bg-white/5 hover:border-blue-500/30 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                  <Layers size={28} />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-white">{f.name || t("common.floorFallback").replace("{number}", String(f.floor_number))}</h4>
                  <p className="text-sm text-slate-500">{buildings.find((b) => b.id === f.building_id)?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", f.svg_map_url ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border border-amber-500/20")}>
                  {f.svg_map_url ? t("admin.svgMapped") : t("admin.noSvg")}
                </div>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white"><ChevronRight size={20} /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      
      <Card className="glass-panel border-white/5 h-fit">
        <CardHeader>
          <CardTitle>{t("admin.quickAddFloor")}</CardTitle>
          <CardDescription>{t("admin.quickAddFloorDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {buildings.length > 0 ? (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t("admin.selectBuilding")}</label>
                <select
                  className="w-full bg-white/5 border border-white/10 h-12 rounded-xl px-4 text-white font-medium focus:outline-none"
                  value={effectiveBuildingId}
                  onChange={(e) => setForm({ ...form, buildingId: e.target.value })}
                >
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id} className="bg-slate-900 text-white">
                      {building.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t("admin.floorNumber")}</label>
                <Input type="number" className="bg-white/5 border-white/10 h-12 rounded-xl" value={form.floorNumber} onChange={(e) => setForm({ ...form, floorNumber: parseInt(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t("admin.floorName")}</label>
                <Input placeholder={t("admin.floorNamePlaceholder")} className="bg-white/5 border-white/10 h-12 rounded-xl" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 h-12 font-black" onClick={handleCreate} disabled={isSaving || !effectiveBuildingId}>
                {isSaving ? t("admin.saving") : t("admin.createFloor")}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-400 text-center py-8">{t("admin.selectBuildingFirst")}</p>
              <Button className="w-full bg-white/5 border border-white/10 text-slate-500 font-bold" disabled>{t("admin.createFloor")}</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function WorkspaceManager({ workspaces, floors, buildings, onRefresh, apiBaseUrl, token }: WorkspaceManagerProps) {
  const { t } = useLanguage()
  const [isSaving, setIsSaving] = React.useState(false)
  const [form, setForm] = React.useState({
    floorId: floors[0]?.id ?? "",
    name: "",
    type: "desk",
    status: "available",
    svgElementId: "",
    qrCodeValue: "",
    capacity: 1,
  })
  const effectiveFloorId = form.floorId || floors[0]?.id || ""

  const describeFloor = React.useCallback((floor: Floor) => {
    const building = buildings.find((item) => item.id === floor.building_id)
    const floorName = floor.name || t("common.floorFallback").replace("{number}", String(floor.floor_number))

    return building ? `${building.name} / ${floorName}` : floorName
  }, [buildings, t])

  const handleCreate = async () => {
    if (!token || !effectiveFloorId || !form.name || !form.svgElementId || !form.qrCodeValue) return
    setIsSaving(true)
    try {
      const res = await fetch(`${apiBaseUrl}/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          floorId: effectiveFloorId,
          name: form.name,
          type: form.type,
          status: form.status,
          svgElementId: form.svgElementId,
          qrCodeValue: form.qrCodeValue,
          capacity: form.capacity,
        }),
      })

      if (res.ok) {
        await onRefresh()
        setForm((current) => ({
          ...current,
          name: "",
          svgElementId: "",
          qrCodeValue: "",
          capacity: 1,
        }))
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
        {workspaces.map((w: Workspace) => (
          <Card key={w.id} className="glass-panel border-white/5 hover:border-primary-500/30 transition-all group relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <MapPin size={80} />
             </div>
             <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                   <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-500">
                      <MapPin size={24} />
                   </div>
                   <div>
                      <h4 className="font-bold text-white text-lg">{w.name}</h4>
                      <p className="text-xs text-slate-500">{w.type.toUpperCase()} • {t("admin.capacity")}: {w.capacity}</p>
                   </div>
                </div>
                <div className="flex items-center justify-between mt-6">
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t("admin.svgId")}: {w.svg_element_id}</span>
                   <Button variant="ghost" size="sm" className="text-primary-500 font-bold hover:bg-primary-500/10">{t("admin.edit")}</Button>
                </div>
             </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-panel border-white/5 h-fit lg:sticky lg:top-8">
        <CardHeader>
          <CardTitle>{t("admin.newWorkspace")}</CardTitle>
          <CardDescription>{t("admin.levelManagementDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t("admin.selectFloor")}</label>
            <select
              className="w-full bg-white/5 border border-white/10 h-12 rounded-xl px-4 text-white font-medium focus:outline-none"
              value={effectiveFloorId}
              onChange={(e) => setForm({ ...form, floorId: e.target.value })}
            >
              {floors.map((floor) => (
                <option key={floor.id} value={floor.id} className="bg-slate-900 text-white">
                  {describeFloor(floor)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t("admin.workspaceName")}</label>
            <Input placeholder={t("admin.workspaceNamePlaceholder")} className="bg-white/5 border-white/10 h-12 rounded-xl" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t("admin.workspaceType")}</label>
              <select className="w-full bg-white/5 border border-white/10 h-12 rounded-xl px-3 text-white font-medium focus:outline-none" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {["desk", "meeting_room", "focus_room", "lab", "room", "parking"].map((type) => (
                  <option key={type} value={type} className="bg-slate-900 text-white">{type}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t("admin.workspaceStatus")}</label>
              <select className="w-full bg-white/5 border border-white/10 h-12 rounded-xl px-3 text-white font-medium focus:outline-none" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {["available", "maintenance", "inactive"].map((status) => (
                  <option key={status} value={status} className="bg-slate-900 text-white">{status}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t("admin.svgId")}</label>
            <Input placeholder={t("admin.svgIdPlaceholder")} className="bg-white/5 border-white/10 h-12 rounded-xl" value={form.svgElementId} onChange={(e) => setForm({ ...form, svgElementId: e.target.value })} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t("admin.qrCodeValue")}</label>
            <Input placeholder={t("admin.qrCodePlaceholder")} className="bg-white/5 border-white/10 h-12 rounded-xl" value={form.qrCodeValue} onChange={(e) => setForm({ ...form, qrCodeValue: e.target.value })} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t("admin.capacity")}</label>
            <Input type="number" min={1} max={50} className="bg-white/5 border-white/10 h-12 rounded-xl" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) })} />
          </div>
          <Button
            className="w-full bg-primary-600 hover:bg-primary-700 h-12 font-black"
            onClick={handleCreate}
            disabled={isSaving || !effectiveFloorId || !form.name || !form.svgElementId || !form.qrCodeValue}
          >
            {isSaving ? t("admin.saving") : <><Plus className="mr-2" size={18} /> {t("admin.createWorkspace")}</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function SvgMapper({ floors, apiBaseUrl, token }: SvgMapperProps) {
  const { t } = useLanguage()
  const [selectedFloorId, setSelectedFloorId] = React.useState("")
  const [file, setFile] = React.useState<File | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)

  const handleUpload = async () => {
    if (!selectedFloorId || !file || !token) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(`${apiBaseUrl}/floors/${selectedFloorId}/svg`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })
      if (res.ok) alert(t("admin.svgUploaded"))
    } finally { setIsUploading(false) }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <Card className="lg:col-span-3 glass-panel border-white/5 flex flex-col min-h-[600px]">
        <CardHeader className="bg-white/5">
          <CardTitle>{t("admin.floorMappingVisualizer")}</CardTitle>
          <CardDescription>{t("admin.floorMappingDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center p-12">
          <div className="text-center space-y-6">
            <div className="w-24 h-24 rounded-3xl bg-blue-500/10 flex items-center justify-center text-blue-500 mx-auto">
              <FileCode size={48} />
            </div>
            <div className="space-y-2">
              <h4 className="text-xl font-bold text-white">{t("admin.mappingConsole")}</h4>
              <p className="text-slate-500 max-w-md">{t("admin.mappingConsoleDesc")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="glass-panel border-white/5">
          <CardHeader>
            <CardTitle>{t("admin.uploadAssets")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t("admin.targetFloor")}</label>
               <select className="w-full bg-white/5 border border-white/10 h-12 rounded-xl px-4 text-white font-medium focus:outline-none" onChange={e => setSelectedFloorId(e.target.value)} value={selectedFloorId}>
                  <option value="">{t("admin.selectFloor")}</option>
                  {floors.map((f) => (
                    <option key={f.id} value={f.id} className="bg-slate-900 text-white">{f.name || t("common.floorFallback").replace("{number}", String(f.floor_number))}</option>
                  ))}
               </select>
             </div>
             <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t("admin.svgSource")}</label>
               <div className="relative h-32 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center hover:bg-white/5 transition-all cursor-pointer">
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept=".svg" onChange={e => setFile(e.target.files?.[0] || null)} />
                  <Upload size={32} className="text-slate-500 mb-2" />
                  <p className="text-xs text-slate-500 font-bold">{file ? file.name : t("admin.chooseSvg")}</p>
               </div>
             </div>
             <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700 h-12 font-black" onClick={handleUpload} disabled={isUploading || !file}>
               {isUploading ? t("admin.uploading") : t("admin.syncAssets")}
             </Button>
          </CardContent>
        </Card>

        <Card className="glass-panel border-primary-500/20 bg-primary-500/5">
          <CardContent className="p-6">
            <div className="flex gap-4">
              <Info className="text-primary-500 shrink-0" size={24} />
              <div className="space-y-1">
                <h4 className="font-bold text-white text-sm">{t("admin.systemTip")}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{t("admin.systemTipDesc")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
