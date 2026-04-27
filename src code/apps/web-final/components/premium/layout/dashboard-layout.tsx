"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { LayoutDashboard, Map, CalendarRange, QrCode, Settings, LogOut, ShieldCheck, Bell, Search, Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/premium/ui/button"
import { supabase } from "@/lib/supabase/client"
import { getBrowserApiBaseUrl } from "@/lib/api-base-url"

interface DashboardLayoutProps {
  children: React.ReactNode
}

interface MeResponse {
  role?: string
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [role, setRole] = React.useState<string | null>(null)
  const [scrolled, setScrolled] = React.useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  React.useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll)
    
    const checkRole = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        try {
          const apiBaseUrl = getBrowserApiBaseUrl()
          const res = await fetch(`${apiBaseUrl}/me`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          })
          if (res.ok) {
            const data = await res.json() as MeResponse
            setRole(data.role ?? null)
          }
        } catch (err) {
          console.error("Auth check error:", err)
        }
      } else {
        router.push("/login")
      }
    }
    checkRole()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [router])

  const isAdmin = role === 'admin' || role === 'manager'

  const navItems = [
    { label: "Home", href: "/dashboard", icon: LayoutDashboard },
    { label: "Book Space", href: "/floor-map", icon: Map },
    { label: "My Bookings", href: "/bookings", icon: CalendarRange },
    ...(isAdmin ? [
      { label: "QR Assets", href: "/workspace-qr", icon: QrCode },
      { label: "System", href: "/admin/setup", icon: Settings },
    ] : []),
  ]

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-[#07090D] text-white selection:bg-primary-500/30">
      {/* --- TOP NAVIGATION BAR --- */}
      <nav 
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500 px-6 py-4 flex items-center justify-between",
          scrolled ? "bg-[#07090D]/80 backdrop-blur-xl border-b border-white/5 py-3" : "bg-transparent"
        )}
      >
        <div className="flex items-center gap-12">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:rotate-6 transition-transform">
              <ShieldCheck className="text-white" size={24} />
            </div>
            <span className="text-2xl font-black tracking-tighter text-white">OFFICE<span className="text-primary-500">HUB</span></span>
          </Link>

          {/* Desktop Nav Items */}
          <div className="hidden lg:flex items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all relative group",
                  pathname === item.href 
                    ? "text-white" 
                    : "text-slate-400 hover:text-white"
                )}
              >
                {item.label}
                {pathname === item.href && (
                  <motion.div 
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-white/5 border border-white/10 rounded-xl -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <div className={cn(
                  "absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary-500 rounded-full transition-all duration-300 opacity-0",
                  pathname === item.href && "opacity-100 translate-y-1"
                )} />
              </Link>
            ))}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3 mr-4 border-r border-white/5 pr-6">
             <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white rounded-full">
                <Search size={20} />
             </Button>
             <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white rounded-full relative">
                <Bell size={20} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-primary-500 rounded-full border-2 border-[#07090D]" />
             </Button>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end text-right">
              <p className="text-xs font-black text-white leading-none">{isAdmin ? "ADMIN ACCESS" : "EXECUTIVE"}</p>
              <p className="text-[10px] text-slate-500 font-bold tracking-widest mt-1">PRO MEMBER</p>
            </div>
            <button 
              onClick={handleSignOut}
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all active:scale-95"
            >
              <LogOut size={18} />
            </button>
            
            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden w-10 h-10 flex items-center justify-center text-white"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {/* --- MOBILE MENU --- */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="fixed top-20 left-0 right-0 z-40 bg-[#07090D] border-b border-white/10 lg:hidden overflow-hidden"
          >
            <div className="p-6 space-y-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-2xl transition-all",
                    pathname === item.href 
                      ? "bg-primary-500/10 text-primary-500 border border-primary-500/20" 
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  <item.icon size={20} />
                  <span className="font-bold">{item.label}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- MAIN CONTENT --- */}
      <main className="relative mx-auto max-w-[1600px] px-6 pb-32 pt-32 lg:px-12 lg:pb-12">
        {/* Background Ambient Orbs */}
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[80%] h-[40%] bg-primary-900/10 rounded-full blur-[160px] pointer-events-none -z-10" />
        <div className="fixed bottom-0 right-0 w-[30%] h-[30%] bg-blue-900/5 rounded-full blur-[140px] pointer-events-none -z-10" />
        
        {children}
      </main>

      {/* --- MOBILE BOTTOM BAR (Optional but very App-like) --- */}
      <div className="lg:hidden fixed bottom-6 left-6 right-6 h-16 glass-panel border-white/10 rounded-2xl flex items-center justify-around px-4 z-50">
        {navItems.slice(0, 3).map((item) => (
          <Link 
            key={item.href} 
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              pathname === item.href ? "text-primary-500 scale-110" : "text-slate-500"
            )}
          >
            <item.icon size={20} />
            <span className="text-[10px] font-bold uppercase">{item.label.split(' ')[0]}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
