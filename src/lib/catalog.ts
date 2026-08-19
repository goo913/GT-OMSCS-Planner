import coursesData from '../data/courses.json'
import specsData from '../data/specializations.json'
import seminarsData from '../data/seminars.json'
import rulesData from '../data/rules.json'
import type { Course, Rules, Seminar, Season, Specialization, TermId } from '../types'
import { seasonOf } from './terms'

export const RULES = rulesData as unknown as Rules
export const COURSES = (coursesData.courses as unknown as Course[])
export const SPECIALIZATIONS = (specsData.specializations as unknown as Specialization[])
export const SEMINARS = (seminarsData.seminars as unknown as Seminar[])
export const DATA_VERSION = coursesData.version as string

export const COURSE_BY_CODE = new Map(COURSES.map((c) => [c.code, c]))
export const SEMINAR_BY_CODE = new Map(SEMINARS.map((s) => [s.code, s]))
export const SPEC_BY_ID = new Map(SPECIALIZATIONS.map((s) => [s.id, s]))

export const SEMINAR_PREFIX = RULES.seminars.code // "CS 8001"

export function isSeminarCode(code: string): boolean {
  return code.startsWith(SEMINAR_PREFIX)
}

/** Course or seminar, whichever the code refers to. */
export interface CatalogEntry {
  code: string
  title: string
  creditHours: number
  isSeminar: boolean
  course: Course | null
  seminar: Seminar | null
}

export function lookup(code: string): CatalogEntry | null {
  const course = COURSE_BY_CODE.get(code)
  if (course) {
    return { code, title: course.title, creditHours: course.creditHours, isSeminar: false, course, seminar: null }
  }
  const seminar = SEMINAR_BY_CODE.get(code)
  if (seminar) {
    return { code, title: seminar.title, creditHours: seminar.creditHours, isSeminar: true, course: null, seminar }
  }
  if (isSeminarCode(code)) {
    return { code, title: code, creditHours: RULES.seminars.creditHours, isSeminar: true, course: null, seminar: null }
  }
  return null
}

/** Firestore field names cannot contain spaces or dots. */
export function codeKey(code: string): string {
  return code.replace(/[ .]/g, '_')
}

export function keyToCode(key: string): string {
  return key.replace(/_/g, ' ')
}

/** Does the course's offering history include this season? `null` when unknown. */
export function offeredInSeason(course: Course, season: Season): boolean | null {
  const o = course.offerings
  if (!o.known) return null
  return season === 'FA' ? o.fall : season === 'SP' ? o.spring : o.summer
}

export function offeredInTerm(course: Course, term: TermId): boolean | null {
  return offeredInSeason(course, seasonOf(term))
}

/** "Fall · Spring · Summer" for the terms a course has historically run in. */
export function offeringSummary(course: Course): string {
  const o = course.offerings
  if (!o.known) return 'No offering history'
  const parts: string[] = []
  if (o.fall) parts.push('Fall')
  if (o.spring) parts.push('Spring')
  if (o.summer) parts.push('Summer')
  return parts.length ? parts.join(' · ') : 'Not recently offered'
}

/** Every specialization slot this course could fill, across all six specializations. */
export function specRolesFor(code: string): { spec: Specialization; group: import('../types').SpecGroup }[] {
  const out: { spec: Specialization; group: import('../types').SpecGroup }[] = []
  for (const spec of SPECIALIZATIONS) {
    for (const group of spec.groups) {
      if (group.courses.includes(code)) out.push({ spec, group })
    }
  }
  return out
}
