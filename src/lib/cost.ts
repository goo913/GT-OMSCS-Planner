/**
 * Cost estimator.
 *
 * Rates come from src/data/tuition.json, parsed from the official Georgia Tech Bursar
 * rate sheets. Terms GT has not published yet carry forward the most recent sheet FOR
 * THE SAME SEASON — Summer runs a lower Online Learning Fee than Fall and Spring, so a
 * blanket carry-forward would be wrong.
 */
import tuitionData from '../data/tuition.json'
import type { Season, TermId, TermRates } from '../types'
import { RULES } from './catalog'
import { seasonOf, termLabel } from './terms'

const TUITION = tuitionData as unknown as {
  version: string
  terms: Record<TermId, TermRates>
  carryForward: Record<Season, TermId>
  notes: string[]
  sourceUrl: string
}

export const TUITION_NOTES = TUITION.notes
export const TUITION_SOURCE_URL = TUITION.sourceUrl
export const PUBLISHED_TERMS = Object.keys(TUITION.terms).sort()

export interface TermRateLookup extends TermRates {
  /** true when the figures were carried forward from an earlier published term. */
  carriedForward: boolean
  basedOn: TermId
}

export function ratesFor(term: TermId): TermRateLookup {
  const exact = TUITION.terms[term]
  if (exact) return { ...exact, carriedForward: false, basedOn: term }
  const basedOn = TUITION.carryForward[seasonOf(term)]
  return { ...TUITION.terms[basedOn], estimated: true, carriedForward: true, basedOn }
}

export interface TermCost {
  term: TermId
  creditHours: number
  tuition: number
  onlineLearningFee: number
  total: number
  estimated: boolean
  basedOn: TermId
  perCreditHour: number
  loanEligible: boolean
}

export function costForTerm(term: TermId, creditHours: number): TermCost {
  const r = ratesFor(term)
  const tuition = creditHours * r.perCreditHour
  const fee =
    creditHours === 0
      ? 0
      : creditHours >= 4
        ? r.onlineLearningFee.atLeast4Hours
        : r.onlineLearningFee.under4Hours
  return {
    term,
    creditHours,
    tuition,
    onlineLearningFee: fee,
    total: tuition + fee,
    estimated: r.estimated || r.carriedForward,
    basedOn: r.basedOn,
    perCreditHour: r.perCreditHour,
    loanEligible: creditHours >= RULES.financialAid.halfTimeCreditHours,
  }
}

/**
 * The fee cliff: the Online Learning Fee jumps at 4 hours, so the second course in a
 * term costs materially more than the first one did on its own.
 */
export function feeCliff(term: TermId): {
  oneCourse: number
  twoCourses: number
  marginal: number
  tuitionPart: number
  feePart: number
} {
  const one = costForTerm(term, 3)
  const two = costForTerm(term, 6)
  return {
    oneCourse: one.total,
    twoCourses: two.total,
    marginal: two.total - one.total,
    tuitionPart: two.tuition - one.tuition,
    feePart: two.onlineLearningFee - one.onlineLearningFee,
  }
}

export function money(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function rateSummary(term: TermId): string {
  const r = ratesFor(term)
  return r.carriedForward
    ? `estimated from ${termLabel(r.basedOn)} rates`
    : `published ${termLabel(term)} rates`
}
