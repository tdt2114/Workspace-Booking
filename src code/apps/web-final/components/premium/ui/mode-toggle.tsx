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
      size="icon"
      aria-label={isDark ? t("common.switchToLight") : t("common.switchToDark")}
      title={isDark ? t("common.lightMode") : t("common.darkMode")}
      onClick={toggleTheme}
      className={cn("rounded-full text-slate-400 hover:text-white", className)}
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </Button>
  )
}
