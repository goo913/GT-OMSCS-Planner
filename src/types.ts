/** Shapes of the generated JSON in src/data/ plus the plan document itself. */

export type Season = 'FA' | 'SP' | 'SU'
/** e.g. "2026FA". Ordered by termIndex(), not lexically. */
export type TermId = string

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F' | 'W' | 'P'

export interface OmsCentral {
  slug: string | null
  url: string | null
  rating: number | null
  difficulty: number | null
  workload: number | null
  reviewCount: number
  description: string | null
  notesUrl: string | null
  tags: string[]
  textbooks: { name: string; url?: string }[]
}

export interface CourseOfferings {
  fall: boolean | null
  spring: boolean | null
  summer: boolean | null
  everyFall: boolean | null
  everySpring: boolean | null
  everySummer: boolean | null
  history: TermId[]
  lastOffered: TermId | null
  known: boolean
}

export interface Course {
  code: string
  subject: string
  number: number
  section: string | null
  title: string
  creditHours: number
  foundational: boolean
  administeredBy: 'analytics' | 'cybersecurity' | null
  formerly: string | null
  isCsCse: boolean
  level: number
  url: string
  slug: string
  overview: string | null
  background: string | null
  goals: string | null
  team: { name: string; role: string }[]
  videos: string[]
  syllabi: { label: string; url: string }[]
  gtSpecRoles: Record<string, 'core' | 'elective'>
  offerings: CourseOfferings
  omscentral: OmsCentral | null
}

export interface Seminar {
  code: string
  title: string
  schedule: string
  lastOffered: string
  description: string
  status: 'scheduled' | 'past'
  creditHours: number
  grading: string
}

export interface SpecGroup {
  id: string
  section: 'core' | 'elective'
  label: string
  need: number
  creditHours: number
  courses: string[]
  catalogCourses: string[]
  sourceText: string | null
  subgroups?: { id: string; label: string; min: number; courses: string[] }[]
}

export interface Specialization {
  id: string
  name: string
  short: string
  formerName: string | null
  url: string
  specializationHours: number
  freeElectiveHours: number
  freeElectiveCourses: number
  excessCoreCountsAsSpecElective: boolean
  minGrade: string
  groups: SpecGroup[]
}

export interface TermRates {
  perCreditHour: number
  perCreditHourAlt: { outOfState: number; outOfCountry: number }
  onlineLearningFee: { under4Hours: number; atLeast4Hours: number }
  estimated: boolean
  source: string
}

export interface Rules {
  version: string
  degree: {
    totalCreditHours: number
    totalCourses: number
    creditHoursPerCourse: number
    specializationsRequired: number
    minGpaToGraduate: number
    minGpaGoodStanding: number
    minGradeSpecialization: string
    minGradeCountsTowardDegree: string
    maxNonCsCseCreditHours: number
    minCsCse6000PlusCreditHours: number
    timeLimitYears: number
    letterGradeOnly: boolean
    substitutionsAllowed: boolean
    source: string
    nonCsCseRuleText: string
  }
  foundational: {
    coursesRequired: number
    minGrade: string
    windowMonths: number
    windowTerms: number
    restrictsRegistrationUntilMet: boolean
    restrictionLiftsAfterGradesPost: boolean
    seminarsExempt: boolean
    dismissalOnFailure: boolean
    notes: string[]
    source: string
  }
  registration: {
    maxCreditHours: Record<Season, number>
    maxDegreeCourses: Record<Season, number>
    waitlistedHoursCountTowardCap: boolean
    appliesToAllStudents: boolean
    source: string
    notes: string[]
  }
  seminars: {
    code: string
    creditHours: number
    grading: string
    countsTowardDegree: boolean
    countsTowardFoundational: boolean
    countsTowardGpa: boolean
    countsTowardTermHourCap: boolean
    countsTowardSatisfactoryProgress: boolean
  }
  prerequisites: { enforced: boolean; text: string; source: string }
  sectionCodes: { pattern: string; meaning: string; omscsEligible: boolean; error?: string }[]
  specializationDeclaration: Record<string, unknown> & {
    blockedDuringActiveRegistration: boolean
    undeclaredBehaviour: string
  }
  financialAid: { halfTimeCreditHours: number; note: string; disclaimer: string }
  gradePoints: Record<string, number>
  nonGpaGrades: string[]
  workload: { comfortableHoursPerWeek: number; note: string }
}

/* ── the plan document ────────────────────────────────────────────── */

export interface Placement {
  code: string
  term: TermId
  /** null while the course is merely planned. */
  grade: Grade | null
  /** ms epoch, used only for last-write-wins bookkeeping. */
  updatedAt?: number
}

/**
 * Settings that change what the plan *means*, so they live in the shared document
 * rather than per-device: both people should see the same verdict. Purely visual
 * preferences (theme, density) stay in localStorage.
 */
export interface PlanSettings {
  /**
   * Off by default. When off the app plans courses, not outcomes: no grade inputs,
   * no GPA requirement, and the minimum-grade rules become advisories on the slots
   * they apply to rather than pass/fail checks.
   */
  trackGrades: boolean
  showCost: boolean
  showWorkload: boolean
}

export interface Plan {
  schemaVersion: number
  specialization: string
  matriculationTerm: TermId
  targetGraduationTerm: TermId | null
  /** keyed by course code with spaces replaced by underscores (Firestore-safe). */
  placements: Record<string, Placement>
  notes: Record<TermId, string>
  settings: PlanSettings
  updatedAt: number
}
