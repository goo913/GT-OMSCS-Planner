import { useEffect, useRef } from 'react'
import type { Grade, Plan, TermId } from '../types'
import type { Validation } from '../lib/validate'
import { COURSE_BY_CODE, RULES, SEMINAR_BY_CODE, SPECIALIZATIONS, isSeminarCode, offeringSummary } from '../lib/catalog'
import { backgroundTopics } from '../lib/validate'
import { placementOf } from '../lib/plan'
import { termLabel, termShortLabel } from '../lib/terms'
import { Bar, Stat } from './Bits'

const GRADES: Grade[] = ['A', 'B', 'C', 'D', 'F', 'W']

export function CourseDetail({
  code,
  plan,
  terms,
  validation,
  onClose,
  onPlace,
  onRemove,
  onGrade,
  onCompare,
}: {
  code: string
  plan: Plan
  terms: TermId[]
  validation: Validation
  onClose: () => void
  onPlace: (code: string, term: TermId) => void
  onRemove: (code: string) => void
  onGrade: (code: string, grade: Grade | null) => void
  onCompare: (code: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const course = COURSE_BY_CODE.get(code)
  const seminar = SEMINAR_BY_CODE.get(code)
  const placement = placementOf(plan, code)
  const slot = validation.slots.find((s) => s.filledBy === code) ?? null
  const oc = course?.omscentral
  const topics = course ? backgroundTopics(course) : []

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`${code} detail`} tabIndex={-1} ref={ref}>
        <header className="sheet-head">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, justifyContent: 'space-between' }}>
            <div style={{ minWidth: 0 }}>
              <div className="mono" style={{ fontSize: 13, fontWeight: 700 }}>
                {code}
              </div>
              <h2 style={{ fontSize: 20, lineHeight: 1.2 }}>{course?.title ?? seminar?.title ?? code}</h2>
            </div>
            <button className="btn ghost" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>

          <div className="filter-row" style={{ marginTop: 10 }}>
            {placement ? (
              <>
                <span className="chip" aria-pressed>
                  {termLabel(placement.term)}
                </span>
                {!isSeminarCode(code) && (
                  <div className="field">
                    <label htmlFor="detail-grade">Grade</label>
                    <select
                      id="detail-grade"
                      value={placement.grade ?? ''}
                      onChange={(e) => onGrade(code, (e.target.value || null) as Grade | null)}
                    >
                      <option value="">planned</option>
                      {GRADES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button className="btn sm danger" onClick={() => onRemove(code)}>
                  Remove from plan
                </button>
              </>
            ) : (
              <span className="dim" style={{ fontSize: 12 }}>
                Not in the plan yet — pick a term:
              </span>
            )}
            <button className="btn sm ghost" onClick={() => onCompare(code)}>
              ⇄ Compare
            </button>
          </div>

          <div className="assignbar-terms" style={{ marginTop: 8 }}>
            {terms.slice(0, 12).map((t) => {
              const summary = validation.terms.find((x) => x.term === t)
              const cap = RULES.registration.maxCreditHours[t.slice(4) as 'FA' | 'SP' | 'SU']
              const full = (summary?.creditHours ?? 0) >= cap
              return (
                <button
                  key={t}
                  data-full={full}
                  onClick={() => onPlace(code, t)}
                  aria-pressed={placement?.term === t}
                  title={full ? `${termLabel(t)} is already at the ${cap}-hour cap` : `Place in ${termLabel(t)}`}
                >
                  {termShortLabel(t)}
                </button>
              )
            })}
          </div>
        </header>

        <div className="sheet-body">
          {course && (
            <>
              <div className="stat-grid">
                <Stat value={oc?.rating?.toFixed(2) ?? '—'} label="Rating / 5" title="OMSCentral average rating" />
                <Stat value={oc?.difficulty?.toFixed(2) ?? '—'} label="Difficulty / 5" />
                <Stat value={oc?.workload ? Math.round(oc.workload) : '—'} label="Hrs / week" />
                <Stat value={oc?.reviewCount ?? 0} label="Reviews" />
              </div>

              <div>
                <h3>At a glance</h3>
                <dl className="kv">
                  <dt>Credit hours</dt>
                  <dd className="num">{course.creditHours}</dd>
                  <dt>Foundational</dt>
                  <dd>
                    {course.foundational ? (
                      <>
                        Yes — counts toward the {RULES.foundational.coursesRequired}-course requirement (grade{' '}
                        {RULES.foundational.minGrade}+)
                      </>
                    ) : (
                      <>
                        No — cannot be registered until the foundational requirement is satisfied
                      </>
                    )}
                  </dd>
                  <dt>Term availability</dt>
                  <dd>
                    {offeringSummary(course)}
                    {course.offerings.lastOffered && (
                      <span className="dim"> · last seen {termLabel(course.offerings.lastOffered)}</span>
                    )}
                  </dd>
                  <dt>Subject cap</dt>
                  <dd>
                    {course.isCsCse
                      ? 'CS/CSE — counts toward the 24-hour minimum'
                      : `${course.subject} — counts against the ${RULES.degree.maxNonCsCseCreditHours}-hour non-CS/CSE cap`}
                  </dd>
                  {course.administeredBy && (
                    <>
                      <dt>Administered by</dt>
                      <dd>
                        OMS {course.administeredBy === 'analytics' ? 'Analytics' : 'Cybersecurity'} — register
                        only for an O## section; OAN and OCY sections return MAJOR RESTRICTION
                      </dd>
                    </>
                  )}
                  {course.formerly && (
                    <>
                      <dt>Formerly</dt>
                      <dd className="mono">{course.formerly}</dd>
                    </>
                  )}
                  {slot && (
                    <>
                      <dt>Filling</dt>
                      <dd>
                        {slot.group}
                        {slot.restriction ? ` · ${slot.restriction}` : ''} ({slot.section})
                      </dd>
                    </>
                  )}
                </dl>
              </div>

              <div>
                <h3>Counts toward</h3>
                <div className="filter-row">
                  {SPECIALIZATIONS.map((s) => {
                    const groups = s.groups.filter((g) => g.courses.includes(code))
                    if (!groups.length) return null
                    return (
                      <span
                        key={s.id}
                        className="chip"
                        aria-pressed={s.id === plan.specialization}
                        title={groups.map((g) => `${g.label} (${g.section})`).join(', ')}
                      >
                        {s.short}: {groups.map((g) => g.label).join(' / ')}
                      </span>
                    )
                  })}
                  {!SPECIALIZATIONS.some((s) => s.groups.some((g) => g.courses.includes(code))) && (
                    <span className="dim" style={{ fontSize: 12 }}>
                      Free elective only — no specialization lists this course.
                    </span>
                  )}
                </div>
              </div>

              {course.overview && (
                <div>
                  <h3>Overview</h3>
                  <p className="prose">{course.overview}</p>
                </div>
              )}

              {course.background && (
                <div>
                  <h3>Recommended background</h3>
                  {topics.length > 0 && (
                    <div className="filter-row" style={{ marginBottom: 6 }}>
                      {topics.map((t) => (
                        <span key={t} className="chip">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="prose">{course.background}</p>
                  <p className="dim" style={{ fontSize: 11, marginBottom: 0 }}>
                    Advisory only. {RULES.prerequisites.text}
                  </p>
                </div>
              )}

              {course.goals && (
                <div>
                  <h3>Course goals</h3>
                  <p className="prose">{course.goals}</p>
                </div>
              )}

              {course.team.length > 0 && (
                <div>
                  <h3>Instructional team</h3>
                  <p className="prose" style={{ whiteSpace: 'normal' }}>
                    {course.team.map((t) => `${t.name}${t.role ? ` (${t.role})` : ''}`).join(' · ')}
                  </p>
                </div>
              )}

              {oc && (oc.rating !== null || oc.difficulty !== null) && (
                <div>
                  <h3>OMSCentral</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <Bar kind="rating" value={oc.rating} max={5} label="Rating" />
                    <Bar kind="difficulty" value={oc.difficulty} max={5} label="Difficulty" />
                    <Bar kind="workload" value={oc.workload} max={30} suffix="h" label="Workload" />
                  </div>
                  {oc.textbooks.length > 0 && (
                    <p className="dim" style={{ fontSize: 11.5, marginBottom: 0, marginTop: 6 }}>
                      Textbooks: {oc.textbooks.map((t) => t.name).join('; ')}
                    </p>
                  )}
                </div>
              )}

              <div>
                <h3>Links</h3>
                <div className="linkrow">
                  <a className="btn sm" href={course.url} target="_blank" rel="noreferrer">
                    GT course page ↗
                  </a>
                  {oc?.url && (
                    <a className="btn sm" href={oc.url} target="_blank" rel="noreferrer">
                      OMSCentral reviews ↗
                    </a>
                  )}
                  {oc?.notesUrl && (
                    <a className="btn sm" href={oc.notesUrl} target="_blank" rel="noreferrer">
                      Lecture notes ↗
                    </a>
                  )}
                  {course.syllabi.map((s) => (
                    <a className="btn sm" key={s.url} href={s.url} target="_blank" rel="noreferrer">
                      {s.label} ↗
                    </a>
                  ))}
                  {course.videos.map((v, i) => (
                    <a className="btn sm" key={v} href={v.replace('/embed/', '/watch?v=')} target="_blank" rel="noreferrer">
                      {i === 0 ? 'Course preview' : 'Sample lesson'} ↗
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}

          {seminar && (
            <>
              <div className="callout">
                <b>Seminars do not count toward the degree.</b> {RULES.seminars.creditHours} credit hour,{' '}
                {RULES.seminars.grading}, excluded from the {RULES.degree.totalCreditHours}-hour requirement,
                from the foundational requirement, and from GPA — but they do count against the per-semester
                hour cap, and they cost money.
              </div>
              {seminar.schedule && (
                <dl className="kv">
                  <dt>Schedule</dt>
                  <dd>{seminar.schedule}</dd>
                </dl>
              )}
              {seminar.lastOffered && (
                <dl className="kv">
                  <dt>Last offered</dt>
                  <dd>{seminar.lastOffered}</dd>
                </dl>
              )}
              {seminar.description && (
                <div>
                  <h3>Description</h3>
                  <p className="prose">{seminar.description}</p>
                </div>
              )}
              <a className="btn sm" href="https://omscs.gatech.edu/seminars" target="_blank" rel="noreferrer">
                All OMSCS seminars ↗
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
