import { useCallback, useEffect, useState } from 'react'

/**
 * Device-local preferences. Anything that changes what the plan *means* lives in the
 * shared Firestore document instead (see PlanSettings) — these only change how it looks
 * on this screen, so they stay out of the other person's way.
 */
export interface Prefs {
  theme: 'light' | 'dark' | 'system'
  density: 'comfortable' | 'compact'
  view: 'plan' | 'summary'
  libraryOpen: boolean
  requirementsOpen: boolean
}

const KEY = 'gt-omscs-planner:prefs'

const DEFAULTS: Prefs = {
  theme: 'system',
  density: 'comfortable',
  view: 'plan',
  libraryOpen: true,
  requirementsOpen: true,
}

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(read)

  const set = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* private mode — the session still works, it just will not be remembered */
      }
      return next
    })
  }, [])

  /* theme */
  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const dark =
        prefs.theme === 'dark' ||
        (prefs.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      root.classList.toggle('dark', dark)
    }
    apply()
    if (prefs.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [prefs.theme])

  /* density */
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('density-compact', prefs.density === 'compact')
    root.classList.toggle('density-comfortable', prefs.density === 'comfortable')
  }, [prefs.density])

  return { prefs, set }
}
