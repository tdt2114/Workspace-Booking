"use client"

import * as React from "react"

type Theme = "light" | "dark"

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)
const subscribers = new Set<() => void>()

function readTheme(): Theme {
  if (typeof window === "undefined") {
    return "dark"
  }

  const storedTheme = window.localStorage.getItem("workspace-theme")

  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"
}

function applyTheme(theme: Theme) {
  const root = document.documentElement

  root.classList.toggle("light", theme === "light")
  root.classList.toggle("dark", theme === "dark")
  root.style.colorScheme = theme
}

function subscribe(callback: () => void) {
  subscribers.add(callback)

  return () => {
    subscribers.delete(callback)
  }
}

function notifyThemeChange() {
  subscribers.forEach((callback) => callback())
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = React.useSyncExternalStore<Theme>(subscribe, readTheme, () => "dark")

  React.useLayoutEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = React.useCallback((nextTheme: Theme) => {
    window.localStorage.setItem("workspace-theme", nextTheme)
    applyTheme(nextTheme)
    notifyThemeChange()
  }, [])

  const toggleTheme = React.useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark")
  }, [setTheme, theme])

  const value = React.useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [setTheme, theme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useWorkspaceTheme() {
  const context = React.useContext(ThemeContext)

  if (!context) {
    throw new Error("useWorkspaceTheme must be used within ThemeProvider")
  }

  return context
}
