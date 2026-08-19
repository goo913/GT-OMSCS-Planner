import type { TermId } from '../types'
import type { Validation } from '../lib/validate'
import { RULES, lookup } from '../lib/catalog'
import { termLabel, termShortLabel } from '../lib/terms'

/**
 * Tap-to-assign. Drag and drop is unusable one-handed on a phone, so this is the
 * first-class path on small screens: tap a course, the bar appears, tap a term.
 * It is also available on desktop — the "Place" button in the library selects,
 * and every term column grows a "Put X here" target.
 */
export function AssignBar({
  code,
  terms,
  validation,
  onPlace,
  onCancel,
  onOpen,
}: {
  code: string
  terms: TermId[]
  validation: Validation
  onPlace: (code: string, term: TermId) => void
  onCancel: () => void
  onOpen: (code: string) => void
}) {
  const entry = lookup(code)
  return (
    <div className="assignbar only-mobile" role="region" aria-label="Choose a term">
      <div className="assignbar-head">
        <div style={{ minWidth: 0, flex: 1 }}>
          <button
            className="course-code"
            style={{ background: 'none', border: 0, padding: 0 }}
            onClick={() => onOpen(code)}
          >
            {code}
          </button>
          <div className="course-title">{entry?.title ?? ''}</div>
        </div>
        <button className="btn sm ghost" onClick={onCancel} aria-label="Cancel">
          Cancel
        </button>
      </div>
      <div className="assignbar-terms">
        {terms.map((t) => {
          const summary = validation.terms.find((x) => x.term === t)
          const cap = RULES.registration.maxCreditHours[t.slice(4) as 'FA' | 'SP' | 'SU']
          const hours = summary?.creditHours ?? 0
          const full = hours + (entry?.creditHours ?? 3) > cap
          return (
            <button
              key={t}
              data-full={full}
              onClick={() => onPlace(code, t)}
              title={
                full
                  ? `${termLabel(t)} would exceed the ${cap}-hour cap — allowed, but flagged`
                  : `Place in ${termLabel(t)}`
              }
            >
              {termShortLabel(t)}
              <span className="dim num" style={{ marginLeft: 5, fontSize: 10.5 }}>
                {hours}/{cap}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
