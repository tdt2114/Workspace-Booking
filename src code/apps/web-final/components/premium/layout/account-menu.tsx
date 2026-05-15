"use client"

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { CalendarRange, ChevronDown, LogOut, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/components/premium/language-provider"

interface AccountMenuProps {
  displayName: string
  roleLabel: string
  isAdmin: boolean
  isSpaceOwner: boolean
  onSignOut: () => void | Promise<void>
}

function tFallback(t: (path: string) => string, path: string, fallback: string) {
  const value = t(path)
  return value === path ? fallback : value
}

export function AccountMenu({
  displayName,
  roleLabel,
  isAdmin,
  isSpaceOwner,
  onSignOut,
}: AccountMenuProps) {
  const { t } = useLanguage()
  const [open, setOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!open) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  return (
    <div ref={menuRef} className="relative hidden border-l border-slate-200 pl-2 dark:border-white/15 sm:block">
      <button
        onClick={() => setOpen(value => !value)}
        className={cn(
          "flex h-11 items-center gap-2 rounded-2xl bg-slate-100 px-1.5 pr-2 text-slate-700 transition hover:bg-slate-200 hover:text-slate-950 dark:bg-white/10 dark:text-white dark:hover:bg-white/15",
          open && "bg-blue-600 text-white hover:bg-blue-600 dark:bg-white dark:text-slate-950 dark:hover:bg-white"
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white ring-1 ring-blue-500/20 dark:bg-white dark:text-slate-950 dark:ring-white/20">
          {displayName.slice(0, 1).toUpperCase()}
        </span>
        <ChevronDown
          size={16}
          className={cn("transition-transform", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-14 z-50 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/15 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/40"
            role="menu"
          >
            <div className="border-b border-slate-100 px-3 py-3 dark:border-white/10">
              <p className="truncate text-sm font-black text-slate-950 dark:text-white">{displayName}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-100/80">
                {roleLabel}
              </p>
            </div>

            <div className="py-2">
              <Link
                href="/bookings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
                role="menuitem"
              >
                <CalendarRange size={18} />
                {t("layout.nav.myBookings")}
              </Link>

              {(isAdmin || isSpaceOwner) && (
                <Link
                  href="/admin/setup"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
                  role="menuitem"
                >
                  <Settings size={18} />
                  {isAdmin ? t("layout.nav.system") : tFallback(t, "layout.nav.mySpaces", "My Spaces")}
                </Link>
              )}
            </div>

            <button
              onClick={onSignOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
              role="menuitem"
            >
              <LogOut size={18} />
              {tFallback(t, "legacy.signOut", "Sign out")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
