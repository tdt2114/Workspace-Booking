"use client"

import { Languages } from "lucide-react"
import { Button } from "@/components/premium/ui/button"
import { useLanguage } from "@/components/premium/language-provider"
import { cn } from "@/lib/utils"

interface LanguageToggleProps {
  className?: string
}

export function LanguageToggle({ className }: LanguageToggleProps) {
  const { locale, toggleLocale, t } = useLanguage()
  const nextLocale = locale === "en" ? "VI" : "EN"

  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={t("common.switchLanguage")}
      title={t("common.switchLanguage")}
      onClick={toggleLocale}
      className={cn("gap-2 rounded-full px-3 text-slate-400 hover:text-white", className)}
    >
      <Languages size={18} />
      <span className="text-xs font-black tracking-widest">{nextLocale}</span>
    </Button>
  )
}
