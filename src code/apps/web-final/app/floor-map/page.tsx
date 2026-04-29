"use client"

import { DashboardLayout } from "@/components/premium/layout/dashboard-layout"
import { FloorMapPremium } from "@/components/premium/features/floor-map-premium"
import { useLanguage } from "@/components/premium/language-provider"

export default function PremiumFloorMapPage() {
  const { t } = useLanguage()

  return (
    <DashboardLayout>
      <div
        className="flex min-h-[calc(100vh-12rem)] flex-col lg:h-[calc(100vh-12rem)]"
        data-testid="floor-map-page"
      >
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">{t("floorMap.title")}</h1>
          <p className="text-slate-400">{t("floorMap.subtitle")}</p>
        </div>
        
        <div className="flex-1">
          <FloorMapPremium />
        </div>
      </div>
    </DashboardLayout>
  )
}
