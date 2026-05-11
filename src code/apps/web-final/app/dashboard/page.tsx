"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  LayoutList,
  Loader2,
  MapPin,
  QrCode,
  UserPlus,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { getBrowserApiBaseUrl } from "@/lib/api-base-url"
import { DashboardLayout } from "@/components/premium/layout/dashboard-layout"
import { Button } from "@/components/premium/ui/button"
import { useToast } from "@/components/premium/ui/toast"
import { useLanguage } from "@/components/premium/language-provider"
import { cn } from "@/lib/utils"

interface Booking {
  id: string
  workspace_name: string
  floor_name: string
  start_time: string
  end_time: string
  status: "confirmed" | "checked_in" | "completed" | "cancelled" | "no_show"
}

interface BookingsResponse {
  items?: Booking[]
}

interface MeResponse {
  role?: string
}

interface OwnerRequestResponse {
  status?: "none" | "pending" | "approved" | "rejected"
}

interface QuickActionProps {
  href: string
  icon: React.ReactNode
  label: string
  description: string
  tone: "blue" | "emerald" | "slate"
}

function tFallback(t: (path: string) => string, path: string, fallback: string) {
  const value = t(path)
  return value === path ? fallback : value
}

export default function DashboardPage() {
  const router = useRouter()
  const { locale, t } = useLanguage()
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [bookings, setBookings] = React.useState<Booking[]>([])
  const [role, setRole] = React.useState<string | null>(null)
  const [ownerRequestStatus, setOwnerRequestStatus] = React.useState<OwnerRequestResponse["status"]>("none")
  const [ownerRequestLoading, setOwnerRequestLoading] = React.useState(false)
  const [currentTime, setCurrentTime] = React.useState(() => Date.now())
  const dateLocale = locale === "vi" ? "vi-VN" : undefined

  const apiBaseUrl = React.useMemo(() => getBrowserApiBaseUrl(), [])

  React.useEffect(() => {
    const bootstrap = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        router.push("/login")
        return
      }

      try {
        setLoadError(null)
        const headers = { Authorization: `Bearer ${currentSession.access_token}` }
        const [meRes, requestRes, bookingsRes] = await Promise.all([
          fetch(`${apiBaseUrl}/me`, { headers }),
          fetch(`${apiBaseUrl}/space-owner-requests/my`, { headers }),
          fetch(`${apiBaseUrl}/bookings/my`, { headers }),
        ])
        if (meRes.ok) {
          const meData = await meRes.json() as MeResponse
          setRole(meData.role ?? null)
        }
        if (requestRes.ok) {
          const requestData = await requestRes.json() as OwnerRequestResponse
          setOwnerRequestStatus(requestData.status ?? "none")
        }
        if (bookingsRes.ok) {
          const data = await bookingsRes.json() as BookingsResponse
          setBookings(data.items || [])
        } else {
          setLoadError(t("dashboard.loadFailed"))
          toast({ title: t("dashboard.loadFailed"), variant: "error" })
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err)
        setLoadError(t("dashboard.networkError"))
        toast({ title: t("dashboard.loadFailed"), description: t("dashboard.networkError"), variant: "error" })
      } finally {
        setCurrentTime(Date.now())
        setLoading(false)
      }
    }

    void bootstrap()
  }, [apiBaseUrl, router, t, toast])

  const upcomingBookings = React.useMemo(() => {
    return bookings
      .filter(booking => {
        const end = new Date(booking.end_time).getTime()
        return (booking.status === "confirmed" || booking.status === "checked_in") && Number.isFinite(end) && end > currentTime
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  }, [bookings, currentTime])

  const nextBooking = upcomingBookings[0] ?? null
  const canRequestOwner = role === "user"

  async function handleRequestSpaceOwner() {
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    if (!currentSession) return
    setOwnerRequestLoading(true)
    try {
      const res = await fetch(`${apiBaseUrl}/space-owner-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({
          message: "I want to publish and manage my own workspaces.",
        }),
      })
      if (res.ok) {
        setOwnerRequestStatus("pending")
        toast({ title: "Space Owner request submitted", variant: "success" })
      } else {
        toast({ title: "Could not submit request", variant: "error" })
      }
    } catch {
      toast({ title: "Could not submit request", description: t("dashboard.networkError"), variant: "error" })
    } finally {
      setOwnerRequestLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 opacity-60" />
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-8" data-testid="dashboard-page">
        <div className="border-b border-slate-200 pb-5 dark:border-white/10">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">
            {tFallback(t, "dashboard.hub", "Workspace Hub")}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl dark:text-white">
            {tFallback(t, "dashboard.title", "Dashboard")}
          </h1>
          <p className="mt-2 max-w-2xl text-base font-medium text-slate-500">
            {t("dashboard.heroDescription")}
          </p>
        </div>

        {loadError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700 dark:border-red-500/20 dark:bg-red-500/10">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 shrink-0" size={20} />
              <div>
                <p className="font-black">{t("dashboard.loadFailed")}</p>
                <p className="mt-1 text-sm font-medium">{loadError}</p>
              </div>
            </div>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              {t("dashboard.retry")}
            </Button>
          </div>
        )}

        {canRequestOwner && (
          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm dark:border-blue-500/20 dark:bg-blue-500/10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                  <UserPlus size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-950 dark:text-white">Request to become Space Owner</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {ownerRequestStatus === "pending"
                      ? "Your request is pending System Admin approval."
                      : ownerRequestStatus === "rejected"
                        ? "Your previous request was rejected. You can submit again with updated details."
                        : "Send a request to publish and manage your own workspaces."}
                  </p>
                </div>
              </div>
              <Button
                className="h-11 rounded-xl font-black"
                onClick={handleRequestSpaceOwner}
                isLoading={ownerRequestLoading}
                disabled={ownerRequestLoading || ownerRequestStatus === "pending"}
              >
                {ownerRequestStatus === "pending" ? "Pending approval" : "Request access"}
              </Button>
            </div>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <h2 className="text-xl font-black text-slate-950 dark:text-white">
              {tFallback(t, "dashboard.quickActions", "Quick Actions")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <QuickAction
                href="/floor-map"
                icon={<Calendar size={32} />}
                label={t("layout.nav.bookSpace")}
                description={tFallback(t, "dashboard.quickBookHint", "Reserve a space for your work session.")}
                tone="blue"
              />
              <QuickAction
                href="/check-in"
                icon={<QrCode size={32} />}
                label={tFallback(t, "layout.nav.checkIn", "Check-in")}
                description={tFallback(t, "dashboard.quickCheckInHint", "Scan QR or enter your workspace code.")}
                tone="emerald"
              />
              <QuickAction
                href="/bookings"
                icon={<LayoutList size={32} />}
                label={t("layout.nav.myBookings")}
                description={tFallback(t, "dashboard.quickHistoryHint", "Review, cancel or manage reservations.")}
                tone="slate"
              />
            </div>
          </div>

          <NextBookingCard booking={nextBooking} dateLocale={dateLocale} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
            <div>
              <h2 className="text-xl font-black text-slate-950 dark:text-white">
                {tFallback(t, "dashboard.recentActivity", "Recent Activity")}
              </h2>
              <p className="text-sm font-medium text-slate-500">
                {tFallback(t, "dashboard.recentActivityHint", "Latest booking updates from your account.")}
              </p>
            </div>
            <Button asChild variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200">
              <Link href="/bookings">{t("dashboard.viewHistory")}</Link>
            </Button>
          </div>

          <div className="mt-5 space-y-1">
            {bookings.length > 0 ? (
              bookings.slice(0, 5).map((booking, index) => (
                <ActivityItem key={booking.id} booking={booking} index={index} dateLocale={dateLocale} />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-white/10">
                <Calendar className="mx-auto text-slate-400" size={42} />
                <p className="mt-3 font-black text-slate-950 dark:text-white">{t("dashboard.emptyBookings")}</p>
                <p className="mx-auto mt-1 max-w-lg text-sm font-medium text-slate-500">{t("dashboard.emptyBookingsHint")}</p>
                <Button asChild className="mt-5">
                  <Link href="/floor-map">{t("dashboard.bookFirstSpace")}</Link>
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}

function QuickAction({ href, icon, label, description, tone }: QuickActionProps) {
  const toneClass = {
    blue: "text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20",
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20",
    slate: "text-slate-600 bg-slate-50 border-slate-100 dark:text-slate-300 dark:bg-white/5 dark:border-white/10",
  }[tone]

  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg dark:border-white/10 dark:bg-slate-900 dark:hover:border-blue-500/30"
    >
      <div className={cn("mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border", toneClass)}>
        {icon}
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-950 dark:text-white">{label}</h3>
          <p className="mt-1 text-sm font-medium leading-relaxed text-slate-500">{description}</p>
        </div>
        <ArrowRight className="mt-1 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600" size={20} />
      </div>
    </Link>
  )
}

function NextBookingCard({ booking, dateLocale }: { booking: Booking | null; dateLocale?: string }) {
  const { t } = useLanguage()

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-blue-300 bg-blue-50 p-5 shadow-sm dark:border-blue-500/30 dark:bg-blue-500/10"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-950 dark:text-white">
            {tFallback(t, "dashboard.nextBooking", "Next Booking")}
          </h2>
          {booking ? (
            <>
              <p className="mt-4 text-sm font-bold text-slate-600 dark:text-slate-300">
                {new Date(booking.start_time).toLocaleDateString(dateLocale, { weekday: "short", month: "short", day: "numeric" })}
                {", "}
                {new Date(booking.start_time).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}
                {" - "}
                {new Date(booking.end_time).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="mt-1 text-lg font-black text-slate-950 dark:text-white">{booking.workspace_name}</p>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
                <MapPin size={15} />
                {booking.floor_name}
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-500">
              {t("dashboard.emptyBookingsHint")}
            </p>
          )}
        </div>
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm dark:bg-white/10">
          <MapPin size={30} />
        </div>
      </div>

      <Button asChild className="mt-5 h-11 w-full bg-emerald-600 font-black hover:bg-emerald-700">
        <Link href={booking ? "/check-in" : "/floor-map"}>
          {booking ? t("dashboard.checkInNow") : t("dashboard.bookFirstSpace")}
        </Link>
      </Button>
    </motion.div>
  )
}

function ActivityItem({ booking, index, dateLocale }: { booking: Booking; index: number; dateLocale?: string }) {
  const status = booking.status
  const tone = {
    confirmed: "bg-blue-50 text-blue-600 dark:bg-blue-500/10",
    checked_in: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10",
    completed: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
    cancelled: "bg-red-50 text-red-600 dark:bg-red-500/10",
    no_show: "bg-amber-50 text-amber-600 dark:bg-amber-500/10",
  }[status]
  const icon = status === "checked_in" ? <CheckCircle2 size={18} /> : status === "confirmed" ? <Clock size={18} /> : <Calendar size={18} />

  return (
    <div className="relative flex gap-4 py-3">
      {index < 4 && <div className="absolute left-5 top-12 h-[calc(100%-1.25rem)] w-px bg-slate-200 dark:bg-white/10" />}
      <div className={cn("relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full", tone)}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-black text-slate-950 dark:text-white">
          {booking.workspace_name}
        </p>
        <p className="text-sm font-medium text-slate-500">
          {booking.status.replace("_", " ")} · {new Date(booking.start_time).toLocaleDateString(dateLocale)} {new Date(booking.start_time).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  )
}
