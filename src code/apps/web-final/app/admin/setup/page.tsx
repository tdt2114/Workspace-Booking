"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Building2, Layers, MapPin, Plus, Save, Trash2, Upload, AlertCircle, ChevronRight, ChevronDown, FileCode, Info, CheckCircle2, CircleDot, ExternalLink, Copy, UserCog, Settings, ShieldCheck, Search, Users, Clock, Ban, QrCode, CalendarClock, Wrench } from "lucide-react"
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
type ConsoleModule = "space-setup" | "approvals" | "users" | "tools"

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
  owner_id?: string | null
  name: string
  type: string
  status: string
  approval_status?: string
  rejection_reason?: string | null
  approved_at?: string | null
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
  reviewed_at?: string | null
}

interface UserRecord {
  id: string
  email: string
  full_name: string | null
  role: "user" | "space_owner" | "admin"
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
  floors: Floor[]
  workspaces: Workspace[]
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
  users: UserRecord[]
  currentUserId: string | null
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
  compact?: boolean
}

// --- Main Component ---
export default function AdminSetupPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const { toast } = useToast()
  const apiBaseUrl = React.useMemo(() => getBrowserApiBaseUrl(), [])
  const [session, setSession] = React.useState<Session | null>(null)
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null)
  const [userRole, setUserRole] = React.useState<string | null>(null)
  const [activeModule, setActiveModule] = React.useState<ConsoleModule>("space-setup")
  const [activeTab, setActiveTab] = React.useState<Tab>("buildings")
  
  const [buildings, setBuildings] = React.useState<Building[]>([])
  const [floors, setFloors] = React.useState<Floor[]>([])
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([])
  const [ownerRequests, setOwnerRequests] = React.useState<OwnerRequest[]>([])
  const [users, setUsers] = React.useState<UserRecord[]>([])
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

  const loadUsers = React.useCallback(async (token: string) => {
    const res = await fetch(`${apiBaseUrl}/users`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      const data = await res.json() as ListResponse<UserRecord>
      setUsers(data.items ?? [])
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
      setCurrentUserId(currentSession.user.id)
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
        if (role === "admin") {
          await Promise.all([
            loadOwnerRequests(currentSession.access_token),
            loadUsers(currentSession.access_token),
          ])
        } else if (role === "space_owner") {
          setActiveTab("svg-mapping")
        }
      }
      await loadData(currentSession.access_token ?? "")
    }
    void bootstrap()
  }, [apiBaseUrl, loadData, loadOwnerRequests, loadUsers, router])

  const handleOwnerRequestReview = async (id: string, status: "approved" | "rejected") => {
    if (!accessToken || !isAdmin) return
    try {
      const res = await fetch(`${apiBaseUrl}/space-owner-requests/${id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ status, reviewNote: status === "approved" ? "Approved by System Admin" : "Rejected by System Admin" }),
      })
      if (res.ok) {
        await Promise.all([loadOwnerRequests(accessToken), loadUsers(accessToken)])
        toast({ title: status === "approved" ? "Space Owner approved" : "Space Owner rejected", variant: "success" })
      } else {
        const message = await readApiError(res, "Could not review request.")
        toast({ title: "Review failed", description: message, variant: "error" })
      }
    } catch {
      toast({ title: "Review failed", description: t("admin.networkError"), variant: "error" })
    }
  }

  const handleWorkspaceReview = async (workspaceId: string, approvalStatus: "approved" | "rejected" | "hidden") => {
    if (!accessToken || !isAdmin) return
    try {
      const res = await fetch(`${apiBaseUrl}/workspaces/${workspaceId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          approvalStatus,
          rejectionReason: approvalStatus === "approved" ? undefined : `${approvalStatus} by System Admin`,
        }),
      })

      if (res.ok) {
        await loadData(accessToken)
        toast({ title: `Workspace ${approvalStatus.replace("_", " ")}`, variant: "success" })
      } else {
        const message = await readApiError(res, "Could not review workspace.")
        toast({ title: "Review failed", description: message, variant: "error" })
      }
    } catch {
      toast({ title: "Review failed", description: t("admin.networkError"), variant: "error" })
    }
  }

  if (loading && !session) return null

  const isAdmin = userRole === "admin"

  return (
    <DashboardLayout>
      <SystemConsolePage
        buildings={buildings}
        floors={floors}
        workspaces={workspaces}
        ownerRequests={ownerRequests}
        users={users}
        currentUserId={currentUserId}
        activeModule={activeModule}
        activeTab={activeTab}
        apiBaseUrl={apiBaseUrl}
        token={tokenForUi}
        userRole={userRole}
        onSelectModule={setActiveModule}
        onSelectTab={setActiveTab}
        onRefresh={() => loadData(tokenForUi)}
        onRefreshUsers={() => accessToken ? loadUsers(accessToken) : Promise.resolve()}
        onReviewOwnerRequest={handleOwnerRequestReview}
        onReviewWorkspace={handleWorkspaceReview}
      >
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertCircle size={18} />
            {error}
          </motion.div>
        )}
      </SystemConsolePage>
    </DashboardLayout>
  )
}

interface SystemConsolePageProps {
  buildings: Building[]
  floors: Floor[]
  workspaces: Workspace[]
  ownerRequests: OwnerRequest[]
  users: UserRecord[]
  currentUserId: string | null
  activeModule: ConsoleModule
  activeTab: Tab
  apiBaseUrl: string
  token: string
  userRole: string | null
  children?: React.ReactNode
  onSelectModule: (module: ConsoleModule) => void
  onSelectTab: (tab: Tab) => void
  onRefresh: () => Promise<void>
  onRefreshUsers: () => Promise<void>
  onReviewOwnerRequest: (id: string, status: "approved" | "rejected") => Promise<void>
  onReviewWorkspace: (id: string, status: "approved" | "rejected" | "hidden") => Promise<void>
}

function SystemConsolePage({
  buildings,
  floors,
  workspaces,
  ownerRequests,
  users,
  currentUserId,
  activeModule,
  activeTab,
  apiBaseUrl,
  token,
  userRole,
  children,
  onSelectModule,
  onSelectTab,
  onRefresh,
  onRefreshUsers,
  onReviewOwnerRequest,
  onReviewWorkspace,
}: SystemConsolePageProps) {
  const pendingSpaces = workspaces.filter((workspace) => workspace.approval_status === "pending_approval")
  const pendingOwnerRequests = ownerRequests.filter((request) => request.status === "pending")

  return (
    <div className="space-y-6 sm:space-y-8">
      {children}
      <StatsCards
        buildings={buildings.length}
        floors={floors.length}
        spaces={workspaces.length}
        pendingSpaces={pendingSpaces.length}
        ownerRequests={pendingOwnerRequests.length}
      />

      <ModuleNav
        activeModule={activeModule}
        pendingCount={pendingSpaces.length + pendingOwnerRequests.length}
        userRole={userRole}
        onSelectModule={onSelectModule}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={activeModule}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {activeModule === "space-setup" ? (
            <SpaceSetupModule
              activeTab={activeTab}
              buildings={buildings}
              floors={floors}
              workspaces={workspaces}
              users={users}
              currentUserId={currentUserId}
              apiBaseUrl={apiBaseUrl}
              token={token}
              userRole={userRole}
              onSelectTab={onSelectTab}
              onRefresh={onRefresh}
            />
          ) : null}
          {activeModule === "approvals" ? (
            <ApprovalsModule
              ownerRequests={ownerRequests}
              workspaces={workspaces}
              buildings={buildings}
              floors={floors}
              users={users}
              onReviewOwnerRequest={onReviewOwnerRequest}
              onReviewWorkspace={onReviewWorkspace}
            />
          ) : null}
          {activeModule === "users" ? (
            <UserManagementModule apiBaseUrl={apiBaseUrl} token={token} users={users} onRefreshUsers={onRefreshUsers} />
          ) : null}
          {activeModule === "tools" ? <SystemToolsModule /> : null}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function StatsCards({
  buildings,
  floors,
  spaces,
  pendingSpaces,
  ownerRequests,
}: {
  buildings: number
  floors: number
  spaces: number
  pendingSpaces: number
  ownerRequests: number
}) {
  const stats = [
    { label: "Buildings", value: buildings, description: "Managed facilities", icon: Building2 },
    { label: "Floors", value: floors, description: "Configured levels", icon: Layers },
    { label: "Spaces", value: spaces, description: "Bookable desks & rooms", icon: MapPin },
    { label: "Pending spaces", value: pendingSpaces, description: "Workspace approvals", icon: CheckCircle2, alert: pendingSpaces > 0 },
    { label: "Owner requests", value: ownerRequests, description: "Waiting approval", icon: Plus, alert: ownerRequests > 0 },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {stats.map((item) => {
        const Icon = item.icon

        return (
          <ConsoleCard key={item.label} className="min-h-[150px] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
                <p className="mt-4 text-4xl font-black tracking-tight text-slate-950 dark:text-white">{item.value}</p>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600 dark:text-slate-300">{item.description}</p>
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                <Icon size={21} />
              </div>
            </div>
            {item.alert ? <span className="mt-2 inline-block h-2 w-2 rounded-full bg-amber-500" /> : null}
          </ConsoleCard>
        )
      })}
    </div>
  )
}

function ModuleNav({
  activeModule,
  pendingCount,
  userRole,
  onSelectModule,
}: {
  activeModule: ConsoleModule
  pendingCount: number
  userRole: string | null
  onSelectModule: (module: ConsoleModule) => void
}) {
  const isAdmin = userRole === "admin"
  const modules = [
    { key: "space-setup", label: isAdmin ? "Space Setup" : "My Spaces", icon: Building2, show: true },
    { key: "approvals", label: "Approvals", icon: ShieldCheck, badge: pendingCount, show: isAdmin },
    { key: "users", label: "User Management", icon: UserCog, show: isAdmin },
    { key: "tools", label: "System Tools", icon: Settings, show: isAdmin },
  ].filter((item) => item.show) as Array<{
    key: ConsoleModule
    label: string
    icon: React.ElementType
    badge?: number
    show: boolean
  }>

  return (
    <ConsoleCard className="p-2">
      <div className="grid gap-2 md:grid-cols-4">
        {modules.map((item) => {
          const Icon = item.icon
          const active = activeModule === item.key

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelectModule(item.key)}
              className={cn(
                "relative flex min-h-14 items-center justify-center gap-3 rounded-2xl px-4 text-sm font-black transition-all",
                active ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/10",
              )}
            >
              <Icon size={18} />
              {item.label}
              {item.badge ? (
                <span className={cn(
                  "ml-1 rounded-full px-2 py-0.5 text-xs font-black",
                  active ? "bg-white/20 text-white" : "bg-rose-100 text-rose-600",
                )}>
                  {item.badge}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </ConsoleCard>
  )
}

function SpaceSetupModule({
  activeTab,
  buildings,
  floors,
  workspaces,
  users,
  currentUserId,
  apiBaseUrl,
  token,
  userRole,
  onSelectTab,
  onRefresh,
}: {
  activeTab: Tab
  buildings: Building[]
  floors: Floor[]
  workspaces: Workspace[]
  users: UserRecord[]
  currentUserId: string | null
  apiBaseUrl: string
  token: string
  userRole: string | null
  onSelectTab: (tab: Tab) => void
  onRefresh: () => Promise<void>
}) {
  const { t } = useLanguage()
  const isAdmin = userRole === "admin"
  const allowedTabs: Tab[] = isAdmin
    ? ["buildings", "floors", "svg-mapping", "workspaces"]
    : ["svg-mapping", "workspaces"]
  const effectiveActiveTab = allowedTabs.includes(activeTab)
    ? activeTab
    : allowedTabs[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">{isAdmin ? "Space Setup" : "My Spaces"}</h1>
          <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
            {isAdmin
              ? "Manage buildings, floors, SVG maps and bookable workspaces."
              : "Upload floor maps, copy SVG element IDs, and propose workspaces for approval."}
          </p>
        </div>
        {isAdmin ? (
          <Button className="h-12 rounded-2xl bg-blue-600 px-6 font-black hover:bg-blue-700" onClick={() => onSelectTab("buildings")}>
            <Plus size={17} className="mr-2" />
            Create Building
          </Button>
        ) : (
          <Button className="h-12 rounded-2xl bg-blue-600 px-6 font-black hover:bg-blue-700" onClick={() => onSelectTab("workspaces")}>
            <Plus size={17} className="mr-2" />
            New Workspace
          </Button>
        )}
      </div>

      <SetupGuide buildings={buildings} floors={floors} workspaces={workspaces} activeTab={effectiveActiveTab} onSelectTab={onSelectTab} compact />

      <ConsoleCard className="overflow-hidden">
        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 p-4 dark:border-white/10">
          {isAdmin ? (
            <>
              <TabButton active={effectiveActiveTab === "buildings"} onClick={() => onSelectTab("buildings")} icon={<Building2 size={16} />} label={t("admin.tabs.buildings")} />
              <TabButton active={effectiveActiveTab === "floors"} onClick={() => onSelectTab("floors")} icon={<Layers size={16} />} label={t("admin.tabs.floors")} />
            </>
          ) : null}
          <TabButton active={effectiveActiveTab === "svg-mapping"} onClick={() => onSelectTab("svg-mapping")} icon={<Upload size={16} />} label={t("admin.tabs.svgMapping")} />
          <TabButton active={effectiveActiveTab === "workspaces"} onClick={() => onSelectTab("workspaces")} icon={<MapPin size={16} />} label={t("admin.tabs.workspaces")} />
        </div>
        <div className="p-5 sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {effectiveActiveTab === "buildings" && isAdmin ? <BuildingPanel buildings={buildings} floors={floors} workspaces={workspaces} onRefresh={onRefresh} apiBaseUrl={apiBaseUrl} token={token} /> : null}
              {effectiveActiveTab === "floors" && isAdmin ? <FloorPanel floors={floors} buildings={buildings} onRefresh={onRefresh} apiBaseUrl={apiBaseUrl} token={token} /> : null}
              {effectiveActiveTab === "workspaces" ? <WorkspacePanel workspaces={workspaces} floors={floors} buildings={buildings} users={users} currentUserId={currentUserId} onRefresh={onRefresh} apiBaseUrl={apiBaseUrl} token={token} userRole={userRole} /> : null}
              {effectiveActiveTab === "svg-mapping" ? <SvgMapper floors={floors} onRefresh={onRefresh} apiBaseUrl={apiBaseUrl} token={token} /> : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </ConsoleCard>
    </div>
  )
}

function ApprovalsModule({
  ownerRequests,
  workspaces,
  buildings,
  floors,
  users,
  onReviewOwnerRequest,
  onReviewWorkspace,
}: {
  ownerRequests: OwnerRequest[]
  workspaces: Workspace[]
  buildings: Building[]
  floors: Floor[]
  users: UserRecord[]
  onReviewOwnerRequest: (id: string, status: "approved" | "rejected") => Promise<void>
  onReviewWorkspace: (id: string, status: "approved" | "rejected" | "hidden") => Promise<void>
}) {
  const pendingOwnerRequests = ownerRequests.filter((request) => request.status === "pending")
  const pendingWorkspaces = workspaces.filter((workspace) => workspace.approval_status === "pending_approval")
  const userById = new Map(users.map((user) => [user.id, user]))

  const describeWorkspaceLocation = (workspace: Workspace) => {
    const floor = floors.find((item) => item.id === workspace.floor_id)
    const building = floor ? buildings.find((item) => item.id === floor.building_id) : null

    return {
      building: building?.name ?? "Unknown building",
      floor: floor?.name ?? (floor ? `Floor ${floor.floor_number}` : "Unknown floor"),
      owner: workspace.owner_id ? userById.get(workspace.owner_id) : null,
    }
  }

  return (
    <div className="space-y-6">
      <ModuleHeading title="Approvals" description="Review access upgrades and submitted workspaces before they become public." />

      <div className="grid gap-6 xl:grid-cols-2">
        <ConsoleCard className="p-5 sm:p-6">
          <SectionHeader title="Space Owner Requests" description="Users waiting for permission to publish and manage their own spaces." count={pendingOwnerRequests.length} />
          <div className="mt-5 space-y-3">
            {pendingOwnerRequests.length ? pendingOwnerRequests.map((request) => {
              const user = userById.get(request.user_id)

              return (
                <ApprovalRow key={request.id}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-slate-950 dark:text-white">{user?.full_name || "User request"}</p>
                      <StatusBadge status={request.status} />
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">{user?.email ?? request.user_id}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Organization: {request.message || "Not provided"} • Requested {formatConsoleDate(request.created_at)}</p>
                  </div>
                  <ApprovalActions
                    onApprove={() => void onReviewOwnerRequest(request.id, "approved")}
                    onReject={() => void onReviewOwnerRequest(request.id, "rejected")}
                  />
                </ApprovalRow>
              )
            }) : <EmptyConsoleState label="No pending owner requests." />}
          </div>
        </ConsoleCard>

        <ConsoleCard className="p-5 sm:p-6">
          <SectionHeader title="Workspace Approval Queue" description="Spaces submitted by Space Owners before public booking." count={pendingWorkspaces.length} />
          <div className="mt-5 space-y-3">
            {pendingWorkspaces.length ? pendingWorkspaces.map((workspace) => {
              const location = describeWorkspaceLocation(workspace)

              return (
                <ApprovalRow key={workspace.id}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-slate-950 dark:text-white">{workspace.name}</p>
                      <StatusBadge status={workspace.approval_status ?? "pending_approval"} />
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">{location.building} • {location.floor}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Owner: {location.owner?.email ?? workspace.owner_id ?? "Unknown"} • Submitted {formatConsoleDate(workspace.approved_at ?? "")}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:flex">
                    <Button size="sm" className="rounded-xl bg-emerald-600 font-black hover:bg-emerald-700" onClick={() => void onReviewWorkspace(workspace.id, "approved")}>Approve</Button>
                    <Button size="sm" variant="outline" className="rounded-xl border-rose-200 font-black text-rose-600 hover:bg-rose-50" onClick={() => void onReviewWorkspace(workspace.id, "rejected")}>Reject</Button>
                    <Button size="sm" variant="outline" className="rounded-xl font-black" onClick={() => void onReviewWorkspace(workspace.id, "hidden")}>Hide</Button>
                  </div>
                </ApprovalRow>
              )
            }) : <EmptyConsoleState label="No workspace is waiting for approval." />}
          </div>
        </ConsoleCard>
      </div>
    </div>
  )
}

function UserManagementModule({
  apiBaseUrl,
  token,
  users,
  onRefreshUsers,
}: {
  apiBaseUrl: string
  token: string
  users: UserRecord[]
  onRefreshUsers: () => Promise<void>
}) {
  const { toast } = useToast()
  const [search, setSearch] = React.useState("")
  const [roleFilter, setRoleFilter] = React.useState<"all" | "user" | "space_owner" | "admin" | "blocked">("all")
  const [form, setForm] = React.useState({ email: "", password: "", fullName: "", role: "admin" })
  const [isSaving, setIsSaving] = React.useState(false)

  const filteredUsers = users.filter((user) => {
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || `${user.email} ${user.full_name ?? ""}`.toLowerCase().includes(query)
    const matchesRole = roleFilter === "all" ? true : roleFilter === "blocked" ? false : user.role === roleFilter
    return matchesSearch && matchesRole
  })

  const createAdmin = async () => {
    if (!form.email.trim() || !form.password.trim()) {
      toast({ title: "Missing information", description: "Email and password are required.", variant: "error" })
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch(`${apiBaseUrl}/users/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          fullName: form.fullName.trim() || undefined,
          role: form.role,
        }),
      })

      if (res.ok) {
        const roleLabel = form.role === "space_owner" ? "Space Owner" : "Admin"
        setForm({ email: "", password: "", fullName: "", role: "admin" })
        await onRefreshUsers()
        toast({ title: `${roleLabel} account created`, variant: "success" })
      } else {
        const roleLabel = form.role === "space_owner" ? "space owner" : "admin"
        const message = await readApiError(res, `Could not create ${roleLabel} account.`)
        toast({ title: `Create ${roleLabel} failed`, description: message, variant: "error" })
      }
    } catch {
      toast({ title: "Create account failed", description: "Network error. Please try again.", variant: "error" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <ModuleHeading title="User Management" description="Search users, review roles and create trusted admin accounts." />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        <ConsoleCard className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <SectionHeader title="Users" description={`Showing ${filteredUsers.length}/${users.length} accounts.`} />
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <Input className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10 font-semibold text-slate-950" placeholder="Search name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <select className={cn(adminSelectClass, "h-11 min-w-40 rounded-2xl")} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}>
                {["all", "user", "space_owner", "admin", "blocked"].map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-5 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 dark:divide-white/10 dark:border-white/10">
            {filteredUsers.map((user) => (
              <div key={user.id} className="grid gap-3 bg-white p-4 dark:bg-white/[0.03] md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0">
                  <p className="truncate font-black text-slate-950 dark:text-white">{user.full_name || user.email}</p>
                  <p className="truncate text-sm font-semibold text-slate-500">{user.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={user.role} />
                  <span className="text-xs font-semibold text-slate-500">{formatConsoleDate(user.created_at)}</span>
                </div>
              </div>
            ))}
            {!filteredUsers.length ? <EmptyConsoleState label="No users match this filter." /> : null}
          </div>
        </ConsoleCard>

        <div className="space-y-6">
          <ConsoleCard className="p-5 sm:p-6">
            <SectionHeader title="Create Privileged Account" description="Create a new Admin or Space Owner account directly." />
            <div className="mt-5 space-y-4">
              <Input className={adminInputClass} placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              <Input className={adminInputClass} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input className={adminInputClass} placeholder="Temporary password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Account Role</label>
                <select className={cn(adminSelectClass, "h-12 w-full rounded-2xl")} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="admin">System Admin</option>
                  <option value="space_owner">Space Owner</option>
                </select>
              </div>
              <Button className="h-12 w-full rounded-2xl bg-blue-600 font-black hover:bg-blue-700" onClick={createAdmin} isLoading={isSaving} loadingText="Creating account...">
                <ShieldCheck size={17} className="mr-2" />
                Create Account
              </Button>
            </div>
          </ConsoleCard>
          <RoleGuideCard />
        </div>
      </div>
    </div>
  )
}

function SystemToolsModule() {
  const tools = [
    { title: "QR Assets", description: "Generate, copy and download physical QR labels.", icon: QrCode, href: "/workspace-qr", status: "Ready" },
    { title: "Global Bookings", description: "Review booking history, analytics and lifecycle status.", icon: CalendarClock, href: "/bookings", status: "Ready" },
    { title: "No-show Cleanup", description: "Maintenance action lives inside Global Bookings.", icon: Clock, href: "/bookings", status: "Ready" },
    { title: "System Maintenance", description: "Advanced audit and service health tools.", icon: Wrench, href: null, status: "Coming Soon" },
  ]

  return (
    <div className="space-y-6">
      <ModuleHeading title="System Tools" description="Shortcuts for operational tools and maintenance screens." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {tools.map((tool) => {
          const Icon = tool.icon
          const content = (
            <ConsoleCard className="h-full p-5 transition-all hover:-translate-y-0.5 hover:border-blue-300">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                <Icon size={21} />
              </div>
              <h3 className="mt-5 text-lg font-black text-slate-950 dark:text-white">{tool.title}</h3>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600 dark:text-slate-300">{tool.description}</p>
              <div className="mt-5 flex items-center justify-between">
                <StatusBadge status={tool.status.toLowerCase().replace(" ", "_")} />
                {tool.href ? <ExternalLink size={16} className="text-blue-500" /> : <Ban size={16} className="text-slate-400" />}
              </div>
            </ConsoleCard>
          )

          return tool.href ? <a key={tool.title} href={tool.href}>{content}</a> : <div key={tool.title}>{content}</div>
        })}
      </div>
    </div>
  )
}

function RoleGuideCard() {
  const roles = [
    { title: "User", description: "Browse workspaces, book spaces and check in by QR.", icon: Users },
    { title: "Space Owner", description: "Manage owned spaces after admin approval.", icon: Building2 },
    { title: "System Admin", description: "Full system access, approvals, users and tools.", icon: ShieldCheck },
  ]

  return (
    <ConsoleCard className="p-5 sm:p-6">
      <SectionHeader title="Role Guide" description="Permission model used across the console." />
      <div className="mt-5 space-y-3">
        {roles.map((role) => {
          const Icon = role.icon
          return (
            <div key={role.title} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Icon size={18} />
              </div>
              <div>
                <p className="font-black text-slate-950 dark:text-white">{role.title}</p>
                <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">{role.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </ConsoleCard>
  )
}

function ConsoleCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_18px_60px_-46px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-slate-950",
        className,
      )}
      {...props}
    />
  )
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status || "unknown"
  const palette: Record<string, string> = {
    approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
    active: "border-emerald-200 bg-emerald-50 text-emerald-700",
    ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
    pending: "border-amber-200 bg-amber-50 text-amber-700",
    pending_approval: "border-amber-200 bg-amber-50 text-amber-700",
    draft: "border-slate-200 bg-slate-50 text-slate-600",
    rejected: "border-rose-200 bg-rose-50 text-rose-700",
    hidden: "border-slate-300 bg-slate-100 text-slate-600",
    user: "border-blue-200 bg-blue-50 text-blue-700",
    space_owner: "border-cyan-200 bg-cyan-50 text-cyan-700",
    admin: "border-indigo-200 bg-indigo-50 text-indigo-700",
    coming_soon: "border-slate-200 bg-slate-50 text-slate-500",
  }

  return (
    <span className={cn("inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest", palette[normalized] ?? palette.draft)}>
      {normalized.replace("_", " ")}
    </span>
  )
}

function ModuleHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">{title}</h1>
      <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">{description}</p>
    </div>
  )
}

function SectionHeader({ title, description, count }: { title: string; description: string; count?: number }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-black text-slate-950 dark:text-white">{title}</h2>
        <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">{description}</p>
      </div>
      {typeof count === "number" ? (
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-600">
          {count} items
        </span>
      ) : null}
    </div>
  )
}

function ApprovalRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04] lg:grid-cols-[1fr_auto] lg:items-center">
      {children}
    </div>
  )
}

function ApprovalActions({ onApprove, onReject }: { onApprove: () => void; onReject: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex">
      <Button size="sm" variant="outline" className="rounded-xl font-black">Review</Button>
      <Button size="sm" className="rounded-xl bg-emerald-600 font-black hover:bg-emerald-700" onClick={onApprove}>Approve</Button>
      <Button size="sm" variant="outline" className="rounded-xl border-rose-200 font-black text-rose-600 hover:bg-rose-50" onClick={onReject}>Reject</Button>
    </div>
  )
}

function EmptyConsoleState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.03]">
      {label}
    </div>
  )
}

function formatConsoleDate(value: string) {
  if (!value) return "N/A"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "N/A"
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date)
}

function SetupGuide({ buildings, floors, workspaces, activeTab, onSelectTab, compact = false }: SetupGuideProps) {
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
    <ConsoleCard className="overflow-hidden">
      <div className={cn("p-5", compact ? "sm:p-5" : "sm:p-6")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-blue-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-300">
              <CircleDot size={14} />
              {t("admin.guide.title")}
            </div>
            <h2 className={cn("font-black text-slate-950 dark:text-white", compact ? "text-xl" : "text-2xl")}>{t("admin.guide.heading")}</h2>
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

        <div className={cn("grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5", compact ? "mt-4" : "mt-6")}>
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
                    "flex shrink-0 items-center justify-center rounded-full text-xs font-black",
                    compact ? "h-8 w-8" : "h-9 w-9",
                    step.done ? "bg-emerald-500 text-white" : "bg-white text-slate-500 shadow-sm dark:bg-white/10 dark:text-slate-400",
                  )}>
                    {step.done ? <CheckCircle2 size={18} /> : index + 1}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-black text-slate-950 dark:text-white">{step.label}</p>
                    {!compact ? <p className="text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-400">{step.description}</p> : null}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </ConsoleCard>
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

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
  isLoading?: boolean
}

function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isLoading = false
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-950"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-rose-600">
                <AlertCircle size={24} />
                <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">{title}</h3>
              </div>
              <p className="text-sm font-semibold leading-relaxed text-slate-600 dark:text-slate-300">{message}</p>
              <div className="flex gap-3 justify-end pt-4">
                <Button
                  variant="outline"
                  className="rounded-xl h-11 px-5 font-bold"
                  onClick={onCancel}
                  disabled={isLoading}
                >
                  {cancelText}
                </Button>
                <Button
                  className="rounded-xl h-11 px-5 font-black bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/20"
                  onClick={onConfirm}
                  isLoading={isLoading}
                >
                  {confirmText}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// --- Specialized setup panels ---

function BuildingPanel({ buildings, floors, workspaces, onRefresh, apiBaseUrl, token }: BuildingPanelProps) {
  const { t, locale } = useLanguage()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)
  const [form, setForm] = React.useState({ name: "", address: "", totalFloors: 1, openTime: "08:00", closeTime: "18:00" })
  const isValid = Boolean(form.name.trim()) && Number.isFinite(form.totalFloors) && form.totalFloors > 0 && Boolean(form.openTime) && Boolean(form.closeTime)

  // Hierarchical view state
  const [expandedBuildings, setExpandedBuildings] = React.useState<Record<string, boolean>>({})
  const [expandedFloors, setExpandedFloors] = React.useState<Record<string, boolean>>({})
  const [isDeleting, setIsDeleting] = React.useState<Record<string, boolean>>({})

  // Custom confirmation modal state
  const [confirmModal, setConfirmModal] = React.useState<{
    isOpen: boolean
    title: string
    message: string
    confirmText: string
    cancelText: string
    onConfirm: () => void
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "",
    cancelText: "",
    onConfirm: () => {}
  })

  // Floor form state
  const [addingFloorToBuildingId, setAddingFloorToBuildingId] = React.useState<string | null>(null)
  const [newFloorForm, setNewFloorForm] = React.useState({ floorNumber: 1, name: "" })

  // Workspace form state
  const [addingWorkspaceToFloorId, setAddingWorkspaceToFloorId] = React.useState<string | null>(null)
  const [newWorkspaceForm, setNewWorkspaceForm] = React.useState({
    name: "",
    type: "desk",
    status: "available",
    svgElementId: "",
    capacity: 1,
    qrCodeValue: "",
  })

  // SVG parsing / mapping state per floor
  const [floorSvgIds, setFloorSvgIds] = React.useState<Record<string, string[]>>({})
  const [loadingFloorSvgIds, setLoadingFloorSvgIds] = React.useState<Record<string, boolean>>({})
  const [uploadingSvgForFloorId, setUploadingSvgForFloorId] = React.useState<string | null>(null)
  const [syncingSvgForFloorId, setSyncingSvgForFloorId] = React.useState<string | null>(null)

  const normalizeSvgId = React.useCallback((id: string) => id.trim().replace(/^g[-_]/i, ""), [])

  const getBookableSvgIds = React.useCallback((ids: string[]) => {
    const blockedWords = ["wall", "door", "window", "label", "text", "icon", "legend", "outline", "corridor", "path", "grid", "zone", "background", "bg"]
    const bookableWords = ["desk", "room", "booth", "lab", "phone", "parking", "server", "pod", "seat", "office"]
    const byNormalizedId = new Map<string, string>()

    ids.forEach((rawId) => {
      const id = rawId.trim()
      if (!id) return
      const normalized = normalizeSvgId(id)
      const key = normalized.toLowerCase()
      const searchable = key.replace(/[-_]/g, " ")
      const hasBookableWord = bookableWords.some((word) => searchable.includes(word))
      const hasBlockedWord = blockedWords.some((word) => searchable.includes(word))

      if (!hasBookableWord || hasBlockedWord) return

      const existing = byNormalizedId.get(key)
      if (!existing || existing.startsWith("g-") || existing.startsWith("g_")) {
        byNormalizedId.set(key, id.startsWith("g-") || id.startsWith("g_") ? normalized : id)
      }
    })

    return Array.from(new Set(byNormalizedId.values()))
  }, [normalizeSvgId])

  const inferWorkspaceType = React.useCallback((svgId: string) => {
    const id = svgId.toLowerCase()
    if (id.includes("meeting") || id.includes("conference")) return "meeting_room"
    if (id.includes("focus") || id.includes("booth") || id.includes("phone") || id.includes("pod")) return "focus_room"
    if (id.includes("lab")) return "lab"
    if (id.includes("parking")) return "parking"
    if (id.includes("room") || id.includes("server")) return "room"
    return "desk"
  }, [])

  const inferWorkspaceCapacity = React.useCallback((type: string, svgId: string) => {
    const id = svgId.toLowerCase()
    if (type === "meeting_room") return 6
    if (type === "focus_room") return 1
    if (type === "lab") return 4
    if (id.includes("server")) return 1
    return 1
  }, [])

  const formatWorkspaceName = React.useCallback((svgId: string) => {
    const words = normalizeSvgId(svgId)
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")

    return words
      .map((word) => (/^\d+$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
      .join(" ")
  }, [normalizeSvgId])

  const loadFloorSvgIds = React.useCallback(async (floorId: string, force = false) => {
    if (!floorId || !token) return []
    const floor = floors.find((item) => item.id === floorId)
    if (!force && !floor?.svg_map_url) return []

    setLoadingFloorSvgIds(prev => ({ ...prev, [floorId]: true }))
    try {
      const res = await fetch(`${apiBaseUrl}/floors/${floorId}/svg`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const svgText = await res.text()
        const ids = Array.from(svgText.matchAll(/\sid=["']([^"']+)["']/g)).map((match) => match[1]).filter(Boolean)
        const uniqueIds = Array.from(new Set(ids))
        setFloorSvgIds(prev => ({ ...prev, [floorId]: uniqueIds }))
        return uniqueIds
      }
    } catch {
      // Ignore error loading SVG ids quietly
    } finally {
      setLoadingFloorSvgIds(prev => ({ ...prev, [floorId]: false }))
    }
    return []
  }, [apiBaseUrl, floors, token])

  const syncDetectedWorkspaces = React.useCallback(async (floorId: string, ids: string[], options?: { silent?: boolean }) => {
    if (!token) return 0
    const bookableIds = getBookableSvgIds(ids)
    const existingSvgIds = new Set(
      workspaces
        .filter((workspace) => workspace.floor_id === floorId)
        .map((workspace) => workspace.svg_element_id.trim().toLowerCase())
    )
    const missingIds = bookableIds.filter((id) => !existingSvgIds.has(id.toLowerCase()))

    if (!missingIds.length) {
      if (!options?.silent) {
        toast({
          title: "No new spaces to sync",
          description: "All detected bookable SVG IDs already have workspace records.",
          variant: "success",
        })
      }
      return 0
    }

    setSyncingSvgForFloorId(floorId)
    let createdCount = 0
    try {
      for (const svgId of missingIds) {
        const type = inferWorkspaceType(svgId)
        const body = {
          floorId,
          name: formatWorkspaceName(svgId),
          type,
          status: "available",
          svgElementId: svgId,
          qrCodeValue: svgId,
          capacity: inferWorkspaceCapacity(type, svgId),
        }

        let res = await fetch(`${apiBaseUrl}/workspaces`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })

        if (!res.ok) {
          const message = await readApiError(res, "")
          if (message.toLowerCase().includes("qrcodevalue")) {
            res = await fetch(`${apiBaseUrl}/workspaces`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ ...body, qrCodeValue: `${floorId.slice(0, 8)}_${svgId}` }),
            })
          } else {
            throw new Error(message || "Could not sync all detected workspaces.")
          }
        }

        if (res.ok) {
          createdCount += 1
        } else {
          const message = await readApiError(res, "Could not sync all detected workspaces.")
          throw new Error(message)
        }
      }

      if (!options?.silent) {
        toast({
          title: "SVG spaces synced",
          description: `Created ${createdCount} workspace${createdCount === 1 ? "" : "s"} from detected SVG IDs.`,
          variant: "success",
        })
      }
      await onRefresh()
      return createdCount
    } catch (error) {
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : t("admin.networkError"),
        variant: "error",
      })
      return createdCount
    } finally {
      setSyncingSvgForFloorId(null)
    }
  }, [apiBaseUrl, formatWorkspaceName, getBookableSvgIds, inferWorkspaceCapacity, inferWorkspaceType, onRefresh, t, toast, token, workspaces])

  const copySvgId = async (svgId: string) => {
    try {
      await navigator.clipboard.writeText(svgId)
      toast({ title: tFallback(t, "admin.svgIdCopied", "SVG ID copied."), description: svgId, variant: "success" })
    } catch {
      toast({ title: tFallback(t, "admin.copyFailed", "Could not copy SVG ID."), description: svgId, variant: "error" })
    }
  }

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

  const requestDeleteBuilding = (buildingId: string, name: string) => {
    const isVi = locale === "vi"
    setConfirmModal({
      isOpen: true,
      title: isVi ? "Xóa Tòa Nhà" : "Delete Building",
      message: isVi 
        ? `Bạn có chắc chắn muốn xóa tòa nhà "${name}" cùng tất cả các tầng và không gian làm việc trực thuộc? Hành động này không thể hoàn tác.`
        : `Are you sure you want to delete the building "${name}" and all its floors and workspaces? This action cannot be undone.`,
      confirmText: isVi ? "Xóa tòa nhà" : "Delete Building",
      cancelText: isVi ? "Hủy" : "Cancel",
      onConfirm: () => {
        void executeDeleteBuilding(buildingId)
      }
    })
  }

  const executeDeleteBuilding = async (buildingId: string) => {
    if (!token) return
    setIsDeleting(prev => ({ ...prev, [buildingId]: true }))
    setConfirmModal(prev => ({ ...prev, isOpen: false }))
    try {
      const res = await fetch(`${apiBaseUrl}/buildings/${buildingId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        toast({ title: locale === "vi" ? "Đã xóa tòa nhà thành công." : "Building deleted successfully.", variant: "success" })
        await onRefresh()
      } else {
        const message = await readApiError(res, "Could not delete building.")
        toast({ title: locale === "vi" ? "Xóa tòa nhà thất bại" : "Delete failed", description: message, variant: "error" })
      }
    } catch {
      toast({ title: locale === "vi" ? "Xóa tòa nhà thất bại" : "Delete failed", description: t("admin.networkError"), variant: "error" })
    } finally {
      setIsDeleting(prev => {
        const next = { ...prev }
        delete next[buildingId]
        return next
      })
    }
  }

  const handleCreateFloor = async (buildingId: string) => {
    if (!token) return
    const { floorNumber, name } = newFloorForm
    if (!floorNumber || floorNumber < -10 || floorNumber > 300) {
      toast({ title: "Invalid floor number", description: "Floor number must be between -10 and 300.", variant: "error" })
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch(`${apiBaseUrl}/floors`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          buildingId,
          floorNumber,
          name: name.trim() || undefined
        })
      })
      if (res.ok) {
        toast({ title: t("admin.floorCreated"), variant: "success" })
        setAddingFloorToBuildingId(null)
        setNewFloorForm({ floorNumber: 1, name: "" })
        await onRefresh()
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

  const requestDeleteFloor = (floorId: string, name: string) => {
    const isVi = locale === "vi"
    setConfirmModal({
      isOpen: true,
      title: isVi ? "Xóa Tầng" : "Delete Floor",
      message: isVi 
        ? `Bạn có chắc chắn muốn xóa tầng "${name}" cùng tất cả các không gian làm việc trực thuộc? Hành động này không thể hoàn tác.`
        : `Are you sure you want to delete the floor "${name}" and all its workspaces? This action cannot be undone.`,
      confirmText: isVi ? "Xóa tầng" : "Delete Floor",
      cancelText: isVi ? "Hủy" : "Cancel",
      onConfirm: () => {
        void executeDeleteFloor(floorId)
      }
    })
  }

  const executeDeleteFloor = async (floorId: string) => {
    if (!token) return
    setIsDeleting(prev => ({ ...prev, [floorId]: true }))
    setConfirmModal(prev => ({ ...prev, isOpen: false }))
    try {
      const res = await fetch(`${apiBaseUrl}/floors/${floorId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        toast({ title: locale === "vi" ? "Đã xóa tầng thành công." : "Floor deleted successfully.", variant: "success" })
        await onRefresh()
      } else {
        const message = await readApiError(res, "Could not delete floor.")
        toast({ title: locale === "vi" ? "Xóa tầng thất bại" : "Delete failed", description: message, variant: "error" })
      }
    } catch {
      toast({ title: locale === "vi" ? "Xóa tầng thất bại" : "Delete failed", description: t("admin.networkError"), variant: "error" })
    } finally {
      setIsDeleting(prev => {
        const next = { ...prev }
        delete next[floorId]
        return next
      })
    }
  }

  const handleFloorSvgUpload = async (floorId: string, file: File) => {
    if (!token) return
    setUploadingSvgForFloorId(floorId)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(`${apiBaseUrl}/floors/${floorId}/svg`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })
      if (res.ok) {
        toast({ title: t("admin.svgUploaded"), variant: "success" })
        const ids = await loadFloorSvgIds(floorId, true)
        const createdCount = await syncDetectedWorkspaces(floorId, ids, { silent: true })
        if (createdCount > 0) {
          toast({
            title: "SVG spaces synced",
            description: `Created ${createdCount} workspace${createdCount === 1 ? "" : "s"} from detected SVG IDs.`,
            variant: "success",
          })
        }
        await onRefresh()
      } else {
        const message = await readApiError(res, t("admin.uploadFailed"))
        toast({ title: t("admin.uploadFailed"), description: message, variant: "error" })
      }
    } catch {
      toast({ title: t("admin.uploadFailed"), description: t("admin.networkError"), variant: "error" })
    } finally {
      setUploadingSvgForFloorId(null)
    }
  }

  const requestClearFloorSvg = (floorId: string, name: string) => {
    const isVi = locale === "vi"
    setConfirmModal({
      isOpen: true,
      title: isVi ? "Xóa Sơ Đồ SVG" : "Clear SVG Map",
      message: isVi 
        ? `Bạn có chắc chắn muốn xóa sơ đồ SVG của tầng "${name}" không?`
        : `Are you sure you want to clear the SVG map for floor "${name}"?`,
      confirmText: isVi ? "Xóa sơ đồ" : "Clear Map",
      cancelText: isVi ? "Hủy" : "Cancel",
      onConfirm: () => {
        void executeClearFloorSvg(floorId)
      }
    })
  }

  const executeClearFloorSvg = async (floorId: string) => {
    if (!token) return
    setUploadingSvgForFloorId(floorId)
    setConfirmModal(prev => ({ ...prev, isOpen: false }))
    try {
      const res = await fetch(`${apiBaseUrl}/floors/${floorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ svgMapUrl: null })
      })
      if (res.ok) {
        toast({ title: locale === "vi" ? "Đã xóa sơ đồ SVG thành công." : "SVG map cleared successfully.", variant: "success" })
        setFloorSvgIds(prev => {
          const next = { ...prev }
          delete next[floorId]
          return next
        })
        await onRefresh()
      } else {
        const message = await readApiError(res, "Could not clear SVG map.")
        toast({ title: locale === "vi" ? "Xóa sơ đồ thất bại" : "Failed to clear SVG map", description: message, variant: "error" })
      }
    } catch {
      toast({ title: locale === "vi" ? "Xóa sơ đồ thất bại" : "Failed to clear SVG map", description: t("admin.networkError"), variant: "error" })
    } finally {
      setUploadingSvgForFloorId(null)
    }
  }

  const handleCreateWorkspace = async (floorId: string) => {
    if (!token) return
    const { name, type, status, svgElementId, capacity, qrCodeValue } = newWorkspaceForm
    if (!name.trim() || !svgElementId.trim() || !qrCodeValue.trim()) {
      toast({ title: "Validation error", description: "Name, SVG ID, and QR code value are required.", variant: "error" })
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch(`${apiBaseUrl}/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          floorId,
          name: name.trim(),
          type,
          status,
          svgElementId: svgElementId.trim(),
          qrCodeValue: qrCodeValue.trim(),
          capacity
        })
      })
      if (res.ok) {
        toast({ title: t("admin.workspaceCreated"), variant: "success" })
        setAddingWorkspaceToFloorId(null)
        setNewWorkspaceForm({ name: "", type: "desk", status: "available", svgElementId: "", capacity: 1, qrCodeValue: "" })
        await onRefresh()
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

  const requestDeleteWorkspace = (workspaceId: string, name: string) => {
    const isVi = locale === "vi"
    setConfirmModal({
      isOpen: true,
      title: isVi ? "Xóa Không Gian" : "Delete Workspace",
      message: isVi 
        ? `Bạn có chắc chắn muốn xóa không gian làm việc "${name}"? Hành động này không thể hoàn tác.`
        : `Are you sure you want to delete the workspace "${name}"? This action cannot be undone.`,
      confirmText: isVi ? "Xóa không gian" : "Delete Workspace",
      cancelText: isVi ? "Hủy" : "Cancel",
      onConfirm: () => {
        void executeDeleteWorkspace(workspaceId)
      }
    })
  }

  const executeDeleteWorkspace = async (workspaceId: string) => {
    if (!token) return
    setIsDeleting(prev => ({ ...prev, [workspaceId]: true }))
    setConfirmModal(prev => ({ ...prev, isOpen: false }))
    try {
      const res = await fetch(`${apiBaseUrl}/workspaces/${workspaceId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        toast({ title: locale === "vi" ? "Đã xóa không gian thành công." : "Workspace deleted successfully.", variant: "success" })
        await onRefresh()
      } else {
        const message = await readApiError(res, "Could not delete workspace.")
        toast({ title: locale === "vi" ? "Xóa thất bại" : "Delete failed", description: message, variant: "error" })
      }
    } catch {
      toast({ title: locale === "vi" ? "Xóa thất bại" : "Delete failed", description: t("admin.networkError"), variant: "error" })
    } finally {
      setIsDeleting(prev => {
        const next = { ...prev }
        delete next[workspaceId]
        return next
      })
    }
  }

  const toggleBuilding = (buildingId: string) => {
    setExpandedBuildings(prev => ({ ...prev, [buildingId]: !prev[buildingId] }))
  }

  const toggleFloor = (floorId: string) => {
    setExpandedFloors(prev => {
      const next = { ...prev, [floorId]: !prev[floorId] }
      if (next[floorId]) {
        void loadFloorSvgIds(floorId)
      }
      return next
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <Card className={cn("lg:col-span-2", adminCardClass)}>
        <CardHeader>
          <CardTitle>{t("admin.activeFacilities")}</CardTitle>
          <CardDescription>Hierarchical view of your buildings, floors, maps, and workspaces.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {buildings.length > 0 ? (
            buildings.map((b: Building) => {
              const buildingFloors = floors
                .filter((f) => f.building_id === b.id)
                .sort((a, b) => a.floor_number - b.floor_number)
              const isBuildingExpanded = Boolean(expandedBuildings[b.id])

              return (
                <div key={b.id} className="border border-slate-200 dark:border-white/10 rounded-[1.5rem] p-4 bg-white dark:bg-slate-950 transition-all hover:shadow-md">
                  {/* Building Header Row */}
                  <div className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-4 cursor-pointer select-none flex-1" onClick={() => toggleBuilding(b.id)}>
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-primary-500/10 dark:text-primary-400">
                        <Building2 size={24} />
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-slate-950 dark:text-white flex items-center gap-2">
                          {b.name}
                          {isBuildingExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                        </h4>
                        <p className="text-xs font-semibold text-slate-500">{b.address || t("admin.noAddress")}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">{t("admin.floorsLabel")}</p>
                        <p className="font-black text-slate-950 dark:text-white">{b.total_floors}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-white"
                        onClick={() => {
                          setAddingFloorToBuildingId(b.id)
                          setExpandedBuildings(prev => ({ ...prev, [b.id]: true }))
                        }}
                        title="Quick Add Floor"
                      >
                        <Plus size={20} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-red-600 disabled:opacity-50"
                        onClick={() => requestDeleteBuilding(b.id, b.name)}
                        disabled={isDeleting[b.id]}
                        title="Delete Building"
                      >
                        <Trash2 size={20} />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Building: Floor List & Add Floor Inline Form */}
                  {isBuildingExpanded && (
                    <div className="mt-4 ml-6 pl-6 border-l-2 border-slate-200/60 dark:border-white/10 space-y-4 py-2 relative">
                      {/* Add Floor Inline Form */}
                      {addingFloorToBuildingId === b.id && (
                        <div className="p-4 border border-blue-200 bg-blue-50/50 dark:border-primary-500/20 dark:bg-primary-500/5 rounded-xl space-y-3">
                          <p className="text-xs font-black uppercase text-blue-600 dark:text-primary-300">Add New Floor</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Floor Number</label>
                              <Input
                                type="number"
                                className="h-10 bg-white dark:bg-slate-900"
                                value={newFloorForm.floorNumber}
                                onChange={(e) => setNewFloorForm({ ...newFloorForm, floorNumber: parseInt(e.target.value) || 1 })}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Floor Name (Optional)</label>
                              <Input
                                placeholder="e.g. Floor A"
                                className="h-10 bg-white dark:bg-slate-900"
                                value={newFloorForm.name}
                                onChange={(e) => setNewFloorForm({ ...newFloorForm, name: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="outline" className="h-9 font-semibold" onClick={() => setAddingFloorToBuildingId(null)}>Cancel</Button>
                            <Button size="sm" className="h-9 font-bold bg-blue-600 text-white hover:bg-blue-700" onClick={() => void handleCreateFloor(b.id)} isLoading={isSaving}>Save Floor</Button>
                          </div>
                        </div>
                      )}

                      {/* Floor Rows */}
                      {buildingFloors.length > 0 ? (
                        buildingFloors.map((floor) => {
                          const isFloorExpanded = Boolean(expandedFloors[floor.id])
                          const floorWorkspaces = workspaces
                            .filter((w) => w.floor_id === floor.id)
                            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                          const hasSvg = Boolean(floor.svg_map_url)
                          const detectedIds = floorSvgIds[floor.id] || []
                          const bookableSvgIds = getBookableSvgIds(detectedIds)
                          const mappedSvgIds = new Set(floorWorkspaces.map((workspace) => workspace.svg_element_id.trim().toLowerCase()))
                          const missingDetectedWorkspaceCount = bookableSvgIds.filter((id) => !mappedSvgIds.has(id.toLowerCase())).length
                          const isLoadingSvg = Boolean(loadingFloorSvgIds[floor.id])
                          const isSyncingSvg = syncingSvgForFloorId === floor.id

                          return (
                            <div key={floor.id} className="border border-slate-150 dark:border-white/5 rounded-xl p-3 bg-slate-50/50 dark:bg-white/[0.01]">
                              {/* Floor Header */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => toggleFloor(floor.id)}>
                                  <Layers size={18} className="text-slate-500" />
                                  <div>
                                    <span className="font-bold text-slate-900 dark:text-white">
                                      {floor.name || t("common.floorFallback").replace("{number}", String(floor.floor_number))}
                                    </span>
                                    <span className={cn("ml-2 inline-flex rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border",
                                      hasSvg ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20" : "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                                    )}>
                                      {hasSvg ? "SVG Mapped" : "No SVG"}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-slate-500">{floorWorkspaces.length} workspaces</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-red-500"
                                    onClick={() => requestDeleteFloor(floor.id, floor.name || t("common.floorFallback").replace("{number}", String(floor.floor_number)))}
                                    disabled={isDeleting[floor.id]}
                                    title="Delete Floor"
                                  >
                                    <Trash2 size={16} />
                                  </Button>
                                </div>
                              </div>

                              {/* Expanded Floor Info (SVG upload, Workspaces) */}
                              {isFloorExpanded && (
                                <div className="mt-3 ml-4 pl-4 border-l border-dashed border-slate-200/80 dark:border-white/10 space-y-4 py-1">
                                  {/* SVG Mapper Section inside floor */}
                                  <div className="p-3 border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 rounded-xl space-y-3">
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-xs font-black uppercase text-slate-500">SVG Map</h5>
                                      {hasSvg && (
                                        <Button size="sm" variant="outline" className="h-7 text-[10px] text-red-500 border-red-200 hover:bg-red-50 dark:border-red-500/20 dark:text-red-400" onClick={() => requestClearFloorSvg(floor.id, floor.name || t("common.floorFallback").replace("{number}", String(floor.floor_number)))}>
                                          Clear Map
                                        </Button>
                                      )}
                                    </div>
                                    
                                    {hasSvg ? (
                                      <div className="space-y-2">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                          <div>
                                            <p className="text-xs font-semibold text-slate-500">Click detected SVG ID below to copy and use for workspace layout:</p>
                                            {bookableSvgIds.length > 0 && (
                                              <p className="text-[10px] font-bold text-slate-400">
                                                {missingDetectedWorkspaceCount} detected bookable ID{missingDetectedWorkspaceCount === 1 ? "" : "s"} still need workspace records.
                                              </p>
                                            )}
                                          </div>
                                          {detectedIds.length > 0 && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-8 shrink-0 text-[11px] font-bold text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10"
                                              onClick={() => void syncDetectedWorkspaces(floor.id, detectedIds)}
                                              disabled={isLoadingSvg || isSyncingSvg || missingDetectedWorkspaceCount === 0}
                                              isLoading={isSyncingSvg}
                                            >
                                              <QrCode size={13} className="mr-1.5" /> Sync detected spaces
                                            </Button>
                                          )}
                                        </div>
                                        {isLoadingSvg ? (
                                          <p className="text-xs text-slate-400 italic">Reading SVG IDs...</p>
                                        ) : detectedIds.length > 0 ? (
                                          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/5">
                                            {detectedIds.map(id => (
                                              <button
                                                key={id}
                                                type="button"
                                                onClick={() => void copySvgId(id)}
                                                className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white border border-slate-200 text-slate-800 hover:bg-blue-50 hover:border-blue-300 dark:bg-slate-800 dark:border-white/10 dark:text-slate-200"
                                              >
                                                {id}
                                              </button>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-xs text-amber-500 italic">No SVG IDs detected. Add id attributes to desk/room elements in your SVG file.</p>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-3">
                                        <div className="relative inline-block">
                                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 font-bold text-xs h-8">
                                            <Upload size={14} className="mr-1.5" /> Upload SVG
                                          </Button>
                                          <input
                                            type="file"
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            accept=".svg"
                                            onChange={(e) => {
                                              const file = e.target.files?.[0]
                                              if (file) void handleFloorSvgUpload(floor.id, file)
                                            }}
                                            disabled={uploadingSvgForFloorId === floor.id}
                                          />
                                        </div>
                                        {uploadingSvgForFloorId === floor.id && <span className="text-xs text-slate-400 animate-pulse">Uploading...</span>}
                                      </div>
                                    )}
                                  </div>

                                  {/* Workspaces list */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-xs font-black uppercase text-slate-500">Workspaces ({floorWorkspaces.length})</h5>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 font-bold"
                                        onClick={() => setAddingWorkspaceToFloorId(floor.id)}
                                      >
                                        <Plus size={12} className="mr-1" /> Add Workspace
                                      </Button>
                                    </div>

                                    {/* Add Workspace Form */}
                                    {addingWorkspaceToFloorId === floor.id && (
                                      <div className="p-3 border border-blue-200 bg-blue-50/30 dark:border-primary-500/20 dark:bg-primary-500/5 rounded-xl space-y-3">
                                        <p className="text-xs font-black uppercase text-blue-600">New Workspace</p>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div>
                                            <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Name</label>
                                            <Input placeholder="e.g. Desk A-01" className="h-9 bg-white dark:bg-slate-900" value={newWorkspaceForm.name} onChange={e => setNewWorkspaceForm({ ...newWorkspaceForm, name: e.target.value })} />
                                          </div>
                                          <div>
                                            <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Type</label>
                                            <select className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 font-semibold text-xs focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white" value={newWorkspaceForm.type} onChange={e => setNewWorkspaceForm({ ...newWorkspaceForm, type: e.target.value })}>
                                              {["desk", "meeting_room", "focus_room", "lab", "room", "parking"].map(type => (
                                                <option key={type} value={type} className="dark:bg-slate-900">{type.toUpperCase()}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">SVG Element ID</label>
                                            <Input placeholder="e.g. desk_a_01" className="h-9 bg-white dark:bg-slate-900" value={newWorkspaceForm.svgElementId} onChange={e => setNewWorkspaceForm({ ...newWorkspaceForm, svgElementId: e.target.value })} />
                                          </div>
                                          <div>
                                            <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">QR Value</label>
                                            <Input placeholder="e.g. QR-A01" className="h-9 bg-white dark:bg-slate-900" value={newWorkspaceForm.qrCodeValue} onChange={e => setNewWorkspaceForm({ ...newWorkspaceForm, qrCodeValue: e.target.value })} />
                                          </div>
                                          <div>
                                            <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Capacity</label>
                                            <Input type="number" min={1} className="h-9 bg-white dark:bg-slate-900" value={newWorkspaceForm.capacity} onChange={e => setNewWorkspaceForm({ ...newWorkspaceForm, capacity: parseInt(e.target.value) || 1 })} />
                                          </div>
                                          <div>
                                            <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Status</label>
                                            <select className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 font-semibold text-xs focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white" value={newWorkspaceForm.status} onChange={e => setNewWorkspaceForm({ ...newWorkspaceForm, status: e.target.value })}>
                                              {["available", "maintenance", "inactive"].map(status => (
                                                <option key={status} value={status} className="dark:bg-slate-900">{status.toUpperCase()}</option>
                                              ))}
                                            </select>
                                          </div>
                                        </div>
                                        <div className="flex gap-2 justify-end">
                                          <Button size="sm" variant="outline" className="h-8 text-xs font-semibold" onClick={() => setAddingWorkspaceToFloorId(null)}>Cancel</Button>
                                          <Button size="sm" className="h-8 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700" onClick={() => void handleCreateWorkspace(floor.id)} isLoading={isSaving}>Save</Button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Workspaces list table */}
                                    {floorWorkspaces.length > 0 ? (
                                      <div className="overflow-hidden border border-slate-100 dark:border-white/5 rounded-lg max-h-60 overflow-y-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                          <thead>
                                            <tr className="bg-slate-100 dark:bg-white/5 text-slate-500 font-bold sticky top-0">
                                              <th className="p-2">Name</th>
                                              <th className="p-2">Type</th>
                                              <th className="p-2">SVG ID</th>
                                              <th className="p-2">Capacity</th>
                                              <th className="p-2 text-right">Action</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                            {floorWorkspaces.map(w => (
                                              <tr key={w.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                                                <td className="p-2 font-bold text-slate-900 dark:text-white">{w.name}</td>
                                                <td className="p-2 text-slate-500">{w.type.toUpperCase()}</td>
                                                <td className="p-2 font-mono text-[10px]">{w.svg_element_id}</td>
                                                <td className="p-2">{w.capacity}</td>
                                                <td className="p-2 text-right">
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-slate-400 hover:text-red-500"
                                                    onClick={() => requestDeleteWorkspace(w.id, w.name)}
                                                    disabled={isDeleting[w.id]}
                                                  >
                                                    <Trash2 size={13} />
                                                  </Button>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : (
                                      <p className="text-xs text-slate-400 italic py-2">No workspaces added yet.</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })
                      ) : (
                        <p className="text-xs text-slate-400 italic py-2">No floors added to this building yet.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <p className="text-sm font-semibold text-slate-500 text-center py-6">No buildings configured. Create a building on the right to start.</p>
          )}
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
      <ConfirmModal {...confirmModal} onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} />
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

function WorkspacePanel({ workspaces, floors, buildings, users, currentUserId, onRefresh, apiBaseUrl, token, userRole }: WorkspacePanelProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)
  const [lastCreated, setLastCreated] = React.useState<{ name: string; floorId: string } | null>(null)
  const [editingWorkspaceId, setEditingWorkspaceId] = React.useState<string | null>(null)
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
  const visibleWorkspaces = React.useMemo(() => {
    if (isAdmin) return workspaces
    return workspaces.filter((workspace) => workspace.owner_id === currentUserId)
  }, [currentUserId, isAdmin, workspaces])
  const userById = React.useMemo(() => new Map(users.map((user) => [user.id, user])), [users])

  const describeFloor = React.useCallback((floor: Floor) => {
    const building = buildings.find((item) => item.id === floor.building_id)
    const floorName = floor.name || t("common.floorFallback").replace("{number}", String(floor.floor_number))

    return building ? `${building.name} / ${floorName}` : floorName
  }, [buildings, t])

  const handleEdit = (workspace: Workspace) => {
    setEditingWorkspaceId(workspace.id)
    setLastCreated(null)
    setSubmitted(false)
    setForm({
      floorId: workspace.floor_id,
      name: workspace.name,
      type: workspace.type,
      status: workspace.status,
      svgElementId: workspace.svg_element_id,
      qrCodeValue: "",
      capacity: workspace.capacity,
    })
  }

  const clearEditing = () => {
    setEditingWorkspaceId(null)
    setSubmitted(false)
    setForm((current) => ({
      ...current,
      name: "",
      svgElementId: "",
      qrCodeValue: "",
      capacity: 1,
    }))
  }

  const handleSave = async () => {
    if (!token || !effectiveFloorId) return
    setSubmitted(true)
    const isUpdate = Boolean(editingWorkspaceId)
    const updateValid = Boolean(effectiveFloorId) && Boolean(form.name.trim()) && Boolean(form.svgElementId.trim()) && Number.isFinite(form.capacity) && form.capacity > 0
    if (isUpdate ? !updateValid : !isValid) {
      toast({ title: tFallback(t, "admin.validationTitle", "Check the form"), description: tFallback(t, "admin.fixValidation", "Some required information is missing or invalid."), variant: "error" })
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch(editingWorkspaceId ? `${apiBaseUrl}/workspaces/${editingWorkspaceId}` : `${apiBaseUrl}/workspaces`, {
        method: editingWorkspaceId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          floorId: effectiveFloorId,
          name: form.name,
          type: form.type,
          status: form.status,
          svgElementId: form.svgElementId,
          ...(editingWorkspaceId ? {} : { qrCodeValue: form.qrCodeValue }),
          capacity: form.capacity,
        }),
      })

      if (res.ok) {
        const createdName = form.name
        const createdFloorId = effectiveFloorId
        await onRefresh()
        setSubmitted(false)
        setEditingWorkspaceId(null)
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
        {visibleWorkspaces.map((w: Workspace) => (
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
                      {isAdmin && (
                        <p className="mt-1 text-[11px] font-bold text-slate-500">
                          Owner: {w.owner_id ? (userById.get(w.owner_id)?.email ?? w.owner_id) : "Admin/System"}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">{w.approval_status ?? "approved"}</p>
                   </div>
                </div>
                <div className="flex items-center justify-between mt-6">
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t("admin.svgId")}: {w.svg_element_id}</span>
                   <Button variant="ghost" size="sm" className="text-primary-500 font-bold hover:bg-primary-500/10" onClick={() => handleEdit(w)}>{t("admin.edit")}</Button>
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
        {!visibleWorkspaces.length && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500 dark:border-white/10 dark:bg-slate-900">
            {isAdmin ? "No workspaces have been created yet." : "You have not created any workspaces yet."}
          </div>
        )}
      </div>

      <Card className={cn("h-fit lg:sticky lg:top-8", adminCardClass)}>
        <CardHeader>
          <CardTitle>{editingWorkspaceId ? tFallback(t, "admin.editWorkspace", "Edit Workspace") : t("admin.newWorkspace")}</CardTitle>
          <CardDescription>
            {editingWorkspaceId
              ? tFallback(t, "admin.editWorkspaceDesc", "Update workspace metadata for the selected space.")
              : t("admin.levelManagementDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {editingWorkspaceId && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
              Editing an existing workspace. QR code value is kept unchanged.
            </div>
          )}
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
            <Input placeholder={editingWorkspaceId ? "Existing QR value is preserved" : t("admin.qrCodePlaceholder")} className={adminInputClass} value={form.qrCodeValue} onChange={(e) => setForm({ ...form, qrCodeValue: e.target.value })} disabled={Boolean(editingWorkspaceId)} />
            <FieldError show={submitted && !editingWorkspaceId && !form.qrCodeValue.trim()}>{tFallback(t, "admin.validation.required", "This field is required.")}</FieldError>
          </div>
          <div className="space-y-2">
            <label className={adminLabelClass}>{t("admin.capacity")}</label>
            <Input type="number" min={1} max={50} className={adminInputClass} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) })} />
            <FieldError show={submitted && (!Number.isFinite(form.capacity) || form.capacity < 1)}>{tFallback(t, "admin.validation.positiveNumber", "Enter a number greater than zero.")}</FieldError>
          </div>
          <Button
            className="w-full bg-primary-600 hover:bg-primary-700 h-12 font-black"
            onClick={handleSave}
            disabled={!effectiveFloorId}
            isLoading={isSaving}
            loadingText={t("admin.saving")}
          >
            <Plus className="mr-2" size={18} /> {editingWorkspaceId ? tFallback(t, "admin.saveWorkspace", "Save Workspace") : t("admin.createWorkspace")}
          </Button>
          {editingWorkspaceId && (
            <Button variant="outline" className="w-full h-11 font-black" onClick={clearEditing} disabled={isSaving}>
              Cancel Edit
            </Button>
          )}
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
