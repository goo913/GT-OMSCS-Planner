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
import type { Grade, Plan, PlanSettings, TermId } from '../types'
import { codeKey, lookup } from './catalog'
import { connect, isConfigured, type PlanDoc } from './firebase'
import { emptyPlan, normalizePlan } from './plan'

export type SyncState = 'local-only' | 'connecting' | 'synced' | 'saving' | 'offline' | 'rejected'

const LS_KEY = 'gt-omscs-planner:plan'
const LS_BACKUP_KEY = 'gt-omscs-planner:last-synced'
/** Whatever this device overwrote when it published its own copy, kept so a
 *  last-write-wins decision is never unrecoverable. */
const LS_REPLACED_KEY = 'gt-omscs-planner:replaced'
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
  /** Remove one course and place another in a single write, so a swap is atomic. */
  swap: (removeCode: string, addCode: string, term: TermId) => void
  setSpecialization: (id: string) => void
  setMatriculationTerm: (term: TermId) => void
  setTargetGraduationTerm: (term: TermId | null) => void
  setNote: (term: TermId, text: string) => void
  setSetting: <K extends keyof PlanSettings>(key: K, value: PlanSettings[K]) => void
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
  const reconciled = useRef(false)
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
          const remote = snap.exists() ? normalizePlan(snap.data()) : null

          /**
           * First snapshot only: decide which copy is the truth.
           *
           * Without this the app was quietly single-device. A browser that already
           * held the plan in localStorage would render it happily while the shared
           * document stayed empty, so anyone else opening the same URL saw nothing —
           * and the plan was only pushed up on the *next* edit, which might never come.
           */
          if (!reconciled.current) {
            reconciled.current = true
            const local = latest.current
            const localHasContent =
              Object.keys(local.placements).length > 0 || Object.keys(local.notes).length > 0

            // Nobody has published a plan yet, but this device has one: publish it.
            // Same when this device holds edits the shared document never received —
            // an offline session, or a write that failed and was never retried.
            const localIsNewer = remote !== null && local.updatedAt > remote.updatedAt
            if (localHasContent && (remote === null || localIsNewer)) {
              if (remote) writeLocal(LS_REPLACED_KEY, remote)
              setSync('saving')
              void c.fs
                .setDoc(c.ref, { ...local, updatedAt: Date.now() })
                .then(() => {
                  docExists.current = true
                  setSync('synced')
                  setLastSyncedAt(Date.now())
                })
                .catch(() => setSync('offline'))
              setReady(true)
              return
            }
          }

          if (remote) {
            applyingRemote.current = true
            setPlan(remote)
            writeLocal(LS_KEY, remote)
            writeLocal(LS_BACKUP_KEY, remote)
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
          settings: { ...prev.settings },
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

  const swap = useCallback(
    (removeCode: string, addCode: string, term: TermId) => {
      if (!lookup(addCode)) return
      mutate((draft) => {
        const outKey = codeKey(removeCode)
        const inKey = codeKey(addCode)
        delete draft.placements[outKey]
        const next = {
          code: addCode,
          term,
          grade: draft.placements[inKey]?.grade ?? null,
          updatedAt: Date.now(),
        }
        draft.placements[inKey] = next
        return { [`placements.${outKey}`]: DELETE, [`placements.${inKey}`]: next }
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

  const setSetting = useCallback(
    <K extends keyof PlanSettings>(key: K, value: PlanSettings[K]) =>
      mutate((draft) => {
        draft.settings = { ...draft.settings, [key]: value }
        return { [`settings.${key}`]: value }
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
    swap,
    setSpecialization,
    setMatriculationTerm,
    setTargetGraduationTerm,
    setNote,
    setSetting,
    replacePlan,
    resetPlan,
  }
}

/** The rolling snapshot kept after every successful sync, for the export panel. */
export function readBackup(): Plan | null {
  return readLocal(LS_BACKUP_KEY)
}

/** The shared plan this device replaced when it published its own, if that happened. */
export function readReplaced(): Plan | null {
  return readLocal(LS_REPLACED_KEY)
}
