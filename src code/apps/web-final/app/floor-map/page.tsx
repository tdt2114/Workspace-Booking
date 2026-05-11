"use client"

import { DashboardLayout } from "@/components/premium/layout/dashboard-layout"
import { FloorMapPremium } from "@/components/premium/features/floor-map-premium"
import { useLanguage } from "@/components/premium/language-provider"

export default function PremiumFloorMapPage() {
  const { t } = useLanguage()

  return (
    <DashboardLayout>
      <div
        className="flex min-h-[calc(100vh-9rem)] flex-col"
        data-testid="floor-map-page"
      >
        <div className="mb-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70 dark:border-white/10 dark:bg-slate-950">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-600">Book Space</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl dark:text-white">{t("floorMap.title")}</h1>
          <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-500 md:text-base dark:text-slate-400">{t("floorMap.subtitle")}</p>
        </div>
        
        <div className="flex-1">
          <FloorMapPremium />
        </div>
      </div>
    </DashboardLayout>
  )
}
