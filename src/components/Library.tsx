import { useMemo, useState } from 'react'
import type { Course, Plan, Seminar } from '../types'
import { COURSES, SEMINARS, SPEC_BY_ID, offeringSummary } from '../lib/catalog'
import { placementOf } from '../lib/plan'
import { Bar, CourseBadges } from './Bits'
import { termShortLabel } from '../lib/terms'

type Sort = 'code' | 'rating' | 'difficulty' | 'workload' | 'reviews' | 'relevance'

const SORTS: { id: Sort; label: string }[] = [
  { id: 'relevance', label: 'Relevance' },
  { id: 'code', label: 'Code' },
  { id: 'rating', label: 'Rating' },
  { id: 'difficulty', label: 'Difficulty' },
  { id: 'workload', label: 'Workload' },
  { id: 'reviews', label: 'Reviews' },
]

export interface LibraryFilters {
  q: string
  foundational: boolean
  specOnly: boolean
  unplaced: boolean
  csCseOnly: boolean
  season: '' | 'FA' | 'SP' | 'SU'
  maxDifficulty: number
  sort: Sort
  showSeminars: boolean
}

const DEFAULT_FILTERS: LibraryFilters = {
  q: '',
  foundational: false,
  specOnly: false,
  unplaced: false,
  csCseOnly: false,
  season: '',
  maxDifficulty: 5,
  sort: 'relevance',
  showSeminars: false,
}

/** Relevance = how directly the course serves the active specialization. */
function relevance(course: Course, specId: string): number {
  const role = course.gtSpecRoles[specId]
  const spec = SPEC_BY_ID.get(specId)
  const named = spec?.groups.some((g) => g.courses.includes(course.code)) ?? false
  if (named && role === 'core') return 0
  if (named) return 1
  if (role === 'core') return 2
  if (role === 'elective') return 3
  if (course.foundational) return 4
  return 5
}

export function Library({
  plan,
  specId,
  selected,
  compare,
  onOpen,
  onSelect,
  onToggleCompare,
  onDragCode,
}: {
  plan: Plan
  specId: string
  selected: string | null
  compare: string[]
  onOpen: (code: string) => void
  onSelect: (code: string | null) => void
  onToggleCompare: (code: string) => void
  onDragCode: (code: string | null) => void
}) {
  const [f, setF] = useState<LibraryFilters>(DEFAULT_FILTERS)
  const set = <K extends keyof LibraryFilters>(k: K, v: LibraryFilters[K]) =>
    setF((prev) => ({ ...prev, [k]: v }))

  const spec = SPEC_BY_ID.get(specId)
  const specCodes = useMemo(
    () => new Set(spec ? spec.groups.flatMap((g) => g.courses) : []),
    [spec],
  )

  const courses = useMemo(() => {
    const q = f.q.trim().toLowerCase()
    const terms = q.split(/\s+/).filter(Boolean)
    const out = COURSES.filter((c) => {
      if (f.foundational && !c.foundational) return false
      if (f.specOnly && !specCodes.has(c.code)) return false
      if (f.csCseOnly && !c.isCsCse) return false
      if (f.unplaced && placementOf(plan, c.code)) return false
      if (f.season) {
        const o = c.offerings
        const ok = f.season === 'FA' ? o.fall : f.season === 'SP' ? o.spring : o.summer
        if (!ok) return false
      }
      const d = c.omscentral?.difficulty
      if (f.maxDifficulty < 5 && (d ?? 0) > f.maxDifficulty) return false
      if (!terms.length) return true
      const hay = `${c.code} ${c.title} ${c.omscentral?.tags?.join(' ') ?? ''} ${
        c.overview ?? ''
      }`.toLowerCase()
      return terms.every((t) => hay.includes(t))
    })

    const cmp: Record<Sort, (a: Course, b: Course) => number> = {
      code: (a, b) => a.code.localeCompare(b.code),
      rating: (a, b) => (b.omscentral?.rating ?? -1) - (a.omscentral?.rating ?? -1),
      difficulty: (a, b) => (a.omscentral?.difficulty ?? 99) - (b.omscentral?.difficulty ?? 99),
      workload: (a, b) => (a.omscentral?.workload ?? 999) - (b.omscentral?.workload ?? 999),
      reviews: (a, b) => (b.omscentral?.reviewCount ?? 0) - (a.omscentral?.reviewCount ?? 0),
      relevance: (a, b) =>
        relevance(a, specId) - relevance(b, specId) ||
        (b.omscentral?.rating ?? 0) - (a.omscentral?.rating ?? 0),
    }
    return out.sort((a, b) => cmp[f.sort](a, b) || a.code.localeCompare(b.code))
  }, [f, plan, specCodes, specId])

  const seminars = useMemo(() => {
    const q = f.q.trim().toLowerCase()
    return SEMINARS.filter(
      (s) =>
        s.status === 'scheduled' &&
        (!q || `${s.code} ${s.title}`.toLowerCase().includes(q)),
    )
  }, [f.q])

  return (
    <section className="panel col-library" aria-label="Course library">
      <div className="panel-head">
        <h2>Course library</h2>
        <span className="num dim" style={{ fontSize: 11 }}>
          {f.showSeminars ? seminars.length : courses.length} of {f.showSeminars ? SEMINARS.filter((s) => s.status === 'scheduled').length : COURSES.length}
        </span>
      </div>

      <div className="library-controls">
        <input
          type="search"
          value={f.q}
          placeholder="Search code, title, description…"
          onChange={(e) => set('q', e.target.value)}
          aria-label="Search courses"
        />
        <div className="filter-row">
          <button className="chip" aria-pressed={f.foundational} onClick={() => set('foundational', !f.foundational)}>
            Foundational
          </button>
          <button className="chip" aria-pressed={f.specOnly} onClick={() => set('specOnly', !f.specOnly)}>
            Counts for {spec?.short ?? 'spec'}
          </button>
          <button className="chip" aria-pressed={f.unplaced} onClick={() => set('unplaced', !f.unplaced)}>
            Not placed
          </button>
          <button className="chip" aria-pressed={f.csCseOnly} onClick={() => set('csCseOnly', !f.csCseOnly)}>
            CS / CSE only
          </button>
          <button className="chip" aria-pressed={f.showSeminars} onClick={() => set('showSeminars', !f.showSeminars)}>
            Seminars
          </button>
        </div>
        <div className="filter-row">
          <div className="field">
            <label htmlFor="lib-season">Runs in</label>
            <select
              id="lib-season"
              value={f.season}
              onChange={(e) => set('season', e.target.value as LibraryFilters['season'])}
            >
              <option value="">Any term</option>
              <option value="FA">Fall</option>
              <option value="SP">Spring</option>
              <option value="SU">Summer</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="lib-sort">Sort</label>
            <select id="lib-sort" value={f.sort} onChange={(e) => set('sort', e.target.value as Sort)}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" title="Hide courses harder than this on OMSCentral's 1–5 scale">
            <label htmlFor="lib-diff">Max diff</label>
            <input
              id="lib-diff"
              type="range"
              min={1}
              max={5}
              step={0.5}
              value={f.maxDifficulty}
              onChange={(e) => set('maxDifficulty', Number(e.target.value))}
              style={{ width: 74 }}
            />
            <span className="num dim" style={{ fontSize: 11 }}>
              {f.maxDifficulty === 5 ? 'all' : f.maxDifficulty.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      <ul className="course-list">
        {f.showSeminars
          ? seminars.map((s) => (
              <SeminarRow key={s.code} seminar={s} plan={plan} onOpen={onOpen} onSelect={onSelect} selected={selected} onDragCode={onDragCode} />
            ))
          : courses.map((c) => (
              <CourseRow
                key={c.code}
                course={c}
                plan={plan}
                specId={specId}
                relevant={specCodes.has(c.code)}
                selected={selected === c.code}
                comparing={compare.includes(c.code)}
                onOpen={onOpen}
                onSelect={onSelect}
                onToggleCompare={onToggleCompare}
                onDragCode={onDragCode}
              />
            ))}
        {!courses.length && !f.showSeminars && (
          <li style={{ padding: '14px 12px' }} className="dim">
            No courses match those filters.
          </li>
        )}
      </ul>
    </section>
  )
}

function CourseRow({
  course,
  plan,
  specId,
  relevant,
  selected,
  comparing,
  onOpen,
  onSelect,
  onToggleCompare,
  onDragCode,
}: {
  course: Course
  plan: Plan
  specId: string
  relevant: boolean
  selected: boolean
  comparing: boolean
  onOpen: (code: string) => void
  onSelect: (code: string | null) => void
  onToggleCompare: (code: string) => void
  onDragCode: (code: string | null) => void
}) {
  const placement = placementOf(plan, course.code)
  const oc = course.omscentral
  return (
    <li>
      <div
        className="course-row"
        data-placed={Boolean(placement)}
        data-selected={selected}
        data-relevant={relevant}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', course.code)
          e.dataTransfer.effectAllowed = 'move'
          onDragCode(course.code)
        }}
        onDragEnd={() => onDragCode(null)}
      >
        <div style={{ minWidth: 0 }}>
          <button
            type="button"
            className="course-code"
            style={{ background: 'none', border: 0, padding: 0 }}
            onClick={() => onOpen(course.code)}
            title="Open course detail"
          >
            {course.code}
          </button>
          <div className="course-title">{course.title}</div>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
          <button
            type="button"
            className="btn sm"
            aria-pressed={selected}
            onClick={() => onSelect(selected ? null : course.code)}
            title={placement ? `Placed in ${termShortLabel(placement.term)} — tap to move` : 'Tap, then choose a term'}
          >
            {placement ? termShortLabel(placement.term) : selected ? 'Choose term' : 'Place'}
          </button>
          <button
            type="button"
            className="btn sm ghost"
            aria-pressed={comparing}
            onClick={() => onToggleCompare(course.code)}
            title="Add to comparison"
          >
            ⇄
          </button>
        </div>
        <div className="course-stats">
          <CourseBadges course={course} specId={specId} />
          <Bar kind="rating" value={oc?.rating} max={5} label="Rating" />
          <Bar kind="difficulty" value={oc?.difficulty} max={5} label="Difficulty" />
          <Bar kind="workload" value={oc?.workload} max={30} suffix="h" label="Workload hrs/week" />
          <span title={offeringSummary(course)}>
            {course.offerings.known
              ? [course.offerings.fall && 'F', course.offerings.spring && 'Sp', course.offerings.summer && 'Su']
                  .filter(Boolean)
                  .join('·') || '—'
              : '?'}
          </span>
          {oc?.reviewCount ? <span className="dim">{oc.reviewCount} rev</span> : null}
        </div>
      </div>
    </li>
  )
}

function SeminarRow({
  seminar,
  plan,
  onOpen,
  onSelect,
  selected,
  onDragCode,
}: {
  seminar: Seminar
  plan: Plan
  onOpen: (code: string) => void
  onSelect: (code: string | null) => void
  selected: string | null
  onDragCode: (code: string | null) => void
}) {
  const placement = placementOf(plan, seminar.code)
  return (
    <li>
      <div
        className="course-row"
        data-placed={Boolean(placement)}
        data-selected={selected === seminar.code}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', seminar.code)
          onDragCode(seminar.code)
        }}
        onDragEnd={() => onDragCode(null)}
      >
        <div style={{ minWidth: 0 }}>
          <button
            type="button"
            className="course-code"
            style={{ background: 'none', border: 0, padding: 0 }}
            onClick={() => onOpen(seminar.code)}
          >
            {seminar.code}
          </button>
          <div className="course-title">{seminar.title}</div>
        </div>
        <button
          type="button"
          className="btn sm"
          aria-pressed={selected === seminar.code}
          onClick={() => onSelect(selected === seminar.code ? null : seminar.code)}
        >
          {placement ? termShortLabel(placement.term) : 'Place'}
        </button>
        <div className="course-stats">
          <span className="badge seminar">1 hr · pass/fail</span>
          <span className="dim">Does not count toward the degree</span>
          {seminar.schedule && <span className="dim">{seminar.schedule}</span>}
        </div>
      </div>
    </li>
  )
}
