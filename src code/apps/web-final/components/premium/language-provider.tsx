"use client"

import * as React from "react"
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries"

interface LanguageContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  toggleLocale: () => void
  t: (path: string) => string
}

const LanguageContext = React.createContext<LanguageContextValue | null>(null)
const subscribers = new Set<() => void>()
const storageKey = "workspace-locale"

function isLocale(value: string | null): value is Locale {
  return value === "en" || value === "vi"
}

function readLocale(): Locale {
  if (typeof window === "undefined") {
    return "en"
  }

  const storedLocale = window.localStorage.getItem(storageKey)

  return isLocale(storedLocale) ? storedLocale : "en"
}

function subscribe(callback: () => void) {
  subscribers.add(callback)

  return () => {
    subscribers.delete(callback)
  }
}

function notifyLanguageChange() {
  subscribers.forEach((callback) => callback())
}

function readNestedValue(source: unknown, path: string): string | null {
  const value = path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key]
    }

    return undefined
  }, source)

  return typeof value === "string" ? value : null
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const locale = React.useSyncExternalStore<Locale>(subscribe, readLocale, () => "en")

  React.useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = React.useCallback((nextLocale: Locale) => {
    window.localStorage.setItem(storageKey, nextLocale)
    document.documentElement.lang = nextLocale
    notifyLanguageChange()
  }, [])

  const toggleLocale = React.useCallback(() => {
    setLocale(locale === "en" ? "vi" : "en")
  }, [locale, setLocale])

  const t = React.useCallback(
    (path: string) => readNestedValue(dictionaries[locale], path) ?? path,
    [locale],
  )

  const value = React.useMemo(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      t,
    }),
    [locale, setLocale, t, toggleLocale],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = React.useContext(LanguageContext)

  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider")
  }

  return context
}
