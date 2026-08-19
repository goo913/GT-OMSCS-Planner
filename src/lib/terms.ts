import type { Season, TermId } from '../types'

export const SEASONS: Season[] = ['FA', 'SP', 'SU']

export const SEASON_NAME: Record<Season, string> = {
  FA: 'Fall',
  SP: 'Spring',
  SU: 'Summer',
}

/** Short form for tight columns. */
export const SEASON_ABBR: Record<Season, string> = { FA: 'Fall', SP: 'Spr', SU: 'Sum' }

export function parseTerm(id: TermId): { year: number; season: Season } {
  return { year: Number(id.slice(0, 4)), season: id.slice(4) as Season }
}

export function makeTerm(year: number, season: Season): TermId {
  return `${year}${season}`
}

/**
 * Monotonic ordering across the academic year: Fall Y < Spring Y+1 < Summer Y+1 < Fall Y+1.
 * Fall belongs to the academic year it opens; Spring and Summer close the year before.
 */
export function termIndex(id: TermId): number {
  const { year, season } = parseTerm(id)
  return season === 'FA' ? year * 3 : (year - 1) * 3 + (season === 'SP' ? 1 : 2)
}

export function termFromIndex(index: number): TermId {
  const offset = index % 3
  const base = Math.floor(index / 3)
  if (offset === 0) return makeTerm(base, 'FA')
  return makeTerm(base + 1, offset === 1 ? 'SP' : 'SU')
}

export function nextTerm(id: TermId): TermId {
  return termFromIndex(termIndex(id) + 1)
}

export function termLabel(id: TermId): string {
  const { year, season } = parseTerm(id)
  return `${SEASON_NAME[season]} ${year}`
}

export function termShortLabel(id: TermId): string {
  const { year, season } = parseTerm(id)
  return `${SEASON_ABBR[season]} ${String(year).slice(2)}`
}

export function seasonOf(id: TermId): Season {
  return parseTerm(id).season
}

/** Inclusive range of term ids. */
export function termRange(from: TermId, to: TermId): TermId[] {
  const out: TermId[] = []
  for (let i = termIndex(from); i <= termIndex(to); i++) out.push(termFromIndex(i))
  return out
}

/** The last term still inside the Institute's time limit. */
export function timeLimitTerm(matriculation: TermId, years: number): TermId {
  const { year, season } = parseTerm(matriculation)
  // Fall 2026 + 6 years => end of Summer 2032, per the Fall 2026 Orientation Document.
  if (season === 'FA') return makeTerm(year + years, 'SU')
  if (season === 'SP') return makeTerm(year + years - 1, 'SP')
  return makeTerm(year + years - 1, 'SU')
}

/** Terms within the first `count` terms of matriculating, inclusive. */
export function firstTerms(matriculation: TermId, count: number): TermId[] {
  return termRange(matriculation, termFromIndex(termIndex(matriculation) + count - 1))
}

export function compareTerms(a: TermId, b: TermId): number {
  return termIndex(a) - termIndex(b)
}
