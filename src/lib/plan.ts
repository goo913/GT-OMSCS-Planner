import type { Grade, Plan, PlanSettings, Placement, TermId } from '../types'
import { codeKey, lookup } from './catalog'
import { compareTerms, termIndex } from './terms'

export const SCHEMA_VERSION = 1

/** Top-level keys allowed by firestore.rules. Keep the two in sync. */
export const PLAN_KEYS = [
  'schemaVersion',
  'specialization',
  'matriculationTerm',
  'targetGraduationTerm',
  'placements',
  'notes',
  'settings',
  'updatedAt',
] as const

export const DEFAULT_SETTINGS: PlanSettings = {
  // Planning a degree is choosing courses; grades are an outcome you record later.
  // Starting with this off keeps ten fewer controls off the screen.
  trackGrades: false,
  showCost: true,
  showWorkload: true,
}

export function emptyPlan(): Plan {
  return {
    schemaVersion: SCHEMA_VERSION,
    specialization: 'ai',
    matriculationTerm: '2026FA',
    targetGraduationTerm: '2028SU',
    placements: {},
    notes: {},
    settings: { ...DEFAULT_SETTINGS },
    updatedAt: 0,
  }
}

/**
 * Coerce anything that arrives from Firestore, localStorage, or an imported file into a
 * well-formed plan. Unknown course codes and malformed placements are dropped rather
 * than allowed to crash the board.
 */
export function normalizePlan(raw: unknown): Plan {
  const base = emptyPlan()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Record<string, unknown>

  const placements: Record<string, Placement> = {}
  const rawPlacements = r.placements
  if (rawPlacements && typeof rawPlacements === 'object') {
    for (const [key, value] of Object.entries(rawPlacements as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue
      const p = value as Record<string, unknown>
      const code = typeof p.code === 'string' ? p.code : null
      const term = typeof p.term === 'string' ? p.term : null
      if (!code || !term || !/^\d{4}(FA|SP|SU)$/.test(term)) continue
      if (!lookup(code)) continue
      placements[key || codeKey(code)] = {
        code,
        term,
        grade: (typeof p.grade === 'string' ? p.grade : null) as Grade | null,
        updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : undefined,
      }
    }
  }

  const notes: Record<string, string> = {}
  if (r.notes && typeof r.notes === 'object') {
    for (const [k, v] of Object.entries(r.notes as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) notes[k] = v
    }
  }

  const rawSettings = (r.settings ?? {}) as Record<string, unknown>
  const settings: PlanSettings = {
    trackGrades:
      typeof rawSettings.trackGrades === 'boolean' ? rawSettings.trackGrades : DEFAULT_SETTINGS.trackGrades,
    showCost: typeof rawSettings.showCost === 'boolean' ? rawSettings.showCost : DEFAULT_SETTINGS.showCost,
    showWorkload:
      typeof rawSettings.showWorkload === 'boolean' ? rawSettings.showWorkload : DEFAULT_SETTINGS.showWorkload,
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    specialization: typeof r.specialization === 'string' ? r.specialization : base.specialization,
    matriculationTerm:
      typeof r.matriculationTerm === 'string' && /^\d{4}(FA|SP|SU)$/.test(r.matriculationTerm)
        ? r.matriculationTerm
        : base.matriculationTerm,
    targetGraduationTerm:
      typeof r.targetGraduationTerm === 'string' && /^\d{4}(FA|SP|SU)$/.test(r.targetGraduationTerm)
        ? r.targetGraduationTerm
        : null,
    placements,
    notes,
    settings,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : 0,
  }
}

export function placementsInTerm(plan: Plan, term: TermId): Placement[] {
  return Object.values(plan.placements)
    .filter((p) => p.term === term)
    .sort((a, b) => {
      const sa = lookup(a.code)?.isSeminar ? 1 : 0
      const sb = lookup(b.code)?.isSeminar ? 1 : 0
      return sa - sb || a.code.localeCompare(b.code)
    })
}

export function placementOf(plan: Plan, code: string): Placement | null {
  return plan.placements[codeKey(code)] ?? null
}

export function sortedPlacements(plan: Plan): Placement[] {
  return Object.values(plan.placements).sort(
    (a, b) => compareTerms(a.term, b.term) || a.code.localeCompare(b.code),
  )
}

/** Terms the board should show: a fixed window that always covers everything placed. */
export function boardTerms(plan: Plan, yearsOut: number): TermId[] {
  const start = termIndex(plan.matriculationTerm)
  let end = start + yearsOut * 3 - 1
  for (const p of Object.values(plan.placements)) end = Math.max(end, termIndex(p.term))
  const out: TermId[] = []
  for (let i = start; i <= end; i++) {
    const offset = i % 3
    const base = Math.floor(i / 3)
    out.push(offset === 0 ? `${base}FA` : `${base + 1}${offset === 1 ? 'SP' : 'SU'}`)
  }
  return out
}

export function exportPlan(plan: Plan): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: 'gt-omscs-planner',
      plan,
    },
    null,
    2,
  )
}

export function importPlan(text: string): Plan {
  const parsed = JSON.parse(text) as Record<string, unknown>
  return normalizePlan(parsed.plan ?? parsed)
}
