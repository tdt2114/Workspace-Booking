"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Camera, QrCode, ArrowLeft, CheckCircle2, AlertCircle, Scan, History, Info, Send, Loader2, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { Html5QrcodeScanner } from "html5-qrcode"
import { Button } from "@/components/premium/ui/button"
import { Card, CardContent } from "@/components/premium/ui/card"
import { Input } from "@/components/premium/ui/input"
import { supabase } from "@/lib/supabase/client"
import { getBrowserApiBaseUrl } from "@/lib/api-base-url"
import { cn } from "@/lib/utils"

interface Booking {
  id: string
  workspace_name: string
  start_time: string
  end_time: string
  status: string
}

export default function CheckInPage() {
  const router = useRouter()
  const apiBaseUrl = React.useMemo(() => getBrowserApiBaseUrl(), [])
  
  const [session, setSession] = React.useState<any>(null)
  const [qrValue, setQrValue] = React.useState("")
  const [status, setStatus] = React.useState<"idle" | "scanning" | "success" | "error">("idle")
  const [manual, setManual] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [nextBooking, setNextBooking] = React.useState<Booking | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

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
          const data = await res.json()
          const upcoming = data.items?.find((b: any) => b.status === 'confirmed' || b.status === 'checked_in')
          setNextBooking(upcoming || null)
        }
      } catch (err) {
        console.error("Failed to load upcoming booking:", err)
      }
    }
    bootstrap()
  }, [apiBaseUrl, router])

  // --- QR Scanner Setup ---
  React.useEffect(() => {
    if (status === "scanning") {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      )

      scanner.render(
        (decodedText) => {
          scanner.clear()
          handleCheckIn(decodedText)
        },
        (error) => {
          // Silent errors during scanning
        }
      )

      return () => {
        scanner.clear().catch(console.error)
      }
    }
  }, [status])

  const handleCheckIn = async (value: string) => {
    if (!session || !value) return
    setIsSubmitting(true)
    setStatus("scanning") // Show scanning state even for manual
    setErrorMessage(null)

    try {
      const res = await fetch(`${apiBaseUrl}/check-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ qrValue: value })
      })

      const data = await res.json()
      if (res.ok) {
        setStatus("success")
      } else {
        setStatus("error")
        setErrorMessage(data.message || "Invalid QR code or session mismatch.")
      }
    } catch (err) {
      setStatus("error")
      setErrorMessage("Network error. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white flex flex-col font-inter overflow-hidden relative">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary-900/10 rounded-full blur-[120px]" />
      
      {/* Mobile Navbar */}
      <nav className="p-6 flex items-center justify-between z-10">
        <button onClick={() => router.back()} className="w-12 h-12 rounded-2xl glass flex items-center justify-center text-slate-400 hover:text-white transition-all active:scale-90">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-black tracking-tight text-gradient">Executive Check-in</h1>
        <div className="w-12" />
      </nav>

      <main className="flex-1 flex flex-col px-6 pb-12 space-y-10 max-w-md mx-auto w-full relative z-10">
        <header className="space-y-3 text-center">
          <h2 className="text-4xl font-black text-white leading-tight tracking-tight">Access Your <br/>Workspace</h2>
          <p className="text-slate-400 font-medium px-4">Verify your physical presence by scanning the desk QR label.</p>
        </header>

        {/* Scanner Area */}
        <section className="relative aspect-square w-full max-w-[340px] mx-auto">
          {/* Decorative Corners */}
          <div className="absolute top-0 left-0 w-16 h-16 border-t-[6px] border-l-[6px] border-primary-500 rounded-tl-[3rem] z-20 shadow-[0_0_15px_rgba(59,130,246,0.3)]" />
          <div className="absolute top-0 right-0 w-16 h-16 border-t-[6px] border-r-[6px] border-primary-500 rounded-tr-[3rem] z-20 shadow-[0_0_15px_rgba(59,130,246,0.3)]" />
          <div className="absolute bottom-0 left-0 w-16 h-16 border-b-[6px] border-l-[6px] border-primary-500 rounded-bl-[3rem] z-20 shadow-[0_0_15px_rgba(59,130,246,0.3)]" />
          <div className="absolute bottom-0 right-0 w-16 h-16 border-b-[6px] border-r-[6px] border-primary-500 rounded-br-[3rem] z-20 shadow-[0_0_15px_rgba(59,130,246,0.3)]" />

          {/* Scanner Content */}
          <div className="absolute inset-4 rounded-[2.5rem] bg-slate-900/80 backdrop-blur-xl overflow-hidden flex items-center justify-center border border-white/10 shadow-2xl">
            <AnimatePresence mode="wait">
              {status === "idle" && (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center space-y-6">
                  <div className="w-24 h-24 rounded-3xl bg-primary-500/10 flex items-center justify-center mx-auto text-primary-500 ring-1 ring-primary-500/20">
                    <Camera size={48} />
                  </div>
                  <Button onClick={() => setStatus("scanning")} className="bg-primary-600 hover:bg-primary-700 font-black h-14 px-10 rounded-2xl shadow-xl shadow-primary-500/20 active:scale-95 transition-all">
                    Initialize Scanner
                  </Button>
                </motion.div>
              )}

              {status === "scanning" && (
                <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full relative">
                  <div id="reader" className="w-full h-full object-cover [&>div]:!border-none" />
                  <motion.div animate={{ top: ["5%", "95%", "5%"] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }} className="absolute left-6 right-6 h-1 bg-primary-500 shadow-[0_0_20px_rgba(59,130,246,0.8)] z-30" />
                  <div className="absolute bottom-6 left-0 right-0 flex justify-center z-30">
                     <button onClick={() => setStatus("idle")} className="p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md">
                        <X size={24} />
                     </button>
                  </div>
                </motion.div>
              )}

              {status === "success" && (
                <motion.div key="success" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-6 p-8">
                  <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto text-emerald-500 ring-4 ring-emerald-500/20">
                    <CheckCircle2 size={56} className="animate-bounce" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-white">Check-in Verified</h4>
                    <p className="text-slate-400 mt-2 font-medium">Your session is now active. <br/>Enjoy your workspace!</p>
                  </div>
                  <Button onClick={() => router.push("/dashboard")} className="bg-emerald-600 hover:bg-emerald-700 w-full h-12 rounded-xl font-bold">
                    Go to Dashboard
                  </Button>
                </motion.div>
              )}

              {status === "error" && (
                <motion.div key="error" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-6 p-8">
                  <div className="w-24 h-24 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto text-rose-500 ring-4 ring-rose-500/20">
                    <AlertCircle size={56} />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-white">Verification Failed</h4>
                    <p className="text-rose-400 mt-2 font-medium">{errorMessage}</p>
                  </div>
                  <Button onClick={() => setStatus("idle")} variant="ghost" className="text-slate-400 hover:text-white font-bold underline">
                    Try Again
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Manual Input */}
        <div className="space-y-4">
          <div className="flex items-center justify-center">
            <button onClick={() => setManual(!manual)} className="text-sm font-bold text-slate-500 hover:text-white flex items-center gap-2 transition-all">
              <QrCode size={18} />
              {manual ? "Hide manual interface" : "Use manual entry code"}
            </button>
          </div>

          <AnimatePresence>
            {manual && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-1 glass rounded-[1.5rem] border border-white/10 flex items-center gap-2">
                <Input placeholder="Enter desk ID..." value={qrValue} onChange={(e) => setQrValue(e.target.value)} className="bg-transparent border-none focus:ring-0 h-12 pl-4 font-bold tracking-widest text-primary-500 placeholder:text-slate-600 placeholder:font-normal placeholder:tracking-normal" />
                <Button onClick={() => handleCheckIn(qrValue)} disabled={isSubmitting || !qrValue} className="bg-primary-600 hover:bg-primary-700 h-10 w-12 rounded-xl shrink-0 p-0">
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                </Button>
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
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active/Next Reservation</p>
                <h4 className="text-xl font-bold text-white">{nextBooking.workspace_name}</h4>
                <p className="text-xs text-slate-400 font-medium">
                  {new Date(nextBooking.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                  {new Date(nextBooking.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </p>
              </div>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            </CardContent>
          </Card>
        )}

        <div className="flex gap-4 p-5 rounded-2xl bg-white/5 border border-white/5 text-xs text-slate-400 leading-relaxed font-medium">
          <Info size={20} className="text-primary-500 shrink-0" />
          <p>Scanning the QR label confirms your physical attendance. Please ensure you are at the correct location within 15 minutes of your booking start time.</p>
        </div>
      </main>
    </div>
  )
}
