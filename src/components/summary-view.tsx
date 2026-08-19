import { AlertTriangle, Check, CircleDashed, Info } from 'lucide-react'
import calendarData from '@/data/calendar.json'
import type { Plan, TermId } from '@/types'
import type { Validation } from '@/lib/validate'
import { COURSE_BY_CODE, RULES, isSeminarCode, lookup } from '@/lib/catalog'
import { costForTerm, money } from '@/lib/cost'
import { placementsInTerm } from '@/lib/plan'
import { termLabel } from '@/lib/terms'
import { buildRailCells } from '@/components/slot-rail'
import { GtLogo } from '@/components/logo'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

const CALENDAR = calendarData as unknown as {
  terms: Record<TermId, { dates: { date: string; label: string; kind?: string; note?: string }[] }>
}

/**
 * The read, as opposed to the work. A single scrolling column in numbered sections:
 * verdict, requirements, the slot map, semester by semester, cost, pacing. This is
 * also what the print stylesheet targets — the board is a working surface, not a
 * document.
 */
export function SummaryView({
  plan,
  terms,
  validation,
}: {
  plan: Plan
  terms: TermId[]
  validation: Validation
}) {
  const cells = buildRailCells(validation)
  const used = terms.filter((t) => placementsInTerm(plan, t).length > 0)
  const costRows = validation.terms
    .filter((t) => t.creditHours > 0)
    .map((t) => costForTerm(t.term, t.creditHours))
  const total = costRows.reduce((n, r) => n + r.total, 0)

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-5 py-8 print:max-w-none print:px-0 print:py-0">
      <header className="flex items-center gap-3">
        <GtLogo className="h-8 w-auto" />
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{validation.spec.name}</h1>
          <p className="text-xs text-muted-foreground">
            Georgia Tech · MS Computer Science, Online · matriculated{' '}
            {termLabel(plan.matriculationTerm)} · must finish by {termLabel(validation.timeLimit)}
          </p>
        </div>
      </header>

      <Section n="01" title="Verdict">
        <div
          className={cn(
            'rounded-lg border p-4',
            validation.verdict.status === 'fail' && 'border-destructive/40 bg-destructive/5',
          )}
        >
          <div
            className={cn(
              'text-base font-medium',
              validation.verdict.status === 'fail' && 'text-destructive',
            )}
          >
            {validation.verdict.headline}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{validation.verdict.detail}</p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>
              <span className="mono text-foreground">{validation.countedCreditHours}</span> of 30
              credit hours
            </span>
            <span>
              <span className="mono text-foreground">{validation.countedCourses}</span> of 10 courses
            </span>
            {validation.trackGrades && validation.gpa !== null && (
              <span>
                GPA <span className="mono text-foreground">{validation.gpa.toFixed(2)}</span>
              </span>
            )}
            {validation.earliestCompletion && (
              <span>
                Earliest finish{' '}
                <span className="text-foreground">{termLabel(validation.earliestCompletion)}</span>
              </span>
            )}
          </div>
        </div>
      </Section>

      <Section n="02" title="Requirements">
        <ul className="divide-y rounded-lg border">
          {validation.checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5 px-3 py-2 print-break-avoid">
              {c.status === 'fail' ? (
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden />
              ) : c.status === 'ok' ? (
                <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
              ) : c.status === 'warn' ? (
                <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <CircleDashed className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      'text-sm',
                      c.status === 'fail' && 'font-medium text-destructive',
                    )}
                  >
                    {c.label}
                  </span>
                  {c.have !== undefined && c.need !== undefined && (
                    <span className="mono ml-auto shrink-0 text-xs text-muted-foreground">
                      {c.have}/{c.need} {c.unit ?? ''}
                    </span>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{c.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section n="03" title="Requirement slots">
        <div className="flex flex-wrap gap-1.5">
          {cells.map((cell) => (
            <div
              key={cell.key}
              className={cn(
                'flex h-11 w-[5.5rem] flex-col justify-center rounded-md border px-2',
                !cell.code && 'border-dashed text-muted-foreground',
                cell.code && cell.kind === 'free' && 'border-gold-surface bg-gold-surface text-gold-foreground',
                cell.code && cell.kind !== 'free' && 'border-primary bg-primary text-primary-foreground',
                cell.surplus && 'opacity-55',
              )}
            >
              <span className="mono text-[11px] font-semibold">{cell.code ?? '——'}</span>
              <span className="truncate text-[9px] opacity-75">
                {cell.code ? cell.group : (cell.restriction ?? cell.group)}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section n="04" title="Semester by semester">
        <div className="space-y-3">
          {used.map((term) => {
            const placements = placementsInTerm(plan, term)
            const summary = validation.terms.find((t) => t.term === term)
            const cost = costForTerm(term, summary?.creditHours ?? 0)
            const cal = CALENDAR.terms[term]
            return (
              <div key={term} className="rounded-lg border print-break-avoid">
                <div className="flex items-baseline gap-3 border-b px-3 py-2">
                  <h3 className="text-sm font-medium">{termLabel(term)}</h3>
                  <span className="mono text-xs text-muted-foreground">
                    {summary?.creditHours ?? 0} hrs
                  </span>
                  {plan.settings.showCost && (
                    <span className="mono ml-auto text-xs">
                      {money(cost.total)}
                      {cost.estimated && <span className="text-muted-foreground"> est</span>}
                    </span>
                  )}
                </div>
                <ul className="divide-y">
                  {placements.map((p) => {
                    const slot = validation.slots.find((s) => s.filledBy === p.code)
                    const course = COURSE_BY_CODE.get(p.code)
                    return (
                      <li key={p.code} className="flex items-baseline gap-2 px-3 py-1.5 text-sm">
                        <span className="mono w-24 shrink-0 font-medium">{p.code}</span>
                        <span className="min-w-0 flex-1 truncate">{lookup(p.code)?.title}</span>
                        {course?.foundational && (
                          <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                            FOUND
                          </Badge>
                        )}
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {isSeminarCode(p.code)
                            ? 'seminar'
                            : (slot?.group ?? 'free elective')}
                        </span>
                        {validation.trackGrades && p.grade && (
                          <span className="mono w-4 shrink-0 text-right text-xs">{p.grade}</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
                {plan.notes[term] && (
                  <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                    {plan.notes[term]}
                  </p>
                )}
                {cal && (
                  <ul className="border-t px-3 py-2 text-[11px] text-muted-foreground">
                    {cal.dates
                      .filter((d) => d.kind === 'payment' || d.kind === 'deadline')
                      .map((d) => (
                        <li key={d.date}>
                          <span className="mono">{d.date.slice(5)}</span> {d.label}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )
          })}
          {used.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing placed yet.</p>
          )}
        </div>
      </Section>

      {plan.settings.showCost && costRows.length > 0 && (
        <Section n="05" title="Cost">
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>Term</TableHead>
                <TableHead className="text-right">Hrs</TableHead>
                <TableHead className="text-right">Tuition</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costRows.map((r) => (
                <TableRow key={r.term}>
                  <TableCell>
                    {termLabel(r.term)}
                    {r.estimated && <span className="text-muted-foreground"> est</span>}
                  </TableCell>
                  <TableCell className="mono text-right">{r.creditHours}</TableCell>
                  <TableCell className="mono text-right">{money(r.tuition)}</TableCell>
                  <TableCell className="mono text-right">{money(r.onlineLearningFee)}</TableCell>
                  <TableCell className="mono text-right">{money(r.total)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-medium">
                <TableCell>Total</TableCell>
                <TableCell className="mono text-right">
                  {costRows.reduce((n, r) => n + r.creditHours, 0)}
                </TableCell>
                <TableCell className="mono text-right">
                  {money(costRows.reduce((n, r) => n + r.tuition, 0))}
                </TableCell>
                <TableCell className="mono text-right">
                  {money(costRows.reduce((n, r) => n + r.onlineLearningFee, 0))}
                </TableCell>
                <TableCell className="mono text-right">{money(total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="mt-2 text-xs text-muted-foreground">{RULES.financialAid.disclaimer}</p>
        </Section>
      )}

      <Separator />
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Estimates from the published Georgia Tech Bursar rate sheets; excludes textbooks and
        course-specific fees. Course offering history is informational only — a term's offerings are
        not final until shortly before that term's Phase I registration. OMSCS enforces no
        prerequisites; recommended background is advisory.
      </p>
    </div>
  )
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="mono rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {n}
        </span>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  )
}
