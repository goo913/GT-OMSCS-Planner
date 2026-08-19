import type { ReactNode } from 'react'
import type { Course } from '../types'

/** A labelled micro-bar for a 0..max metric. Used for rating / difficulty / workload. */
export function Bar({
  kind,
  value,
  max,
  suffix = '',
  label,
}: {
  kind: 'rating' | 'difficulty' | 'workload'
  value: number | null | undefined
  max: number
  suffix?: string
  label: string
}) {
  if (value === null || value === undefined) {
    return (
      <span className="bar" data-kind={kind} title={`${label}: no data`}>
        <span className="bar-track" />
        <span className="dim">—</span>
      </span>
    )
  }
  const pct = Math.max(0, Math.min(1, value / max))
  return (
    <span className="bar" data-kind={kind} title={`${label}: ${value.toFixed(2)}${suffix} (of ${max})`}>
      <span className="bar-track">
        <span className="bar-fill" style={{ width: `${pct * 100}%` }} />
      </span>
      <span>
        {value.toFixed(kind === 'workload' ? 0 : 1)}
        {suffix}
      </span>
    </span>
  )
}

export function Stat({ value, label, title }: { value: ReactNode; label: string; title?: string }) {
  return (
    <div className="stat" title={title}>
      <div className="v">{value}</div>
      <div className="k">{label}</div>
    </div>
  )
}

/** Foundational / administered-by / specialization badges for one course. */
export function CourseBadges({ course, specId }: { course: Course; specId: string }) {
  const role = course.gtSpecRoles[specId]
  return (
    <>
      {course.foundational && (
        <span className="badge found" title="Foundational course — counts toward the 2-course requirement">
          Found
        </span>
      )}
      {role === 'core' && (
        <span className="badge core" title="Specialization core course">
          Core
        </span>
      )}
      {role === 'elective' && (
        <span className="badge elec" title="Specialization elective">
          Elec
        </span>
      )}
      {course.administeredBy && (
        <span
          className="badge admin"
          title={`Administered by the OMS ${
            course.administeredBy === 'analytics' ? 'Analytics' : 'Cybersecurity'
          } program — register only for an O## section`}
        >
          {course.administeredBy === 'analytics' ? 'OMSA' : 'OMSCyb'}
        </span>
      )}
      {!course.isCsCse && (
        <span className="badge admin" title="Counts against the 6-hour non-CS/CSE cap">
          {course.subject}
        </span>
      )}
    </>
  )
}

export function Meter({ filled, total, gold = 0 }: { filled: number; total: number; gold?: number }) {
  return (
    <span className="meter" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < filled ? (i >= filled - gold ? 'on gold' : 'on') : ''} />
      ))}
    </span>
  )
}
