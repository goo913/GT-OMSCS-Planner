import { useState } from 'react'
import {
  AlertTriangle,
  Award,
  BookOpen,
  CalendarDays,
  Info,
  MoreHorizontal,
  Plus,
  StickyNote,
  Trash2,
} from 'lucide-react'
import calendarData from '@/data/calendar.json'
import type { Plan, TermId } from '@/types'
import type { Slot, Validation } from '@/lib/validate'
import { COURSE_BY_CODE, RULES, isSeminarCode, lookup } from '@/lib/catalog'
import { costForTerm, money, rateSummary } from '@/lib/cost'
import { checkCap } from '@/lib/placement'
import { placementsInTerm } from '@/lib/plan'
import { seasonOf, termIndex, termLabel } from '@/lib/terms'
import { IntensityBar } from '@/components/metric'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const CALENDAR = calendarData as unknown as {
  registrarUrl: string
  terms: Record<
    TermId,
    { source: string; dates: { date: string; label: string; kind?: string; note?: string }[] }
  >
}

export function Board({
  plan,
  terms,
  validation,
  focusedTerm,
  dragging,
  showCost,
  showWorkload,
  onFocusTerm,
  onPlace,
  onRemove,
  onOpenCourse,
  onNote,
  onAddTerm,
  onClearTerm,
}: {
  plan: Plan
  terms: TermId[]
  validation: Validation
  focusedTerm: TermId | null
  dragging: string | null
  showCost: boolean
  showWorkload: boolean
  onFocusTerm: (t: TermId) => void
  onPlace: (code: string, term: TermId) => void
  onRemove: (code: string) => void
  onOpenCourse: (code: string) => void
  onNote: (term: TermId, text: string) => void
  onAddTerm: () => void
  onClearTerm: (term: TermId) => void
}) {
  const [dropTarget, setDropTarget] = useState<TermId | null>(null)
  const slotByCode = new Map<string, Slot>()
  for (const s of validation.slots) if (s.filledBy) slotByCode.set(s.filledBy, s)

  // Academic years become a hairline with a small label, not a header row.
  const years = new Map<number, TermId[]>()
  for (const t of terms) {
    const y = Math.floor(termIndex(t) / 3)
    if (!years.has(y)) years.set(y, [])
    years.get(y)!.push(t)
  }

  return (
    <div className="@container space-y-5 p-4">
      {[...years.entries()].map(([year, group]) => (
        <section key={year} className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="mono text-[10px] tracking-wider text-muted-foreground">
              {year}–{String(year + 1).slice(2)}
            </span>
            <Separator className="flex-1" />
          </div>
          <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
            {group.map((term) => (
              <TermCard
                key={term}
                term={term}
                plan={plan}
                validation={validation}
                slotByCode={slotByCode}
                focused={focusedTerm === term}
                dragging={dragging}
                isDropTarget={dropTarget === term}
                showCost={showCost}
                showWorkload={showWorkload}
                setDropTarget={setDropTarget}
                onFocusTerm={onFocusTerm}
                onPlace={onPlace}
                onRemove={onRemove}
                onOpenCourse={onOpenCourse}
                onNote={onNote}
                onClearTerm={onClearTerm}
              />
            ))}
          </div>
        </section>
      ))}

      <Button variant="outline" size="sm" onClick={onAddTerm} className="w-full border-dashed">
        <Plus className="size-3.5" aria-hidden />
        Add term
      </Button>
    </div>
  )
}

function TermCard({
  term,
  plan,
  validation,
  slotByCode,
  focused,
  dragging,
  isDropTarget,
  showCost,
  showWorkload,
  setDropTarget,
  onFocusTerm,
  onPlace,
  onRemove,
  onOpenCourse,
  onNote,
  onClearTerm,
}: {
  term: TermId
  plan: Plan
  validation: Validation
  slotByCode: Map<string, Slot>
  focused: boolean
  dragging: string | null
  isDropTarget: boolean
  showCost: boolean
  showWorkload: boolean
  setDropTarget: (t: TermId | null) => void
  onFocusTerm: (t: TermId) => void
  onPlace: (code: string, term: TermId) => void
  onRemove: (code: string) => void
  onOpenCourse: (code: string) => void
  onNote: (term: TermId, text: string) => void
  onClearTerm: (term: TermId) => void
}) {
  const [noteOpen, setNoteOpen] = useState(false)
  const placements = placementsInTerm(plan, term)
  const summary = validation.terms.find((t) => t.term === term)
  const hours = summary?.creditHours ?? 0
  const cap = RULES.registration.maxCreditHours[seasonOf(term)]
  const maxCourses = RULES.registration.maxDegreeCourses[seasonOf(term)]
  const courseCount = summary?.degreeCourses.length ?? 0
  const cost = costForTerm(term, hours)
  const cal = CALENDAR.terms[term]
  const inWindow = validation.foundationalWindow.includes(term)
  const note = plan.notes[term] ?? ''

  const wouldReject = dragging ? checkCap(plan, dragging, term) : null
  const dropBlocked = Boolean(dragging && wouldReject && !wouldReject.ok)

  // onPlace owns the cap check and the message it produces; the board only routes
  // the drop to it, so there is exactly one place that decides whether a placement
  // is allowed.
  const accept = (code: string) => {
    if (code && lookup(code)) onPlace(code, term)
  }

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = dropBlocked ? 'none' : 'move'
        setDropTarget(term)
      }}
      onDragLeave={() => setDropTarget(null)}
      onDrop={(e) => {
        e.preventDefault()
        setDropTarget(null)
        accept(e.dataTransfer.getData('text/plain'))
      }}
      onClick={() => onFocusTerm(term)}
      className={cn(
        '@container/term flex flex-col rounded-lg border bg-card transition-colors',
        focused && 'ring-2 ring-primary/30',
        isDropTarget && !dropBlocked && 'border-primary bg-primary/5',
        isDropTarget && dropBlocked && 'border-destructive bg-destructive/5',
        summary?.overCap && 'border-destructive',
      )}
      aria-label={termLabel(term)}
    >
      {/* one line of chrome */}
      <header className="flex items-center gap-2 px-3 pt-2.5 pb-2">
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium">{termLabel(term)}</h3>

        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'flex shrink-0 items-center gap-1 text-[11px]',
                summary?.overCap ? 'font-semibold text-destructive' : 'text-muted-foreground',
              )}
            >
              <BookOpen className="size-3" aria-hidden />
              <span className="mono">
                {courseCount}/{maxCourses}
              </span>
              <span className="opacity-40">·</span>
              <span className="mono">{hours}h</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {seasonOf(term) === 'SU' ? 'Summer' : 'Fall and Spring'} allow {maxCourses}{' '}
            {maxCourses === 1 ? 'course' : 'courses'} and {cap} credit hours.
          </TooltipContent>
        </Tooltip>

        {showCost && hours > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="mono hidden shrink-0 text-[11px] text-muted-foreground @[15rem]/term:inline">
                {money(cost.total)}
                {cost.estimated && <span className="opacity-50">*</span>}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {hours} hrs × {money(cost.perCreditHour)} = {money(cost.tuition)} tuition +{' '}
              {money(cost.onlineLearningFee)} online learning fee — {rateSummary(term)}.
            </TooltipContent>
          </Tooltip>
        )}

        {summary?.overCap && (
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertTriangle className="size-3.5 shrink-0 text-destructive" aria-label="Over the cap" />
            </TooltipTrigger>
            <TooltipContent>
              {hours} hours against a {cap}-hour cap. Banner will refuse this registration.
            </TooltipContent>
          </Tooltip>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 text-muted-foreground"
              onClick={(e) => e.stopPropagation()}
              aria-label={`Details for ${termLabel(term)}`}
            >
              <Info className="size-3.5" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 space-y-3 text-xs">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Credit hours</span>
                <span className="mono">
                  {hours} / {cap}
                </span>
              </div>
              {showWorkload && summary && summary.workloadHoursPerWeek > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated workload</span>
                  <span className="mono">≈{Math.round(summary.workloadHoursPerWeek)} hrs/week</span>
                </div>
              )}
              {showCost && hours > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tuition</span>
                    <span className="mono">{money(cost.tuition)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Online learning fee</span>
                    <span className="mono">{money(cost.onlineLearningFee)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Federal loan eligibility</span>
                <span>{cost.loanEligible ? 'half-time' : 'below half-time'}</span>
              </div>
              {inWindow && (
                <div className="pt-1 text-muted-foreground">
                  Inside the foundational window — two foundational courses must be finished by{' '}
                  {termLabel(validation.foundationalWindow[validation.foundationalWindow.length - 1])}.
                </div>
              )}
            </div>

            {cal && (
              <>
                <Separator />
                <ul className="space-y-1">
                  {cal.dates
                    .filter((d) => d.kind === 'payment' || d.kind === 'deadline')
                    .map((d) => (
                      <li key={d.date} className="flex gap-2">
                        <span className="mono shrink-0 text-muted-foreground">{d.date.slice(5)}</span>
                        <span>
                          {d.label}
                          {d.note ? ` (${d.note})` : ''}
                        </span>
                      </li>
                    ))}
                </ul>
                <a
                  href={CALENDAR.registrarUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <CalendarDays className="size-3" aria-hidden />
                  Full academic calendar
                </a>
              </>
            )}
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 text-muted-foreground"
              onClick={(e) => e.stopPropagation()}
              aria-label={`More actions for ${termLabel(term)}`}
            >
              <MoreHorizontal className="size-3.5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setNoteOpen((o) => !o)}>
              <StickyNote className="size-3.5" aria-hidden />
              {note ? 'Edit note' : 'Add note'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={!placements.length}
              onClick={() => onClearTerm(term)}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Clear term
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {showWorkload && summary && summary.workloadHoursPerWeek > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="px-3 pb-2">
              <IntensityBar
                value={summary.workloadHoursPerWeek}
                max={RULES.workload.comfortableHoursPerWeek}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            ≈{Math.round(summary.workloadHoursPerWeek)} hrs/week from OMSCentral self-reports,
            against a {RULES.workload.comfortableHoursPerWeek}-hour comfortable load.
          </TooltipContent>
        </Tooltip>
      )}

      <Separator />

      <div className="flex-1 space-y-1 p-2">
        {placements.map((p) => {
          const entry = lookup(p.code)
          const slot = slotByCode.get(p.code)
          const seminar = isSeminarCode(p.code)
          const course = COURSE_BY_CODE.get(p.code)
          // A hard failure tints the card; an advisory only earns a quiet icon, so
          // red stays reserved for rules the program will actually refuse.
          const broken = validation.checks.some(
            (c) => c.status === 'fail' && c.offenders?.includes(p.code),
          )
          const advisory = validation.checks.find(
            (c) => c.status === 'warn' && c.id !== 'background' && c.offenders?.includes(p.code),
          )
          return (
            <div
              key={p.code}
              role="button"
              tabIndex={0}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', p.code)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onClick={(e) => {
                e.stopPropagation()
                onOpenCourse(p.code)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onOpenCourse(p.code)
                }
              }}
              className={cn(
                'group flex cursor-grab items-center gap-2 rounded-md border-l-2 px-2 py-1.5 transition-colors hover:bg-accent',
                seminar ? 'border-l-border' : slot ? 'border-l-primary' : 'border-l-gold-surface',
                broken && 'bg-destructive/5',
              )}
            >
              <span className="mono shrink-0 text-[12px] font-semibold">{p.code}</span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
                {entry?.title}
              </span>
              {validation.trackGrades && p.grade && (
                <Badge variant="outline" className="mono h-4 px-1 text-[10px]">
                  {p.grade}
                </Badge>
              )}
              {course?.foundational && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Award className="size-3 shrink-0 text-gold" aria-label="Foundational" />
                  </TooltipTrigger>
                  <TooltipContent>Foundational course</TooltipContent>
                </Tooltip>
              )}
              {advisory && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle
                      className={cn(
                        'size-3 shrink-0',
                        broken ? 'text-destructive' : 'text-muted-foreground',
                      )}
                      aria-label={advisory.label}
                    />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64">{advisory.detail}</TooltipContent>
                </Tooltip>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-5 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(p.code)
                }}
                aria-label={`Remove ${p.code}`}
              >
                <Trash2 className="size-3" aria-hidden />
              </Button>
            </div>
          )
        })}

        {placements.length === 0 && !dragging && (
          <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">
            {focused ? 'Pick a course from the library' : 'Empty'}
          </p>
        )}

        {dragging && (
          <div
            className={cn(
              'rounded-md border border-dashed px-2 py-2 text-center text-[11px]',
              dropBlocked ? 'border-destructive text-destructive' : 'border-primary text-primary',
            )}
          >
            {dropBlocked ? (wouldReject?.limit === 'courses' ? 'Course limit reached' : 'Hour cap reached') : 'Drop here'}
          </div>
        )}
      </div>

      {(noteOpen || note) && (
        <>
          <Separator />
          <div className="p-2">
            <Textarea
              value={note}
              onChange={(e) => onNote(term, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Note…"
              rows={2}
              className="min-h-0 resize-none border-0 bg-transparent p-1 !text-xs leading-relaxed shadow-none focus-visible:ring-0"
              aria-label={`Note for ${termLabel(term)}`}
            />
          </div>
        </>
      )}
    </section>
  )
}
