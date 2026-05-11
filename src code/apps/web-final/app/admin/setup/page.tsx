"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Building2, Layers, MapPin, Plus, Save, Trash2, Upload, AlertCircle, ChevronRight, FileCode, Info, CheckCircle2, CircleDot, ExternalLink, Copy, Wand2 } from "lucide-react"
import { useRouter } from "next/navigation"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase/client"
import { getBrowserApiBaseUrl } from "@/lib/api-base-url"
import { DashboardLayout } from "@/components/premium/layout/dashboard-layout"
import { Button } from "@/components/premium/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/premium/ui/card"
import { Input } from "@/components/premium/ui/input"
import { useToast } from "@/components/premium/ui/toast"
import { useLanguage } from "@/components/premium/language-provider"
import { readApiError } from "@/lib/http-feedback"
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
  approval_status?: string
  svg_element_id: string
  capacity: number
}

interface ListResponse<T> {
  items?: T[]
}

interface OwnerRequest {
  id: string
  user_id: string
  status: "none" | "pending" | "approved" | "rejected"
  message: string | null
  created_at: string
}

interface TabButtonProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}

interface BuildingPanelProps {
  buildings: Building[]
  onRefresh: () => Promise<void>
  apiBaseUrl: string
  token: string
}

interface FloorPanelProps {
  floors: Floor[]
  buildings: Building[]
  onRefresh: () => Promise<void>
  apiBaseUrl: string
  token: string
}

interface WorkspacePanelProps {
  workspaces: Workspace[]
  floors: Floor[]
  buildings: Building[]
  onRefresh: () => Promise<void>
  apiBaseUrl: string
  token: string
  userRole: string | null
}

interface SvgMapperProps {
  floors: Floor[]
  onRefresh: () => Promise<void>
  apiBaseUrl: string
  token: string
}

interface SetupGuideProps {
  buildings: Building[]
  floors: Floor[]
  workspaces: Workspace[]
  activeTab: Tab
  onSelectTab: (tab: Tab) => void
}

// --- Main Component ---
export default function AdminSetupPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const { toast } = useToast()
  const apiBaseUrl = React.useMemo(() => getBrowserApiBaseUrl(), [])
  const [session, setSession] = React.useState<Session | null>(null)
  const [userRole, setUserRole] = React.useState<string | null>(null)
  const [activeTab, setActiveTab] = React.useState<Tab>("buildings")
  
  const [buildings, setBuildings] = React.useState<Building[]>([])
  const [floors, setFloors] = React.useState<Floor[]>([])
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([])
  const [ownerRequests, setOwnerRequests] = React.useState<OwnerRequest[]>([])
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
      toast({ title: t("admin.loadFailed"), variant: "error" })
    } finally {
      setLoading(false)
    }
  }, [apiBaseUrl, t, toast])

  const loadOwnerRequests = React.useCallback(async (token: string) => {
    const res = await fetch(`${apiBaseUrl}/space-owner-requests`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      const data = await res.json() as ListResponse<OwnerRequest>
      setOwnerRequests(data.items ?? [])
    }
  }, [apiBaseUrl])

  // Auth & Initial Data
  React.useEffect(() => {
    const bootstrap = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        router.push("/login")
        return
      }
      setSession(currentSession)
      const meRes = await fetch(`${apiBaseUrl}/me`, {
        headers: { Authorization: `Bearer ${currentSession.access_token}` }
      })
      if (meRes.ok) {
        const meData = await meRes.json() as { role?: string }
        const role = meData.role ?? null
        setUserRole(role)
        if (role === "user") {
          router.push("/dashboard")
          return
        }
        if (role === "space_owner") {
          setActiveTab("workspaces")
        }
        if (role === "admin") {
          void loadOwnerRequests(currentSession.access_token)
        }
      }
      await loadData(currentSession.access_token ?? "")
    }
    void bootstrap()
  }, [apiBaseUrl, loadData, loadOwnerRequests, router])

  const handleOwnerRequestReview = async (id: string, status: "approved" | "rejected") => {
    if (!accessToken || !isAdmin) return
    try {
      const res = await fetch(`${apiBaseUrl}/space-owner-requests/${id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ status, reviewNote: status === "approved" ? "Approved by System Admin" : "Rejected by System Admin" }),
      })
      if (res.ok) {
        await loadOwnerRequests(accessToken)
        toast({ title: status === "approved" ? "Space Owner approved" : "Space Owner rejected", variant: "success" })
      } else {
        const message = await readApiError(res, "Could not review request.")
        toast({ title: "Review failed", description: message, variant: "error" })
      }
    } catch {
      toast({ title: "Review failed", description: t("admin.networkError"), variant: "error" })
    }
  }

  if (loading && !session) return null

  const isAdmin = userRole === "admin"
  const isSpaceOwner = userRole === "space_owner"

  return (
    <DashboardLayout>
      <div className="space-y-6 sm:space-y-8">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_-44px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-slate-950">
          <div className="grid gap-6 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/40 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                <Wand2 size={14} />
                Setup wizard
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl dark:text-white">{t("admin.title")}</h1>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">{t("admin.subtitle")}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:max-w-xl">
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 dark:border-white/10 dark:bg-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Buildings</p>
                  <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{buildings.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 dark:border-white/10 dark:bg-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Floors</p>
                  <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{floors.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 dark:border-white/10 dark:bg-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Spaces</p>
                  <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{workspaces.length}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-white/10 dark:bg-slate-900">
              {isAdmin && <TabButton active={activeTab === "buildings"} onClick={() => setActiveTab("buildings")} icon={<Building2 size={16} />} label={t("admin.tabs.buildings")} />}
              {isAdmin && <TabButton active={activeTab === "floors"} onClick={() => setActiveTab("floors")} icon={<Layers size={16} />} label={t("admin.tabs.floors")} />}
              {isAdmin && <TabButton active={activeTab === "svg-mapping"} onClick={() => setActiveTab("svg-mapping")} icon={<Upload size={16} />} label={t("admin.tabs.svgMapping")} />}
              <TabButton active={activeTab === "workspaces"} onClick={() => setActiveTab("workspaces")} icon={<MapPin size={16} />} label={t("admin.tabs.workspaces")} />
            </div>
          </div>
        </section>

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertCircle size={18} />
            {error}
          </motion.div>
        )}

        {isAdmin && (
          <SetupGuide
            buildings={buildings}
            floors={floors}
            workspaces={workspaces}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
          />
        )}

        {isAdmin && ownerRequests.filter((request) => request.status === "pending").length > 0 && (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10">
            <CardHeader>
              <CardTitle>Space Owner requests</CardTitle>
              <CardDescription>Approve or reject users who want to publish their own spaces.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ownerRequests.filter((request) => request.status === "pending").map((request) => (
                <div key={request.id} className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-black text-slate-950 dark:text-white">{request.user_id}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{request.message || "No message provided."}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <Button className="h-10 rounded-xl bg-emerald-600 font-black hover:bg-emerald-700" onClick={() => handleOwnerRequestReview(request.id, "approved")}>Approve</Button>
                    <Button variant="outline" className="h-10 rounded-xl border-rose-200 font-black text-rose-600 hover:bg-rose-50 dark:border-rose-500/20 dark:text-rose-300 dark:hover:bg-rose-500/10" onClick={() => handleOwnerRequestReview(request.id, "rejected")}>Reject</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {isSpaceOwner && (
          <div className="rounded-[1.5rem] border border-blue-200 bg-blue-50 p-5 text-sm font-semibold text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-100">
            Spaces you create are submitted as pending approval. A System Admin must approve them before users can book them.
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {activeTab === "buildings" && isAdmin ? (accessToken ? <BuildingPanel buildings={buildings} onRefresh={() => loadData(tokenForUi)} apiBaseUrl={apiBaseUrl} token={tokenForUi} /> : null) : null}
            {activeTab === "floors" && isAdmin ? (accessToken ? <FloorPanel floors={floors} buildings={buildings} onRefresh={() => loadData(tokenForUi)} apiBaseUrl={apiBaseUrl} token={tokenForUi} /> : null) : null}
            {activeTab === "workspaces" ? (accessToken ? <WorkspacePanel workspaces={workspaces} floors={floors} buildings={buildings} onRefresh={() => loadData(tokenForUi)} apiBaseUrl={apiBaseUrl} token={tokenForUi} userRole={userRole} /> : null) : null}
            {activeTab === "svg-mapping" && isAdmin ? (accessToken ? <SvgMapper floors={floors} onRefresh={() => loadData(tokenForUi)} apiBaseUrl={apiBaseUrl} token={tokenForUi} /> : null) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </DashboardLayout>
  )
}

function SetupGuide({ buildings, floors, workspaces, activeTab, onSelectTab }: SetupGuideProps) {
  const { t } = useLanguage()
  const hasBuilding = buildings.length > 0
  const hasFloor = floors.length > 0
  const hasSvg = floors.some((floor) => Boolean(floor.svg_map_url))
  const hasWorkspace = workspaces.length > 0
  const mappedFloorIds = new Set(floors.filter((floor) => floor.svg_map_url).map((floor) => floor.id))
  const hasMappedWorkspace = workspaces.some((workspace) => workspace.svg_element_id)
  const hasBookableMappedWorkspace = workspaces.some((workspace) => mappedFloorIds.has(workspace.floor_id) && workspace.svg_element_id)
  const steps: Array<{ key: Tab; label: string; description: string; done: boolean }> = [
    { key: "buildings", label: t("admin.guide.building"), description: t("admin.guide.buildingDesc"), done: hasBuilding },
    { key: "floors", label: t("admin.guide.floor"), description: t("admin.guide.floorDesc"), done: hasFloor },
    { key: "svg-mapping", label: t("admin.guide.svg"), description: t("admin.guide.svgDesc"), done: hasSvg },
    { key: "svg-mapping", label: tFallback(t, "admin.guide.mapping", "Map SVG IDs"), description: tFallback(t, "admin.guide.mappingDesc", "Review SVG element IDs and copy the correct ID for each desk or room."), done: hasMappedWorkspace },
    { key: "workspaces", label: t("admin.guide.workspace"), description: t("admin.guide.workspaceDesc"), done: hasWorkspace && hasBookableMappedWorkspace },
  ]
  const nextStep = steps.find((step) => !step.done) ?? null
  const completedCount = steps.filter((step) => step.done).length

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-[0_20px_70px_-46px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-slate-950">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-blue-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-300">
              <CircleDot size={14} />
              {t("admin.guide.title")}
            </div>
            <h2 className="text-2xl font-black text-slate-950 dark:text-white">{t("admin.guide.heading")}</h2>
            <p className="max-w-2xl text-sm font-semibold leading-relaxed text-slate-600 dark:text-slate-400">
              {nextStep ? t("admin.guide.nextStep").replace("{step}", nextStep.label) : t("admin.guide.completed")}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("admin.guide.progress")}</p>
              <p className="text-2xl font-black text-slate-950 dark:text-white">{completedCount}/5</p>
            </div>
            <Button
              className="h-11 rounded-xl bg-blue-600 px-5 font-black text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700"
              onClick={() => onSelectTab((nextStep?.key ?? "workspaces"))}
            >
              {nextStep ? t("admin.guide.continue") : t("admin.tabs.workspaces")}
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {steps.map((step, index) => {
            const isActive = activeTab === step.key

            return (
              <button
                key={`${step.key}-${index}`}
                type="button"
                onClick={() => onSelectTab(step.key)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-all",
                  step.done ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10" : "border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.03]",
                  isActive ? "ring-2 ring-blue-500/50" : "hover:border-blue-300 dark:hover:border-primary-500/30",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black",
                    step.done ? "bg-emerald-500 text-white" : "bg-white text-slate-500 shadow-sm dark:bg-white/10 dark:text-slate-400",
                  )}>
                    {step.done ? <CheckCircle2 size={18} /> : index + 1}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-black text-slate-950 dark:text-white">{step.label}</p>
                    <p className="text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-400">{step.description}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-black transition-all sm:px-5",
        active ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function FieldError({ show, children }: { show: boolean; children: React.ReactNode }) {
  if (!show) return null

  return (
    <p className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
      <AlertCircle size={13} />
      {children}
    </p>
  )
}

const adminCardClass = "border-slate-200 bg-white shadow-[0_18px_60px_-42px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-slate-950"
const adminPanelClass = "rounded-2xl border border-slate-200 bg-slate-50 transition-all hover:border-blue-300 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-primary-500/30"
const adminInputClass = "h-12 rounded-xl border-slate-200 bg-white text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-white"
const adminSelectClass = "h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-semibold text-slate-950 focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
const adminLabelClass = "ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500"

function tFallback(t: (path: string) => string, path: string, fallback: string) {
  const value = t(path)
  return value === path ? fallback : value
}

// --- Specialized setup panels ---

function BuildingPanel({ buildings, onRefresh, apiBaseUrl, token }: BuildingPanelProps) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)
  const [form, setForm] = React.useState({ name: "", address: "", totalFloors: 1, openTime: "08:00", closeTime: "18:00" })
  const isValid = Boolean(form.name.trim()) && Number.isFinite(form.totalFloors) && form.totalFloors > 0 && Boolean(form.openTime) && Boolean(form.closeTime)

  const handleCreate = async () => {
    if (!token) return
    setSubmitted(true)
    if (!isValid) {
      toast({ title: tFallback(t, "admin.validationTitle", "Check the form"), description: tFallback(t, "admin.fixValidation", "Some required information is missing or invalid."), variant: "error" })
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch(`${apiBaseUrl}/buildings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      })
      if (res.ok) {
        await onRefresh()
        setSubmitted(false)
        setForm({ name: "", address: "", totalFloors: 1, openTime: "08:00", closeTime: "18:00" })
        toast({ title: t("admin.createSuccess"), description: t("admin.buildingCreated"), variant: "success" })
      } else {
        const message = await readApiError(res, t("admin.createFailed"))
        toast({ title: t("admin.createFailed"), description: message, variant: "error" })
      }
    } catch {
      toast({ title: t("admin.createFailed"), description: t("admin.networkError"), variant: "error" })
    } finally { setIsSaving(false) }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <Card className={cn("lg:col-span-2", adminCardClass)}>
        <CardHeader>
          <CardTitle>{t("admin.activeFacilities")}</CardTitle>
          <CardDescription>{t("admin.activeFacilitiesDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {buildings.map((b: Building) => (
            <div key={b.id} className={cn("group flex items-center justify-between p-5", adminPanelClass)}>
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 transition-transform group-hover:scale-105 dark:bg-primary-500/10 dark:text-primary-400">
                  <Building2 size={28} />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-950 dark:text-white">{b.name}</h4>
                  <p className="text-sm font-semibold text-slate-500">{b.address || t("admin.noAddress")}</p>
                  <p className="text-xs font-semibold text-slate-400">
                    {b.open_time && b.close_time ? `${b.open_time.slice(0, 5)} - ${b.close_time.slice(0, 5)}` : t("floorMap.notConfigured")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right mr-4">
                  <p className="text-xs font-bold text-slate-500 uppercase">{t("admin.floorsLabel")}</p>
                  <p className="font-black text-slate-950 dark:text-white">{b.total_floors}</p>
                </div>
                <Button variant="ghost" size="icon" className="text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-white"><Plus size={20} /></Button>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-400"><Trash2 size={20} /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className={cn("h-fit lg:sticky lg:top-8", adminCardClass)}>
        <CardHeader>
          <CardTitle>{t("admin.addFacility")}</CardTitle>
          <CardDescription>{t("admin.addFacilityDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label className={adminLabelClass}>{t("admin.buildingName")}</label>
            <Input placeholder={t("admin.buildingPlaceholder")} className={adminInputClass} value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <FieldError show={submitted && !form.name.trim()}>{tFallback(t, "admin.validation.required", "This field is required.")}</FieldError>
          </div>
          <div className="space-y-2">
            <label className={adminLabelClass}>{t("admin.address")}</label>
            <Input placeholder={t("admin.addressPlaceholder")} className={adminInputClass} value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className={adminLabelClass}>{t("admin.totalFloors")}</label>
            <Input type="number" className={adminInputClass} value={form.totalFloors} onChange={e => setForm({...form, totalFloors: parseInt(e.target.value)})} />
            <FieldError show={submitted && (!Number.isFinite(form.totalFloors) || form.totalFloors < 1)}>{tFallback(t, "admin.validation.positiveNumber", "Enter a number greater than zero.")}</FieldError>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className={adminLabelClass}>{t("admin.openTime")}</label>
              <Input type="time" className={cn(adminInputClass, "[color-scheme:light] dark:[color-scheme:dark]")} value={form.openTime} onChange={e => setForm({...form, openTime: e.target.value})} />
              <FieldError show={submitted && !form.openTime}>{tFallback(t, "admin.validation.required", "This field is required.")}</FieldError>
            </div>
            <div className="space-y-2">
              <label className={adminLabelClass}>{t("admin.closeTime")}</label>
              <Input type="time" className={cn(adminInputClass, "[color-scheme:light] dark:[color-scheme:dark]")} value={form.closeTime} onChange={e => setForm({...form, closeTime: e.target.value})} />
              <FieldError show={submitted && !form.closeTime}>{tFallback(t, "admin.validation.required", "This field is required.")}</FieldError>
            </div>
          </div>
          <Button className="w-full mt-4 bg-primary-600 hover:bg-primary-700 h-14 font-black text-lg shadow-lg shadow-primary-500/20" onClick={handleCreate} isLoading={isSaving} loadingText={t("admin.saving")}>
            <Save className="mr-2" size={20} /> {t("admin.createBuilding")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function FloorPanel({ floors, buildings, onRefresh, apiBaseUrl, token }: FloorPanelProps) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)
  const [form, setForm] = React.useState({
    buildingId: buildings[0]?.id ?? "",
    floorNumber: 1,
    name: "",
  })
  const effectiveBuildingId = form.buildingId || buildings[0]?.id || ""
  const isValid = Boolean(effectiveBuildingId) && Number.isFinite(form.floorNumber) && form.floorNumber > 0

  const handleCreate = async () => {
    if (!token || !effectiveBuildingId) return
    setSubmitted(true)
    if (!isValid) {
      toast({ title: tFallback(t, "admin.validationTitle", "Check the form"), description: tFallback(t, "admin.fixValidation", "Some required information is missing or invalid."), variant: "error" })
      return
    }
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
        setSubmitted(false)
        setForm((current) => ({ ...current, floorNumber: current.floorNumber + 1, name: "" }))
        toast({ title: t("admin.createSuccess"), description: t("admin.floorCreated"), variant: "success" })
      } else {
        const message = await readApiError(res, t("admin.createFailed"))
        toast({ title: t("admin.createFailed"), description: message, variant: "error" })
      }
    } catch {
      toast({ title: t("admin.createFailed"), description: t("admin.networkError"), variant: "error" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <Card className={cn("lg:col-span-2", adminCardClass)}>
        <CardHeader>
          <CardTitle>{t("admin.levelManagement")}</CardTitle>
          <CardDescription>{t("admin.levelManagementDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {floors.map((f: Floor) => (
            <div key={f.id} className={cn("group flex items-center justify-between p-5", adminPanelClass)}>
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 transition-transform group-hover:scale-105 dark:bg-blue-500/10 dark:text-blue-400">
                  <Layers size={28} />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-950 dark:text-white">{f.name || t("common.floorFallback").replace("{number}", String(f.floor_number))}</h4>
                  <p className="text-sm font-semibold text-slate-500">{buildings.find((b) => b.id === f.building_id)?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", f.svg_map_url ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border border-amber-500/20")}>
                  {f.svg_map_url ? t("admin.svgMapped") : t("admin.noSvg")}
                </div>
                <Button variant="ghost" size="icon" className="text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-white"><ChevronRight size={20} /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      
      <Card className={cn("h-fit", adminCardClass)}>
        <CardHeader>
          <CardTitle>{t("admin.quickAddFloor")}</CardTitle>
          <CardDescription>{t("admin.quickAddFloorDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {buildings.length > 0 ? (
            <>
              <div className="space-y-2">
                <label className={adminLabelClass}>{t("admin.selectBuilding")}</label>
                <select
                  className={adminSelectClass}
                  value={effectiveBuildingId}
                  onChange={(e) => setForm({ ...form, buildingId: e.target.value })}
                >
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id} className="bg-white text-slate-950 dark:bg-slate-900 dark:text-white">
                      {building.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className={adminLabelClass}>{t("admin.floorNumber")}</label>
                <Input type="number" className={adminInputClass} value={form.floorNumber} onChange={(e) => setForm({ ...form, floorNumber: parseInt(e.target.value) })} />
                <FieldError show={submitted && (!Number.isFinite(form.floorNumber) || form.floorNumber < 1)}>{tFallback(t, "admin.validation.positiveNumber", "Enter a number greater than zero.")}</FieldError>
              </div>
              <div className="space-y-2">
                <label className={adminLabelClass}>{t("admin.floorName")}</label>
                <Input placeholder={t("admin.floorNamePlaceholder")} className={adminInputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 h-12 font-black" onClick={handleCreate} disabled={!effectiveBuildingId} isLoading={isSaving} loadingText={t("admin.saving")}>
                {t("admin.createFloor")}
              </Button>
            </>
          ) : (
            <>
              <p className="py-8 text-center text-sm font-semibold text-slate-500">{t("admin.selectBuildingFirst")}</p>
              <Button className="w-full bg-white/5 border border-white/10 text-slate-500 font-bold" disabled>{t("admin.createFloor")}</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function WorkspacePanel({ workspaces, floors, buildings, onRefresh, apiBaseUrl, token, userRole }: WorkspacePanelProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)
  const [lastCreated, setLastCreated] = React.useState<{ name: string; floorId: string } | null>(null)
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
  const isValid = Boolean(effectiveFloorId) && Boolean(form.name.trim()) && Boolean(form.svgElementId.trim()) && Boolean(form.qrCodeValue.trim()) && Number.isFinite(form.capacity) && form.capacity > 0
  const isAdmin = userRole === "admin"

  const describeFloor = React.useCallback((floor: Floor) => {
    const building = buildings.find((item) => item.id === floor.building_id)
    const floorName = floor.name || t("common.floorFallback").replace("{number}", String(floor.floor_number))

    return building ? `${building.name} / ${floorName}` : floorName
  }, [buildings, t])

  const handleCreate = async () => {
    if (!token || !effectiveFloorId) return
    setSubmitted(true)
    if (!isValid) {
      toast({ title: tFallback(t, "admin.validationTitle", "Check the form"), description: tFallback(t, "admin.fixValidation", "Some required information is missing or invalid."), variant: "error" })
      return
    }
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
        const createdName = form.name
        const createdFloorId = effectiveFloorId
        await onRefresh()
        setSubmitted(false)
        setLastCreated({ name: createdName, floorId: createdFloorId })
        setForm((current) => ({
          ...current,
          name: "",
          svgElementId: "",
          qrCodeValue: "",
          capacity: 1,
        }))
        toast({ title: t("admin.createSuccess"), description: t("admin.workspaceCreated"), variant: "success" })
      } else {
        const message = await readApiError(res, t("admin.createFailed"))
        toast({ title: t("admin.createFailed"), description: message, variant: "error" })
      }
    } catch {
      toast({ title: t("admin.createFailed"), description: t("admin.networkError"), variant: "error" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleReview = async (workspaceId: string, approvalStatus: "approved" | "rejected") => {
    if (!token || !isAdmin) return
    setIsSaving(true)
    try {
      const res = await fetch(`${apiBaseUrl}/workspaces/${workspaceId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          approvalStatus,
          rejectionReason: approvalStatus === "rejected" ? "Rejected by System Admin" : undefined,
        }),
      })

      if (res.ok) {
        await onRefresh()
        toast({
          title: approvalStatus === "approved" ? "Workspace approved" : "Workspace rejected",
          variant: "success",
        })
      } else {
        const message = await readApiError(res, "Could not review workspace.")
        toast({ title: "Review failed", description: message, variant: "error" })
      }
    } catch {
      toast({ title: "Review failed", description: t("admin.networkError"), variant: "error" })
    } finally {
      setIsSaving(false)
    }
  }

  const openLastCreatedOnMap = React.useCallback(() => {
    if (!lastCreated) return
    const floor = floors.find((item) => item.id === lastCreated.floorId)
    const params = new URLSearchParams({ floorId: lastCreated.floorId })
    if (floor?.building_id) params.set("buildingId", floor.building_id)
    router.push(`/floor-map?${params.toString()}`)
  }, [floors, lastCreated, router])

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
        {workspaces.map((w: Workspace) => (
          <Card key={w.id} className={cn("group relative overflow-hidden transition-all hover:border-blue-300", adminCardClass)}>
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <MapPin size={80} />
             </div>
             <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                   <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-primary-500/10 dark:text-primary-400">
                      <MapPin size={24} />
                   </div>
                   <div>
                      <h4 className="text-lg font-black text-slate-950 dark:text-white">{w.name}</h4>
                      <p className="text-xs font-semibold text-slate-500">{w.type.toUpperCase()} • {t("admin.capacity")}: {w.capacity}</p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">{w.approval_status ?? "approved"}</p>
                   </div>
                </div>
                <div className="flex items-center justify-between mt-6">
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t("admin.svgId")}: {w.svg_element_id}</span>
                   <Button variant="ghost" size="sm" className="text-primary-500 font-bold hover:bg-primary-500/10">{t("admin.edit")}</Button>
                </div>
                {isAdmin && w.approval_status === "pending_approval" && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button className="h-10 rounded-xl bg-emerald-600 font-black hover:bg-emerald-700" onClick={() => handleReview(w.id, "approved")} disabled={isSaving}>
                      Approve
                    </Button>
                    <Button variant="outline" className="h-10 rounded-xl border-rose-200 font-black text-rose-600 hover:bg-rose-50 dark:border-rose-500/20 dark:text-rose-300 dark:hover:bg-rose-500/10" onClick={() => handleReview(w.id, "rejected")} disabled={isSaving}>
                      Reject
                    </Button>
                  </div>
                )}
             </CardContent>
          </Card>
        ))}
      </div>

      <Card className={cn("h-fit lg:sticky lg:top-8", adminCardClass)}>
        <CardHeader>
          <CardTitle>{t("admin.newWorkspace")}</CardTitle>
          <CardDescription>{t("admin.levelManagementDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {lastCreated && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-slate-950 dark:text-white">{tFallback(t, "admin.workspaceReady", "Workspace created")}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{lastCreated.name}</p>
                  <Button className="mt-3 h-10 w-full rounded-xl bg-emerald-600 font-black hover:bg-emerald-700" onClick={openLastCreatedOnMap}>
                    <ExternalLink size={16} className="mr-2" />
                    {tFallback(t, "admin.viewOnFloorMap", "Check on Floor Map")}
                  </Button>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <label className={adminLabelClass}>{t("admin.selectFloor")}</label>
            <select
              className={adminSelectClass}
              value={effectiveFloorId}
              onChange={(e) => setForm({ ...form, floorId: e.target.value })}
            >
              {floors.map((floor) => (
                <option key={floor.id} value={floor.id} className="bg-white text-slate-950 dark:bg-slate-900 dark:text-white">
                  {describeFloor(floor)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className={adminLabelClass}>{t("admin.workspaceName")}</label>
            <Input placeholder={t("admin.workspaceNamePlaceholder")} className={adminInputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <FieldError show={submitted && !form.name.trim()}>{tFallback(t, "admin.validation.required", "This field is required.")}</FieldError>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className={adminLabelClass}>{t("admin.workspaceType")}</label>
              <select className={adminSelectClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {["desk", "meeting_room", "focus_room", "lab", "room", "parking"].map((type) => (
                  <option key={type} value={type} className="bg-white text-slate-950 dark:bg-slate-900 dark:text-white">{type}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className={adminLabelClass}>{t("admin.workspaceStatus")}</label>
              <select className={adminSelectClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {["available", "maintenance", "inactive"].map((status) => (
                  <option key={status} value={status} className="bg-white text-slate-950 dark:bg-slate-900 dark:text-white">{status}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className={adminLabelClass}>{t("admin.svgId")}</label>
            <Input placeholder={t("admin.svgIdPlaceholder")} className={adminInputClass} value={form.svgElementId} onChange={(e) => setForm({ ...form, svgElementId: e.target.value })} />
            <FieldError show={submitted && !form.svgElementId.trim()}>{tFallback(t, "admin.validation.required", "This field is required.")}</FieldError>
          </div>
          <div className="space-y-2">
            <label className={adminLabelClass}>{t("admin.qrCodeValue")}</label>
            <Input placeholder={t("admin.qrCodePlaceholder")} className={adminInputClass} value={form.qrCodeValue} onChange={(e) => setForm({ ...form, qrCodeValue: e.target.value })} />
            <FieldError show={submitted && !form.qrCodeValue.trim()}>{tFallback(t, "admin.validation.required", "This field is required.")}</FieldError>
          </div>
          <div className="space-y-2">
            <label className={adminLabelClass}>{t("admin.capacity")}</label>
            <Input type="number" min={1} max={50} className={adminInputClass} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) })} />
            <FieldError show={submitted && (!Number.isFinite(form.capacity) || form.capacity < 1)}>{tFallback(t, "admin.validation.positiveNumber", "Enter a number greater than zero.")}</FieldError>
          </div>
          <Button
            className="w-full bg-primary-600 hover:bg-primary-700 h-12 font-black"
            onClick={handleCreate}
            disabled={!effectiveFloorId}
            isLoading={isSaving}
            loadingText={t("admin.saving")}
          >
            <Plus className="mr-2" size={18} /> {t("admin.createWorkspace")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function SvgMapper({ floors, onRefresh, apiBaseUrl, token }: SvgMapperProps) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [selectedFloorId, setSelectedFloorId] = React.useState("")
  const [file, setFile] = React.useState<File | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [isLoadingSvg, setIsLoadingSvg] = React.useState(false)
  const [svgIds, setSvgIds] = React.useState<string[]>([])
  const selectedFloor = floors.find((floor) => floor.id === selectedFloorId) ?? null

  const loadSvgIds = React.useCallback(async (floorId: string) => {
    if (!floorId || !token) {
      setSvgIds([])
      return
    }

    const floor = floors.find((item) => item.id === floorId)
    if (!floor?.svg_map_url) {
      setSvgIds([])
      return
    }

    setIsLoadingSvg(true)
    try {
      const res = await fetch(`${apiBaseUrl}/floors/${floorId}/svg`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        const message = await readApiError(res, tFallback(t, "admin.svgIdLoadFailed", "Could not read SVG IDs."))
        toast({ title: tFallback(t, "admin.svgIdLoadFailed", "Could not read SVG IDs."), description: message, variant: "error" })
        setSvgIds([])
        return
      }

      const svgText = await res.text()
      const ids = Array.from(svgText.matchAll(/\sid=["']([^"']+)["']/g)).map((match) => match[1]).filter(Boolean)
      setSvgIds(Array.from(new Set(ids)))
    } catch {
      toast({ title: tFallback(t, "admin.svgIdLoadFailed", "Could not read SVG IDs."), description: t("admin.networkError"), variant: "error" })
      setSvgIds([])
    } finally {
      setIsLoadingSvg(false)
    }
  }, [apiBaseUrl, floors, t, toast, token])

  const copySvgId = async (svgId: string) => {
    try {
      await navigator.clipboard.writeText(svgId)
      toast({ title: tFallback(t, "admin.svgIdCopied", "SVG ID copied."), description: svgId, variant: "success" })
    } catch {
      toast({ title: tFallback(t, "admin.copyFailed", "Could not copy SVG ID."), description: svgId, variant: "error" })
    }
  }

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
      if (res.ok) {
        toast({ title: t("admin.svgUploaded"), variant: "success" })
        setFile(null)
        await onRefresh()
        await loadSvgIds(selectedFloorId)
      } else {
        const message = await readApiError(res, t("admin.uploadFailed"))
        toast({ title: t("admin.uploadFailed"), description: message, variant: "error" })
      }
    } catch {
      toast({ title: t("admin.uploadFailed"), description: t("admin.networkError"), variant: "error" })
    } finally { setIsUploading(false) }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <Card className={cn("flex min-h-[600px] flex-col lg:col-span-3", adminCardClass)}>
        <CardHeader className="border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
          <CardTitle>{t("admin.floorMappingVisualizer")}</CardTitle>
          <CardDescription>{t("admin.floorMappingDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 p-6 sm:p-8">
          {!selectedFloorId ? (
            <div className="flex min-h-[460px] items-center justify-center text-center">
              <div className="space-y-6">
                <div className="w-24 h-24 rounded-3xl bg-blue-500/10 flex items-center justify-center text-blue-500 mx-auto">
                  <FileCode size={48} />
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl font-black text-slate-950 dark:text-white">{t("admin.mappingConsole")}</h4>
                  <p className="max-w-md font-semibold text-slate-500">{t("admin.mappingConsoleDesc")}</p>
                </div>
              </div>
            </div>
          ) : !selectedFloor?.svg_map_url ? (
            <div className="flex min-h-[460px] items-center justify-center text-center">
              <div className="max-w-md space-y-4">
                <Upload size={48} className="mx-auto text-amber-400" />
                <h4 className="text-xl font-black text-slate-950 dark:text-white">{tFallback(t, "admin.svgRequiredTitle", "Upload an SVG map first")}</h4>
                <p className="text-sm font-semibold leading-relaxed text-slate-500 dark:text-slate-400">{tFallback(t, "admin.svgRequiredDesc", "This floor does not have an SVG map yet. Upload the map on the right, then copy the detected element IDs into workspace setup.")}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-xl font-black text-slate-950 dark:text-white">{tFallback(t, "admin.detectedSvgIds", "Detected SVG IDs")}</h4>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{tFallback(t, "admin.detectedSvgIdsDesc", "Click any ID to copy it, then paste it into the workspace SVG ID field.")}</p>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  {svgIds.length} {tFallback(t, "admin.idsFound", "IDs found")}
                </div>
              </div>

              {isLoadingSvg ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                  {tFallback(t, "admin.loadingSvgIds", "Reading SVG IDs...")}
                </div>
              ) : svgIds.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {svgIds.map((svgId) => (
                    <button
                      key={svgId}
                      type="button"
                      onClick={() => copySvgId(svgId)}
                      className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition-all hover:border-blue-300 hover:bg-blue-50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-primary-500/30 dark:hover:bg-primary-500/10"
                    >
                      <span className="min-w-0 truncate font-mono text-sm font-bold text-slate-950 dark:text-white">{svgId}</span>
                      <Copy size={16} className="shrink-0 text-slate-500 transition-colors group-hover:text-primary-400" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6 text-sm font-medium text-amber-100">
                  {tFallback(t, "admin.noSvgIdsFound", "No SVG IDs were found. Add id attributes to desk/room elements in the SVG file.")}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className={adminCardClass}>
          <CardHeader>
            <CardTitle>{t("admin.uploadAssets")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="space-y-2">
               <label className={adminLabelClass}>{t("admin.targetFloor")}</label>
               <select
                 className={adminSelectClass}
                 onChange={(e) => {
                   const nextFloorId = e.target.value
                   setSelectedFloorId(nextFloorId)
                   void loadSvgIds(nextFloorId)
                 }}
                 value={selectedFloorId}
               >
                  <option value="">{t("admin.selectFloor")}</option>
                  {floors.map((f) => (
                    <option key={f.id} value={f.id} className="bg-white text-slate-950 dark:bg-slate-900 dark:text-white">{f.name || t("common.floorFallback").replace("{number}", String(f.floor_number))}</option>
                  ))}
               </select>
             </div>
             <div className="space-y-2">
               <label className={adminLabelClass}>{t("admin.svgSource")}</label>
               <div className="relative flex h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition-all hover:bg-blue-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/5">
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept=".svg" onChange={e => setFile(e.target.files?.[0] || null)} />
                  <Upload size={32} className="text-slate-500 mb-2" />
                  <p className="text-xs text-slate-500 font-bold">{file ? file.name : t("admin.chooseSvg")}</p>
               </div>
             </div>
             <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700 h-12 font-black" onClick={handleUpload} disabled={!file || !selectedFloorId} isLoading={isUploading} loadingText={t("admin.uploading")}>
               {t("admin.syncAssets")}
             </Button>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50 dark:border-primary-500/20 dark:bg-primary-500/5">
          <CardContent className="p-6">
            <div className="flex gap-4">
              <Info className="text-primary-500 shrink-0" size={24} />
              <div className="space-y-1">
                <h4 className="text-sm font-black text-slate-950 dark:text-white">{t("admin.systemTip")}</h4>
                <p className="text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-400">{t("admin.systemTipDesc")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
