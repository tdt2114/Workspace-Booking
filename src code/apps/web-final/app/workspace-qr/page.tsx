"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { QrCode, Search, Download, Copy, Printer, Info, CheckCircle2, Layers, Loader2, AlertCircle, Settings2, Building2, MapPin } from "lucide-react"
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
  type: string
  qr_code_value: string
  status: string
}

interface Floor {
  id: string
  building_id: string
  name: string
  floor_number: number
}

interface Building {
  id: string
  name: string
  address: string | null
}

interface WorkspacesResponse {
  items?: Workspace[]
}

interface FloorsResponse {
  items?: Floor[]
}

interface BuildingsResponse {
  items?: Building[]
}

export default function WorkspaceQrPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const { toast } = useToast()
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([])
  const [floors, setFloors] = React.useState<Floor[]>([])
  const [buildings, setBuildings] = React.useState<Building[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [selectedBuildingId, setSelectedBuildingId] = React.useState("all")
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
          const meRes = await fetch(`${apiBaseUrl}/me`, { headers })
          if (meRes.ok) {
            const meData = await meRes.json() as { role?: string }
            if (meData.role !== "admin") {
              router.push("/dashboard")
              return
            }
          }
          const [wRes, fRes, bRes] = await Promise.all([
            fetch(`${apiBaseUrl}/workspaces`, { headers }),
            fetch(`${apiBaseUrl}/floors`, { headers }),
            fetch(`${apiBaseUrl}/buildings`, { headers })
          ])
          if (wRes.ok && fRes.ok && bRes.ok) {
            const wData = await wRes.json() as WorkspacesResponse
            const fData = await fRes.json() as FloorsResponse
            const bData = await bRes.json() as BuildingsResponse
            const workspaceItems = wData.items || []
            const floorItems = fData.items || []
            const buildingItems = bData.items || []
            setWorkspaces(workspaceItems)
            setFloors(floorItems)
            setBuildings(buildingItems)
            setSelectedId(workspaceItems[0]?.id ?? null)
          } else {
            const message = !wRes.ok
              ? await readApiError(wRes, t("qr.loadFailed"))
              : !fRes.ok
                ? await readApiError(fRes, t("qr.loadFailed"))
                : await readApiError(bRes, t("qr.loadFailed"))
            setLoadError(message)
            toast({ title: t("qr.loadFailed"), description: message, variant: "error" })
          }
        } catch {
          setLoadError(t("qr.networkError"))
          toast({ title: t("qr.loadFailed"), description: t("qr.networkError"), variant: "error" })
        }
      }
      setLoading(false)
  }, [apiBaseUrl, router, t, toast])

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadData])

  const selectedWorkspace = React.useMemo(() => workspaces.find(w => w.id === selectedId), [workspaces, selectedId])
  const floorById = React.useMemo(() => new Map(floors.map((floor) => [floor.id, floor])), [floors])
  const buildingById = React.useMemo(() => new Map(buildings.map((building) => [building.id, building])), [buildings])
  const selectedFloor = selectedWorkspace ? floorById.get(selectedWorkspace.floor_id) ?? null : null
  const selectedBuilding = selectedFloor ? buildingById.get(selectedFloor.building_id) ?? null : null
  const floorsForSelectedBuilding = React.useMemo(() => {
    if (selectedBuildingId === "all") return floors
    return floors.filter((floor) => floor.building_id === selectedBuildingId)
  }, [floors, selectedBuildingId])

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
    const floor = floorById.get(w.floor_id)
    const building = floor ? buildingById.get(floor.building_id) : null
    const searchValue = search.toLowerCase()
    const matchesSearch = [
      w.name,
      w.type,
      w.qr_code_value,
      floor?.name,
      building?.name,
    ].some((value) => value?.toLowerCase().includes(searchValue))
    const matchesBuilding = selectedBuildingId === "all" || floor?.building_id === selectedBuildingId
    const matchesFloor = selectedFloorId === "all" || w.floor_id === selectedFloorId
    return matchesSearch && matchesBuilding && matchesFloor
  })

  const groupedWorkspaces = React.useMemo(() => {
    return buildings
      .map((building) => {
        const buildingFloors = floors
          .filter((floor) => floor.building_id === building.id)
          .map((floor) => ({
            floor,
            workspaces: filteredWorkspaces.filter((workspace) => workspace.floor_id === floor.id),
          }))
          .filter((group) => group.workspaces.length > 0)

        return { building, floors: buildingFloors }
      })
      .filter((group) => group.floors.length > 0)
  }, [buildings, filteredWorkspaces, floors])

  const workspaceCountLabel = `${filteredWorkspaces.length}/${workspaces.length}`

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
      const buildingName = selectedBuilding?.name ?? "building"
      const floorName = selectedFloor?.name ?? `floor-${selectedFloor?.floor_number ?? "unknown"}`
      link.download = `QR_${buildingName}_${floorName}_${selectedWorkspace.name}.png`.replace(/[^a-z0-9._-]+/gi, "-")
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
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm shadow-slate-200/70 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-6 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6 dark:from-slate-800 dark:via-slate-900 dark:to-blue-950/70 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-600 dark:text-blue-300">QR Asset Library</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl dark:text-white">{t("qr.title")}</h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-600 md:text-base dark:text-slate-300">{t("qr.subtitle")}</p>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:min-w-[360px]">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">Buildings</p>
                <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{buildings.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">Floors</p>
                <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{floors.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">QR Codes</p>
                <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{workspaces.length}</p>
              </div>
            </div>
          </div>
        </div>

        {loadError ? (
          <Card className="border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10">
            <CardContent className="flex flex-col items-center justify-center gap-4 p-10 text-center">
              <AlertCircle className="text-rose-400" size={48} />
              <div>
                <h2 className="text-2xl font-black text-slate-950 dark:text-white">{t("qr.loadFailed")}</h2>
                <p className="mt-2 max-w-xl text-sm font-medium text-slate-400">{loadError}</p>
              </div>
              <Button className="bg-primary-600 font-bold hover:bg-primary-700" onClick={() => void loadData()}>
                {t("qr.retry")}
              </Button>
            </CardContent>
          </Card>
        ) : workspaces.length === 0 ? (
          <Card className="border-dashed border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
            <CardContent className="flex flex-col items-center justify-center gap-5 p-12 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary-500/10 text-primary-400">
                <QrCode size={44} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-950 dark:text-white">{t("qr.emptyTitle")}</h2>
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
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">Location hierarchy</p>
                <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Building / Floor / Room QR codes</h2>
                <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">Filter and print QR labels by exact physical location.</p>
              </div>
              <Button className="h-11 rounded-2xl bg-blue-600 px-5 font-black text-white hover:bg-blue-700">
                <Printer size={18} className="mr-2" />
                {t("qr.bulkExport")}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300" size={18} />
                <Input 
                  placeholder={t("qr.searchPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-12 font-semibold text-slate-950 placeholder:text-slate-500 focus:border-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-300"
                />
              </div>
              <div className="flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 dark:border-slate-600 dark:bg-slate-800">
                <Building2 size={18} className="text-slate-500 dark:text-slate-300" />
                <select
                  className="bg-transparent text-sm font-black text-slate-700 focus:outline-none dark:text-white"
                  value={selectedBuildingId}
                  onChange={(e) => {
                    setSelectedBuildingId(e.target.value)
                    setSelectedFloorId("all")
                  }}
                >
                  <option value="all" className="bg-white text-slate-950 dark:bg-slate-900 dark:text-white">All buildings</option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id} className="bg-white text-slate-950 dark:bg-slate-900 dark:text-white">
                      {building.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 dark:border-slate-600 dark:bg-slate-800">
                <Layers size={18} className="text-slate-500 dark:text-slate-300" />
                <select 
                  className="cursor-pointer bg-transparent text-sm font-black text-slate-700 focus:outline-none dark:text-white"
                  value={selectedFloorId}
                  onChange={(e) => setSelectedFloorId(e.target.value)}
                >
                  <option value="all" className="bg-white text-slate-950 dark:bg-slate-900 dark:text-white">{t("qr.allFloors")}</option>
                  {floorsForSelectedBuilding.map(f => (
                    <option key={f.id} value={f.id} className="bg-white text-slate-950 dark:bg-slate-900 dark:text-white">
                      {f.name || t("common.floorFallback").replace("{number}", String(f.floor_number))}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-white">
                Showing {workspaceCountLabel}
              </div>
            </div>
            </div>

            <div className="space-y-5">
              {groupedWorkspaces.map((buildingGroup) => (
                <section key={buildingGroup.building.id} className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                        <Building2 size={22} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-950 dark:text-white">{buildingGroup.building.name}</h3>
                        <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-300">{buildingGroup.building.address || "No address"}</p>
                      </div>
                    </div>
                    <p className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-600 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                      {buildingGroup.floors.reduce((count, floorGroup) => count + floorGroup.workspaces.length, 0)} QR labels
                    </p>
                  </div>

                  <div className="space-y-5 p-5">
                    {buildingGroup.floors.map((floorGroup) => (
                      <div key={floorGroup.floor.id} className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-white">
                          <Layers size={17} className="text-blue-600 dark:text-blue-300" />
                          {floorGroup.floor.name || t("common.floorFallback").replace("{number}", String(floorGroup.floor.floor_number))}
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-300">/ {floorGroup.workspaces.length} spaces</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {floorGroup.workspaces.map((ws) => (
                            <button
                              key={ws.id}
                              onClick={() => {
                                setQrImageUrl(null)
                                setSelectedId(ws.id)
                              }}
                              className={cn(
                                "group relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300",
                                selectedId === ws.id
                                  ? "border-blue-500 bg-blue-50 shadow-lg shadow-blue-100 dark:bg-blue-950/70 dark:shadow-none"
                                  : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-400"
                              )}
                            >
                              <div className="relative z-10 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
                                    <MapPin size={12} />
                                    {ws.type.replace(/_/g, " ")}
                                  </p>
                                  <h4 className="mt-1 truncate text-lg font-black text-slate-950 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-300">{ws.name}</h4>
                                  <p className="mt-2 truncate font-mono text-xs font-bold text-slate-500 dark:text-slate-300">{t("qr.valuePrefix")}: {ws.qr_code_value}</p>
                                </div>
                                <div className={cn(
                                  "h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_8px_currentColor]",
                                  ws.status === "available" ? "bg-emerald-500 text-emerald-500" : "bg-amber-500 text-amber-500"
                                )} />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
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
                  <Card className="overflow-hidden border-slate-200 bg-white shadow-xl shadow-slate-200/70 dark:border-white/10 dark:bg-slate-900 dark:shadow-none">
                    <CardHeader className="border-b border-slate-200 bg-slate-50 text-center dark:border-white/10 dark:bg-slate-800">
                      <CardTitle className="text-2xl font-black text-slate-950 dark:text-white">{t("qr.labelPreview")}</CardTitle>
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
                            <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-blue-600">{selectedBuilding?.name || "Building"}</p>
                            <p className="mt-1 text-[8px] text-slate-400 uppercase font-black tracking-widest">
                              {selectedFloor?.name || t("qr.unknownLevel")} • {selectedWorkspace.type.replace(/_/g, " ")}
                            </p>
                            <p className="text-[8px] text-slate-400 mt-2 uppercase font-black tracking-widest">{t("qr.scanToCheckIn")}</p>
                          </div>
                        </motion.div>
                      </div>

                      <div className="mt-12 grid grid-cols-2 gap-4 w-full">
                        <Button onClick={handleDownload} variant="outline" className="h-14 rounded-2xl border-slate-200 gap-3 font-bold dark:border-white/10 dark:hover:bg-white/10">
                          <Download size={20} />
                          {t("qr.export")}
                        </Button>
                        <Button onClick={handleCopy} variant="outline" className="h-14 rounded-2xl border-slate-200 gap-3 font-bold dark:border-white/10 dark:hover:bg-white/10">
                          {copySuccess ? <CheckCircle2 className="text-emerald-500" size={20} /> : <Copy size={20} />}
                  {copySuccess ? t("qr.copied") : t("qr.copy")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-blue-200 bg-blue-50 p-6 dark:border-primary-500/20 dark:bg-primary-500/5">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center text-primary-500 shrink-0">
                        <Info size={24} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-950 text-sm dark:text-white">{t("qr.deploymentGuide")}</h4>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium dark:text-slate-400">
                          {t("qr.deploymentDescription")}
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ) : (
                <div className="h-96 flex flex-col items-center justify-center rounded-3xl border-dashed border-2 border-slate-200 bg-white text-slate-500 text-center px-10 gap-4 dark:border-white/10 dark:bg-slate-900">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center dark:bg-white/5">
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
