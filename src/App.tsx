import { useEffect, useMemo, useState } from 'react'
import type { Plan, TermId } from './types'
import { AssignBar } from './components/AssignBar'
import { Board } from './components/Board'
import { Compare } from './components/Compare'
import { CourseDetail } from './components/CourseDetail'
import { CostPanel } from './components/CostPanel'
import { Header } from './components/Header'
import { Library } from './components/Library'
import { SlotStrip } from './components/SlotStrip'
import { Validator } from './components/Validator'
import { boardTerms } from './lib/plan'
import { usePlan } from './lib/store'
import { termFromIndex, termIndex } from './lib/terms'
import { validate } from './lib/validate'

type Theme = 'system' | 'light' | 'dark'
type MobileView = 'plan' | 'courses' | 'status'

const YEARS_ON_BOARD = 4

export default function App() {
  const api = usePlan()
  const { plan } = api

  const [selected, setSelected] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [compare, setCompare] = useState<string[]>([])
  const [mobileView, setMobileView] = useState<MobileView>('plan')
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('gt-omscs-planner:theme') as Theme) || 'system',
  )

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    localStorage.setItem('gt-omscs-planner:theme', theme)
  }, [theme])

  const terms = useMemo(() => boardTerms(plan, YEARS_ON_BOARD), [plan])
  const validation = useMemo(() => validate(plan), [plan])

  const matriculationOptions = useMemo(() => {
    const start = termIndex('2024FA')
    return Array.from({ length: 15 }, (_, i) => termFromIndex(start + i))
  }, [])

  const place = (code: string, term: TermId) => {
    api.place(code, term)
    setSelected(null)
  }

  const toggleCompare = (code: string) =>
    setCompare((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev.slice(-2), code],
    )

  const importPlan = (next: Plan) => {
    api.replacePlan(next)
    setSelected(null)
    setDetail(null)
  }

  return (
    <div className="app">
      <Header
        plan={plan}
        sync={api.sync}
        lastSyncedAt={api.lastSyncedAt}
        matriculationOptions={matriculationOptions}
        theme={theme}
        onTheme={setTheme}
        onSpecialization={api.setSpecialization}
        onMatriculation={api.setMatriculationTerm}
        onImport={importPlan}
        onReset={api.resetPlan}
      />

      <SlotStrip plan={plan} validation={validation} onOpen={setDetail} />

      <div className="mobile-tabs">
        <div className="seg">
          {(['plan', 'courses', 'status'] as const).map((v) => (
            <button key={v} aria-pressed={mobileView === v} onClick={() => setMobileView(v)}>
              {v === 'plan' ? 'Plan' : v === 'courses' ? 'Courses' : 'Status'}
            </button>
          ))}
        </div>
      </div>

      <main className="main">
        <div className={`col${mobileView === 'courses' ? '' : ' hide-mobile'}`}>
          <Library
            plan={plan}
            specId={plan.specialization}
            selected={selected}
            compare={compare}
            onOpen={setDetail}
            onSelect={setSelected}
            onToggleCompare={toggleCompare}
            onDragCode={setDragging}
          />
        </div>

        <div className={`col${mobileView === 'plan' ? '' : ' hide-mobile'}`}>
          <Board
            plan={plan}
            terms={terms}
            validation={validation}
            selected={selected}
            dragging={dragging}
            onPlace={place}
            onRemove={api.remove}
            onGrade={api.setGrade}
            onOpen={setDetail}
            onNote={api.setNote}
            onSelect={setSelected}
          />
          {compare.length > 0 && (
            <Compare
              codes={compare}
              specId={plan.specialization}
              onRemove={(c) => setCompare((p) => p.filter((x) => x !== c))}
              onClear={() => setCompare([])}
              onOpen={setDetail}
            />
          )}
        </div>

        <div className={`col col-side sticky-col${mobileView === 'status' ? '' : ' hide-mobile'}`}>
          <Validator validation={validation} plan={plan} onTarget={api.setTargetGraduationTerm} />
          <CostPanel validation={validation} />
        </div>
      </main>

      {selected && (
        <AssignBar
          code={selected}
          terms={terms}
          validation={validation}
          onPlace={place}
          onCancel={() => setSelected(null)}
          onOpen={setDetail}
        />
      )}

      {detail && (
        <CourseDetail
          code={detail}
          plan={plan}
          terms={terms}
          validation={validation}
          onClose={() => setDetail(null)}
          onPlace={place}
          onRemove={(c) => {
            api.remove(c)
            setDetail(null)
          }}
          onGrade={api.setGrade}
          onCompare={(c) => {
            toggleCompare(c)
            setDetail(null)
          }}
        />
      )}
    </div>
  )
}
