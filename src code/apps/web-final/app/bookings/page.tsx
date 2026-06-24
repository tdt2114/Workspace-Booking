"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar, Clock, MapPin, Search, XCircle, CheckCircle2, History, ShieldCheck, Play, Settings2, Loader2, Info, ChevronRight, BarChart3, TrendingUp, Users, Building2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/premium/layout/dashboard-layout"
import { Button } from "@/components/premium/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/premium/ui/card"
import { Input } from "@/components/premium/ui/input"
import { useLanguage } from "@/components/premium/language-provider"
import { useToast } from "@/components/premium/ui/toast"
import { supabase } from "@/lib/supabase/client"
import { getBrowserApiBaseUrl } from "@/lib/api-base-url"
import { readApiError } from "@/lib/http-feedback"
import { Skeleton } from "@/components/premium/ui/skeleton"
import { cn } from "@/lib/utils"

interface Booking {
  id: string
  user_id: string
  workspace_id: string
  start_time: string
  end_time: string
  status: 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'no_show'
  workspace_name?: string
  floor_name?: string
  floor_id?: string
  building_id?: string
  user_email?: string
}

interface BookingsResponse {
  items?: Booking[]
}

interface MeResponse {
  role?: string
}

interface AnalyticsResponse {
  generatedAt: string
  summary: {
    totalBookings: number
    upcomingBookings: number
    activeBookings: number
    checkedInBookings: number
    completedBookings: number
    cancelledBookings: number
    noShowBookings: number
    totalWorkspaces: number
    availableWorkspaces: number
    unavailableWorkspaces: number
    occupancyRate: number
    noShowRate: number
  }
  statusCounts: {
    confirmed: number
    checkedIn: number
    completed: number
    cancelled: number
    noShow: number
  }
  topWorkspaces: Array<{
    workspaceId: string
    workspaceName: string
    floorName: string
    buildingName: string
    bookingCount: number
  }>
  floorUtilization: Array<{
    floorId: string
    floorName: string
    buildingName: string
    workspaceCount: number
    occupiedCount: number
    utilizationRate: number
  }>
  bookingVolume?: {
    daily: Array<{
      periodStart: string
      label: string
      count: number
    }>
    weekly: Array<{
      periodStart: string
      label: string
      count: number
    }>
  }
}

interface StatCardProps {
  label: string
  value: number
  icon: React.ReactNode
}

type BookingDisplayStatus = "upcoming" | "active" | "checkedIn" | "completed" | "cancelled" | "noShow"
type BookingStatusConfig = Record<BookingDisplayStatus, { label: string; className: string }>

interface BookingItemProps {
  booking: Booking
  onCancel: () => void
  isActionLoading: boolean
  now: number
}

function getBookingDisplayStatus(booking: Booking, now: number): BookingDisplayStatus {
  const start = new Date(booking.start_time).getTime()
  const end = new Date(booking.end_time).getTime()

  if (booking.status === "checked_in") return "checkedIn"
  if (booking.status === "completed") return "completed"
  if (booking.status === "cancelled") return "cancelled"
  if (booking.status === "no_show") return "noShow"
  if (Number.isFinite(start) && now < start) return "upcoming"
  if (Number.isFinite(end) && now <= end) return "active"

  return "completed"
}

export default function BookingsPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = React.useState<"my" | "system">("my")
  const [bookings, setBookings] = React.useState<Booking[]>([])
  const [systemBookings, setSystemBookings] = React.useState<Booking[]>([])
  const [loading, setLoading] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [role, setRole] = React.useState<string | null>(null)
  const [currentTime, setCurrentTime] = React.useState(() => Date.now())
  const [analytics, setAnalytics] = React.useState<AnalyticsResponse | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = React.useState(false)

  const apiBaseUrl = React.useMemo(() => getBrowserApiBaseUrl(), [])


  const loadAnalytics = React.useCallback(async (token: string) => {
    setAnalyticsLoading(true)
    try {
      const res = await fetch(`${apiBaseUrl}/bookings/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        setAnalytics(await res.json() as AnalyticsResponse)
      } else {
        const message = await readApiError(res, t("bookings.analytics.loadFailed"))
        toast({ title: t("bookings.analytics.loadFailed"), description: message, variant: "error" })
      }
    } catch (err) {
      console.error("Failed to load analytics:", err)
      toast({ title: t("bookings.analytics.loadFailed"), description: t("bookings.networkError"), variant: "error" })
    } finally {
      setAnalyticsLoading(false)
    }
  }, [apiBaseUrl, t, toast])

  const hasFetchedRef = React.useRef(false)

  React.useEffect(() => {
    if (hasFetchedRef.current) return
    hasFetchedRef.current = true

    let mounted = true
    const base = apiBaseUrl

    const run = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        router.push("/login")
        return
      }

      if (mounted) {
        setLoading(true)
      }

      const token = currentSession.access_token

      try {
        // Fetch role first
        let currentRole: string | null = null
        try {
          const meRes = await fetch(`${base}/me`, { headers: { Authorization: `Bearer ${token}` } })
          if (meRes.ok) {
            const meData = await meRes.json() as MeResponse
            currentRole = meData.role ?? null
            if (mounted) setRole(currentRole)
          }
        } catch { /* non-fatal */ }

        // Fetch bookings
        const endpoint = "/bookings/my"
        const res = await fetch(`${base}${endpoint}`, { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) {
          const data = await res.json() as BookingsResponse
          if (mounted) setBookings(data.items || [])
        } else {
          const message = await readApiError(res, t("bookings.loadFailed"))
          if (mounted) toast({ title: t("bookings.loadFailed"), description: message, variant: "error" })
        }
      } catch (err) {
        console.error("Failed to load bookings:", err)
        if (mounted) toast({ title: t("bookings.loadFailed"), description: t("bookings.networkError"), variant: "error" })
      } finally {
        if (mounted) {
          setCurrentTime(Date.now())
          setLoading(false)
        }
      }
    }

    void run()
    return () => { mounted = false }
    // Run only once on mount — deps intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchTabData = React.useCallback(async (tab: "my" | "system") => {
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    if (!currentSession) return
    setLoading(true)
    const token = currentSession.access_token
    const base = apiBaseUrl
    try {
      const endpoint = tab === "my" ? "/bookings/my" : "/bookings/manage"
      const res = await fetch(`${base}${endpoint}`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json() as BookingsResponse
        if (tab === "my") setBookings(data.items || [])
        else {
          setSystemBookings(data.items || [])
          if (role === "admin") {
            setAnalyticsLoading(true)
            try {
              const aRes = await fetch(`${base}/bookings/analytics`, { headers: { Authorization: `Bearer ${token}` } })
              if (aRes.ok) setAnalytics(await aRes.json() as AnalyticsResponse)
            } catch { /* non-fatal */ } finally {
              setAnalyticsLoading(false)
            }
          }
        }
      } else {
        const message = await readApiError(res, t("bookings.loadFailed"))
        toast({ title: t("bookings.loadFailed"), description: message, variant: "error" })
      }
    } catch {
      toast({ title: t("bookings.loadFailed"), description: t("bookings.networkError"), variant: "error" })
    } finally {
      setCurrentTime(Date.now())
      setLoading(false)
    }
  }, [apiBaseUrl, role, t, toast])

  const handleAction = async (bookingId: string, action: 'cancel' | 'no-show' | 'complete') => {
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    if (!currentSession) return
    const loadingKey = action === "cancel" ? bookingId : action
    setActionLoading(loadingKey)
    try {
      let endpoint = `${apiBaseUrl}/bookings/${bookingId}/cancel`
      let method = "PATCH"
      
      if (action === 'no-show') {
        endpoint = `${apiBaseUrl}/bookings/run-no-show`
        method = "POST"
      }
      if (action === 'complete') {
        endpoint = `${apiBaseUrl}/bookings/run-completed`
        method = "POST"
      }
      
      const res = await fetch(endpoint, {
        method: method,
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentSession.access_token}` 
        }
      })
      
      if (res.ok) {
        void fetchTabData(activeTab)
        toast({
          title: t("bookings.actionSuccess"),
          description: t(`bookings.actions.${action}`),
          variant: "success",
        })
      } else {
        const message = await readApiError(res, t("bookings.actionFailed"))
        toast({ title: t("bookings.actionFailed"), description: message, variant: "error" })
      }
    } catch (err) {
      console.error("Action error:", err)
      toast({ title: t("bookings.actionFailed"), description: t("bookings.networkError"), variant: "error" })
    } finally {
      setActionLoading(null)
    }
  }

  const displayedBookings = (activeTab === "my" ? bookings : systemBookings).filter(b => 
    (b.workspace_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (b.user_email || "").toLowerCase().includes(search.toLowerCase())
  )
  const isAdmin = role === "admin"
  const isSpaceOwner = role === "space_owner"
  const canViewManagedBookings = isAdmin || isSpaceOwner

  const stats = React.useMemo(() => {
    const list = activeTab === "my" ? bookings : systemBookings
    const phases = list.map((booking) => getBookingDisplayStatus(booking, currentTime))

    return {
      total: list.length,
      upcoming: phases.filter((status) => status === "upcoming").length,
      active: phases.filter((status) => status === "active" || status === "checkedIn").length,
      completed: phases.filter((status) => status === "completed").length,
      cancelled: phases.filter((status) => status === "cancelled" || status === "noShow").length,
    }
  }, [activeTab, bookings, currentTime, systemBookings])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-4 w-96" />
              </div>
              <Skeleton className="h-12 w-60 rounded-2xl" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900">
              <div className="flex justify-between items-center mb-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-10 w-64" />
              </div>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-24 rounded-2xl" />
                ))}
              </div>
            </Card>
            <div className="space-y-6">
              <Skeleton className="h-64 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-8" data-testid="bookings-page">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-950 shadow-sm shadow-slate-200/70 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-600">Reservations</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl dark:text-white">{t("bookings.title")}</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-500 md:text-base dark:text-slate-400">{t("bookings.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 dark:border-white/10 dark:bg-white/5">
            <button 
              data-testid="bookings-tab-my"
              onClick={() => { setActiveTab("my"); void fetchTabData("my") }}
              className={cn(
                "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black transition-all",
                activeTab === "my" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              )}
            >
              <History size={18} />
              {t("bookings.myHistory")}
            </button>
            {canViewManagedBookings && (
              <button 
                data-testid="bookings-tab-system"
                onClick={() => { setActiveTab("system"); void fetchTabData("system") }}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black transition-all",
                  activeTab === "system" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                )}
              >
                <ShieldCheck size={18} />
                {isAdmin ? t("bookings.globalAccess") : t("bookings.ownerAccess")}
              </button>
            )}
          </div>
        </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t("bookings.stats.total")} value={stats.total} icon={<Calendar className="text-blue-500" size={20} />} />
          <StatCard label={t("bookings.stats.upcoming")} value={stats.upcoming} icon={<Clock className="text-blue-500" size={20} />} />
          <StatCard label={t("bookings.stats.live")} value={stats.active} icon={<CheckCircle2 className="text-emerald-500" size={20} />} />
          <StatCard label={t("bookings.stats.finalized")} value={stats.completed} icon={<History className="text-slate-400" size={20} />} />
        </div>

        {activeTab === "system" && isAdmin && (
          <AnalyticsPanel analytics={analytics} isLoading={analyticsLoading} />
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
          >
            <Card className="flex h-fit flex-col border-slate-200 bg-white text-slate-950 shadow-sm shadow-slate-200/70 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 xl:col-span-1">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl font-black text-slate-950 dark:text-white">{activeTab === "my" ? t("bookings.yourReservations") : t("bookings.systemRecords")}</CardTitle>
                  <CardDescription className="font-semibold text-slate-500">{t("bookings.filtering").replace("{count}", String(displayedBookings.length))}</CardDescription>
                </div>
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-500 transition-colors" size={16} />
                  <Input 
                    data-testid="bookings-search"
                    placeholder={t("bookings.searchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-11 w-full rounded-xl border-slate-200 bg-slate-50 pl-9 font-semibold text-slate-950 focus:border-blue-500 sm:w-72 dark:border-white/10 dark:bg-white/5 dark:text-white" 
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pb-8">
                {displayedBookings.length > 0 ? (
                  displayedBookings.map((b) => (
                    <BookingItem 
                      key={b.id}
                      booking={b}
                      onCancel={() => handleAction(b.id, 'cancel')}
                      isActionLoading={actionLoading === b.id}
                      now={currentTime}
                    />
                  ))
                ) : (
                  <div className="space-y-4 py-20 text-center text-slate-400">
                    <Calendar size={64} className="mx-auto opacity-60" />
                    <p className="font-bold text-slate-600 dark:text-slate-400">{t("bookings.empty")}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <aside className="space-y-6">
              {activeTab === "system" && isAdmin && (
                <>
                  <Card data-testid="bookings-system-section" className="overflow-hidden border-blue-200 bg-white text-slate-950 shadow-sm shadow-blue-100/70 dark:border-primary-500/20 dark:bg-slate-900 dark:text-slate-100">
                    <CardHeader className="border-b border-blue-100 bg-blue-50 dark:border-white/10 dark:bg-slate-800">
                      <CardTitle className="flex items-center gap-2 text-lg font-black text-slate-950 dark:text-white">
                        <Settings2 size={20} className="text-blue-600 dark:text-primary-500" />
                        {t("bookings.maintenanceTools")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-slate-500">{t("bookings.noShowCleanup")}</span>
                          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        </div>
                        <p className="text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-400">{t("bookings.noShowDescription")}</p>
                        <Button 
                          data-testid="bookings-run-no-show"
                          onClick={() => handleAction('bulk', 'no-show')}
                          className="w-full bg-amber-600/10 hover:bg-amber-600/20 text-amber-500 border border-amber-500/20 font-bold h-10 rounded-xl"
                          isLoading={actionLoading === "no-show"}
                          disabled={Boolean(actionLoading)}
                        >
                          <Play size={14} className="mr-2" />
                          {t("bookings.executeCleanup")}
                        </Button>
                      </div>

                      <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-slate-500">{t("bookings.archiveJob")}</span>
                        </div>
                        <p className="text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-400">{t("bookings.archiveDescription")}</p>
                        <Button 
                          data-testid="bookings-run-completed"
                          onClick={() => handleAction('bulk', 'complete')}
                          className="w-full bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 border border-emerald-500/20 font-bold h-10 rounded-xl"
                          isLoading={actionLoading === "complete"}
                          disabled={Boolean(actionLoading)}
                        >
                          <Play size={14} className="mr-2" />
                          {t("bookings.archivePastSessions")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              <Card className="border-slate-200 bg-white text-slate-950 shadow-sm shadow-slate-200/70 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100">
                <CardHeader>
                  <CardTitle className="text-lg font-black text-slate-950 dark:text-white">{t("bookings.quotaStatus")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-slate-500">{t("bookings.activeBookings")}</span>
                    <span className="text-slate-950 dark:text-white">{stats.active + stats.upcoming}/5</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(((stats.active + stats.upcoming) / 5) * 100, 100)}%` }} />
                  </div>
                  <div className="flex gap-3 border-t border-slate-100 pt-4 dark:border-white/5">
                    <Info size={16} className="text-slate-500 shrink-0" />
                    <p className="text-[10px] text-slate-500 leading-relaxed font-medium uppercase tracking-tight">{t("bookings.quotaInfo")}</p>
                  </div>
                </CardContent>
              </Card>
            </aside>
          </motion.div>
        </AnimatePresence>
      </div>
    </DashboardLayout>
  )
}

function AnalyticsPanel({ analytics, isLoading }: { analytics: AnalyticsResponse | null; isLoading: boolean }) {
  const { t } = useLanguage()
  const summary = analytics?.summary
  const topFloors = analytics?.floorUtilization.slice(0, 3) ?? []
  const dailyVolume = analytics?.bookingVolume?.daily ?? []
  const weeklyVolume = analytics?.bookingVolume?.weekly ?? []
  const weeklyTotal = weeklyVolume.reduce((sum, item) => sum + item.count, 0)
  const weeklyPeak = weeklyVolume.reduce((peak, item) => Math.max(peak, item.count), 0)
  const dailyTotal = dailyVolume.reduce((sum, item) => sum + item.count, 0)

  return (
    <Card data-testid="bookings-analytics-section" className="overflow-hidden border-emerald-200 bg-white text-slate-950 shadow-sm shadow-emerald-100/70 dark:border-emerald-500/20 dark:bg-slate-900 dark:text-slate-100">
      <CardHeader className="border-b border-emerald-100 bg-emerald-50 dark:border-white/10 dark:bg-slate-800">
        <CardTitle className="flex items-center gap-2 text-xl font-black text-slate-950 dark:text-white">
          <BarChart3 size={22} className="text-emerald-600 dark:text-emerald-500" />
          {t("bookings.analytics.title")}
        </CardTitle>
        <CardDescription className="font-semibold text-slate-600 dark:text-slate-400">
          {analytics
            ? t("bookings.analytics.generated").replace("{time}", new Date(analytics.generatedAt).toLocaleTimeString())
            : t("bookings.analytics.subtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
            <div className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
              <Skeleton className="h-64 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          </div>
        ) : summary ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <AnalyticsMetric
                label={t("bookings.analytics.occupancy")}
                value={`${summary.occupancyRate}%`}
                icon={<TrendingUp size={18} />}
                tone="emerald"
              />
              <AnalyticsMetric
                label={t("bookings.analytics.noShowRate")}
                value={`${summary.noShowRate}%`}
                icon={<XCircle size={18} />}
                tone="amber"
              />
              <AnalyticsMetric
                label={t("bookings.analytics.availableNow")}
                value={summary.availableWorkspaces}
                icon={<CheckCircle2 size={18} />}
                tone="blue"
              />
              <AnalyticsMetric
                label={t("bookings.analytics.checkedInNow")}
                value={summary.checkedInBookings}
                icon={<Users size={18} />}
                tone="emerald"
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {t("bookings.analytics.bookingVolume")}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {t("bookings.analytics.bookingVolumeHint")}
                  </p>
                </div>
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-black text-blue-600 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-500">
                  {dailyTotal}
                </span>
              </div>
              <AnalyticsVolumeBars
                label={t("bookings.analytics.dailyVolume")}
                items={dailyVolume}
              />
              <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 dark:border-white/5">
                <div className="rounded-xl bg-white p-3 dark:bg-slate-900">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                    {t("bookings.analytics.sixWeekTotal")}
                  </p>
                  <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">{weeklyTotal}</p>
                </div>
                <div className="rounded-xl bg-white p-3 dark:bg-slate-900">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                    {t("bookings.analytics.weeklyPeak")}
                  </p>
                  <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">{weeklyPeak}</p>
                </div>
              </div>
            </div>

              <div className="space-y-5">
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-800">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {t("bookings.analytics.topSpaces")}
                </p>
                {(analytics.topWorkspaces.length ? analytics.topWorkspaces.slice(0, 3) : []).map((workspace) => (
                  <div key={workspace.workspaceId} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950 dark:text-white">{workspace.workspaceName}</p>
                      <p className="truncate text-[10px] font-bold text-slate-500">{workspace.buildingName} • {workspace.floorName}</p>
                    </div>
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-600 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-500">
                      {workspace.bookingCount}
                    </span>
                  </div>
                ))}
                {analytics.topWorkspaces.length === 0 && (
                  <p className="text-xs font-semibold text-slate-500">{t("bookings.analytics.noTopSpaces")}</p>
                )}
              </div>

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-800">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {t("bookings.analytics.floorUtilization")}
                </p>
                {topFloors.map((floor) => (
                  <div key={floor.floorId} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-xs font-bold">
                      <span className="flex min-w-0 items-center gap-2 text-slate-950 dark:text-white">
                        <Building2 size={14} className="shrink-0 text-blue-600 dark:text-primary-500" />
                        <span className="truncate">{floor.buildingName} • {floor.floorName}</span>
                      </span>
                      <span className="text-slate-400">{floor.occupiedCount}/{floor.workspaceCount}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/5">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${floor.utilizationRate}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm font-semibold text-slate-500">
            {t("bookings.analytics.empty")}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function AnalyticsVolumeBars({
  label,
  items,
}: {
  label: string
  items: Array<{ periodStart: string; label: string; count: number }>
}) {
  const maxCount = Math.max(...items.map((item) => item.count), 1)

  return (
    <div className="space-y-3">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</p>
      <div className="grid grid-cols-7 gap-2">
        {items.map((item) => (
          <div key={item.periodStart} className="space-y-2">
            <div className="flex h-20 items-end rounded-xl bg-white p-1.5 dark:bg-slate-900">
              <div
                className="w-full rounded-lg bg-blue-600 transition-all dark:bg-primary-500"
                style={{ height: `${Math.max((item.count / maxCount) * 100, item.count > 0 ? 18 : 4)}%` }}
              />
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-slate-950 dark:text-white">{item.count}</p>
              <p className="truncate text-[10px] font-bold text-slate-500">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AnalyticsMetric({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  tone: "amber" | "blue" | "emerald"
}) {
  const toneClass = {
    amber: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-500 dark:bg-amber-500/10 dark:border-amber-500/20",
    blue: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-500 dark:bg-blue-500/10 dark:border-blue-500/20",
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-500 dark:bg-emerald-500/10 dark:border-emerald-500/20",
  }[tone]

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-800">
      <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-xl border", toneClass)}>
        {icon}
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
    </div>
  )
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <Card className="border-slate-200 bg-white text-slate-950 shadow-sm shadow-slate-200/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-blue-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-white/20">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{label}</p>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 shadow-inner dark:border-white/10 dark:bg-slate-800">
            {icon}
          </div>
        </div>
        <p className="text-3xl font-black text-slate-950 dark:text-white">{value}</p>
      </CardContent>
    </Card>
  )
}

function BookingItem({ booking, onCancel, isActionLoading, now }: BookingItemProps) {
  const { locale, t } = useLanguage()
  const router = useRouter()
  const dateLocale = locale === "vi" ? "vi-VN" : undefined
  const statusConfig: BookingStatusConfig = {
    upcoming: { label: t("bookings.status.upcoming"), className: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-500 dark:border-blue-500/20" },
    active: { label: t("bookings.status.active"), className: "bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20" },
    checkedIn: { label: t("bookings.status.checkedIn"), className: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-500 dark:border-emerald-500/20" },
    completed: { label: t("bookings.status.completed"), className: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-white/5" },
    cancelled: { label: t("bookings.status.cancelled"), className: "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-500 dark:border-rose-500/20" },
    noShow: { label: t("bookings.status.noShow"), className: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-500 dark:border-amber-500/20" },
  }

  const displayStatus = getBookingDisplayStatus(booking, now)
  const cfg = statusConfig[displayStatus]

  const handleNavigateToMap = () => {
    if (booking.floor_id && booking.workspace_id) {
      const params = new URLSearchParams()
      if (booking.building_id) {
        params.set("buildingId", booking.building_id)
      }
      params.set("floorId", booking.floor_id)
      params.set("workspaceId", booking.workspace_id)
      if (booking.start_time) {
        params.set("startTime", booking.start_time)
      }
      if (booking.end_time) {
        params.set("endTime", booking.end_time)
      }
      router.push(`/floor-map?${params.toString()}`)
    } else {
      router.push("/floor-map")
    }
  }

  return (
    <div className="group flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 transition-all hover:border-blue-200 hover:bg-white sm:flex-row sm:items-center dark:border-white/10 dark:bg-slate-800 dark:hover:border-primary-500/30">
      <div className="flex items-center gap-5">
        <div className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all group-hover:scale-110",
          cfg.className
        )}>
          <Calendar size={28} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="text-lg font-black text-slate-950 dark:text-white">{booking.workspace_name || t("bookings.workspaceFallback")}</h4>
            {booking.user_email && <span className="rounded-lg bg-white px-2 py-0.5 text-xs font-bold text-slate-500 dark:bg-white/5">{booking.user_email}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-slate-500">
            <span className="flex items-center gap-1.5"><MapPin size={14} className="text-primary-500" /> {booking.floor_name || t("bookings.levelFallback")}</span>
            <span className="flex items-center gap-1.5"><Clock size={14} className="text-primary-500" /> {new Date(booking.start_time).toLocaleDateString(dateLocale)} {new Date(booking.start_time).toLocaleTimeString(dateLocale, {hour: '2-digit', minute:'2-digit'})}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-4">
        <span className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border", cfg.className)}>
          {cfg.label}
        </span>
        <div className="flex items-center gap-2">
          {booking.status === 'confirmed' && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onCancel}
              disabled={isActionLoading}
              className="text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 h-10 font-bold"
            >
              {isActionLoading ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={18} className="mr-2" />}
              {t("bookings.cancel")}
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 h-10 w-10 transition-colors"
            onClick={handleNavigateToMap}
          >
            <ChevronRight size={20} />
          </Button>
        </div>
      </div>
    </div>
  )
}
