import { useRef, useState } from 'react'
import type { Plan, TermId } from '../types'
import type { SyncState } from '../lib/store'
import { DATA_VERSION, SPECIALIZATIONS } from '../lib/catalog'
import { PLAN_DOC_PATH, isConfigured } from '../lib/firebase'
import { exportPlan, importPlan } from '../lib/plan'
import { termLabel } from '../lib/terms'

const SYNC_LABEL: Record<SyncState, string> = {
  'local-only': 'local only',
  connecting: 'connecting',
  synced: 'synced',
  saving: 'saving',
  offline: 'offline',
  rejected: 'not saved',
}

export function Header({
  plan,
  sync,
  lastSyncedAt,
  matriculationOptions,
  theme,
  onTheme,
  onSpecialization,
  onMatriculation,
  onImport,
  onReset,
}: {
  plan: Plan
  sync: SyncState
  lastSyncedAt: number | null
  matriculationOptions: TermId[]
  theme: 'system' | 'light' | 'dark'
  onTheme: (t: 'system' | 'light' | 'dark') => void
  onSpecialization: (id: string) => void
  onMatriculation: (t: TermId) => void
  onImport: (plan: Plan) => void
  onReset: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [menu, setMenu] = useState(false)

  const download = () => {
    const blob = new Blob([exportPlan(plan)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `omscs-plan-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <header className="header">
      <div className="brand">
        <span className="brand-mark" aria-hidden />
        <div>
          <h1>OMSCS Planner</h1>
          <div className="sub">
            Georgia Tech · MS Computer Science, Online · matriculated {termLabel(plan.matriculationTerm)}
          </div>
        </div>
      </div>

      <div className="header-spacer" />

      <div className="header-actions">
        <div className="field hide-mobile">
          <label htmlFor="spec-select">Specialization</label>
          <select
            id="spec-select"
            value={plan.specialization}
            onChange={(e) => onSpecialization(e.target.value)}
            title="Switch specialization to re-validate the same plan"
          >
            {SPECIALIZATIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.specializationHours} hrs)
              </option>
            ))}
          </select>
        </div>

        <span
          className="sync hide-mobile"
          data-state={sync}
          title={
            sync === 'rejected'
              ? `Firestore rejected the write to ${PLAN_DOC_PATH}. Check that firestore.rules is deployed and its document path matches VITE_PLAN_DOC_PATH. Your plan is safe in this browser — export it.`
              : isConfigured
                ? `Shared document ${PLAN_DOC_PATH}${
                    lastSyncedAt ? ` · last synced ${new Date(lastSyncedAt).toLocaleTimeString()}` : ''
                  }`
                : 'No Firebase config found — the plan lives in this browser only'
          }
        >
          <span className="dot" />
          {SYNC_LABEL[sync]}
        </span>

        <div style={{ position: 'relative' }}>
          <button className="btn ghost" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu">
            ⋯
          </button>
          {menu && (
            <div
              className="panel"
              role="menu"
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 6px)',
                width: 268,
                zIndex: 50,
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <div className="field only-mobile" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <label htmlFor="spec-select-m">Specialization</label>
                <select id="spec-select-m" value={plan.specialization} onChange={(e) => onSpecialization(e.target.value)}>
                  {SPECIALIZATIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <label htmlFor="matric-select">Matriculation term</label>
                <select id="matric-select" value={plan.matriculationTerm} onChange={(e) => onMatriculation(e.target.value)}>
                  {matriculationOptions.map((t) => (
                    <option key={t} value={t}>
                      {termLabel(t)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <label>Appearance</label>
                <div className="seg">
                  {(['system', 'light', 'dark'] as const).map((t) => (
                    <button key={t} aria-pressed={theme === t} onClick={() => onTheme(t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--rule)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button className="btn" onClick={download}>
                  Export plan (JSON)
                </button>
                <button className="btn" onClick={() => fileRef.current?.click()}>
                  Import plan…
                </button>
                <button className="btn" onClick={() => window.print()}>
                  Print / save PDF
                </button>
                <button
                  className="btn danger"
                  onClick={() => {
                    if (confirm('Clear every placement, grade, and note? Export first if you want a backup.')) {
                      onReset()
                      setMenu(false)
                    }
                  }}
                >
                  Reset plan
                </button>
              </div>

              <p className="dim" style={{ fontSize: 10.5, margin: 0, lineHeight: 1.45 }}>
                Catalog data v{DATA_VERSION}. No accounts — anyone with this URL reads and edits the same
                plan. Export regularly; there is no recovery path.
              </p>

              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    onImport(importPlan(await file.text()))
                    setMenu(false)
                  } catch {
                    alert('That file is not a plan export this app can read.')
                  }
                  e.target.value = ''
                }}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
