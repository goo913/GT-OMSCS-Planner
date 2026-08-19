/**
 * Scenario checks for the validator. Run with:  npx tsx scripts/validate-selftest.ts
 *
 * These are not exhaustive unit tests — they are the specific situations the rules
 * file calls out, encoded so a rules edit that breaks one of them is loud.
 */
import { COURSES, RULES, SPECIALIZATIONS } from '../src/lib/catalog'
import { costForTerm, feeCliff } from '../src/lib/cost'
import { checkCap } from '../src/lib/placement'
import { emptyPlan } from '../src/lib/plan'
import { termLabel, timeLimitTerm } from '../src/lib/terms'
import { validate } from '../src/lib/validate'
import type { Grade, Plan, TermId } from '../src/types'

let failures = 0
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${ok ? '' : `\n         expected ${JSON.stringify(expected)}\n         actual   ${JSON.stringify(actual)}`}`)
}

/**
 * Grade tracking defaults OFF in the app, but most scenarios here are about the
 * grade-dependent rules, so this helper turns it on whenever any entry carries a
 * grade. Scenarios that specifically exercise the off state build the plan directly.
 */
function planWith(entries: [string, TermId, Grade | null][], specialization = 'ai'): Plan {
  const p = emptyPlan()
  p.specialization = specialization
  p.settings.trackGrades = entries.some(([, , g]) => g !== null)
  for (const [code, term, grade] of entries) {
    p.placements[code.replace(/ /g, '_')] = { code, term, grade }
  }
  return p
}

const check_ = (id: string, v: ReturnType<typeof validate>) => v.checks.find((c) => c.id === id)!

console.log('\n— catalog —')
check('77 courses on the current-courses page', COURSES.length, 77)
check('51 foundational courses', COURSES.filter((c) => c.foundational).length, 51)
check('six specializations', SPECIALIZATIONS.length, 6)
check(
  'Computing Systems is the 18-hour specialization',
  SPECIALIZATIONS.filter((s) => s.specializationHours === 18).map((s) => s.id),
  ['cs'],
)
check(
  'every specialization totals 10 courses',
  SPECIALIZATIONS.map((s) => s.specializationHours / 3 + s.freeElectiveCourses),
  [10, 10, 10, 10, 10, 10],
)
check(
  'AI avoids CS 6515 via CS 6300',
  SPECIALIZATIONS.find((s) => s.id === 'ai')!.groups[0].courses,
  ['CS 6300', 'CS 6515'],
)
check(
  'HCI needs no algorithms course',
  SPECIALIZATIONS.find((s) => s.id === 'hci')!.groups.some((g) => g.courses.includes('CS 6515')),
  false,
)

console.log('\n— registration caps —')
check('Fall cap is 7 hours', RULES.registration.maxCreditHours.FA, 7)
check('Summer cap is 5 hours', RULES.registration.maxCreditHours.SU, 5)
check('Summer still allows only one degree course', RULES.registration.maxDegreeCourses.SU, 1)

{
  const v = validate(planWith([['CS 6035', '2026FA', null], ['CS 6750', '2026FA', null]]))
  check('two courses in Fall is within the cap', check_('term-cap', v).status, 'ok')
}
{
  const v = validate(
    planWith([['CS 6035', '2026FA', null], ['CS 6750', '2026FA', null], ['CS 6601', '2026FA', null]]),
  )
  check('three courses in Fall breaks the cap', check_('term-cap', v).status, 'fail')
}
{
  const v = validate(planWith([['CS 6035', '2027SU', null], ['CS 6750', '2027SU', null]]))
  check('two courses in Summer breaks the 5-hour cap', check_('term-cap', v).status, 'fail')
}
{
  const v = validate(
    planWith([['CS 6035', '2026FA', null], ['CS 6750', '2026FA', null], ['CS 8001 OCS', '2026FA', null]]),
  )
  check('2 courses + a seminar fits exactly in Fall', check_('term-cap', v).status, 'ok')
  check('the seminar does not count toward the degree', v.countedCreditHours, 6)
}

console.log('\n— foundational requirement —')
{
  const v = validate(planWith([['CS 6035', '2026FA', 'B'], ['CS 6750', '2026FA', 'A']]))
  check('two foundational B+ in the first term satisfies it', check_('foundational', v).status, 'ok')
  check('and it is met in Fall 2026', v.foundationalMetTerm, '2026FA')
}
{
  const v = validate(planWith([['CS 6035', '2026FA', 'C'], ['CS 6750', '2026FA', 'A']]))
  check('a C does not count toward the foundational requirement', check_('foundational', v).have, 1)
  check('  … but the window still has room, so it is not yet broken', check_('foundational', v).status, 'pending')
}
{
  const v = validate(planWith([['CS 6035', '2027FA', null], ['CS 6750', '2027FA', null]]))
  check(
    'foundational courses outside the 3-term window do not count',
    check_('foundational', v).have,
    0,
  )
}
{
  // Fall 2 + Spring 2 + Summer 1 = five course slots in the window, all spent on Cs.
  const v = validate(
    planWith([
      ['CS 6035', '2026FA', 'C'],
      ['CS 6750', '2026FA', 'C'],
      ['CS 6601', '2027SP', 'C'],
      ['CS 6300', '2027SP', 'C'],
      ['CS 7637', '2027SU', 'C'],
    ]),
  )
  check('a full window with no qualifying grade is unreachable', check_('foundational', v).status, 'fail')
}
{
  const v = validate(planWith([]))
  check('an empty plan is pending, not broken', check_('foundational', v).status, 'pending')
  check('  … and the verdict is not red', validate(planWith([])).verdict.status, 'pending')
}
{
  // CS 6150 is not foundational; placing it before the requirement is met is a Banner block.
  const v = validate(planWith([['CS 6150', '2026FA', null], ['CS 6035', '2026FA', null]]))
  check('a non-foundational course in term 1 trips the cohort restriction', check_('foundational-lock', v).status, 'fail')
}
{
  const v = validate(
    planWith([
      ['CS 6035', '2026FA', 'A'],
      ['CS 6750', '2026FA', 'A'],
      ['CS 6150', '2027SP', null],
    ]),
  )
  check('the lock lifts the term after the requirement is met', check_('foundational-lock', v).status, 'ok')
}
{
  const v = validate(
    planWith([
      ['CS 6035', '2026FA', 'A'],
      ['CS 6750', '2026FA', null],
      ['CS 6150', '2026FA', null],
    ]),
  )
  check('the lock still applies during the term it is being met', check_('foundational-lock', v).status, 'fail')
}

console.log('\n— non-CS/CSE cap —')
{
  const v = validate(planWith([['ISYE 6420', '2026FA', null], ['MGT 6311', '2027SP', null]]))
  check('two non-CS/CSE courses is exactly the cap', check_('non-cs-cse', v).status, 'ok')
  check('  … 6 of 6 hours', check_('non-cs-cse', v).have, 6)
}
{
  const v = validate(
    planWith([
      ['ISYE 6420', '2026FA', null],
      ['MGT 6311', '2027SP', null],
      ['PUBP 6725', '2027FA', null],
    ]),
  )
  check('three non-CS/CSE courses breaks it', check_('non-cs-cse', v).status, 'fail')
}

console.log('\n— specialization matching (AI) —')
{
  const v = validate(
    planWith([
      ['CS 6300', '2026FA', null], // algorithms slot
      ['CS 6601', '2026FA', null], // AI core
      ['CS 7637', '2027SP', null], // AI core
      ['CS 6750', '2027SP', null], // AI elective (cognition)
      ['CS 7632', '2027SU', null], // AI elective (AI methods)
    ]),
  )
  check('five well-chosen courses fill every AI slot', v.slots.filter((s) => s.filledBy).length, 5)
  check('and nothing spills into free electives', v.freeElectives, [])
  check('CS 6515 is not required for AI', check_('spec-ai-algorithms', v).status, 'ok')
}
{
  // AI allows core beyond the requirement to fill a specialization elective.
  const v = validate(
    planWith([
      ['CS 6300', '2026FA', null],
      ['CS 6601', '2026FA', null],
      ['CS 7637', '2027SP', null],
      ['CS 7641', '2027SP', null],
      ['CS 7643', '2027SU', null],
    ]),
  )
  check('excess AI core fills the elective slots', v.slots.filter((s) => s.filledBy).length, 5)
}
{
  // Machine Learning does NOT allow that — extra core falls to a free elective.
  const v = validate(
    planWith([
      ['CS 6515', '2026FA', null],
      ['CS 7641', '2026FA', null],
      ['CS 6476', '2027SP', null],
      ['CS 7643', '2027SP', null],
      ['CS 7646', '2027SU', null],
    ], 'ml'),
  )
  check('ML fills all five slots from its own lists', v.slots.filter((s) => s.filledBy).length, 5)
}
{
  const v = validate(
    planWith([
      ['CS 6515', '2026FA', null],
      ['CS 6601', '2026FA', null],
      ['CS 6475', '2027SP', null], // perception
      ['CS 6476', '2027SP', null], // perception
      ['CS 7650', '2027SU', null], // perception
    ], 'cpr'),
  )
  check(
    'CPR electives still need one robotics course',
    v.slots.filter((s) => s.filledBy).length,
    4,
  )
  check('  … the robotics slot stays open', v.slots.find((s) => s.restriction === 'Robotics')!.filledBy, null)
}
{
  const v = validate(
    planWith([
      ['CS 6515', '2026FA', null],
      ['CS 6601', '2026FA', null],
      ['CS 6475', '2027SP', null],
      ['CS 6476', '2027SP', null],
      ['CS 7638', '2027SU', null], // robotics
    ], 'cpr'),
  )
  check('adding a robotics course completes CPR', v.slots.filter((s) => s.filledBy).length, 5)
}
{
  const v = validate(planWith([['CS 6035', '2026FA', null]]))
  check('a course no specialization lists becomes a free elective', v.freeElectives, ['CS 6035'])
}
{
  const v = validate(planWith([['CS 6601', '2026FA', 'C']]))
  check('a C cannot hold a specialization slot', v.slots.filter((s) => s.filledBy).length, 0)
  check('  … and it is called out', check_('min-grades', v).status, 'fail')
}

{
  // Computer Graphics draws on only six OMSCS courses for its five slots.
  const v = validate(
    planWith([
      ['CS 6515', '2026FA', null],
      ['CS 6491', '2026FA', null],
      ['CS 6457', '2027SP', null],
      ['CS 6475', '2027SP', null],
      ['CS 7496', '2027SU', null],
    ], 'cg'),
  )
  check('Computer Graphics is completable', v.slots.filter((s) => s.filledBy).length, 5)
}
{
  // HCI cannot be finished without one course from each elective sub-area.
  const v = validate(
    planWith([
      ['CS 7470', '2026FA', null],
      ['CS 6750', '2026FA', null],
      ['CS 6435', '2027SP', null],
      ['CS 6457', '2027SP', null],
      ['CS 6460', '2027SU', null],
    ], 'hci'),
  )
  check('three design-sub-area electives leave the interactive slot open',
    v.slots.filter((s) => s.filledBy).length, 4)
}

console.log('\n— the cap is enforced at the drop, not just reported —')
{
  const p = planWith([['CS 6035', '2026FA', null], ['CS 6750', '2026FA', null]])
  check('a third Fall course is refused', checkCap(p, 'CS 6601', '2026FA').ok, false)
  check('  … on the course limit, not the hour limit', checkCap(p, 'CS 6601', '2026FA').limit, 'courses')
  check('  … and it offers the two courses to swap out',
    checkCap(p, 'CS 6601', '2026FA').swappable.sort(), ['CS 6035', 'CS 6750'])
  check('a seminar still fits alongside two courses', checkCap(p, 'CS 8001 OCS', '2026FA').ok, true)
}
{
  const p = planWith([
    ['CS 6035', '2026FA', null],
    ['CS 6750', '2026FA', null],
    ['CS 8001 OCS', '2026FA', null],
  ])
  check('a second seminar would break the 7-hour cap', checkCap(p, 'CS 8001 ODA', '2026FA').ok, false)
  check('  … on hours', checkCap(p, 'CS 8001 ODA', '2026FA').limit, 'hours')
}
{
  const p = planWith([['CS 6035', '2027SU', null]])
  check('a second Summer course is refused', checkCap(p, 'CS 6750', '2027SU').ok, false)
  check('a Summer seminar is allowed', checkCap(p, 'CS 8001 OCS', '2027SU').ok, true)
}
{
  const p = planWith([['CS 6035', '2027SU', null], ['CS 8001 OCS', '2027SU', null]])
  check('Summer fits one course and two seminars', checkCap(p, 'CS 8001 ODA', '2027SU').ok, true)
  const q = planWith([
    ['CS 6035', '2027SU', null],
    ['CS 8001 OCS', '2027SU', null],
    ['CS 8001 ODA', '2027SU', null],
  ])
  check('  … but not three seminars', checkCap(q, 'CS 8001 OLP', '2027SU').ok, false)
}
{
  const p = planWith([['CS 6035', '2026FA', null], ['CS 6750', '2026FA', null]])
  check('re-placing a course already in the term is a no-op, not a violation',
    checkCap(p, 'CS 6035', '2026FA').ok, true)
  check('an empty term accepts anything', checkCap(p, 'CS 6601', '2027SP').ok, true)
}

console.log('\n— grade tracking off —')
{
  const p = emptyPlan()
  p.settings.trackGrades = false
  for (const [c, t] of [['CS 6035', '2026FA'], ['CS 6750', '2026FA']] as [string, TermId][]) {
    p.placements[c.replace(/ /g, '_')] = { code: c, term: t, grade: null }
  }
  const v = validate(p)
  check('the GPA requirement disappears', v.checks.some((c) => c.id === 'gpa'), false)
  check('the minimum-grade rule becomes an advisory',
    v.checks.find((c) => c.id === 'min-grades')!.severity, 'soft')
  check('foundational counts planned courses', check_('foundational', v).status, 'ok')
  check('  … and says the grade is still required',
    /needs a B or better/i.test(check_('foundational', v).detail), true)
  check('no hard requirement is left waiting on data the user opted out of',
    v.checks.filter((c) => c.severity === 'hard' && c.status === 'pending').map((c) => c.id).includes('gpa'),
    false)
}
{
  const p = emptyPlan()
  p.settings.trackGrades = true
  for (const [c, t] of [['CS 6035', '2026FA'], ['CS 6750', '2026FA']] as [string, TermId][]) {
    p.placements[c.replace(/ /g, '_')] = { code: c, term: t, grade: null }
  }
  const v = validate(p)
  check('turning it on brings the GPA requirement back', v.checks.some((c) => c.id === 'gpa'), true)
  check('  … and foundational waits for real grades', check_('foundational', v).status, 'pending')
}

console.log('\n— GPA, time limit, cost —')
{
  const v = validate(planWith([['CS 6035', '2026FA', 'A'], ['CS 6750', '2026FA', 'B']]))
  check('GPA of an A and a B is 3.50', v.gpa, 3.5)
  check('  … which clears the bar', check_('gpa', v).status, 'ok')
}
{
  const v = validate(planWith([['CS 6035', '2026FA', 'C'], ['CS 6750', '2026FA', 'C']]))
  check('a 2.00 GPA fails the graduation requirement', check_('gpa', v).status, 'fail')
}
check('Fall 2026 + 6 years ends Summer 2032', termLabel(timeLimitTerm('2026FA', 6)), 'Summer 2032')
{
  const v = validate(planWith([['CS 6035', '2033FA', null]]))
  check('a term past the limit fails', check_('time-limit', v).status, 'fail')
}

check('one course in Fall 2026 costs $893', costForTerm('2026FA', 3).total, 3 * 227 + 212)
check('two courses in Fall 2026 cost $1,893', costForTerm('2026FA', 6).total, 6 * 227 + 531)
check('two courses + seminar cost $2,120', costForTerm('2026FA', 7).total, 7 * 227 + 531)
check('the Fall fee cliff is $1,000', feeCliff('2026FA').marginal, 1000)
check(
  'the whole two-year AI plan costs $9,300',
  (['2026FA', '2027SP', '2027FA', '2028SP'] as TermId[]).reduce((n, t) => n + costForTerm(t, 6).total, 0) +
    (['2027SU', '2028SU'] as TermId[]).reduce((n, t) => n + costForTerm(t, 3).total, 0),
  9300,
)
check('Summer 2027 runs a lower online fee', costForTerm('2027SU', 3).total, 3 * 227 + 183)
check('Fall 2028 is carried forward from Fall 2026', costForTerm('2028FA', 3).estimated, true)
check('Summer carries forward from Summer, not Fall', costForTerm('2028SU', 3).total, 3 * 227 + 183)

console.log('\n— pacing —')
{
  const v = validate(planWith([]))
  check('ten courses from Fall 2026 finish no earlier than Summer 2028', v.earliestCompletion, '2028SU')
}
{
  const p = planWith([])
  p.targetGraduationTerm = '2028SU'
  const v = validate(p)
  check('a Summer 2028 target has zero slack', v.slackTerms, 0)
}
{
  const p = planWith([])
  p.targetGraduationTerm = '2027SU'
  const v = validate(p)
  check('a Summer 2027 target is not reachable', v.slackTerms! < 0, true)
  check('  … and the earliest finish is still reported', v.earliestCompletion, '2028SU')
}

console.log('\n— a complete, valid AI plan —')
{
  const v = validate(
    planWith([
      ['CS 6035', '2026FA', 'A'],
      ['CS 6750', '2026FA', 'A'],
      ['CS 6300', '2027SP', 'A'],
      ['CS 6601', '2027SP', 'B'],
      ['CS 7637', '2027SU', 'A'],
      ['CS 7641', '2027FA', 'B'],
      ['CS 6603', '2027FA', 'A'],
      ['CS 7632', '2028SP', 'A'],
      ['CS 6460', '2028SP', 'A'],
      ['CS 6250', '2028SU', 'A'],
    ]),
  )
  check('every hard rule passes', v.hardFailures, 0)
  check('30 credit hours', v.countedCreditHours, 30)
  check('verdict is green', v.verdict.status, 'ok')
  const open = v.checks.filter((c) => c.severity === 'hard' && c.status !== 'ok')
  check('no hard requirement left open', open.map((c) => c.id), [])
}

console.log(`\n${failures === 0 ? 'All scenario checks passed.' : `${failures} check(s) FAILED.`}\n`)
process.exit(failures === 0 ? 0 : 1)
