'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // SSR or localStorage unavailable
  }
  return 'system'
}

function subscribeToMediaQuery(callback: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', callback)
  return () => mq.removeEventListener('change', callback)
}

function getMediaSnapshot(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function getMediaServerSnapshot(): boolean {
  return false
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const prefersDark = useSyncExternalStore(subscribeToMediaQuery, getMediaSnapshot, getMediaServerSnapshot)
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)

  const resolvedTheme: ResolvedTheme = theme === 'system'
    ? (prefersDark ? 'dark' : 'light')
    : theme

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
  }, [resolvedTheme])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('theme', newTheme)
  }, [])

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
