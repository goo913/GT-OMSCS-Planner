/**
 * usePlan — the whole application state.
 *
 * One fixed Firestore document holds the plan; everyone who opens the URL reads and
 * writes that same document. onSnapshot keeps two devices in step. Writes are
 * debounced and sent as dotted field paths so that two people editing different
 * courses merge at the field level instead of clobbering each other's document.
 *
 * localStorage is the safety net: it is written after every change and read on boot,
 * so the board renders instantly and keeps working with Firebase unreachable.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Grade, Plan, TermId } from '../types'
import { codeKey, lookup } from './catalog'
import { connect, isConfigured, type PlanDoc } from './firebase'
import { emptyPlan, normalizePlan } from './plan'

export type SyncState = 'local-only' | 'connecting' | 'synced' | 'saving' | 'offline' | 'rejected'

const LS_KEY = 'gt-omscs-planner:plan'
const LS_BACKUP_KEY = 'gt-omscs-planner:last-synced'
const WRITE_DEBOUNCE_MS = 500

function readLocal(key: string): Plan | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? normalizePlan(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function writeLocal(key: string, plan: Plan) {
  try {
    localStorage.setItem(key, JSON.stringify(plan))
  } catch {
    /* quota or private mode — the plan still lives in memory and in Firestore */
  }
}

/** Firestore update payload: dotted paths so unrelated fields merge instead of replace. */
type Patch = Record<string, unknown>

/**
 * Stand-in for firestore's deleteField(). The SDK loads asynchronously, so patches are
 * built with this marker and it is swapped for the real FieldValue at flush time.
 */
const DELETE = { __delete: true } as const
const isDelete = (v: unknown) => v === DELETE

export interface PlanApi {
  plan: Plan
  sync: SyncState
  lastSyncedAt: number | null
  /** true once the first snapshot (or the localStorage fallback) has landed. */
  ready: boolean
  place: (code: string, term: TermId) => void
  remove: (code: string) => void
  setGrade: (code: string, grade: Grade | null) => void
  setSpecialization: (id: string) => void
  setMatriculationTerm: (term: TermId) => void
  setTargetGraduationTerm: (term: TermId | null) => void
  setNote: (term: TermId, text: string) => void
  replacePlan: (plan: Plan) => void
  resetPlan: () => void
}

export function usePlan(): PlanApi {
  const [plan, setPlan] = useState<Plan>(() => readLocal(LS_KEY) ?? emptyPlan())
  const [sync, setSync] = useState<SyncState>(isConfigured ? 'connecting' : 'local-only')
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [ready, setReady] = useState(!isConfigured)

  const pending = useRef<Patch>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const applyingRemote = useRef(false)
  const docExists = useRef(false)
  const conn = useRef<PlanDoc | null>(null)
  // The seed write has to send a whole plan, not a patch — firestore.rules requires
  // every required top-level key to be present in the resulting document. Kept in a
  // ref (updated after commit, not during render) so flush can read it 500ms later.
  const latest = useRef<Plan>(plan)

  useEffect(() => {
    latest.current = plan
  }, [plan])

  /* subscribe — the SDK is loaded lazily, so the board is already on screen by now */
  useEffect(() => {
    if (!isConfigured) return
    let unsub: (() => void) | undefined
    let cancelled = false
    void connect().then((c) => {
      if (cancelled || !c) {
        if (!cancelled) setSync('local-only')
        setReady(true)
        return
      }
      conn.current = c
      unsub = c.fs.onSnapshot(
        c.ref,
        (snap) => {
          docExists.current = snap.exists()
          if (snap.exists()) {
            const incoming = normalizePlan(snap.data())
            applyingRemote.current = true
            setPlan(incoming)
            writeLocal(LS_KEY, incoming)
            writeLocal(LS_BACKUP_KEY, incoming)
            setLastSyncedAt(Date.now())
            applyingRemote.current = false
          }
          setReady(true)
          setSync((s) => (s === 'saving' ? s : 'synced'))
        },
        (err) => {
          // Offline, or the rules rejected the read. Either way keep running from
          // localStorage — but say which, since only one of them will fix itself.
          setReady(true)
          setSync((err as { code?: string })?.code === 'permission-denied' ? 'rejected' : 'offline')
        },
      )
    })
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [])

  const flush = useCallback(async () => {
    const c = conn.current ?? (await connect())
    if (!c) return
    conn.current = c
    const patch = pending.current
    pending.current = {}
    if (!Object.keys(patch).length) return
    patch.updatedAt = Date.now()
    const resolved: Patch = {}
    for (const [k, v] of Object.entries(patch)) resolved[k] = isDelete(v) ? c.fs.deleteField() : v
    try {
      if (docExists.current) {
        await c.fs.updateDoc(c.ref, resolved)
      } else {
        // First write of a brand-new document. updateDoc would fail outright, and a
        // patch-shaped setDoc would be rejected by the rules for missing required
        // keys — so seed the complete plan, which already carries this edit.
        await c.fs.setDoc(c.ref, { ...latest.current, updatedAt: Date.now() })
        docExists.current = true
      }
      setSync('synced')
      setLastSyncedAt(Date.now())
    } catch (err) {
      // A rules rejection is not a network problem and retrying will not fix it, so
      // surface it plainly instead of letting the plan sit in a silent "offline".
      if ((err as { code?: string })?.code === 'permission-denied') {
        setSync('rejected')
        return
      }
      // Re-queue so the next successful flush carries these changes too.
      pending.current = { ...patch, ...pending.current }
      setSync('offline')
    }
  }, [])

  const queue = useCallback(
    (patch: Patch) => {
      if (!isConfigured) return
      Object.assign(pending.current, patch)
      setSync('saving')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), WRITE_DEBOUNCE_MS)
    },
    [flush],
  )

  /* Never lose an edit to a tab close mid-debounce. */
  useEffect(() => {
    const onHide = () => {
      if (Object.keys(pending.current).length) void flush()
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [flush])

  const mutate = useCallback(
    (fn: (draft: Plan) => Patch) => {
      setPlan((prev) => {
        const draft: Plan = {
          ...prev,
          placements: { ...prev.placements },
          notes: { ...prev.notes },
        }
        const patch = fn(draft)
        draft.updatedAt = Date.now()
        writeLocal(LS_KEY, draft)
        if (!applyingRemote.current) queue(patch)
        return draft
      })
    },
    [queue],
  )

  const place = useCallback(
    (code: string, term: TermId) => {
      if (!lookup(code)) return
      mutate((draft) => {
        const key = codeKey(code)
        const existing = draft.placements[key]
        const next = { code, term, grade: existing?.grade ?? null, updatedAt: Date.now() }
        draft.placements[key] = next
        return { [`placements.${key}`]: next }
      })
    },
    [mutate],
  )

  const remove = useCallback(
    (code: string) => {
      mutate((draft) => {
        const key = codeKey(code)
        delete draft.placements[key]
        return { [`placements.${key}`]: DELETE }
      })
    },
    [mutate],
  )

  const setGrade = useCallback(
    (code: string, grade: Grade | null) => {
      mutate((draft) => {
        const key = codeKey(code)
        const existing = draft.placements[key]
        if (!existing) return {}
        draft.placements[key] = { ...existing, grade, updatedAt: Date.now() }
        return { [`placements.${key}.grade`]: grade, [`placements.${key}.updatedAt`]: Date.now() }
      })
    },
    [mutate],
  )

  const setSpecialization = useCallback(
    (id: string) =>
      mutate((draft) => {
        draft.specialization = id
        return { specialization: id }
      }),
    [mutate],
  )

  const setMatriculationTerm = useCallback(
    (term: TermId) =>
      mutate((draft) => {
        draft.matriculationTerm = term
        return { matriculationTerm: term }
      }),
    [mutate],
  )

  const setTargetGraduationTerm = useCallback(
    (term: TermId | null) =>
      mutate((draft) => {
        draft.targetGraduationTerm = term
        return { targetGraduationTerm: term }
      }),
    [mutate],
  )

  const setNote = useCallback(
    (term: TermId, text: string) =>
      mutate((draft) => {
        if (text.trim()) {
          draft.notes[term] = text
          return { [`notes.${term}`]: text }
        }
        delete draft.notes[term]
        return { [`notes.${term}`]: DELETE }
      }),
    [mutate],
  )

  const replacePlan = useCallback((next: Plan) => {
    const normalized = normalizePlan(next)
    setPlan(normalized)
    writeLocal(LS_KEY, normalized)
    if (!isConfigured) return
    setSync('saving')
    void connect()
      .then((c) => {
        if (!c) return
        conn.current = c
        // A whole-document replace is correct here: import and reset mean
        // "this is now the plan", not "merge these fields".
        return c.fs.setDoc(c.ref, { ...normalized, updatedAt: Date.now() }).then(() => {
          docExists.current = true
          setSync('synced')
          setLastSyncedAt(Date.now())
        })
      })
      .catch((err) => setSync((err as { code?: string })?.code === 'permission-denied' ? 'rejected' : 'offline'))
  }, [])

  const resetPlan = useCallback(() => replacePlan(emptyPlan()), [replacePlan])

  return {
    plan,
    sync,
    lastSyncedAt,
    ready,
    place,
    remove,
    setGrade,
    setSpecialization,
    setMatriculationTerm,
    setTargetGraduationTerm,
    setNote,
    replacePlan,
    resetPlan,
  }
}

/** The rolling snapshot kept after every successful sync, for the export panel. */
export function readBackup(): Plan | null {
  return readLocal(LS_BACKUP_KEY)
}
