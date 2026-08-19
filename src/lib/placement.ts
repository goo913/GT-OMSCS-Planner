/**
 * The one rule the app enforces rather than reports.
 *
 * Everything else in the validator produces a verdict and lets you carry on — you can
 * put a course in a term it has never run in, or plan a GPA that will not graduate.
 * The per-term registration cap is different: Banner will simply refuse the
 * registration, so a plan that exceeds it is not a plan, it is a mistake. It is
 * blocked at the drop with a reason and a way out.
 *
 * Both halves of the rule have to hold (OMSCS_RULES.md §2):
 *   - credit hours: Fall/Spring ≤ 7, Summer ≤ 5
 *   - degree courses: Fall/Spring ≤ 2, Summer ≤ 1
 * Seminars consume hours but not course slots, which is why the two limits differ.
 */
import type { Plan, TermId } from '../types'
import { RULES, isSeminarCode, lookup } from './catalog'
import { placementsInTerm } from './plan'
import { seasonOf, termLabel } from './terms'

export interface CapCheck {
  ok: boolean
  /** Why the placement was refused, phrased for a tooltip or an inline message. */
  reason: string | null
  /** Which limit was hit, so the UI can say "2 courses" vs "7 hours". */
  limit: 'hours' | 'courses' | null
  /** Codes already in the term that could be swapped out to make room. */
  swappable: string[]
  hoursAfter: number
  maxHours: number
  coursesAfter: number
  maxCourses: number
}

/** Would placing `code` into `term` fit? `movingFrom` is the term it is leaving, if any. */
export function checkCap(plan: Plan, code: string, term: TermId): CapCheck {
  const season = seasonOf(term)
  const maxHours = RULES.registration.maxCreditHours[season]
  const maxCourses = RULES.registration.maxDegreeCourses[season]
  const entry = lookup(code)
  const incomingHours = entry?.creditHours ?? 3
  const incomingIsSeminar = isSeminarCode(code)

  // Moving a course within a term, or re-placing it where it already is, is a no-op.
  const existing = placementsInTerm(plan, term).filter((p) => p.code !== code)
  const hoursNow = existing.reduce((n, p) => n + (lookup(p.code)?.creditHours ?? 3), 0)
  const coursesNow = existing.filter((p) => !isSeminarCode(p.code)).length

  const hoursAfter = hoursNow + incomingHours
  const coursesAfter = coursesNow + (incomingIsSeminar ? 0 : 1)

  const swappable = existing
    .filter((p) => (incomingIsSeminar ? isSeminarCode(p.code) : !isSeminarCode(p.code)))
    .map((p) => p.code)

  if (coursesAfter > maxCourses) {
    return {
      ok: false,
      limit: 'courses',
      reason:
        `${termLabel(term)} already holds ${coursesNow} ${coursesNow === 1 ? 'course' : 'courses'}. ` +
        `${season === 'SU' ? 'Summer' : 'Fall and Spring'} allow ${maxCourses}.`,
      swappable,
      hoursAfter,
      maxHours,
      coursesAfter,
      maxCourses,
    }
  }

  if (hoursAfter > maxHours) {
    return {
      ok: false,
      limit: 'hours',
      reason:
        `${termLabel(term)} is at ${hoursNow} of ${maxHours} credit hours. ` +
        `Adding ${entry?.title ?? code} would make it ${hoursAfter}.`,
      swappable,
      hoursAfter,
      maxHours,
      coursesAfter,
      maxCourses,
    }
  }

  return { ok: true, limit: null, reason: null, swappable, hoursAfter, maxHours, coursesAfter, maxCourses }
}

/** Terms this course could go into, for the mobile term picker and the detail dialog. */
export function openTerms(plan: Plan, code: string, terms: TermId[]): Set<TermId> {
  return new Set(terms.filter((t) => checkCap(plan, code, t).ok))
}
