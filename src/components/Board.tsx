import { useState } from 'react'
import calendarData from '../data/calendar.json'
import type { Grade, Placement, Plan, TermId } from '../types'
import type { Slot, Validation } from '../lib/validate'
import { COURSE_BY_CODE, RULES, isSeminarCode, lookup } from '../lib/catalog'
import { costForTerm, money } from '../lib/cost'
import { placementsInTerm } from '../lib/plan'
import { seasonOf, termIndex, termLabel } from '../lib/terms'

const CALENDAR = calendarData as unknown as {
  registrarUrl: string
  terms: Record<TermId, { source: string; sourceUrl: string; dates: { date: string; label: string; kind?: string; note?: string }[] }>
}

const GRADES: (Grade | '')[] = ['', 'A', 'B', 'C', 'D', 'F', 'W', 'P']

export function Board({
  plan,
  terms,
  validation,
  selected,
  dragging,
  onPlace,
  onRemove,
  onGrade,
  onOpen,
  onNote,
  onSelect,
}: {
  plan: Plan
  terms: TermId[]
  validation: Validation
  selected: string | null
  dragging: string | null
  onPlace: (code: string, term: TermId) => void
  onRemove: (code: string) => void
  onGrade: (code: string, grade: Grade | null) => void
  onOpen: (code: string) => void
  onNote: (term: TermId, text: string) => void
  onSelect: (code: string | null) => void
}) {
  const [dropTarget, setDropTarget] = useState<TermId | null>(null)
  const slotByCode = new Map<string, Slot>()
  for (const s of validation.slots) if (s.filledBy) slotByCode.set(s.filledBy, s)

  // Group into academic years — Fall, then the Spring and Summer that close it out —
  // so a four-year plan reads as four rows instead of one long horizontal scroll.
  const years = new Map<number, TermId[]>()
  for (const t of terms) {
    const y = Math.floor(termIndex(t) / 3)
    if (!years.has(y)) years.set(y, [])
    years.get(y)!.push(t)
  }

  return (
    <div className="years" role="list" aria-label="Semester plan">
      {[...years.entries()].map(([year, group]) => {
        const cost = group.reduce((n, t) => {
          const s = validation.terms.find((x) => x.term === t)
          return n + costForTerm(t, s?.creditHours ?? 0).total
        }, 0)
        const courses = group.reduce(
          (n, t) => n + (validation.terms.find((x) => x.term === t)?.degreeCourses.length ?? 0),
          0,
        )
        return (
          <section className="year" key={year} data-empty={courses === 0}>
            <div className="year-label">
              <span className="eyebrow">
                {year}–{String(year + 1).slice(2)}
              </span>
              <span className="num dim">
                {courses} {courses === 1 ? 'course' : 'courses'}
              </span>
              <span className="num dim">{cost > 0 ? money(cost) : '—'}</span>
            </div>
            <div className="board">
              {group.map((term) => (
                <TermColumn
                  key={term}
                  term={term}
                  plan={plan}
                  validation={validation}
                  slotByCode={slotByCode}
                  selected={selected}
                  dragging={dragging}
                  isDropTarget={dropTarget === term}
                  setDropTarget={setDropTarget}
                  onPlace={onPlace}
                  onRemove={onRemove}
                  onGrade={onGrade}
                  onOpen={onOpen}
                  onNote={onNote}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function TermColumn({
  term,
  plan,
  validation,
  slotByCode,
  selected,
  dragging,
  isDropTarget,
  setDropTarget,
  onPlace,
  onRemove,
  onGrade,
  onOpen,
  onNote,
  onSelect,
}: {
  term: TermId
  plan: Plan
  validation: Validation
  slotByCode: Map<string, Slot>
  selected: string | null
  dragging: string | null
  isDropTarget: boolean
  setDropTarget: (t: TermId | null) => void
  onPlace: (code: string, term: TermId) => void
  onRemove: (code: string) => void
  onGrade: (code: string, grade: Grade | null) => void
  onOpen: (code: string) => void
  onNote: (term: TermId, text: string) => void
  onSelect: (code: string | null) => void
}) {
  const placements = placementsInTerm(plan, term)
  const summary = validation.terms.find((t) => t.term === term)
  const hours = summary?.creditHours ?? 0
  const cap = RULES.registration.maxCreditHours[seasonOf(term)]
  const cost = costForTerm(term, hours)
  const cal = CALENDAR.terms[term]
  const isFoundationalWindow = validation.foundationalWindow.includes(term)
  const past = termIndex(term) < termIndex(plan.matriculationTerm)

  const accept = (code: string) => {
    if (!code || !lookup(code)) return
    onPlace(code, term)
    onSelect(null)
  }

  return (
    <section
      className="term"
      role="listitem"
      data-over={hours > cap}
      data-past={past}
      data-drop={isDropTarget}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDropTarget(term)
      }}
      onDragLeave={() => setDropTarget(null)}
      onDrop={(e) => {
        e.preventDefault()
        setDropTarget(null)
        accept(e.dataTransfer.getData('text/plain'))
      }}
      aria-label={termLabel(term)}
    >
      <header className="term-head">
        <div className="term-title">
          <strong>{termLabel(term)}</strong>
          <span className="num dim" style={{ fontSize: 11 }}>
            {money(cost.total)}
            {cost.estimated && (
              <span className="tag-est" style={{ marginLeft: 4 }} title={`Estimated from ${termLabel(cost.basedOn)} rates`}>
                est
              </span>
            )}
          </span>
        </div>
        <div className="term-stats">
          <span className={hours > cap ? 'over' : ''} title={`${cap}-hour cap in ${seasonOf(term) === 'SU' ? 'Summer' : 'Fall and Spring'}`}>
            {hours}/{cap} hrs
          </span>
          {summary && summary.workloadHoursPerWeek > 0 && (
            <span
              title="Sum of OMSCentral self-reported hours per week"
              style={
                summary.workloadHoursPerWeek > RULES.workload.comfortableHoursPerWeek
                  ? { color: 'var(--warn)', fontWeight: 700 }
                  : undefined
              }
            >
              ≈{Math.round(summary.workloadHoursPerWeek)} h/wk
            </span>
          )}
          {hours > 0 && (
            <span className={cost.loanEligible ? 'tag-half' : 'tag-nohalf'} title={RULES.financialAid.note}>
              {cost.loanEligible ? 'half-time' : 'below half-time'}
            </span>
          )}
          {isFoundationalWindow && (
            <span className="dim" title="Inside the 12-month foundational window">
              foundational window
            </span>
          )}
        </div>
      </header>

      <div className="term-body">
        {placements.map((p) => (
          <PlacementCard
            key={p.code}
            placement={p}
            slot={slotByCode.get(p.code) ?? null}
            validation={validation}
            onRemove={onRemove}
            onGrade={onGrade}
            onOpen={onOpen}
          />
        ))}

        {selected ? (
          <button type="button" className="term-drop active" onClick={() => accept(selected)}>
            Put <span className="mono">{selected}</span> here
          </button>
        ) : (
          <div className="term-drop" aria-hidden={!dragging}>
            {dragging ? 'Drop here' : hours >= cap ? 'At the cap' : 'Drag or tap a course'}
          </div>
        )}
      </div>

      {cal && (
        <div className="term-deadlines">
          {cal.dates
            .filter((d) => d.kind === 'payment' || d.kind === 'deadline')
            .map((d) => (
              <span key={d.date}>
                <b>{d.date.slice(5)}</b> {d.label}
                {d.note ? ` (${d.note})` : ''}
              </span>
            ))}
          <a href={CALENDAR.registrarUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10 }}>
            Full academic calendar ↗
          </a>
        </div>
      )}

      <div className="term-notes">
        <label className="eyebrow" htmlFor={`note-${term}`}>
          Notes
        </label>
        <textarea
          id={`note-${term}`}
          rows={1}
          placeholder="—"
          value={plan.notes[term] ?? ''}
          onChange={(e) => onNote(term, e.target.value)}
        />
      </div>
    </section>
  )
}

function PlacementCard({
  placement,
  slot,
  validation,
  onRemove,
  onGrade,
  onOpen,
}: {
  placement: Placement
  slot: Slot | null
  validation: Validation
  onRemove: (code: string) => void
  onGrade: (code: string, grade: Grade | null) => void
  onOpen: (code: string) => void
}) {
  const entry = lookup(placement.code)
  const course = COURSE_BY_CODE.get(placement.code)
  const seminar = isSeminarCode(placement.code)
  // Recommended background is published for most courses and is advisory, so it is
  // reported in the validator but never used to put a warning ring on a card.
  const flagged = validation.checks.some(
    (c) =>
      c.id !== 'background' &&
      (c.status === 'warn' || c.status === 'fail') &&
      c.offenders?.includes(placement.code),
  )
  const kind = seminar ? 'seminar' : slot ? slot.section : 'free'
  const gradePoint = placement.grade ? RULES.gradePoints[placement.grade] : undefined

  return (
    <div
      className="placement"
      data-slot={kind}
      data-flag={flagged}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', placement.code)
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      <button
        type="button"
        className="course-code"
        style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }}
        onClick={() => onOpen(placement.code)}
      >
        {placement.code}
      </button>
      <button
        type="button"
        className="btn sm ghost"
        onClick={() => onRemove(placement.code)}
        aria-label={`Remove ${placement.code}`}
        title="Remove from the plan"
      >
        ×
      </button>
      <div className="placement-title">{entry?.title ?? placement.code}</div>
      <div className="placement-foot">
        <span>
          {seminar
            ? 'seminar'
            : slot
              ? slot.restriction
                ? `${slot.group} · ${slot.restriction}`
                : slot.group
              : 'free elective'}
        </span>
        {course?.foundational && <span className="badge found">Found</span>}
        {seminar ? (
          <span className="dim">not counted</span>
        ) : (
          <label style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <span className="sr-only">Grade for {placement.code}</span>
            <select
              value={placement.grade ?? ''}
              onChange={(e) => onGrade(placement.code, (e.target.value || null) as Grade | null)}
              style={{ padding: '0 2px', fontSize: 11, borderRadius: 3 }}
              title={
                placement.grade
                  ? gradePoint !== undefined
                    ? `${placement.grade} = ${gradePoint.toFixed(1)} grade points`
                    : `${placement.grade} — no GPA impact`
                  : 'Planned — no grade yet'
              }
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g || 'planned'}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  )
}
