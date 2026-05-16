"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  Building2,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  PlusCircle,
  QrCode,
  ScanLine,
  Settings,
  ShieldCheck,
  UserCog,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/premium/ui/button"
import { LanguageToggle } from "@/components/premium/ui/language-toggle"
import { ModeToggle } from "@/components/premium/ui/mode-toggle"
import { AccountMenu } from "@/components/premium/layout/account-menu"
import { NotificationMenu, type NotificationItem } from "@/components/premium/layout/notification-menu"
import { useLanguage } from "@/components/premium/language-provider"
import { supabase } from "@/lib/supabase/client"
import { getBrowserApiBaseUrl } from "@/lib/api-base-url"

interface DashboardLayoutProps {
  children: React.ReactNode
}

interface MeResponse {
  email?: string
  fullName?: string | null
  full_name?: string | null
  role?: string
}

interface ReminderBooking {
  id: string
  workspace_name: string
  floor_name: string
  start_time: string
  end_time: string
  status: "confirmed" | "checked_in" | "completed" | "cancelled" | "no_show"
}

interface BookingsResponse {
  items?: ReminderBooking[]
}

interface OwnerRequest {
  id: string
  user_id: string
  status: "none" | "pending" | "approved" | "rejected"
  message: string | null
  created_at: string
}

interface OwnerRequestsResponse {
  items?: OwnerRequest[]
}

interface WorkspaceApproval {
  id: string
  name: string
  approval_status?: string
}

interface WorkspacesResponse {
  items?: WorkspaceApproval[]
}

function tFallback(t: (path: string) => string, path: string, fallback: string) {
  const value = t(path)
  return value === path ? fallback : value
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { locale, t } = useLanguage()
  const [profile, setProfile] = React.useState<MeResponse | null>(null)
  const [bookings, setBookings] = React.useState<ReminderBooking[]>([])
  const [ownerRequests, setOwnerRequests] = React.useState<OwnerRequest[]>([])
  const [workspaces, setWorkspaces] = React.useState<WorkspaceApproval[]>([])
  const [currentTime, setCurrentTime] = React.useState(() => Date.now())
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  React.useEffect(() => {
    const checkRole = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push("/login")
        return
      }

      try {
        const apiBaseUrl = getBrowserApiBaseUrl()
        const res = await fetch(`${apiBaseUrl}/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        })
        let meData: MeResponse | null = null
        if (res.ok) {
          meData = await res.json() as MeResponse
          setProfile(meData)
        }

        const bookingsRes = await fetch(`${apiBaseUrl}/bookings/my`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        })
        if (bookingsRes.ok) {
          const data = await bookingsRes.json() as BookingsResponse
          setBookings(data.items ?? [])
        }

        if (meData?.role === "admin") {
          const headers = { Authorization: `Bearer ${session.access_token}` }
          const [ownerRequestsRes, workspacesRes] = await Promise.all([
            fetch(`${apiBaseUrl}/space-owner-requests`, { headers }),
            fetch(`${apiBaseUrl}/workspaces`, { headers }),
          ])

          if (ownerRequestsRes.ok) {
            const requestsData = await ownerRequestsRes.json() as OwnerRequestsResponse
            setOwnerRequests(requestsData.items ?? [])
          }

          if (workspacesRes.ok) {
            const workspacesData = await workspacesRes.json() as WorkspacesResponse
            setWorkspaces(workspacesData.items ?? [])
          }
        }
      } catch (err) {
        console.error("Auth check error:", err)
      }
    }

    void checkRole()
  }, [router])

  React.useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTime(Date.now()), 60_000)
    return () => window.clearInterval(intervalId)
  }, [])

  const role = profile?.role ?? null
  const isAdmin = role === "admin"
  const isSpaceOwner = role === "space_owner"
  const canManageOwnSpaces = isSpaceOwner
  const displayName = profile?.fullName ?? profile?.full_name ?? profile?.email ?? "Workspace User"
  const dateLocale = locale === "vi" ? "vi-VN" : undefined
  const reminder = React.useMemo(() => {
    const checkInWindowMs = 15 * 60 * 1000
    const upcomingWindowMs = 30 * 60 * 1000

    return bookings
      .filter(booking => booking.status === "confirmed" || booking.status === "checked_in")
      .map(booking => {
        const start = new Date(booking.start_time).getTime()
        const end = new Date(booking.end_time).getTime()
        const startsInMs = start - currentTime
        const inCheckInWindow = booking.status === "confirmed" && currentTime >= start - checkInWindowMs && currentTime <= end
        const activeCheckedIn = booking.status === "checked_in" && currentTime <= end
        const upcomingSoon = booking.status === "confirmed" && startsInMs > 0 && startsInMs <= upcomingWindowMs
        const priority = activeCheckedIn ? 0 : inCheckInWindow ? 1 : upcomingSoon ? 2 : 99

        return { booking, start, end, priority, activeCheckedIn, inCheckInWindow, upcomingSoon }
      })
      .filter(item => item.priority < 99)
      .sort((a, b) => a.priority - b.priority || a.start - b.start)[0] ?? null
  }, [bookings, currentTime])

  const notifications = React.useMemo<NotificationItem[]>(() => {
    const checkInWindowMs = 15 * 60 * 1000
    const upcomingWindowMs = 30 * 60 * 1000
    const bookingNotifications: NotificationItem[] = []

    bookings
      .filter(booking => booking.status === "confirmed" || booking.status === "checked_in")
      .forEach(booking => {
        const start = new Date(booking.start_time).getTime()
        const end = new Date(booking.end_time).getTime()
        const startsInMs = start - currentTime
        const inCheckInWindow = booking.status === "confirmed" && currentTime >= start - checkInWindowMs && currentTime <= end
        const activeCheckedIn = booking.status === "checked_in" && currentTime <= end
        const upcomingSoon = booking.status === "confirmed" && startsInMs > 0 && startsInMs <= upcomingWindowMs

        if (!inCheckInWindow && !activeCheckedIn && !upcomingSoon) {
          return
        }

        const startLabel = new Date(booking.start_time).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })

        bookingNotifications.push({
          id: `booking-${booking.id}`,
          title: activeCheckedIn
            ? t("layout.reminder.activeLabel")
            : inCheckInWindow
              ? t("layout.reminder.readyLabel")
              : t("layout.reminder.upcomingLabel"),
          description: `${booking.workspace_name || t("bookings.workspaceFallback")} - ${startLabel}`,
          href: activeCheckedIn ? "/bookings" : "/check-in",
          icon: activeCheckedIn ? CheckCircle2 : CalendarClock,
          tone: activeCheckedIn ? "emerald" : "blue",
          urgent: inCheckInWindow,
        })
      })

    const ownerRequestNotifications = isAdmin
      ? ownerRequests
        .filter(request => request.status === "pending")
        .slice(0, 5)
        .map(request => ({
          id: `owner-request-${request.id}`,
          title: tFallback(t, "layout.notifications.ownerRequest", "Space owner request"),
          description: request.message?.trim() || tFallback(t, "layout.notifications.ownerRequestFallback", "A user is waiting for manager approval."),
          href: "/admin/setup",
          icon: UserCog,
          tone: "amber" as const,
          urgent: true,
        }))
      : []

    const workspaceNotifications = isAdmin
      ? workspaces
        .filter(workspace => workspace.approval_status === "pending_approval")
        .slice(0, 5)
        .map(workspace => ({
          id: `workspace-${workspace.id}`,
          title: tFallback(t, "layout.notifications.workspaceApproval", "Workspace pending approval"),
          description: workspace.name,
          href: "/admin/setup",
          icon: Building2,
          tone: "amber" as const,
          urgent: true,
        }))
      : []

    return [...bookingNotifications, ...ownerRequestNotifications, ...workspaceNotifications]
  }, [bookings, currentTime, dateLocale, isAdmin, ownerRequests, t, workspaces])

  const navItems = [
    { label: t("layout.nav.home"), href: "/dashboard", icon: LayoutDashboard, show: true },
    { label: t("layout.nav.bookSpace"), href: "/floor-map", icon: Map, show: true },
    { label: t("layout.nav.myBookings"), href: "/bookings", icon: CalendarRange, show: true },
    { label: t("layout.nav.checkIn"), href: "/check-in", icon: ScanLine, show: true },
    { label: t("layout.nav.mySpaces"), href: "/admin/setup", icon: PlusCircle, show: canManageOwnSpaces },
    { label: t("layout.nav.qrAssets"), href: "/workspace-qr", icon: QrCode, show: isAdmin },
    { label: t("layout.nav.system"), href: "/admin/setup", icon: Settings, show: isAdmin },
  ].filter(item => item.show)

  const roleLabel = isAdmin
    ? t("layout.role.admin")
    : isSpaceOwner
      ? t("layout.role.spaceOwner")
      : t("layout.role.member")

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 selection:bg-blue-500/20 dark:bg-[#070b16] dark:text-white">
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white text-slate-950 shadow-lg shadow-slate-900/5 dark:border-white/10 dark:bg-slate-950 dark:text-white">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-8">
            <Link href="/dashboard" className="flex shrink-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 ring-1 ring-blue-500/20 dark:bg-white/10 dark:ring-white/20">
                <ShieldCheck size={23} />
              </div>
              <span className="text-xl font-black tracking-tight">
                Workspace<span className="text-blue-600 dark:text-blue-300">Connect</span>
              </span>
            </Link>

            <div className="hidden items-center gap-1 lg:flex">
              {navItems.map((item) => {
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all",
                      active ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20 dark:bg-white dark:text-slate-950" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                    )}
                  >
                    <item.icon size={17} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 md:flex dark:border-white/10 dark:bg-white/5">
              <LanguageToggle className="h-9 px-2.5" />
              <ModeToggle className="h-9 px-2.5" />
            </div>

            <NotificationMenu notifications={notifications} />

            <AccountMenu
              displayName={displayName}
              roleLabel={roleLabel}
              isAdmin={isAdmin}
              isSpaceOwner={isSpaceOwner}
              onSignOut={handleSignOut}
            />

            <button
              onClick={() => setMobileMenuOpen(value => !value)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-950 dark:bg-white/10 dark:text-white lg:hidden"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed inset-x-0 top-16 z-40 border-b border-slate-200 bg-white p-4 shadow-xl lg:hidden dark:border-white/10 dark:bg-slate-900"
          >
            <div className="mb-4 flex items-center justify-between rounded-2xl bg-slate-50 p-3 dark:bg-white/5">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-950 dark:text-white">{displayName}</p>
                <p className="text-xs font-semibold text-slate-500">{roleLabel}</p>
              </div>
              <div className="flex items-center gap-2">
                <LanguageToggle />
                <ModeToggle />
              </div>
            </div>
            <div className="grid gap-2">
              {navItems.map((item) => {
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold",
                      active ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                    )}
                  >
                    <item.icon size={19} />
                    {item.label}
                  </Link>
                )
              })}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                <LogOut size={19} />
                {t("legacy.signOut")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="mx-auto max-w-[1600px] px-4 pb-28 pt-24 sm:px-6 lg:px-10 lg:pb-10">
        {reminder && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 overflow-hidden rounded-[1.75rem] border border-blue-200 bg-white shadow-lg shadow-blue-100/70 dark:border-blue-500/20 dark:bg-slate-900 dark:shadow-blue-950/20"
            data-testid="check-in-reminder-banner"
          >
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex min-w-0 gap-4">
                <div className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                  reminder.activeCheckedIn ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                )}>
                  {reminder.activeCheckedIn ? <CheckCircle2 size={24} /> : <CalendarClock size={24} />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">
                    {reminder.activeCheckedIn
                      ? t("layout.reminder.activeLabel")
                      : reminder.inCheckInWindow
                        ? t("layout.reminder.readyLabel")
                        : t("layout.reminder.upcomingLabel")}
                  </p>
                  <h2 className="mt-1 truncate text-lg font-black text-slate-950 dark:text-white">
                    {reminder.booking.workspace_name || t("bookings.workspaceFallback")}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {reminder.booking.floor_name || t("bookings.levelFallback")}
                    {" · "}
                    {new Date(reminder.booking.start_time).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}
                    {" - "}
                    {new Date(reminder.booking.end_time).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:flex sm:items-center">
                <Button asChild className="h-11 rounded-2xl px-5 font-black">
                  <Link href={reminder.activeCheckedIn ? "/bookings" : "/check-in"}>
                    {reminder.activeCheckedIn
                      ? t("layout.reminder.viewBooking")
                      : t("layout.reminder.checkInNow")}
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-11 rounded-2xl border-slate-200 px-5 font-black text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200">
                  <Link href="/bookings">{t("layout.nav.myBookings")}</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
        {children}
      </main>

      <div className="fixed inset-x-4 bottom-4 z-50 grid grid-cols-4 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/15 lg:hidden dark:border-white/10 dark:bg-slate-900">
        {navItems.slice(0, 4).map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[9px] font-black uppercase tracking-tighter",
                active ? "bg-blue-600 text-white" : "text-slate-500 dark:text-slate-400"
              )}
            >
              <item.icon size={18} />
              <span className="max-w-full truncate px-0.5">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
