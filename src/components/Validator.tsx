import type { Validation } from '../lib/validate'
import type { Plan, TermId } from '../types'
import { RULES } from '../lib/catalog'
import { termLabel } from '../lib/terms'

const MARK: Record<string, string> = { ok: '✓', fail: '✕', warn: '!', pending: '·' }

export function Validator({
  validation,
  plan,
  onTarget,
}: {
  validation: Validation
  plan: Plan
  onTarget: (t: TermId | null) => void
}) {
  const hard = validation.checks.filter((c) => c.severity === 'hard')
  const soft = validation.checks.filter((c) => c.severity === 'soft')

  return (
    <section className="panel" aria-label="Graduation validator">
      <div className="verdict" data-status={validation.verdict.status}>
        <span className="verdict-flag" />
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">Can I graduate?</div>
          <h2>{validation.verdict.headline}</h2>
          <p className="muted" style={{ margin: '3px 0 0', fontSize: 12 }}>
            {validation.verdict.detail}
          </p>
        </div>
      </div>

      <Pacing validation={validation} plan={plan} onTarget={onTarget} />

      <ul className="checks">
        {hard.map((c) => (
          <CheckRow key={c.id} check={c} />
        ))}
      </ul>

      <div className="panel-head" style={{ borderTop: '1px solid var(--rule)' }}>
        <h2 style={{ fontSize: 13 }}>Advisories</h2>
        <span className="dim" style={{ fontSize: 11 }}>
          never blocking
        </span>
      </div>
      <ul className="checks">
        {soft.map((c) => (
          <CheckRow key={c.id} check={c} />
        ))}
      </ul>

      <div className="panel-body" style={{ borderTop: '1px solid var(--rule)' }}>
        <p className="dim" style={{ margin: 0, fontSize: 11, lineHeight: 1.5 }}>
          OMSCS enforces no course-to-course prerequisites — {RULES.prerequisites.text.toLowerCase()}{' '}
          Specializations are declared in DegreeWorks and{' '}
          {RULES.specializationDeclaration.blockedDuringActiveRegistration
            ? 'cannot be declared during an active registration period'
            : 'can be declared at any time'}
          . {RULES.specializationDeclaration.undeclaredBehaviour}
        </p>
      </div>
    </section>
  )
}

function CheckRow({ check }: { check: Validation['checks'][number] }) {
  return (
    <li className="check" data-status={check.status}>
      <span className="check-mark" aria-hidden>
        {MARK[check.status]}
      </span>
      <span className="check-label">{check.label}</span>
      <span className="check-count">
        {check.have !== undefined && check.need !== undefined
          ? `${check.have}/${check.need}${check.unit ? ` ${check.unit}` : ''}`
          : ''}
      </span>
      {check.detail && <span className="check-detail">{check.detail}</span>}
      <span className="sr-only">
        {check.status === 'ok'
          ? 'satisfied'
          : check.status === 'fail'
            ? 'not satisfied'
            : check.status === 'warn'
              ? 'advisory'
              : 'in progress'}
      </span>
    </li>
  )
}

/** Target date feasibility, earliest possible finish, and the zero-slack warning. */
function Pacing({
  validation,
  plan,
  onTarget,
}: {
  validation: Validation
  plan: Plan
  onTarget: (t: TermId | null) => void
}) {
  const { earliestCompletion, slackTerms, remainingCourses } = validation
  const options: TermId[] = []
  {
    // twelve terms of choices starting from the earliest possible finish
    const start = earliestCompletion ?? plan.matriculationTerm
    const idx = (id: TermId) => {
      const y = Number(id.slice(0, 4))
      const s = id.slice(4)
      return s === 'FA' ? y * 3 : (y - 1) * 3 + (s === 'SP' ? 1 : 2)
    }
    for (let i = idx(start); i < idx(start) + 13; i++) {
      const off = i % 3
      const base = Math.floor(i / 3)
      options.push(off === 0 ? `${base}FA` : `${base + 1}${off === 1 ? 'SP' : 'SU'}`)
    }
  }

  const infeasible = slackTerms !== null && slackTerms < 0
  const zeroSlack = slackTerms === 0 && remainingCourses > 0

  return (
    <div className="panel-body" style={{ borderBottom: '1px solid var(--rule)', paddingBottom: 10 }}>
      <div className="filter-row" style={{ marginBottom: 6 }}>
        <div className="field">
          <label htmlFor="target-term">Target</label>
          <select
            id="target-term"
            value={plan.targetGraduationTerm ?? ''}
            onChange={(e) => onTarget(e.target.value || null)}
          >
            <option value="">No target</option>
            {options.map((t) => (
              <option key={t} value={t}>
                {termLabel(t)}
              </option>
            ))}
          </select>
        </div>
        <span className="num dim" style={{ fontSize: 11 }}>
          earliest possible: {earliestCompletion ? termLabel(earliestCompletion) : '—'}
        </span>
      </div>

      {infeasible && (
        <div className="callout" style={{ borderColor: 'var(--bad)', background: 'var(--bad-soft)' }}>
          <b>Not reachable.</b> {remainingCourses} course{remainingCourses === 1 ? '' : 's'} remain and the
          per-term caps ({RULES.registration.maxDegreeCourses.FA} in Fall/Spring,{' '}
          {RULES.registration.maxDegreeCourses.SU} in Summer) put the earliest finish at{' '}
          {termLabel(earliestCompletion!)}.
        </div>
      )}

      {zeroSlack && (
        <div className="callout gold">
          <b>Zero slack.</b> Every remaining term runs at the cap, so one dropped or failed course
          pushes graduation back a full term. There is no spare semester in this plan.
        </div>
      )}

      {!infeasible && !zeroSlack && slackTerms !== null && slackTerms > 0 && (
        <div className="callout">
          <b>
            {slackTerms} spare term{slackTerms === 1 ? '' : 's'}.
          </b>{' '}
          You can drop below the cap {slackTerms} time{slackTerms === 1 ? '' : 's'} and still finish by{' '}
          {termLabel(plan.targetGraduationTerm!)}.
        </div>
      )}
    </div>
  )
}
