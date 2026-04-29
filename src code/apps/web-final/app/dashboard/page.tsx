"use client"

import * as React from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar, ArrowRight, Scan, MapPin, Loader2, Building2, Stars, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { getBrowserApiBaseUrl } from "@/lib/api-base-url"
import { DashboardLayout } from "@/components/premium/layout/dashboard-layout"
import { Button } from "@/components/premium/ui/button"
import { Input } from "@/components/premium/ui/input"
import { useLanguage } from "@/components/premium/language-provider"
import { cn } from "@/lib/utils"

interface Booking {
  id: string
  workspace_name: string
  floor_name: string
  start_time: string
  end_time: string
  status: 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'no_show'
}

interface BookingsResponse {
  items?: Booking[]
}

interface CategoryCardProps {
  title: string
  desc: string
  count: string
  icon: React.ReactNode
  color: string
  href: string
}

export default function DashboardPage() {
  const router = useRouter()
  const { locale, t } = useLanguage()
  const [loading, setLoading] = React.useState(true)
  const [bookings, setBookings] = React.useState<Booking[]>([])
  const dateLocale = locale === "vi" ? "vi-VN" : undefined

  const apiBaseUrl = React.useMemo(() => getBrowserApiBaseUrl(), [])

  React.useEffect(() => {
    const bootstrap = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (currentSession) {
        try {
          const bookingsRes = await fetch(`${apiBaseUrl}/bookings/my`, {
            headers: { Authorization: `Bearer ${currentSession.access_token}` }
          })
          if (bookingsRes.ok) {
            const data = await bookingsRes.json() as BookingsResponse
            setBookings(data.items || [])
          }
        } catch (err) {
          console.error("Dashboard fetch error:", err)
        }
      } else {
        router.push("/login")
      }
      setLoading(false)
    }
    bootstrap()
  }, [apiBaseUrl, router])

  const checkInTarget = React.useMemo(() => {
    const now = new Date()
    return bookings.find(b => {
      if (b.status !== 'confirmed') return false
      const start = new Date(b.start_time)
      const diffMs = start.getTime() - now.getTime()
      const diffMins = diffMs / (1000 * 60)
      return diffMins <= 30 && now < new Date(b.end_time)
    })
  }, [bookings])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090D] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary-500 animate-spin opacity-20" />
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-16 pb-24" data-testid="dashboard-page">
        {/* --- HERO SECTION --- */}
        <section className="relative pt-10 pb-4 text-center space-y-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-xs font-black uppercase tracking-[0.2em]">
              <Stars size={14} />
              {t("dashboard.hub")}
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-[0.9]">
              {t("dashboard.heroLine1")} <br/>
              <span className="text-gradient">{t("dashboard.heroAccent")}</span>
            </h1>
            <p className="text-lg text-slate-400 max-w-xl mx-auto font-medium">
              {t("dashboard.heroDescription")}
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="max-w-2xl mx-auto relative group"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 to-blue-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000" />
            <div className="relative flex p-2 glass rounded-3xl border border-white/10 shadow-2xl">
               <div className="flex-1 flex items-center px-6">
                 <Search className="text-slate-500" size={20} />
                 <Input 
                   placeholder={t("dashboard.searchPlaceholder")}
                   className="bg-transparent border-none focus:ring-0 text-white placeholder:text-slate-600 h-12"
                 />
               </div>
               <Button asChild data-testid="dashboard-open-floor-map" className="h-14 px-10 rounded-2xl bg-primary-600 hover:bg-primary-700 font-black shadow-lg shadow-primary-500/20">
                 <Link href="/floor-map">{t("dashboard.exploreNow")}</Link>
               </Button>
            </div>
          </motion.div>
        </section>

        {/* --- SMART BANNER --- */}
        <AnimatePresence>
          {checkInTarget && (
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel border-primary-500/30 bg-primary-500/10 p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-[80px] -mr-32 -mt-32" />
              <div className="flex items-center gap-8 relative z-10">
                <div className="w-20 h-20 rounded-3xl bg-primary-500 flex items-center justify-center text-white shadow-2xl shadow-primary-500/50">
                  <Scan size={40} className="animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-white">{t("dashboard.sessionReady")}</h3>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                    {checkInTarget.workspace_name} • {t("dashboard.startsAt")} {new Date(checkInTarget.start_time).toLocaleTimeString(dateLocale, {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </div>
              </div>
              <Button 
                asChild
                className="w-full md:w-auto h-16 px-12 bg-white text-slate-950 hover:bg-slate-100 font-black rounded-2xl text-lg shadow-2xl transition-transform active:scale-95"
              >
                <Link href="/check-in">{t("dashboard.checkInNow")}</Link>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- MAIN CONTENT: MARKETPLACE STYLE --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           <CategoryCard 
             title={t("dashboard.categories.desksTitle")}
             desc={t("dashboard.categories.desksDesc")}
             count={t("dashboard.categories.desksCount")}
             icon={<MapPin size={24} />} 
             color="bg-blue-500"
             href="/floor-map"
           />
           <CategoryCard 
             title={t("dashboard.categories.roomsTitle")}
             desc={t("dashboard.categories.roomsDesc")}
             count={t("dashboard.categories.roomsCount")}
             icon={<Building2 size={24} />} 
             color="bg-primary-500"
             href="/floor-map"
           />
           <CategoryCard 
             title={t("dashboard.categories.zonesTitle")}
             desc={t("dashboard.categories.zonesDesc")}
             count={t("dashboard.categories.zonesCount")}
             icon={<Stars size={24} />} 
             color="bg-emerald-500"
             href="/floor-map"
           />
        </div>

        {/* --- RECENT BOOKINGS --- */}
        <section className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-black text-white">{t("dashboard.reservations")}</h2>
            <Button asChild data-testid="dashboard-open-bookings" variant="ghost" className="text-primary-500 hover:text-primary-400 font-bold">
              <Link href="/bookings">{t("dashboard.viewHistory")}</Link>
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {bookings.filter(b => b.status === 'confirmed').length > 0 ? (
              bookings.filter(b => b.status === 'confirmed').slice(0, 2).map((b) => (
                <div key={b.id} className="p-6 glass rounded-[2.5rem] border-white/5 hover:border-primary-500/30 transition-all group flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-slate-500 group-hover:text-primary-500 transition-colors">
                      <Calendar size={32} />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-white">{b.workspace_name}</h4>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">{b.floor_name} • {new Date(b.start_time).toLocaleDateString(dateLocale)}</p>
                    </div>
                  </div>
                  <ArrowRight size={24} className="text-slate-800 group-hover:text-primary-500 transition-transform group-hover:translate-x-2" />
                </div>
              ))
            ) : (
              <div className="md:col-span-2 py-20 glass rounded-[2.5rem] border-dashed border-2 border-white/5 text-center opacity-30">
                <p className="text-lg font-bold">{t("dashboard.emptyBookings")}</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}

function CategoryCard({ title, desc, count, icon, color, href }: CategoryCardProps) {
  return (
    <Link 
      href={href}
      className="group p-8 glass rounded-[3rem] border-white/5 hover:border-white/20 text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
    >
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-6 shadow-xl", color)}>
        {icon}
      </div>
      <h3 className="text-2xl font-black text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-500 font-medium mb-6 leading-relaxed">{desc}</p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-400">{count}</span>
        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white group-hover:bg-primary-500 transition-colors">
          <ArrowRight size={20} />
        </div>
      </div>
    </Link>
  )
}
