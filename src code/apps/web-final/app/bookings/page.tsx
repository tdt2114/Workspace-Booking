"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar, Clock, MapPin, Search, XCircle, CheckCircle2, History, ShieldCheck, Play, Settings2, Loader2, Info, ChevronRight } from "lucide-react"
import type { Session } from "@supabase/supabase-js"
import { DashboardLayout } from "@/components/premium/layout/dashboard-layout"
import { Button } from "@/components/premium/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/premium/ui/card"
import { Input } from "@/components/premium/ui/input"
import { useLanguage } from "@/components/premium/language-provider"
import { useToast } from "@/components/premium/ui/toast"
import { supabase } from "@/lib/supabase/client"
import { getBrowserApiBaseUrl } from "@/lib/api-base-url"
import { readApiError } from "@/lib/http-feedback"
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
  user_email?: string
}

interface BookingsResponse {
  items?: Booking[]
}

interface MeResponse {
  role?: string
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

function tFallback(t: (path: string) => string, path: string, fallback: string) {
  const value = t(path)
  return value === path ? fallback : value
}

export default function BookingsPage() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [session, setSession] = React.useState<Session | null>(null)
  const [activeTab, setActiveTab] = React.useState<"my" | "system">("my")
  const [bookings, setBookings] = React.useState<Booking[]>([])
  const [systemBookings, setSystemBookings] = React.useState<Booking[]>([])
  const [loading, setLoading] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [currentTime, setCurrentTime] = React.useState(() => Date.now())

  const apiBaseUrl = React.useMemo(() => getBrowserApiBaseUrl(), [])

  const loadData = React.useCallback(async (token: string, tab: "my" | "system") => {
    setLoading(true)
    try {
      const endpoint = tab === "my" ? "/bookings/my" : "/bookings/manage"
      const res = await fetch(`${apiBaseUrl}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json() as BookingsResponse
        if (tab === "my") setBookings(data.items || [])
        else setSystemBookings(data.items || [])
      } else {
        const message = await readApiError(res, t("bookings.loadFailed"))
        toast({ title: t("bookings.loadFailed"), description: message, variant: "error" })
      }
    } catch (err) {
      console.error("Failed to load bookings:", err)
      toast({ title: t("bookings.loadFailed"), description: t("bookings.networkError"), variant: "error" })
    } finally {
      setCurrentTime(Date.now())
      setLoading(false)
    }
  }, [apiBaseUrl, t, toast])

  React.useEffect(() => {
    const bootstrap = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (currentSession) {
        setSession(currentSession)
        // Simple check for admin role from me endpoint
        const meRes = await fetch(`${apiBaseUrl}/me`, {
          headers: { Authorization: `Bearer ${currentSession.access_token}` }
        })
        const meData = await meRes.json() as MeResponse
        setIsAdmin(meData.role === 'admin' || meData.role === 'manager')
        void loadData(currentSession.access_token, activeTab)
      }
    }
    void bootstrap()
  }, [apiBaseUrl, activeTab, loadData])

  const handleAction = async (bookingId: string, action: 'cancel' | 'no-show' | 'complete') => {
    if (!session) return
    const loadingKey = action === "cancel" ? bookingId : action
    setActionLoading(loadingKey)
    try {
      let endpoint = `${apiBaseUrl}/bookings/${bookingId}/cancel`
      const method = "PATCH"
      
      if (action === 'no-show') endpoint = `${apiBaseUrl}/bookings/maintenance/no-show`
      if (action === 'complete') endpoint = `${apiBaseUrl}/bookings/maintenance/complete`
      
      const res = await fetch(endpoint, {
        method: method,
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}` 
        }
      })
      
      if (res.ok) {
        void loadData(session.access_token, activeTab)
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

  return (
    <DashboardLayout>
      <div className="space-y-8" data-testid="bookings-page">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-white mb-2 tracking-tight">{t("bookings.title")}</h1>
            <p className="text-slate-400 font-medium">{t("bookings.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2 glass p-1.5 rounded-2xl border-white/5">
            <button 
              data-testid="bookings-tab-my"
              onClick={() => setActiveTab("my")}
              className={cn(
                "px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                activeTab === "my" ? "bg-primary-600 text-white shadow-lg" : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <History size={18} />
              {t("bookings.myHistory")}
            </button>
            {isAdmin && (
              <button 
                data-testid="bookings-tab-system"
                onClick={() => setActiveTab("system")}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                  activeTab === "system" ? "bg-primary-600 text-white shadow-lg" : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <ShieldCheck size={18} />
                {t("bookings.globalAccess")}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label={t("bookings.stats.total")} value={stats.total} icon={<Calendar className="text-blue-500" size={20} />} />
          <StatCard label={tFallback(t, "bookings.stats.upcoming", "Upcoming")} value={stats.upcoming} icon={<Clock className="text-blue-500" size={20} />} />
          <StatCard label={t("bookings.stats.live")} value={stats.active} icon={<CheckCircle2 className="text-emerald-500" size={20} />} />
          <StatCard label={t("bookings.stats.finalized")} value={stats.completed} icon={<History className="text-slate-400" size={20} />} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            <Card className="lg:col-span-2 glass-panel border-white/10 flex flex-col h-fit">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>{activeTab === "my" ? t("bookings.yourReservations") : t("bookings.systemRecords")}</CardTitle>
                  <CardDescription>{t("bookings.filtering").replace("{count}", String(displayedBookings.length))}</CardDescription>
                </div>
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-500 transition-colors" size={16} />
                  <Input 
                    data-testid="bookings-search"
                    placeholder={t("bookings.searchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-10 w-full sm:w-64 bg-white/5 border-white/10 rounded-xl focus:border-primary-500" 
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pb-8">
                {loading ? (
                  <div className="flex justify-center py-20">
                    <Loader2 className="w-10 h-10 text-primary-500 animate-spin opacity-20" />
                  </div>
                ) : displayedBookings.length > 0 ? (
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
                  <div className="py-20 text-center space-y-4 opacity-20">
                    <Calendar size={64} className="mx-auto" />
                    <p className="font-bold">{t("bookings.empty")}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <aside className="space-y-6">
              {activeTab === "system" && isAdmin && (
                <Card data-testid="bookings-system-section" className="glass-panel border-primary-500/20 bg-primary-500/5 overflow-hidden">
                  <CardHeader className="bg-primary-500/10">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Settings2 size={20} className="text-primary-500" />
                      {t("bookings.maintenanceTools")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-3 p-4 rounded-2xl bg-white/5 border border-white/5">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t("bookings.noShowCleanup")}</span>
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed font-medium">{t("bookings.noShowDescription")}</p>
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

                    <div className="space-y-3 p-4 rounded-2xl bg-white/5 border border-white/5">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t("bookings.archiveJob")}</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed font-medium">{t("bookings.archiveDescription")}</p>
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
              )}

              <Card className="glass-panel border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg">{t("bookings.quotaStatus")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-slate-500">{t("bookings.activeBookings")}</span>
                    <span className="text-white">{stats.active + stats.upcoming}/5</span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-500 rounded-full" style={{ width: `${Math.min(((stats.active + stats.upcoming) / 5) * 100, 100)}%` }} />
                  </div>
                  <div className="flex gap-3 pt-4 border-t border-white/5">
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

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <Card className="glass-panel border-white/5 hover:border-white/10 transition-all hover:scale-105 duration-300">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{label}</p>
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 shadow-inner">
            {icon}
          </div>
        </div>
        <p className="text-3xl font-black text-white">{value}</p>
      </CardContent>
    </Card>
  )
}

function BookingItem({ booking, onCancel, isActionLoading, now }: BookingItemProps) {
  const { locale, t } = useLanguage()
  const dateLocale = locale === "vi" ? "vi-VN" : undefined
  const statusConfig: BookingStatusConfig = {
    upcoming: { label: tFallback(t, "bookings.status.upcoming", "Upcoming"), className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
    active: { label: tFallback(t, "bookings.status.active", "Active"), className: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
    checkedIn: { label: t("bookings.status.checkedIn"), className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
    completed: { label: t("bookings.status.completed"), className: "bg-slate-500/10 text-slate-400 border-white/5" },
    cancelled: { label: t("bookings.status.cancelled"), className: "bg-rose-500/10 text-rose-500 border-rose-500/20" },
    noShow: { label: t("bookings.status.noShow"), className: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  }

  const displayStatus = getBookingDisplayStatus(booking, now)
  const cfg = statusConfig[displayStatus]

  return (
    <div className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border border-white/5 bg-white/5 hover:border-primary-500/30 transition-all gap-4">
      <div className="flex items-center gap-5">
        <div className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all group-hover:scale-110",
          cfg.className
        )}>
          <Calendar size={28} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="text-lg font-bold text-white">{booking.workspace_name || t("bookings.workspaceFallback")}</h4>
            {booking.user_email && <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded-lg font-bold">{booking.user_email}</span>}
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
          <Button variant="ghost" size="icon" className="text-slate-500 hover:text-white h-10 w-10">
            <ChevronRight size={20} />
          </Button>
        </div>
      </div>
    </div>
  )
}
