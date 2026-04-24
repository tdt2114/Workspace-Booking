"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { LayoutDashboard, Map, CalendarRange, QrCode, Settings, LogOut, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/premium/ui/button"
import { supabase } from "@/lib/supabase/client"
import { getBrowserApiBaseUrl } from "@/lib/api-base-url"

export function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = React.useState(false)
  const [role, setRole] = React.useState<string | null>(null)

  React.useEffect(() => {
    const checkRole = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        try {
          const apiBaseUrl = getBrowserApiBaseUrl()
          const res = await fetch(`${apiBaseUrl}/me`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          })
          if (res.ok) {
            const data = await res.json()
            setRole(data.role)
          }
        } catch (err) {
          console.error("Failed to fetch role:", err)
        }
      }
    }
    checkRole()
  }, [])

  const isAdmin = role === 'admin' || role === 'manager'

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", show: true },
    { icon: Map, label: "Floor Map", href: "/floor-map", show: true },
    { icon: CalendarRange, label: "My Bookings", href: "/bookings", show: true },
    { icon: QrCode, label: "QR Manager", href: "/workspace-qr", show: isAdmin },
    { icon: Settings, label: "System Setup", href: "/admin/setup", show: isAdmin },
  ]

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <aside
      className={cn(
        "relative flex flex-col glass border-r border-border transition-all duration-300 ease-in-out z-20",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      <div className="flex items-center justify-between p-6">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
              <ShieldCheck className="text-white" size={18} />
            </div>
            <span className="text-xl font-black text-gradient">Executive</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn("transition-all", isCollapsed ? "mx-auto" : "ml-auto")}
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </Button>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {menuItems.filter(item => item.show).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-4 px-3 py-3 rounded-xl transition-all group relative",
              pathname === item.href
                ? "bg-primary-500/10 text-primary-500"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <item.icon size={22} className={cn(
              "transition-transform group-hover:scale-110 shrink-0",
              pathname === item.href ? "text-primary-500" : "text-slate-400 group-hover:text-white"
            )} />
            {!isCollapsed && <span className="font-bold text-sm">{item.label}</span>}
            
            {pathname === item.href && (
              <motion.div 
                layoutId="active-nav"
                className="absolute left-0 w-1 h-6 bg-primary-500 rounded-r-full"
              />
            )}
          </Link>
        ))}
      </nav>

      {isAdmin && !isCollapsed && (
        <div className="mx-6 mb-4 p-4 rounded-2xl bg-primary-500/5 border border-primary-500/10">
          <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest mb-1">Access Level</p>
          <p className="text-xs font-bold text-white flex items-center gap-2">
            <ShieldCheck size={12} className="text-primary-500" />
            Administrator
          </p>
        </div>
      )}

      <div className="p-4 border-t border-white/5">
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className={cn(
            "w-full justify-start gap-4 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 h-12 rounded-xl",
            isCollapsed && "justify-center px-0"
          )}
        >
          <LogOut size={22} className="shrink-0" />
          {!isCollapsed && <span className="font-bold text-sm">Sign Out</span>}
        </Button>
      </div>
    </aside>
  )
}
