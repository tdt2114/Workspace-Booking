"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react"
import { cn } from "@/lib/utils"

type ToastVariant = "success" | "error" | "info"

interface ToastInput {
  title: string
  description?: string
  variant?: ToastVariant
  durationMs?: number
}

interface ToastItem extends Required<Omit<ToastInput, "description">> {
  id: string
  description?: string
}

interface ToastContextValue {
  toast: (input: ToastInput) => void
  dismiss: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

const variantConfig: Record<ToastVariant, { icon: React.ReactNode; className: string }> = {
  success: {
    icon: <CheckCircle2 size={20} />,
    className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  },
  error: {
    icon: <AlertCircle size={20} />,
    className: "border-rose-500/25 bg-rose-500/10 text-rose-300",
  },
  info: {
    icon: <Info size={20} />,
    className: "border-primary-500/25 bg-primary-500/10 text-primary-200",
  },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([])

  const dismiss = React.useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = React.useCallback((input: ToastInput) => {
    const id = crypto.randomUUID()
    const item: ToastItem = {
      id,
      title: input.title,
      description: input.description,
      variant: input.variant ?? "info",
      durationMs: input.durationMs ?? 4200,
    }

    setItems((current) => [item, ...current].slice(0, 4))
    window.setTimeout(() => dismiss(id), item.durationMs)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col gap-3 sm:inset-x-auto sm:right-6 sm:w-[380px]"
      >
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const config = variantConfig[item.variant]

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: -12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                className={cn(
                  "pointer-events-auto overflow-hidden rounded-2xl border p-4 shadow-2xl backdrop-blur-xl",
                  "bg-slate-950/90 text-white shadow-black/30",
                  config.className,
                )}
              >
                <div className="flex gap-3">
                  <div className="mt-0.5 shrink-0">{config.icon}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-white">{item.title}</p>
                    {item.description ? (
                      <p className="mt-1 text-xs font-medium leading-relaxed text-slate-300">{item.description}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label="Dismiss notification"
                    onClick={() => dismiss(item.id)}
                    className="shrink-0 rounded-full p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider")
  }

  return context
}
