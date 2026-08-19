import { ArrowUpRight, Award, Calendar, Trash2 } from 'lucide-react'
import type { Grade, Plan, TermId } from '@/types'
import type { Validation } from '@/lib/validate'
import { COURSE_BY_CODE, RULES, SEMINAR_BY_CODE, SPECIALIZATIONS, isSeminarCode, offeringSummary } from '@/lib/catalog'
import { backgroundTopics } from '@/lib/validate'
import { checkCap } from '@/lib/placement'
import { placementOf } from '@/lib/plan'
import { termLabel } from '@/lib/terms'
import { cn } from '@/lib/utils'
import { MetricRow } from '@/components/metric'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const GRADES: Grade[] = ['A', 'B', 'C', 'D', 'F', 'W']

/**
 * One dialog, opened from every place a course appears — a library row, a card on the
 * board, a filled slot on the rail. Previously clicking a placed course did nothing,
 * which was the single most frustrating thing in the app.
 */
export function CourseDialog({
  code,
  plan,
  terms,
  validation,
  onClose,
  onPlace,
  onRemove,
  onGrade,
}: {
  code: string | null
  plan: Plan
  terms: TermId[]
  validation: Validation
  onClose: () => void
  onPlace: (code: string, term: TermId) => void
  onRemove: (code: string) => void
  onGrade: (code: string, grade: Grade | null) => void
}) {
  const course = code ? COURSE_BY_CODE.get(code) : null
  const seminar = code ? SEMINAR_BY_CODE.get(code) : null
  const placement = code ? placementOf(plan, code) : null
  const oc = course?.omscentral
  const topics = course ? backgroundTopics(course) : []
  const slot = code ? (validation.slots.find((s) => s.filledBy === code) ?? null) : null
  const isSeminar = code ? isSeminarCode(code) : false

  const title = course?.title ?? seminar?.title ?? code ?? ''

  return (
    <Dialog open={Boolean(code)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 space-y-2 border-b px-6 py-4 pr-12">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono text-sm font-semibold">{code}</span>
            <span className="text-muted-foreground">·</span>
            <span className="mono text-xs text-muted-foreground">
              {course?.creditHours ?? RULES.seminars.creditHours} hrs
            </span>
            {course?.foundational && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="gap-1">
                    <Award className="size-3" aria-hidden />
                    Foundational
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  Counts toward the {RULES.foundational.coursesRequired}-course foundational
                  requirement, which needs a {RULES.foundational.minGrade} or better within the first{' '}
                  {RULES.foundational.windowTerms} terms.
                </TooltipContent>
              </Tooltip>
            )}
            {course && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="gap-1 font-normal">
                    <Calendar className="size-3" aria-hidden />
                    {offeringSummary(course)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  Terms this course has run in since Fall 2022. Offerings are not final until
                  shortly before that term's Phase I registration.
                </TooltipContent>
              </Tooltip>
            )}
            {course && !course.isCsCse && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="font-normal">
                    {course.subject}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  Counts against the {RULES.degree.maxNonCsCseCreditHours}-hour cap on non-CS/CSE
                  coursework.
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <DialogTitle className="text-xl leading-snug">{title}</DialogTitle>
          {course?.administeredBy && (
            <DialogDescription>
              Administered by the OMS{' '}
              {course.administeredBy === 'analytics' ? 'Analytics' : 'Cybersecurity'} program —
              register only for an O## section.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {oc && (
            <>
              <MetricRow
                rating={oc.rating}
                difficulty={oc.difficulty}
                workload={oc.workload}
                reviews={oc.reviewCount}
                className="gap-6"
              />
              <Separator className="my-5" />
            </>
          )}

          {/* Placement */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Placement
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={placement?.term ?? ''}
                onValueChange={(t) => code && onPlace(code, t)}
              >
                <SelectTrigger className="w-44" size="sm">
                  <SelectValue placeholder="Choose a term…" />
                </SelectTrigger>
                <SelectContent>
                  {terms.map((t) => {
                    const cap = code ? checkCap(plan, code, t) : { ok: true, reason: null }
                    return (
                      <SelectItem key={t} value={t} disabled={!cap.ok}>
                        {termLabel(t)}
                        {!cap.ok && (
                          <span className="ml-2 text-xs text-muted-foreground">full</span>
                        )}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>

              {validation.trackGrades && !isSeminar && placement && (
                <Select
                  value={placement.grade ?? 'planned'}
                  onValueChange={(g) => code && onGrade(code, g === 'planned' ? null : (g as Grade))}
                >
                  <SelectTrigger className="w-32" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    {GRADES.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {placement && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => code && onRemove(code)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Remove
                </Button>
              )}
            </div>
            {slot && (
              <p className="text-xs text-muted-foreground">
                Filling <span className="text-foreground">{slot.group}</span>
                {slot.restriction ? ` · ${slot.restriction}` : ''}
                {!validation.trackGrades && (
                  <> — will require a {RULES.degree.minGradeSpecialization}.</>
                )}
              </p>
            )}
          </section>

          {course?.overview && (
            <>
              <Separator className="my-5" />
              <section className="space-y-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Overview
                </h3>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {course.overview}
                </p>
              </section>
            </>
          )}

          {course?.background && (
            <>
              <Separator className="my-5" />
              <section className="space-y-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Recommended background
                </h3>
                {topics.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {topics.map((t) => (
                      <Badge key={t} variant="secondary" className="font-normal">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {course.background}
                </p>
                <p className="text-xs text-muted-foreground/80">{RULES.prerequisites.text}</p>
              </section>
            </>
          )}

          {/* Requirement fit across all six specializations */}
          {course && (
            <>
              <Separator className="my-5" />
              <section className="space-y-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Requirement fit
                </h3>
                <ul className="divide-y rounded-md border text-sm">
                  {SPECIALIZATIONS.map((s) => {
                    const groups = s.groups.filter((g) => g.courses.includes(code!))
                    const active = s.id === plan.specialization
                    return (
                      <li
                        key={s.id}
                        className={cn(
                          'flex items-baseline gap-3 px-3 py-1.5',
                          active ? 'bg-primary/5 text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        <span className={cn('min-w-0 flex-1', active && 'font-medium')}>
                          {s.name}
                        </span>
                        <span className={cn('shrink-0 text-right', active && 'font-medium')}>
                          {groups.length ? groups.map((g) => g.label).join(' / ') : 'free elective'}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            </>
          )}

          {seminar && (
            <section className="space-y-2">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {seminar.description}
              </p>
              <p className="text-xs text-muted-foreground">
                Seminars are {RULES.seminars.creditHours} credit hour, {RULES.seminars.grading}, and
                do not count toward the degree, the foundational requirement, or GPA — but they do
                count against the per-semester hour cap.
              </p>
              {seminar.schedule && (
                <p className="text-xs text-muted-foreground">Schedule: {seminar.schedule}</p>
              )}
            </section>
          )}

          {/* Links */}
          <Separator className="my-5" />
          <section className="flex flex-wrap gap-2">
            {course && (
              <Button asChild variant="outline" size="sm">
                <a href={course.url} target="_blank" rel="noreferrer">
                  GT course page
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </a>
              </Button>
            )}
            {oc?.url && (
              <Button asChild variant="outline" size="sm">
                <a href={oc.url} target="_blank" rel="noreferrer">
                  OMSCentral reviews
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </a>
              </Button>
            )}
            {oc?.notesUrl && (
              <Button asChild variant="outline" size="sm">
                <a href={oc.notesUrl} target="_blank" rel="noreferrer">
                  Lecture notes
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </a>
              </Button>
            )}
            {course?.syllabi.slice(0, 2).map((s) => (
              <Button asChild key={s.url} variant="outline" size="sm">
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.label}
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </a>
              </Button>
            ))}
            {course?.videos.map((v, i) => (
              <Button asChild key={v} variant="outline" size="sm">
                <a href={v.replace('/embed/', '/watch?v=')} target="_blank" rel="noreferrer">
                  {i === 0 ? 'Preview' : 'Sample lesson'}
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </a>
              </Button>
            ))}
            {seminar && (
              <Button asChild variant="outline" size="sm">
                <a href="https://omscs.gatech.edu/seminars" target="_blank" rel="noreferrer">
                  All seminars
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </a>
              </Button>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
