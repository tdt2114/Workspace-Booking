"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { QrCode, Search, Download, Copy, Printer, Info, CheckCircle2, Layers, Loader2, AlertCircle, Settings2 } from "lucide-react"
import QRCode from "qrcode"
import { DashboardLayout } from "@/components/premium/layout/dashboard-layout"
import { Button } from "@/components/premium/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/premium/ui/card"
import { Input } from "@/components/premium/ui/input"
import { useToast } from "@/components/premium/ui/toast"
import { useLanguage } from "@/components/premium/language-provider"
import { supabase } from "@/lib/supabase/client"
import { getBrowserApiBaseUrl } from "@/lib/api-base-url"
import { readApiError } from "@/lib/http-feedback"
import { cn } from "@/lib/utils"

interface Workspace {
  id: string
  name: string
  floor_id: string
  qr_code_value: string
  status: string
}

interface Floor {
  id: string
  name: string
  floor_number: number
}

interface WorkspacesResponse {
  items?: Workspace[]
}

interface FloorsResponse {
  items?: Floor[]
}

export default function WorkspaceQrPage() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([])
  const [floors, setFloors] = React.useState<Floor[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [selectedFloorId, setSelectedFloorId] = React.useState("all")
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [qrImageUrl, setQrImageUrl] = React.useState<string | null>(null)
  const [copySuccess, setCopySuccess] = React.useState(false)

  const apiBaseUrl = React.useMemo(() => getBrowserApiBaseUrl(), [])

  const loadData = React.useCallback(async () => {
      setLoading(true)
      setLoadError(null)
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (currentSession) {
        try {
          const headers = { Authorization: `Bearer ${currentSession.access_token}` }
          const [wRes, fRes] = await Promise.all([
            fetch(`${apiBaseUrl}/workspaces`, { headers }),
            fetch(`${apiBaseUrl}/floors`, { headers })
          ])
          if (wRes.ok && fRes.ok) {
            const wData = await wRes.json() as WorkspacesResponse
            const fData = await fRes.json() as FloorsResponse
            const workspaceItems = wData.items || []
            const floorItems = fData.items || []
            setWorkspaces(workspaceItems)
            setFloors(floorItems)
            setSelectedId(workspaceItems[0]?.id ?? null)
          } else {
            const message = !wRes.ok ? await readApiError(wRes, t("qr.loadFailed")) : await readApiError(fRes, t("qr.loadFailed"))
            setLoadError(message)
            toast({ title: t("qr.loadFailed"), description: message, variant: "error" })
          }
        } catch {
          setLoadError(t("qr.networkError"))
          toast({ title: t("qr.loadFailed"), description: t("qr.networkError"), variant: "error" })
        }
      }
      setLoading(false)
  }, [apiBaseUrl, t, toast])

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadData])

  const selectedWorkspace = React.useMemo(() => workspaces.find(w => w.id === selectedId), [workspaces, selectedId])

  React.useEffect(() => {
    if (selectedWorkspace?.qr_code_value) {
      void QRCode.toDataURL(selectedWorkspace.qr_code_value, {
        width: 400,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      }).then((url: string) => setQrImageUrl(url))
    }
  }, [selectedWorkspace])

  const activeQrImageUrl = selectedWorkspace ? qrImageUrl : null

  const filteredWorkspaces = workspaces.filter(w => {
    const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase()) || w.qr_code_value.toLowerCase().includes(search.toLowerCase())
    const matchesFloor = selectedFloorId === "all" || w.floor_id === selectedFloorId
    return matchesSearch && matchesFloor
  })

  const handleCopy = () => {
    if (selectedWorkspace) {
      navigator.clipboard.writeText(selectedWorkspace.qr_code_value)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }
  }

  const handleDownload = () => {
    if (qrImageUrl && selectedWorkspace) {
      const link = document.createElement('a')
      link.href = qrImageUrl
      link.download = `QR_${selectedWorkspace.name}.png`
      link.click()
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-500 opacity-50" />
          <p className="text-sm font-bold text-slate-500">{t("qr.loading")}</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-white mb-2 tracking-tight">{t("qr.title")}</h1>
            <p className="text-slate-400 font-medium">{t("qr.subtitle")}</p>
          </div>
          <Button className="bg-primary-600 hover:bg-primary-700 font-black h-12 px-8 shadow-lg shadow-primary-500/20 gap-2">
            <Printer size={20} />
            {t("qr.bulkExport")}
          </Button>
        </div>

        {loadError ? (
          <Card className="glass-panel border-rose-500/20 bg-rose-500/10">
            <CardContent className="flex flex-col items-center justify-center gap-4 p-10 text-center">
              <AlertCircle className="text-rose-400" size={48} />
              <div>
                <h2 className="text-2xl font-black text-white">{t("qr.loadFailed")}</h2>
                <p className="mt-2 max-w-xl text-sm font-medium text-slate-400">{loadError}</p>
              </div>
              <Button className="bg-primary-600 font-bold hover:bg-primary-700" onClick={() => void loadData()}>
                {t("qr.retry")}
              </Button>
            </CardContent>
          </Card>
        ) : workspaces.length === 0 ? (
          <Card className="glass-panel border-dashed border-white/10">
            <CardContent className="flex flex-col items-center justify-center gap-5 p-12 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary-500/10 text-primary-400">
                <QrCode size={44} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">{t("qr.emptyTitle")}</h2>
                <p className="mt-2 max-w-xl text-sm font-medium leading-relaxed text-slate-400">{t("qr.emptyDescription")}</p>
              </div>
              <Button asChild className="bg-primary-600 font-black hover:bg-primary-700">
                <Link href="/admin/setup">
                  <Settings2 className="mr-2" size={18} />
                  {t("qr.openAdminSetup")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <section className="lg:col-span-2 space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <Input 
                  placeholder={t("qr.searchPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-12 bg-white/5 border-white/10 h-12 rounded-xl focus:border-primary-500"
                />
              </div>
              <div className="flex items-center gap-2 glass px-4 py-2 rounded-xl border-white/5 h-12">
                <Layers size={18} className="text-slate-400" />
                <select 
                  className="bg-transparent text-white text-sm font-bold focus:outline-none cursor-pointer"
                  value={selectedFloorId}
                  onChange={(e) => setSelectedFloorId(e.target.value)}
                >
                  <option value="all" className="bg-slate-900">{t("qr.allFloors")}</option>
                  {floors.map(f => (
                    <option key={f.id} value={f.id} className="bg-slate-900">
                      {f.name || t("common.floorFallback").replace("{number}", String(f.floor_number))}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredWorkspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    setQrImageUrl(null)
                    setSelectedId(ws.id)
                  }}
                  className={cn(
                    "p-5 rounded-2xl border text-left transition-all duration-300 group relative overflow-hidden",
                    selectedId === ws.id 
                      ? "bg-primary-500/10 border-primary-500 shadow-xl" 
                      : "bg-white/5 border-white/5 hover:border-white/20"
                  )}
                >
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div>
                      <p className="text-[10px] uppercase font-black tracking-widest text-slate-500">
                        {floors.find(f => f.id === ws.floor_id)?.name || t("qr.unknownLevel")}
                      </p>
                      <h4 className="text-xl font-bold text-white group-hover:text-primary-400 transition-colors">{ws.name}</h4>
                    </div>
                    <div className={cn(
                      "w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor]",
                      ws.status === 'available' ? "text-emerald-500 bg-emerald-500" : "text-amber-500 bg-amber-500"
                    )} />
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 relative z-10">
                    <QrCode size={14} />
                    <span className="font-mono">{t("qr.valuePrefix")}: {ws.qr_code_value}</span>
                  </div>
                  {selectedId === ws.id && (
                    <motion.div layoutId="active-bg" className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent pointer-events-none" />
                  )}
                </button>
              ))}
            </div>
          </section>

          <aside className="space-y-6">
            <AnimatePresence mode="wait">
              {selectedWorkspace ? (
                <motion.div
                  key={selectedWorkspace.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-6 sticky top-8"
                >
                  <Card className="glass-panel border-white/10 overflow-hidden shadow-2xl">
                    <CardHeader className="bg-white/5 border-b border-white/5 text-center">
                      <CardTitle className="text-2xl font-black">{t("qr.labelPreview")}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-10 flex flex-col items-center">
                      <div className="relative group perspective-1000">
                        <div className="absolute -inset-6 bg-primary-500/20 rounded-[3rem] blur-3xl group-hover:bg-primary-500/30 transition-all duration-500" />
                        
                        <motion.div 
                          whileHover={{ rotateY: 5, rotateX: -5 }}
                          className="relative w-64 h-80 bg-white rounded-[2.5rem] p-8 shadow-[0_40px_100px_rgba(0,0,0,0.4)] flex flex-col items-center justify-between border-[6px] border-slate-900"
                        >
                          <div className="text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">{t("qr.officeHub")}</p>
                            <div className="h-1 w-12 bg-primary-600 mx-auto rounded-full" />
                          </div>
                          
                          <div className="w-44 h-44 bg-white flex items-center justify-center">
                            {activeQrImageUrl ? (
                              <Image src={activeQrImageUrl} alt="QR Code" width={176} height={176} className="w-full h-full" unoptimized />
                            ) : (
                              <QrCode size={100} className="text-slate-200 animate-pulse" />
                            )}
                          </div>

                          <div className="text-center">
                            <h3 className="text-2xl font-black text-slate-900 leading-none">{selectedWorkspace.name}</h3>
                            <p className="text-[8px] text-slate-400 mt-2 uppercase font-black tracking-widest">{t("qr.scanToCheckIn")}</p>
                          </div>
                        </motion.div>
                      </div>

                      <div className="mt-12 grid grid-cols-2 gap-4 w-full">
                        <Button onClick={handleDownload} variant="outline" className="h-14 rounded-2xl border-white/10 hover:bg-white/10 gap-3 font-bold">
                          <Download size={20} />
                          {t("qr.export")}
                        </Button>
                        <Button onClick={handleCopy} variant="outline" className="h-14 rounded-2xl border-white/10 hover:bg-white/10 gap-3 font-bold">
                          {copySuccess ? <CheckCircle2 className="text-emerald-500" size={20} /> : <Copy size={20} />}
                  {copySuccess ? t("qr.copied") : t("qr.copy")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="glass-panel bg-primary-500/5 border-primary-500/20 p-6">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center text-primary-500 shrink-0">
                        <Info size={24} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-white text-sm">{t("qr.deploymentGuide")}</h4>
                        <p className="text-xs text-slate-400 leading-relaxed font-medium">
                          {t("qr.deploymentDescription")}
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ) : (
                <div className="h-96 flex flex-col items-center justify-center glass rounded-3xl border-dashed border-2 border-white/5 text-slate-500 text-center px-10 gap-4">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                    <QrCode size={32} className="opacity-20" />
                  </div>
                  <p className="font-bold">{t("qr.empty")}</p>
                </div>
              )}
            </AnimatePresence>
          </aside>
        </div>
        )}
      </div>
    </DashboardLayout>
  )
}
