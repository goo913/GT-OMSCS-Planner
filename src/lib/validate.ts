/**
 * The graduation validator.
 *
 * Every threshold here is read from src/data/rules.json and src/data/specializations.json —
 * nothing is hard-coded. Editing OMSCS_RULES.md means editing those data files; see the
 * README section "Editing the rules".
 *
 * Placement is never blocked. Rules produce a verdict; the UI shows over-limit terms in red
 * and still lets the course sit there.
 */
import type { Course, Grade, Placement, Plan, Season, Specialization, TermId } from '../types'
import { COURSE_BY_CODE, RULES, SPEC_BY_ID, isSeminarCode, lookup } from './catalog'
import { compareTerms, firstTerms, seasonOf, termFromIndex, termIndex, termLabel, timeLimitTerm } from './terms'

export type CheckStatus = 'ok' | 'pending' | 'warn' | 'fail'

export interface Check {
  id: string
  label: string
  status: CheckStatus
  detail: string
  /** Optional progress readout, rendered as "have / need". */
  have?: number
  need?: number
  unit?: string
  /** Hard rules block graduation; soft rules are advisory. */
  severity: 'hard' | 'soft'
  /** Codes or terms the check is complaining about, for highlighting. */
  offenders?: string[]
}

export interface Slot {
  id: string
  groupId: string
  section: 'core' | 'elective'
  /** Group label, e.g. "Algorithms and Design". */
  group: string
  /** Sub-area restriction, when the page requires at least one from it. */
  restriction: string | null
  eligible: string[]
  filledBy: string | null
}

export interface TermSummary {
  term: TermId
  season: Season
  codes: string[]
  degreeCourses: string[]
  seminars: string[]
  creditHours: number
  maxCreditHours: number
  overCap: boolean
  workloadHoursPerWeek: number
  workloadKnown: boolean
  loanEligible: boolean
}

export interface Validation {
  /** Mirrors plan.settings.trackGrades; the view uses it to hide grade controls. */
  trackGrades: boolean
  checks: Check[]
  slots: Slot[]
  /** Placed degree courses that fill no specialization slot. */
  freeElectives: string[]
  freeElectivesNeeded: number
  spec: Specialization
  terms: TermSummary[]
  countedCourses: number
  countedCreditHours: number
  gpa: number | null
  gradedCourses: number
  qualityPoints: number
  /** The term the foundational requirement is satisfied in, if it is. */
  foundationalMetTerm: TermId | null
  foundationalWindow: TermId[]
  lastTerm: TermId | null
  timeLimit: TermId
  hardFailures: number
  softWarnings: number
  verdict: { status: CheckStatus; headline: string; detail: string }
  earliestCompletion: TermId | null
  remainingCourses: number
  slackTerms: number | null
}

const GRADE_POINTS = RULES.gradePoints

export function gradeRank(g: Grade | null): number | null {
  if (!g) return null
  const p = GRADE_POINTS[g]
  return p === undefined ? null : p
}

/** A grade good enough to count toward the 30 hours (C or better), or not yet graded. */
export function countsTowardDegree(g: Grade | null): boolean {
  const r = gradeRank(g)
  if (g === null) return true
  if (r === null) return false // W and other non-GPA marks earn no credit
  return r >= GRADE_POINTS[RULES.degree.minGradeCountsTowardDegree]
}

/** A grade good enough for a specialization slot (B or better), or not yet graded. */
export function countsTowardSpecialization(g: Grade | null): boolean {
  const r = gradeRank(g)
  if (g === null) return true
  if (r === null) return false
  return r >= GRADE_POINTS[RULES.degree.minGradeSpecialization]
}

/* ── specialization slot matching ─────────────────────────────────── */

function buildSlots(spec: Specialization): Slot[] {
  const coreCourses = new Set<string>()
  for (const g of spec.groups) if (g.section === 'core') g.courses.forEach((c) => coreCourses.add(c))

  const slots: Slot[] = []
  for (const group of spec.groups) {
    // Core courses beyond what the core groups need may fill specialization
    // electives — but only for AI and Computing Systems, whose pages say so.
    // Everywhere else the extra course falls to a FREE elective instead.
    const pool = new Set(group.courses)
    if (group.section === 'elective' && spec.excessCoreCountsAsSpecElective) {
      coreCourses.forEach((c) => pool.add(c))
    }

    const mins = (group.subgroups ?? []).filter((s) => s.min > 0)
    let remaining = group.need
    for (const sub of mins) {
      for (let i = 0; i < sub.min; i++) {
        slots.push({
          id: `${group.id}:${sub.id}:${i}`,
          groupId: group.id,
          section: group.section,
          group: group.label,
          restriction: sub.label,
          eligible: sub.courses.slice(),
          filledBy: null,
        })
        remaining--
      }
    }
    for (let i = 0; i < remaining; i++) {
      slots.push({
        id: `${group.id}:${i}`,
        groupId: group.id,
        section: group.section,
        group: group.label,
        restriction: null,
        eligible: [...pool],
        filledBy: null,
      })
    }
  }
  return slots
}

/**
 * Maximum-cardinality bipartite matching (Kuhn's algorithm) between placed courses
 * and specialization slots. Slots are visited in declaration order — core before
 * elective, sub-area-restricted before open — so that among equally-sized optimal
 * matchings the one shown is stable across renders.
 */
function matchSlots(slots: Slot[], courses: string[]): void {
  const takenBy = new Map<string, string>() // code -> slotId
  const slotOf = new Map<string, string>() // slotId -> code

  const tryAssign = (slot: Slot, seen: Set<string>): boolean => {
    for (const code of courses) {
      if (!slot.eligible.includes(code) || seen.has(code)) continue
      seen.add(code)
      const holder = takenBy.get(code)
      if (holder === undefined) {
        takenBy.set(code, slot.id)
        slotOf.set(slot.id, code)
        return true
      }
      const other = slots.find((s) => s.id === holder)!
      if (tryAssign(other, seen)) {
        takenBy.set(code, slot.id)
        slotOf.set(slot.id, code)
        return true
      }
    }
    return false
  }

  // Restricted slots first: they have the fewest candidates and would otherwise
  // lose their only eligible course to an open slot.
  const order = [...slots].sort((a, b) => a.eligible.length - b.eligible.length)
  for (const slot of order) tryAssign(slot, new Set())
  for (const slot of slots) slot.filledBy = slotOf.get(slot.id) ?? null
}

export function assignSpecialization(
  spec: Specialization,
  placements: Placement[],
): { slots: Slot[]; freeElectives: string[] } {
  const slots = buildSlots(spec)
  const eligible = placements
    .filter((p) => !isSeminarCode(p.code) && countsTowardSpecialization(p.grade))
    .sort((a, b) => compareTerms(a.term, b.term) || a.code.localeCompare(b.code))
    .map((p) => p.code)
  matchSlots(slots, eligible)
  const used = new Set(slots.map((s) => s.filledBy).filter(Boolean) as string[])
  const freeElectives = placements
    .filter((p) => !isSeminarCode(p.code) && !used.has(p.code))
    .sort((a, b) => compareTerms(a.term, b.term) || a.code.localeCompare(b.code))
    .map((p) => p.code)
  return { slots, freeElectives }
}

/* ── recommended background ───────────────────────────────────────── */

/**
 * OMSCS enforces no prerequisites (Fall 2026 Orientation Document, Course/Program
 * Planning FAQ #6). These topics are pulled out of the course page's own
 * "Suggested Background Knowledge" prose purely so the advisory reads at a glance.
 * They are never used to block or order a placement.
 */
const BACKGROUND_TOPICS: [string, RegExp][] = [
  ['Python', /\bpython\b/i],
  ['Java', /\bjava\b(?!script)/i],
  ['C / C++', /\bC\+\+|\bC programming|\bthe C language|\bin C\b/i],
  ['linear algebra', /linear algebra|\bmatri(x|ces)\b/i],
  ['probability & statistics', /probabilit|statistic/i],
  ['calculus', /calculus|derivativ/i],
  ['algorithms', /algorithm/i],
  ['data structures', /data structure/i],
  ['operating systems', /operating system/i],
  ['computer architecture', /computer architecture|microarchitect/i],
  ['networking', /\bnetworking\b|computer network/i],
  ['databases', /\bdatabase|\bSQL\b/i],
  ['discrete math', /discrete math|combinatoric|graph theory/i],
  ['machine learning', /machine learning/i],
  ['Unix / Linux', /\bunix\b|\blinux\b|command line/i],
  ['software engineering', /software engineering|object-oriented/i],
]

export function backgroundTopics(course: Course): string[] {
  if (!course.background) return []
  return BACKGROUND_TOPICS.filter(([, re]) => re.test(course.background!)).map(([name]) => name)
}

/* ── the validator ────────────────────────────────────────────────── */

function pct(have: number, need: number): number {
  return need === 0 ? 1 : Math.min(1, have / need)
}

export function validate(plan: Plan): Validation {
  const spec = SPEC_BY_ID.get(plan.specialization) ?? SPEC_BY_ID.values().next().value!
  // With grade tracking off the app plans courses, not outcomes: grade-dependent
  // requirements drop out of the checklist rather than sitting there permanently
  // "pending" on data the user has chosen not to enter.
  const trackGrades = plan.settings?.trackGrades ?? false
  const placements = Object.values(plan.placements).filter((p) => p && p.code && p.term)
  const degreePlacements = placements.filter((p) => !isSeminarCode(p.code))

  const { slots, freeElectives } = assignSpecialization(spec, degreePlacements)
  const slotOfCourse = new Map<string, Slot>()
  for (const s of slots) if (s.filledBy) slotOfCourse.set(s.filledBy, s)

  /* per-term rollup */
  const termIds = [...new Set(placements.map((p) => p.term))].sort(compareTerms)
  const terms: TermSummary[] = termIds.map((term) => {
    const inTerm = placements.filter((p) => p.term === term)
    const season = seasonOf(term)
    const creditHours = inTerm.reduce((n, p) => n + (lookup(p.code)?.creditHours ?? 3), 0)
    const workloads = inTerm
      .map((p) => COURSE_BY_CODE.get(p.code)?.omscentral?.workload)
      .filter((w): w is number => typeof w === 'number')
    return {
      term,
      season,
      codes: inTerm.map((p) => p.code),
      degreeCourses: inTerm.filter((p) => !isSeminarCode(p.code)).map((p) => p.code),
      seminars: inTerm.filter((p) => isSeminarCode(p.code)).map((p) => p.code),
      creditHours,
      maxCreditHours: RULES.registration.maxCreditHours[season],
      overCap: creditHours > RULES.registration.maxCreditHours[season],
      workloadHoursPerWeek: workloads.reduce((a, b) => a + b, 0),
      workloadKnown: workloads.length === inTerm.filter((p) => !isSeminarCode(p.code)).length,
      loanEligible: creditHours >= RULES.financialAid.halfTimeCreditHours,
    }
  })

  /* GPA */
  let qualityPoints = 0
  let gradedHours = 0
  let gradedCourses = 0
  for (const p of degreePlacements) {
    const r = gradeRank(p.grade)
    if (r === null) continue
    const hours = lookup(p.code)?.creditHours ?? 3
    qualityPoints += r * hours
    gradedHours += hours
    gradedCourses++
  }
  const gpa = gradedHours > 0 ? qualityPoints / gradedHours : null

  /* counted credit */
  const counted = degreePlacements.filter((p) => countsTowardDegree(p.grade))
  const countedCreditHours = counted.reduce((n, p) => n + (lookup(p.code)?.creditHours ?? 3), 0)

  /* foundational */
  const window = firstTerms(plan.matriculationTerm, RULES.foundational.windowTerms)
  const windowSet = new Set(window)
  const foundationalInWindow = degreePlacements
    .filter((p) => COURSE_BY_CODE.get(p.code)?.foundational && windowSet.has(p.term))
    .filter((p) => countsTowardSpecialization(p.grade)) // B or better, or ungraded
    .sort((a, b) => compareTerms(a.term, b.term))
  const foundationalMetTerm =
    foundationalInWindow.length >= RULES.foundational.coursesRequired
      ? foundationalInWindow[RULES.foundational.coursesRequired - 1].term
      : null

  const checks: Check[] = []

  /* 1. total hours */
  checks.push({
    id: 'credit-hours',
    label: `${RULES.degree.totalCreditHours} credit hours`,
    status: countedCreditHours >= RULES.degree.totalCreditHours ? 'ok' : 'pending',
    have: countedCreditHours,
    need: RULES.degree.totalCreditHours,
    unit: 'hrs',
    severity: 'hard',
    detail:
      countedCreditHours >= RULES.degree.totalCreditHours
        ? `${counted.length} courses placed.`
        : `${RULES.degree.totalCourses - counted.length} more course${
            RULES.degree.totalCourses - counted.length === 1 ? '' : 's'
          } to place.`,
  })

  /* 2. specialization, one check per group */
  for (const group of spec.groups) {
    const groupSlots = slots.filter((s) => s.groupId === group.id)
    const filled = groupSlots.filter((s) => s.filledBy).length
    checks.push({
      id: `spec-${group.id}`,
      label: group.label,
      status: filled >= groupSlots.length ? 'ok' : 'pending',
      have: filled,
      need: groupSlots.length,
      unit: 'courses',
      severity: 'hard',
      detail: groupSlots
        .map((s) => s.filledBy ?? `— ${s.restriction ? `${s.restriction} ` : ''}open`)
        .join(', '),
      offenders: [],
    })
  }

  /* 3. free electives */
  const freeNeeded = spec.freeElectiveCourses
  checks.push({
    id: 'free-electives',
    label: 'Free electives',
    status: freeElectives.length >= freeNeeded ? 'ok' : 'pending',
    have: Math.min(freeElectives.length, freeNeeded),
    need: freeNeeded,
    unit: 'courses',
    severity: 'hard',
    detail:
      freeElectives.length > freeNeeded
        ? `${freeElectives.length} courses fall outside the specialization — ${
            freeElectives.length - freeNeeded
          } beyond what the degree needs.`
        : freeElectives.join(', ') || 'Any OMSCS course not already used by the specialization.',
  })

  /* 4. foundational.
        This only fails once it is genuinely unreachable — when the course slots still
        free inside the window cannot get you to two qualifying foundational courses.
        An empty plan is "pending", not "broken". */
  const foundationalConfirmed = trackGrades
    ? foundationalInWindow.filter((p) => p.grade !== null).length
    : foundationalInWindow.length
  const foundationalNeed = RULES.foundational.coursesRequired
  const windowCapacity = window.reduce(
    (n, t) => n + RULES.registration.maxDegreeCourses[seasonOf(t)],
    0,
  )
  const windowPlaced = degreePlacements.filter((p) => windowSet.has(p.term)).length
  const windowRoom = Math.max(0, windowCapacity - windowPlaced)
  const foundationalReachable = foundationalInWindow.length + windowRoom >= foundationalNeed
  checks.push({
    id: 'foundational',
    label: trackGrades
      ? `${foundationalNeed} foundational courses, grade ${RULES.foundational.minGrade}+`
      : `${foundationalNeed} foundational courses planned`,
    status:
      foundationalConfirmed >= foundationalNeed
        ? 'ok'
        : foundationalReachable
          ? 'pending'
          : 'fail',
    have: Math.min(foundationalInWindow.length, foundationalNeed),
    need: foundationalNeed,
    unit: 'courses',
    severity: 'hard',
    detail:
      foundationalInWindow.length >= foundationalNeed
        ? `${foundationalInWindow
            .slice(0, foundationalNeed)
            .map((p) => p.code)
            .join(' + ')} by ${termLabel(foundationalMetTerm!)}.${
            trackGrades
              ? foundationalConfirmed >= foundationalNeed
                ? ''
                : ' Grades not entered yet.'
              : ` Each still needs a ${RULES.foundational.minGrade} or better to count.`
          }`
        : foundationalReachable
          ? `${foundationalInWindow.length} of ${foundationalNeed} placed in ${termLabel(
              window[0],
            )}–${termLabel(window[window.length - 1])}; ${windowRoom} course slot${
              windowRoom === 1 ? '' : 's'
            } still free in that window.`
          : `Unreachable: ${termLabel(window[0])}–${termLabel(
              window[window.length - 1],
            )} is full and only ${foundationalInWindow.length} of those course${
              foundationalInWindow.length === 1 ? '' : 's'
            } counts. Missing the window means continuing to enrol in foundational courses until it is met.`,
    offenders: window,
  })

  /* 5. the registration lock that follows from the foundational requirement */
  const lockViolations = degreePlacements.filter((p) => {
    const c = COURSE_BY_CODE.get(p.code)
    if (!c || c.foundational) return false
    // Nothing to flag before the window has even started being planned.
    if (!foundationalMetTerm) return true
    return termIndex(p.term) <= termIndex(foundationalMetTerm)
  })
  checks.push({
    id: 'foundational-lock',
    label: 'Registration unlocked for non-foundational courses',
    status: lockViolations.length ? 'fail' : 'ok',
    severity: 'hard',
    offenders: lockViolations.map((p) => p.code),
    detail: lockViolations.length
      ? `${lockViolations
          .map((p) => `${p.code} (${termLabel(p.term)})`)
          .join(', ')} — Banner returns COHORT RESTRICTION until the foundational requirement is complete ` +
        `and grades have posted. The lock lifts the term after it is satisfied.`
      : foundationalMetTerm
        ? `Non-foundational courses open from ${termLabel(
            terms.find((t) => termIndex(t.term) > termIndex(foundationalMetTerm))?.term ??
              foundationalMetTerm,
          )} onward.`
        : 'No non-foundational courses placed yet.',
  })

  /* 6. non-CS/CSE cap */
  const nonCsCse = counted.filter((p) => COURSE_BY_CODE.get(p.code)?.isCsCse === false)
  const nonCsCseHours = nonCsCse.reduce((n, p) => n + (lookup(p.code)?.creditHours ?? 3), 0)
  checks.push({
    id: 'non-cs-cse',
    label: `Non-CS/CSE hours ≤ ${RULES.degree.maxNonCsCseCreditHours}`,
    status: nonCsCseHours > RULES.degree.maxNonCsCseCreditHours ? 'fail' : 'ok',
    have: nonCsCseHours,
    need: RULES.degree.maxNonCsCseCreditHours,
    unit: 'hrs',
    severity: 'hard',
    offenders: nonCsCse.map((p) => p.code),
    detail: nonCsCse.length
      ? `${nonCsCse.map((p) => p.code).join(', ')} — ${nonCsCseHours} of ${
          RULES.degree.maxNonCsCseCreditHours
        } allowed hours used.`
      : RULES.degree.nonCsCseRuleText,
  })

  /* 7. the mirror rule DegreeWorks shows */
  const csCseHours = countedCreditHours - nonCsCseHours
  checks.push({
    id: 'cs-cse-24',
    label: `CS/CSE 6000+ hours ≥ ${RULES.degree.minCsCse6000PlusCreditHours}`,
    status: csCseHours >= RULES.degree.minCsCse6000PlusCreditHours ? 'ok' : 'pending',
    have: csCseHours,
    need: RULES.degree.minCsCse6000PlusCreditHours,
    unit: 'hrs',
    severity: 'hard',
    detail: 'The mirror of the non-CS/CSE cap; this is the line DegreeWorks audits.',
  })

  /* 8. GPA — only a requirement you can check if you are recording grades. */
  if (trackGrades)
    checks.push({
    id: 'gpa',
    label: `Cumulative GPA ≥ ${RULES.degree.minGpaToGraduate.toFixed(1)}`,
    status: gpa === null ? 'pending' : gpa >= RULES.degree.minGpaToGraduate ? 'ok' : 'fail',
    severity: 'hard',
    detail:
      gpa === null
        ? 'No grades entered yet.'
        : `${gpa.toFixed(2)} across ${gradedCourses} graded course${gradedCourses === 1 ? '' : 's'}` +
          (gpa < RULES.degree.minGpaGoodStanding
            ? ` — below the ${RULES.degree.minGpaGoodStanding.toFixed(1)} needed for good academic standing.`
            : '.'),
  })

  /* 9. grades too low for the requirement the course was meant to satisfy.
        A course graded below B is silently demoted out of the specialization, so
        this names it rather than letting it vanish into the free electives. */
  const specCourses = new Set(spec.groups.flatMap((g) => g.courses))
  const specBelowB = degreePlacements.filter(
    (p) => specCourses.has(p.code) && p.grade !== null && !countsTowardSpecialization(p.grade),
  )
  const belowC = degreePlacements.filter((p) => p.grade !== null && !countsTowardDegree(p.grade))
  if (trackGrades)
    checks.push({
    id: 'min-grades',
    label: `Minimum grades (${RULES.degree.minGradeSpecialization} specialization, ${RULES.degree.minGradeCountsTowardDegree} elective)`,
    status: specBelowB.length || belowC.length ? 'fail' : 'ok',
    severity: 'hard',
    offenders: [...specBelowB, ...belowC].map((p) => p.code),
    detail:
      specBelowB.length || belowC.length
        ? [
            specBelowB.length
              ? `${specBelowB.map((p) => `${p.code} (${p.grade})`).join(', ')} below ${
                  RULES.degree.minGradeSpecialization
                } — cannot hold a ${spec.short} slot; ${
                  specBelowB.length === 1 ? 'it falls' : 'they fall'
                } to a free elective.`
              : '',
            belowC.length
              ? `${belowC.map((p) => `${p.code} (${p.grade})`).join(', ')} below ${
                  RULES.degree.minGradeCountsTowardDegree
                } — earns no credit toward the ${RULES.degree.totalCreditHours} hours.`
              : '',
          ]
            .filter(Boolean)
            .join(' ')
        : 'Every entered grade is high enough for the requirement it fills.',
  })
  else
    checks.push({
      id: 'min-grades',
      label: 'Minimum grades',
      status: 'ok',
      severity: 'soft',
      detail:
        `Specialization courses need a ${RULES.degree.minGradeSpecialization}; free electives need a ` +
        `${RULES.degree.minGradeCountsTowardDegree}. Turn on grade tracking in settings to check this ` +
        `against real grades and to see a projected GPA.`,
    })

  /* 10. per-term registration cap */
  const overCap = terms.filter((t) => t.overCap)
  checks.push({
    id: 'term-cap',
    label: 'Per-term registration cap',
    status: overCap.length ? 'fail' : 'ok',
    severity: 'hard',
    offenders: overCap.map((t) => t.term),
    detail: overCap.length
      ? overCap
          .map((t) => `${termLabel(t.term)}: ${t.creditHours} hrs over the ${t.maxCreditHours}-hour cap`)
          .join('; ')
      : `Fall and Spring allow ${RULES.registration.maxCreditHours.FA} hours (2 courses + a seminar); ` +
        `Summer allows ${RULES.registration.maxCreditHours.SU} (1 course + up to 2 seminars).`,
  })

  /* 11. six-year time limit */
  const limit = timeLimitTerm(plan.matriculationTerm, RULES.degree.timeLimitYears)
  const lastTerm = termIds.length ? termIds[termIds.length - 1] : null
  const beyond = termIds.filter((t) => termIndex(t) > termIndex(limit))
  checks.push({
    id: 'time-limit',
    label: `${RULES.degree.timeLimitYears}-year time limit`,
    status: beyond.length ? 'fail' : 'ok',
    severity: 'hard',
    offenders: beyond,
    detail: beyond.length
      ? `${beyond.map(termLabel).join(', ')} fall past ${termLabel(limit)}.`
      : `Matriculated ${termLabel(plan.matriculationTerm)}; everything must be finished by ${termLabel(limit)}.`,
  })

  /* ── soft advisories ─────────────────────────────────────────── */

  const offSeason = degreePlacements.filter((p) => {
    const c = COURSE_BY_CODE.get(p.code)
    if (!c || !c.offerings.known) return false
    const s = seasonOf(p.term)
    return !(s === 'FA' ? c.offerings.fall : s === 'SP' ? c.offerings.spring : c.offerings.summer)
  })
  checks.push({
    id: 'offering-season',
    label: 'Term availability',
    status: offSeason.length ? 'warn' : 'ok',
    severity: 'soft',
    offenders: offSeason.map((p) => p.code),
    detail: offSeason.length
      ? offSeason
          .map((p) => `${p.code} has never run in a ${seasonOf(p.term) === 'SU' ? 'Summer' : seasonOf(p.term) === 'FA' ? 'Fall' : 'Spring'} term`)
          .join('; ') + '. Offerings are not final until shortly before Phase I registration.'
      : 'Every placed course has historically run in the term you put it in.',
  })

  const heavy = terms.filter((t) => t.workloadHoursPerWeek > RULES.workload.comfortableHoursPerWeek)
  checks.push({
    id: 'workload',
    label: `Semester workload ≤ ${RULES.workload.comfortableHoursPerWeek} hrs/week`,
    status: heavy.length ? 'warn' : 'ok',
    severity: 'soft',
    offenders: heavy.map((t) => t.term),
    detail: heavy.length
      ? heavy
          .map((t) => `${termLabel(t.term)} ≈ ${Math.round(t.workloadHoursPerWeek)} hrs/week`)
          .join('; ') + ' (OMSCentral self-reported).'
      : 'No semester exceeds the comfortable load.',
  })

  const withBackground = degreePlacements
    .map((p) => COURSE_BY_CODE.get(p.code))
    .filter((c): c is Course => !!c && backgroundTopics(c).length > 0)
  checks.push({
    id: 'background',
    label: 'Recommended background',
    status: withBackground.length ? 'warn' : 'ok',
    severity: 'soft',
    offenders: withBackground.map((c) => c.code),
    detail: withBackground.length
      ? withBackground.map((c) => `${c.code}: ${backgroundTopics(c).join(', ')}`).join(' · ') +
        '. Advisory only — OMSCS enforces no prerequisites.'
      : 'No placed course publishes recommended background.',
  })

  /* ── verdict and pacing ──────────────────────────────────────── */

  const hardFailures = checks.filter((c) => c.severity === 'hard' && c.status === 'fail').length
  const softWarnings = checks.filter((c) => c.severity === 'soft' && c.status === 'warn').length
  const pendingHard = checks.filter((c) => c.severity === 'hard' && c.status === 'pending').length

  const remainingCourses = Math.max(0, RULES.degree.totalCourses - counted.length)
  const startFrom = lastTerm
    ? termIndex(lastTerm) + 1
    : termIndex(plan.matriculationTerm)
  let earliestCompletion: TermId | null = null
  if (remainingCourses === 0) {
    earliestCompletion = lastTerm
  } else {
    let left = remainingCourses
    for (let i = startFrom; i < startFrom + 60 && left > 0; i++) {
      const t = termFromIndex(i)
      left -= RULES.registration.maxDegreeCourses[seasonOf(t)]
      if (left <= 0) earliestCompletion = t
    }
  }

  const slackTerms =
    plan.targetGraduationTerm && earliestCompletion
      ? termIndex(plan.targetGraduationTerm) - termIndex(earliestCompletion)
      : null

  let verdict: Validation['verdict']
  if (hardFailures > 0) {
    verdict = {
      status: 'fail',
      headline: 'Plan breaks a hard rule',
      detail: `${hardFailures} requirement${hardFailures === 1 ? '' : 's'} the program will not bend on.`,
    }
  } else if (pendingHard === 0) {
    verdict = {
      status: 'ok',
      headline: 'Every degree requirement is met',
      detail: !trackGrades
        ? `All ${RULES.degree.totalCourses} courses placed. Specialization courses still need a ${RULES.degree.minGradeSpecialization}.`
        : gpa === null
          ? 'Enter grades to confirm the GPA requirement.'
          : `Cumulative GPA ${gpa.toFixed(2)}.`,
    }
  } else {
    verdict = {
      status: 'pending',
      headline: `${remainingCourses} course${remainingCourses === 1 ? '' : 's'} left to place`,
      detail: `${pendingHard} requirement${pendingHard === 1 ? '' : 's'} still open${
        softWarnings ? `, ${softWarnings} advisor${softWarnings === 1 ? 'y' : 'ies'}` : ''
      }.`,
    }
  }

  return {
    trackGrades,
    checks,
    slots,
    freeElectives,
    freeElectivesNeeded: freeNeeded,
    spec,
    terms,
    countedCourses: counted.length,
    countedCreditHours,
    gpa,
    gradedCourses,
    qualityPoints,
    foundationalMetTerm,
    foundationalWindow: window,
    lastTerm,
    timeLimit: limit,
    hardFailures,
    softWarnings,
    verdict,
    earliestCompletion,
    remainingCourses,
    slackTerms,
  }
}

export { pct }
