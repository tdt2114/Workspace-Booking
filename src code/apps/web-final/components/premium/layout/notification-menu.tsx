"use client"

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { Bell, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/components/premium/language-provider"

export interface NotificationItem {
  id: string
  title: string
  description: string
  href: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  tone: "blue" | "amber" | "emerald"
  urgent?: boolean
}

interface NotificationMenuProps {
  notifications: NotificationItem[]
}

export function NotificationMenu({ notifications }: NotificationMenuProps) {
  const { t } = useLanguage()
  const [open, setOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement | null>(null)
  const notificationCount = notifications.length

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
    <div ref={menuRef} className="relative hidden sm:block">
      <button
        onClick={() => setOpen(value => !value)}
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition hover:bg-slate-200 hover:text-slate-950 dark:bg-white/10 dark:text-white dark:hover:bg-white/15",
          open && "bg-blue-600 text-white hover:bg-blue-600 dark:bg-white dark:text-slate-950 dark:hover:bg-white"
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("layout.notifications.title")}
      >
        <Bell size={19} />
        {notificationCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-slate-950">
            {notificationCount > 9 ? "9+" : notificationCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-14 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/15 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/40"
            role="menu"
          >
            <div className="border-b border-slate-100 px-3 py-3 dark:border-white/10">
              <p className="text-sm font-black text-slate-950 dark:text-white">{t("layout.notifications.title")}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {notificationCount
                  ? t("layout.notifications.count").replace("{count}", String(notificationCount))
                  : t("layout.notifications.clear")}
              </p>
            </div>

            <div className="max-h-96 overflow-y-auto py-2">
              {notifications.length ? notifications.map(item => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex gap-3 rounded-xl px-3 py-3 transition hover:bg-slate-100 dark:hover:bg-white/10"
                    role="menuitem"
                  >
                    <span className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      item.tone === "emerald"
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : item.tone === "amber"
                          ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300"
                          : "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"
                    )}>
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-black text-slate-950 dark:text-white">{item.title}</span>
                        {item.urgent && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
                        {item.description}
                      </span>
                    </span>
                  </Link>
                )
              }) : (
                <div className="px-3 py-8 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <CheckCircle2 size={22} />
                  </div>
                  <p className="mt-3 text-sm font-black text-slate-950 dark:text-white">{t("layout.notifications.emptyTitle")}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {t("layout.notifications.emptyDescription")}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
