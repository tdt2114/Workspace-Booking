"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Camera, QrCode, ArrowLeft, CheckCircle2, AlertCircle, History, Info, Send, Loader2, X, ListChecks } from "lucide-react"
import { useRouter } from "next/navigation"
import type { Session } from "@supabase/supabase-js"
import type { CameraDevice, Html5Qrcode } from "html5-qrcode"
import { Button } from "@/components/premium/ui/button"
import { Card, CardContent } from "@/components/premium/ui/card"
import { Input } from "@/components/premium/ui/input"
import { useToast } from "@/components/premium/ui/toast"
import { useLanguage } from "@/components/premium/language-provider"
import { DashboardLayout } from "@/components/premium/layout/dashboard-layout"
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

type Html5QrcodeModule = typeof import("html5-qrcode")

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

function tFallback(t: (path: string) => string, path: string, fallback: string) {
  const value = t(path)
  return value === path ? fallback : value
}

export default function CheckInPage() {
  const router = useRouter()
  const { locale, t } = useLanguage()
  const { toast } = useToast()
  const apiBaseUrl = React.useMemo(() => getBrowserApiBaseUrl(), [])
  const dateLocale = locale === "vi" ? "vi-VN" : undefined
  const scannerContainerRef = React.useRef<HTMLDivElement | null>(null)
  const html5QrcodeRef = React.useRef<Html5Qrcode | null>(null)
  const scannerModulePromiseRef = React.useRef<Promise<Html5QrcodeModule> | null>(null)
  const hasDecodedRef = React.useRef(false)
  const scannerStartTokenRef = React.useRef(0)
  
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
  const [isNavigating, setIsNavigating] = React.useState(false)
  const [navigationTarget, setNavigationTarget] = React.useState<"dashboard" | "bookings" | null>(null)

  const enableManualFallback = React.useCallback((message: string) => {
    setManual(true)
    setErrorMessage(message)
    setStatus("error")
  }, [])

  const loadScannerModule = React.useCallback(() => {
    scannerModulePromiseRef.current ??= import("html5-qrcode")
    return scannerModulePromiseRef.current
  }, [])

  const waitForScannerContainer = React.useCallback(async () => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (scannerContainerRef.current) {
        return scannerContainerRef.current
      }

      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve())
      })
    }

    return null
  }, [])

  const pickBackCamera = React.useCallback((cameras: CameraDevice[]) => {
    return cameras.find((camera) => /back|rear|environment|sau/i.test(camera.label)) ?? cameras[0] ?? null
  }, [])

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

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.isSecureContext) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void loadScannerModule()
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [loadScannerModule])

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
        toast({
          title: t("checkIn.successTitle"),
          description: t("checkIn.successText"),
          variant: "success",
        })
      } else {
        setStatus("error")
        const message = data.message || t("checkIn.invalidQr")
        setErrorMessage(message)
        toast({ title: t("checkIn.errorTitle"), description: message, variant: "error" })
      }
    } catch {
      setStatus("error")
      setErrorMessage(t("checkIn.networkError"))
      toast({ title: t("checkIn.errorTitle"), description: t("checkIn.networkError"), variant: "error" })
    } finally {
      setIsSubmitting(false)
    }
  }, [apiBaseUrl, enableTestScanTime, manualScannedAt, nextBooking, session, t, toast])

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
    return () => {
      scannerStartTokenRef.current += 1
      void stopScanner()
    }
  }, [stopScanner])

  const handleStartScanner = React.useCallback(() => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      enableManualFallback(t("checkIn.cameraHttpsRequired"))
      toast({ title: t("checkIn.errorTitle"), description: t("checkIn.cameraHttpsRequired"), variant: "error" })
      return
    }

    scannerStartTokenRef.current += 1
    const startToken = scannerStartTokenRef.current

    hasDecodedRef.current = false
    setIsScannerStarting(true)
    setErrorMessage(null)
    setStatus("scanning")

    void (async () => {
      try {
        await stopScanner()

        const container = await waitForScannerContainer()
        if (!container || scannerStartTokenRef.current !== startToken) {
          return
        }

        const { Html5Qrcode } = await loadScannerModule()
        const scanner = new Html5Qrcode(container.id, false)
        html5QrcodeRef.current = scanner

        let cameraConfigOrId: string | { facingMode: string } = { facingMode: "environment" }

        try {
          const cameras = await Html5Qrcode.getCameras()
          const backCamera = pickBackCamera(cameras)
          if (backCamera?.id) {
            cameraConfigOrId = backCamera.id
          }
        } catch (cameraListError) {
          console.info("Could not enumerate cameras, falling back to environment camera.", cameraListError)
        }

        if (scannerStartTokenRef.current !== startToken) {
          await stopScanner()
          return
        }

        await scanner.start(
          cameraConfigOrId,
          {
            fps: 15,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.68)
              const size = Math.max(220, Math.min(edge, 320))
              return { width: size, height: size }
            },
            aspectRatio: 1,
            disableFlip: false,
          },
          (decodedText) => {
            if (hasDecodedRef.current) {
              return
            }

            hasDecodedRef.current = true
            void (async () => {
              scannerStartTokenRef.current += 1
              await stopScanner()
              void handleCheckIn(decodedText)
            })()
          },
          () => {},
        )

        if (scannerStartTokenRef.current === startToken) {
          setIsScannerStarting(false)
        }
      } catch (err) {
        console.error("Scanner start error:", err)
        await stopScanner()

        if (scannerStartTokenRef.current === startToken) {
          setIsScannerStarting(false)
          enableManualFallback(t("checkIn.cameraFailed"))
        }
      }
    })()
  }, [enableManualFallback, handleCheckIn, loadScannerModule, pickBackCamera, stopScanner, t, toast, waitForScannerContainer])

  const handleCancelScanner = React.useCallback(() => {
    scannerStartTokenRef.current += 1
    setStatus("idle")
    setIsScannerStarting(false)
    void stopScanner()
  }, [stopScanner])

  const handleNavigate = React.useCallback((target: "dashboard" | "bookings") => {
    setIsNavigating(true)
    setNavigationTarget(target)
    const href = target === "dashboard" ? "/dashboard" : "/bookings"

    if (typeof window !== "undefined") {
      window.location.assign(href)
      return
    }

    router.push(href)
  }, [router])

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6" data-testid="check-in-page">
        <header className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70 dark:border-white/10 dark:bg-slate-950">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-5 inline-flex touch-manipulation items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-600 transition hover:border-blue-300 hover:text-blue-700 dark:border-white/10 dark:text-slate-300 dark:hover:text-white"
          >
            <ArrowLeft size={18} />
            {tFallback(t, "checkIn.back", "Quay lai")}
          </button>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-600">{t("checkIn.navTitle")}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-5xl dark:text-white">
            {t("checkIn.titleLine1")} {t("checkIn.titleLine2")}
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-relaxed text-slate-500 md:text-base dark:text-slate-400">
            {t("checkIn.description")}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70 dark:border-white/10 dark:bg-slate-950 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleStartScanner}
                disabled={isScannerStarting || isSubmitting || status === "scanning"}
                className="group flex flex-1 touch-manipulation items-center gap-4 rounded-3xl border border-blue-200 bg-blue-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-500/20 dark:bg-blue-500/10"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
                  {isScannerStarting ? <Loader2 className="animate-spin" size={26} /> : <Camera size={28} />}
                </span>
                  <span>
                    <span className="block text-base font-black text-slate-950 dark:text-white">{t("checkIn.initializeScanner")}</span>
                  <span className="mt-1 block text-sm font-semibold text-slate-500 dark:text-slate-400">{tFallback(t, "checkIn.scanOptionDesc", "Dung camera de quet QR tai ban.")}</span>
                </span>
              </button>

              <button
                type="button"
                data-testid="check-in-toggle-manual"
                onClick={() => setManual(true)}
                className="group flex flex-1 touch-manipulation items-center gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-300 dark:border-white/10 dark:bg-white/5"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-white/10">
                  <QrCode size={28} />
                </span>
                <span>
                  <span className="block text-base font-black text-slate-950 dark:text-white">{t("checkIn.useManualShort")}</span>
                  <span className="mt-1 block text-sm font-semibold text-slate-500 dark:text-slate-400">{tFallback(t, "checkIn.manualOptionDesc", "Nhap ma QR neu camera khong kha dung.")}</span>
                </span>
              </button>
            </div>

            <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-900">
              <AnimatePresence mode="wait">
                {status === "idle" && (
                  <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5 p-8 text-center">
                    <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-[2rem] bg-blue-50 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:ring-blue-500/20">
                      <Camera size={54} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-950 dark:text-white">{tFallback(t, "checkIn.scanReadyTitle", "Quet ma QR tai ban")}</h2>
                      <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-slate-500 dark:text-slate-400">{tFallback(t, "checkIn.scanReadyDesc", "Bat dau quet khi ban dang o dung vi tri da dat.")}</p>
                    </div>
                    <Button onClick={handleStartScanner} disabled={isScannerStarting || isSubmitting} className="h-12 rounded-2xl px-8 font-black">
                      {isScannerStarting ? <><Loader2 className="mr-2 animate-spin" size={18} />{t("checkIn.openingCamera")}</> : t("checkIn.initializeScanner")}
                    </Button>
                  </motion.div>
                )}

                {status === "scanning" && (
                  <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative h-[420px] w-full">
                    <div ref={scannerContainerRef} id="reader" className="h-full w-full object-cover [&>div]:!border-none" />
                    {isScannerStarting && (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-slate-950/80 backdrop-blur-sm">
                        <Loader2 className="animate-spin text-blue-500" size={36} />
                        <p className="max-w-[260px] text-center text-sm font-semibold text-slate-200">
                          {t("checkIn.requestingCamera")}
                        </p>
                      </div>
                    )}
                    <motion.div animate={{ top: ["12%", "88%", "12%"] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }} className="pointer-events-none absolute left-10 right-10 z-30 h-1 rounded-full bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.8)]" />
                    <div className="absolute bottom-6 left-0 right-0 z-30 flex justify-center">
                      <button type="button" onClick={handleCancelScanner} className="touch-manipulation rounded-full bg-white p-3 text-slate-700 shadow-lg hover:bg-slate-100 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800">
                        <X size={24} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {status === "success" && (
                  <motion.div key="success" data-testid="check-in-success" initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-6 p-8 text-center">
                    <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-4 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20">
                      <CheckCircle2 size={60} />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-slate-950 dark:text-white">{t("checkIn.successTitle")}</h2>
                      <p className="mt-2 font-semibold text-slate-500 dark:text-slate-400">{t("checkIn.successText")} {t("checkIn.successText2")}</p>
                    </div>
                    <div className="mx-auto grid max-w-md gap-3 sm:grid-cols-2">
                      <Button
                        onClick={() => handleNavigate("dashboard")}
                        isLoading={isNavigating && navigationTarget === "dashboard"}
                        loadingText={t("checkIn.openingDashboard")}
                        className="h-12 rounded-2xl bg-emerald-600 font-black hover:bg-emerald-700"
                      >
                        {t("checkIn.goDashboard")}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleNavigate("bookings")}
                        isLoading={isNavigating && navigationTarget === "bookings"}
                        loadingText={t("checkIn.openingBookings")}
                        className="h-12 rounded-2xl border-slate-200 font-black text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200"
                      >
                        <ListChecks className="mr-2" size={18} />
                        {t("checkIn.goBookings")}
                      </Button>
                    </div>
                  </motion.div>
                )}

                {status === "error" && (
                  <motion.div key="error" data-testid="check-in-error" initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-6 p-8 text-center">
                    <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-4 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20">
                      <AlertCircle size={60} />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-slate-950 dark:text-white">{t("checkIn.errorTitle")}</h2>
                      <p className="mt-2 font-semibold text-rose-600 dark:text-rose-400">{errorMessage}</p>
                      <p className="mx-auto mt-3 max-w-md text-sm font-semibold text-slate-500 dark:text-slate-400">{t("checkIn.manualFallbackHint")}</p>
                    </div>
                    <div className="mx-auto grid max-w-md gap-3 sm:grid-cols-2">
                      <Button onClick={() => setStatus("idle")} variant="outline" className="h-12 rounded-2xl border-slate-200 font-black text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200">
                        {t("checkIn.tryAgain")}
                      </Button>
                      <Button onClick={() => setManual(true)} className="h-12 rounded-2xl font-black">
                        <QrCode className="mr-2" size={18} />
                        {t("checkIn.useManualShort")}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

          <aside className="space-y-6">
            <Card className="overflow-hidden border-slate-200 bg-white shadow-sm shadow-slate-200/70 dark:border-white/10 dark:bg-slate-950">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-blue-600 ring-1 ring-slate-200 dark:bg-white/5 dark:ring-white/10">
                    <Send size={22} />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">{t("checkIn.useManualShort")}</p>
                    <h3 className="text-xl font-black text-slate-950 dark:text-white">{tFallback(t, "checkIn.manualTitle", "Check-in thu cong")}</h3>
                  </div>
                </div>
                <p className="text-sm font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
                  {t("checkIn.manualHelp")}
                </p>
                <AnimatePresence>
                  {(manual || status === "error") && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="space-y-3">
                      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5">
                        <Input
                          data-testid="check-in-qr-input"
                          placeholder={t("checkIn.manualPlaceholder")}
                          value={qrValue}
                          onChange={(e) => setQrValue(e.target.value)}
                          className="h-12 border-none bg-transparent pl-3 font-bold tracking-widest text-blue-600 placeholder:text-slate-400 placeholder:font-normal placeholder:tracking-normal focus:ring-0"
                        />
                        <Button data-testid="check-in-submit-manual" onClick={() => handleCheckIn(qrValue)} disabled={isSubmitting || !qrValue} className="h-11 w-12 shrink-0 rounded-xl p-0">
                          {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                        </Button>
                      </div>

                      {enableTestScanTime && (
                        <Input
                          data-testid="check-in-scanned-at"
                          type="datetime-local"
                          value={manualScannedAt}
                          onChange={(e) => setManualScannedAt(e.target.value)}
                          className="h-12 rounded-xl border-slate-200 bg-white text-slate-950 [color-scheme:light] dark:border-white/10 dark:bg-slate-900 dark:text-white dark:[color-scheme:dark]"
                        />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                {!manual && status !== "error" && (
                  <Button onClick={() => setManual(true)} variant="outline" className="h-12 w-full rounded-2xl border-slate-200 font-black text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200">
                    {t("checkIn.useManual")}
                  </Button>
                )}
              </CardContent>
            </Card>

            {nextBooking && (
              <Card className="overflow-hidden border-slate-200 bg-white shadow-sm shadow-slate-200/70 dark:border-white/10 dark:bg-slate-950">
                <CardContent className="flex items-center gap-5 p-5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:ring-blue-500/20">
                    <History size={28} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("checkIn.activeReservation")}</p>
                    <h4 className="truncate text-xl font-black text-slate-950 dark:text-white">{nextBooking.workspace_name}</h4>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {new Date(nextBooking.start_time).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })} -
                      {" "}
                      {new Date(nextBooking.end_time).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                </CardContent>
              </Card>
            )}

            <div className="flex gap-4 rounded-[1.5rem] border border-blue-100 bg-blue-50 p-5 text-sm font-semibold leading-relaxed text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-100">
              <Info size={20} className="shrink-0 text-blue-600 dark:text-blue-300" />
              <p>{t("checkIn.info")}</p>
            </div>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  )
}
