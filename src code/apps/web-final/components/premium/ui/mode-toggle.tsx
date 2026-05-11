"use client"

import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/premium/ui/button"
import { useLanguage } from "@/components/premium/language-provider"
import { useWorkspaceTheme } from "@/components/premium/theme-provider"
import { cn } from "@/lib/utils"

interface ModeToggleProps {
  className?: string
}

export function ModeToggle({ className }: ModeToggleProps) {
  const { theme, toggleTheme } = useWorkspaceTheme()
  const { t } = useLanguage()
  const isDark = theme === "dark"

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={isDark ? t("common.switchToLight") : t("common.switchToDark")}
      title={isDark ? t("common.lightMode") : t("common.darkMode")}
      onClick={toggleTheme}
      className={cn(
        "h-9 gap-2 rounded-full border px-3 font-black",
        "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950",
        "dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15 dark:hover:text-white",
        className
      )}
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
      <span className="hidden text-xs sm:inline">{isDark ? "Light" : "Dark"}</span>
    </Button>
  )
}
