import { DashboardLayout } from "@/components/premium/layout/dashboard-layout"
import { FloorMapPremium } from "@/components/premium/features/floor-map-premium"

export default function PremiumFloorMapPage() {
  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-12rem)] flex flex-col">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Interactive Floor Map</h1>
          <p className="text-slate-400">Select a floor and reserve your spot in real-time.</p>
        </div>
        
        <div className="flex-1">
          <FloorMapPremium />
        </div>
      </div>
    </DashboardLayout>
  )
}
