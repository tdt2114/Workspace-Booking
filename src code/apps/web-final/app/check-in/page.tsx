"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Camera, QrCode, ArrowLeft, CheckCircle2, AlertCircle, History, Info, Send, Loader2, X } from "lucide-react"
import { useRouter } from "next/navigation"
import type { Session } from "@supabase/supabase-js"
import type { Html5Qrcode } from "html5-qrcode"
import { Button } from "@/components/premium/ui/button"
import { Card, CardContent } from "@/components/premium/ui/card"
import { Input } from "@/components/premium/ui/input"
import { LanguageToggle } from "@/components/premium/ui/language-toggle"
import { ModeToggle } from "@/components/premium/ui/mode-toggle"
import { useLanguage } from "@/components/premium/language-provider"
import { supabase } from "@/lib/supabase/client"
import { getBrowserApiBaseUrl } from "@/lib/api-base-url"

interface Booking {
  id: string
  workspace_name: string
  start_time: string
  end_time: string
  status: string
}

interface BookingsResponse {
  items?: Booking[]
}

interface CheckInResponse {
  message?: string
}

function findActiveCheckedInBooking(bookings: Booking[]) {
  const now = Date.now()

  return bookings
    .filter((booking) => booking.status === "checked_in" && new Date(booking.end_time).getTime() > now)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0] ?? null
}

function findNextRelevantBooking(bookings: Booking[]) {
  const now = Date.now()

  return bookings
    .filter((booking) => {
      if (booking.status !== "confirmed" && booking.status !== "checked_in") {
        return false
      }

      return new Date(booking.end_time).getTime() > now
    })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0] ?? null
}

export default function CheckInPage() {
  const router = useRouter()
  const { locale, t } = useLanguage()
  const apiBaseUrl = React.useMemo(() => getBrowserApiBaseUrl(), [])
  const dateLocale = locale === "vi" ? "vi-VN" : undefined
  const scannerContainerRef = React.useRef<HTMLDivElement | null>(null)
  const html5QrcodeRef = React.useRef<Html5Qrcode | null>(null)
  const hasDecodedRef = React.useRef(false)
  
  const [session, setSession] = React.useState<Session | null>(null)
  const [qrValue, setQrValue] = React.useState("")
  const [manualScannedAt, setManualScannedAt] = React.useState("")
  const [enableTestScanTime] = React.useState(() => {
    if (typeof window === "undefined") {
      return false
    }

    return new URLSearchParams(window.location.search).get("e2e") === "1"
  })
  const [status, setStatus] = React.useState<"idle" | "scanning" | "success" | "error">("idle")
  const [manual, setManual] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [nextBooking, setNextBooking] = React.useState<Booking | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isScannerStarting, setIsScannerStarting] = React.useState(false)

  // --- Auth & Initial Data ---
  React.useEffect(() => {
    const bootstrap = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        router.push("/login")
        return
      }
      setSession(currentSession)

      // Fetch next booking
      try {
        const res = await fetch(`${apiBaseUrl}/bookings/my`, {
          headers: { Authorization: `Bearer ${currentSession.access_token}` }
        })
        if (res.ok) {
          const data = await res.json() as BookingsResponse
          const bookings = data.items ?? []
          const activeCheckedInBooking = findActiveCheckedInBooking(bookings)
          const upcoming = findNextRelevantBooking(bookings)

          setNextBooking(activeCheckedInBooking ?? upcoming)

          if (activeCheckedInBooking) {
            setStatus("success")
          }
        }
      } catch (err) {
        console.error("Failed to load upcoming booking:", err)
      }
    }
    bootstrap()
  }, [apiBaseUrl, router])

  // --- QR Scanner Setup ---
  const handleCheckIn = React.useCallback(async (value: string) => {
    if (!session || !value) return
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await fetch(`${apiBaseUrl}/check-in/scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          qrCodeValue: value,
          scannedAt: enableTestScanTime && manualScannedAt ? new Date(manualScannedAt).toISOString() : undefined,
        })
      })

      const data = await res.json() as CheckInResponse
      if (res.ok) {
        if (nextBooking) {
          setNextBooking({
            ...nextBooking,
            status: "checked_in",
          })
        }
        setStatus("success")
      } else {
        setStatus("error")
        setErrorMessage(data.message || t("checkIn.invalidQr"))
      }
    } catch {
      setStatus("error")
      setErrorMessage(t("checkIn.networkError"))
    } finally {
      setIsSubmitting(false)
    }
  }, [apiBaseUrl, enableTestScanTime, manualScannedAt, nextBooking, session, t])

  const stopScanner = React.useCallback(async () => {
    const scanner = html5QrcodeRef.current

    if (!scanner) {
      return
    }

    html5QrcodeRef.current = null

    try {
      if (scanner.isScanning) {
        await scanner.stop()
      }
    } catch (err) {
      console.error("Failed to stop scanner:", err)
    }

    try {
      await scanner.clear()
    } catch (err) {
      console.error("Failed to clear scanner:", err)
    }
  }, [])

  React.useEffect(() => {
    if (status !== "scanning") {
      return
    }

    let cancelled = false
    let retryTimeoutId: number | null = null
    let attempts = 0

    hasDecodedRef.current = false

    const initializeScanner = async () => {
      if (cancelled) {
        return
      }

      const container = scannerContainerRef.current

      if (!container) {
        if (attempts < 10) {
          attempts += 1
          retryTimeoutId = window.setTimeout(() => {
            void initializeScanner()
          }, 100)
        } else {
          setIsScannerStarting(false)
          setStatus("error")
          setErrorMessage(t("checkIn.scannerInitFailed"))
        }
        return
      }

      try {
        const { Html5Qrcode } = await import("html5-qrcode")
        const scanner = new Html5Qrcode(container.id)
        html5QrcodeRef.current = scanner

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (hasDecodedRef.current) {
              return
            }

            hasDecodedRef.current = true
            void (async () => {
              await stopScanner()
              void handleCheckIn(decodedText)
            })()
          },
          () => {},
        )

        if (!cancelled) {
          setIsScannerStarting(false)
        }
      } catch (err) {
        console.error("Scanner start error:", err)
        await stopScanner()

        if (!cancelled) {
          setIsScannerStarting(false)
          setStatus("error")
          setErrorMessage(t("checkIn.cameraFailed"))
        }
      }
    }

    retryTimeoutId = window.setTimeout(() => {
      void initializeScanner()
    }, 0)

    return () => {
      cancelled = true

      if (retryTimeoutId !== null) {
        window.clearTimeout(retryTimeoutId)
      }

      hasDecodedRef.current = false
      setIsScannerStarting(false)
      void stopScanner()
    }
  }, [handleCheckIn, status, stopScanner, t])

  React.useEffect(() => {
    return () => {
      void stopScanner()
    }
  }, [stopScanner])

  const handleStartScanner = React.useCallback(() => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setErrorMessage(t("checkIn.cameraHttpsRequired"))
      setStatus("error")
      return
    }

    setIsScannerStarting(true)
    setErrorMessage(null)
    setStatus("scanning")
  }, [t])

  const handleCancelScanner = React.useCallback(() => {
    setStatus("idle")
    setIsScannerStarting(false)
    void stopScanner()
  }, [stopScanner])

  const handleGoToDashboard = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.assign("/dashboard")
      return
    }

    router.push("/dashboard")
  }, [router])

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white flex flex-col font-inter overflow-hidden relative" data-testid="check-in-page">
      {/* Background Orbs */}
      <div className="pointer-events-none absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary-900/10 rounded-full blur-[120px]" />
      
      {/* Mobile Navbar */}
      <nav className="p-6 flex items-center justify-between z-10">
        <button type="button" onClick={() => router.back()} className="w-12 h-12 touch-manipulation rounded-2xl glass flex items-center justify-center text-slate-400 hover:text-white transition-all active:scale-90">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-black tracking-tight text-gradient">{t("checkIn.navTitle")}</h1>
        <div className="flex items-center gap-2">
          <LanguageToggle className="h-12 rounded-2xl glass px-3" />
          <ModeToggle className="h-12 w-12 rounded-2xl glass" />
        </div>
      </nav>

      <main className="flex-1 flex flex-col px-6 pb-12 space-y-10 max-w-md mx-auto w-full relative z-10">
        <header className="space-y-3 text-center">
          <h2 className="text-4xl font-black text-white leading-tight tracking-tight">{t("checkIn.titleLine1")} <br/>{t("checkIn.titleLine2")}</h2>
          <p className="text-slate-400 font-medium px-4">{t("checkIn.description")}</p>
        </header>

        {/* Scanner Area */}
        <section className="relative aspect-square w-full max-w-[340px] mx-auto">
          {/* Decorative Corners */}
          <div className="pointer-events-none absolute top-0 left-0 w-16 h-16 border-t-[6px] border-l-[6px] border-primary-500 rounded-tl-[3rem] z-20 shadow-[0_0_15px_rgba(59,130,246,0.3)]" />
          <div className="pointer-events-none absolute top-0 right-0 w-16 h-16 border-t-[6px] border-r-[6px] border-primary-500 rounded-tr-[3rem] z-20 shadow-[0_0_15px_rgba(59,130,246,0.3)]" />
          <div className="pointer-events-none absolute bottom-0 left-0 w-16 h-16 border-b-[6px] border-l-[6px] border-primary-500 rounded-bl-[3rem] z-20 shadow-[0_0_15px_rgba(59,130,246,0.3)]" />
          <div className="pointer-events-none absolute bottom-0 right-0 w-16 h-16 border-b-[6px] border-r-[6px] border-primary-500 rounded-br-[3rem] z-20 shadow-[0_0_15px_rgba(59,130,246,0.3)]" />

          {/* Scanner Content */}
          <div className="absolute inset-4 rounded-[2.5rem] bg-slate-900/80 backdrop-blur-xl overflow-hidden flex items-center justify-center border border-white/10 shadow-2xl">
            <AnimatePresence mode="wait">
              {status === "idle" && (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center space-y-6">
                  <div className="w-24 h-24 rounded-3xl bg-primary-500/10 flex items-center justify-center mx-auto text-primary-500 ring-1 ring-primary-500/20">
                    <Camera size={48} />
                  </div>
                  <Button onClick={handleStartScanner} disabled={isScannerStarting || isSubmitting} className="bg-primary-600 hover:bg-primary-700 font-black h-14 px-10 rounded-2xl shadow-xl shadow-primary-500/20 active:scale-95 transition-all">
                    {isScannerStarting ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={18} />
                        {t("checkIn.openingCamera")}
                      </>
                    ) : (
                      t("checkIn.initializeScanner")
                    )}
                  </Button>
                </motion.div>
              )}

              {status === "scanning" && (
                <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full relative">
                  <div ref={scannerContainerRef} id="reader" className="w-full h-full object-cover [&>div]:!border-none" />
                  {isScannerStarting && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-slate-950/80 backdrop-blur-sm">
                      <Loader2 className="animate-spin text-primary-500" size={36} />
                      <p className="max-w-[220px] text-center text-sm font-semibold text-slate-300">
                        {t("checkIn.requestingCamera")}
                      </p>
                    </div>
                  )}
                  <motion.div animate={{ top: ["5%", "95%", "5%"] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }} className="pointer-events-none absolute left-6 right-6 h-1 bg-primary-500 shadow-[0_0_20px_rgba(59,130,246,0.8)] z-30" />
                  <div className="absolute bottom-6 left-0 right-0 flex justify-center z-30">
                     <button type="button" onClick={handleCancelScanner} className="touch-manipulation p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md">
                        <X size={24} />
                     </button>
                  </div>
                </motion.div>
              )}

              {status === "success" && (
                <motion.div key="success" data-testid="check-in-success" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-6 p-8">
                  <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto text-emerald-500 ring-4 ring-emerald-500/20">
                    <CheckCircle2 size={56} className="animate-bounce" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-white">{t("checkIn.successTitle")}</h4>
                    <p className="text-slate-400 mt-2 font-medium">{t("checkIn.successText")} <br/>{t("checkIn.successText2")}</p>
                  </div>
                  <Button onClick={handleGoToDashboard} className="bg-emerald-600 hover:bg-emerald-700 w-full h-12 rounded-xl font-bold">
                    {t("checkIn.goDashboard")}
                  </Button>
                </motion.div>
              )}

              {status === "error" && (
                <motion.div key="error" data-testid="check-in-error" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-6 p-8">
                  <div className="w-24 h-24 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto text-rose-500 ring-4 ring-rose-500/20">
                    <AlertCircle size={56} />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-white">{t("checkIn.errorTitle")}</h4>
                    <p className="text-rose-400 mt-2 font-medium">{errorMessage}</p>
                  </div>
                  <Button onClick={() => setStatus("idle")} variant="ghost" className="text-slate-400 hover:text-white font-bold underline">
                    {t("checkIn.tryAgain")}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Manual Input */}
        <div className="space-y-4">
          <div className="flex items-center justify-center">
            <button type="button" data-testid="check-in-toggle-manual" onClick={() => setManual(!manual)} className="touch-manipulation text-sm font-bold text-slate-500 hover:text-white flex items-center gap-2 transition-all">
              <QrCode size={18} />
              {manual ? t("checkIn.hideManual") : t("checkIn.useManual")}
            </button>
          </div>

          <AnimatePresence>
            {manual && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
                <div className="p-1 glass rounded-[1.5rem] border border-white/10 flex items-center gap-2">
                  <Input data-testid="check-in-qr-input" placeholder={t("checkIn.manualPlaceholder")} value={qrValue} onChange={(e) => setQrValue(e.target.value)} className="bg-transparent border-none focus:ring-0 h-12 pl-4 font-bold tracking-widest text-primary-500 placeholder:text-slate-600 placeholder:font-normal placeholder:tracking-normal" />
                  <Button data-testid="check-in-submit-manual" onClick={() => handleCheckIn(qrValue)} disabled={isSubmitting || !qrValue} className="bg-primary-600 hover:bg-primary-700 h-10 w-12 rounded-xl shrink-0 p-0">
                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                  </Button>
                </div>

                {enableTestScanTime && (
                  <Input
                    data-testid="check-in-scanned-at"
                    type="datetime-local"
                    value={manualScannedAt}
                    onChange={(e) => setManualScannedAt(e.target.value)}
                    className="bg-white/5 border-white/10 h-12 rounded-xl text-white [color-scheme:dark]"
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Context Card */}
        {nextBooking && (
          <Card className="glass-panel border-white/5 bg-white/5 mt-auto overflow-hidden group">
            <div className="absolute inset-0 bg-primary-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 flex items-center gap-5 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-primary-500/10 flex items-center justify-center text-primary-500 ring-1 ring-primary-500/20">
                <History size={28} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t("checkIn.activeReservation")}</p>
                <h4 className="text-xl font-bold text-white">{nextBooking.workspace_name}</h4>
                <p className="text-xs text-slate-400 font-medium">
                  {new Date(nextBooking.start_time).toLocaleTimeString(dateLocale, {hour: '2-digit', minute:'2-digit'})} - 
                  {new Date(nextBooking.end_time).toLocaleTimeString(dateLocale, {hour: '2-digit', minute:'2-digit'})}
                </p>
              </div>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            </CardContent>
          </Card>
        )}

        <div className="flex gap-4 p-5 rounded-2xl bg-white/5 border border-white/5 text-xs text-slate-400 leading-relaxed font-medium">
          <Info size={20} className="text-primary-500 shrink-0" />
          <p>{t("checkIn.info")}</p>
        </div>
      </main>
    </div>
  )
}
