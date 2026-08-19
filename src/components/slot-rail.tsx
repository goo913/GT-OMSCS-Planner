import { Fragment } from 'react'
import { GraduationCap } from 'lucide-react'
import type { Plan } from '@/types'
import type { Slot, Validation } from '@/lib/validate'
import { COURSE_BY_CODE } from '@/lib/catalog'
import { placementOf } from '@/lib/plan'
import { termLabel, termShortLabel } from '@/lib/terms'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * Ten squares in one row: the whole degree, at a glance.
 *
 * The rail is an instrument, not a readout. A filled square jumps the board to that
 * course; an empty one filters the library down to exactly the courses that can fill
 * it. Group membership is a hairline separator plus a tooltip, not a stack of headers.
 */
export interface RailCell {
  key: string
  code: string | null
  kind: 'core' | 'elective' | 'free'
  group: string
  /** Sub-area restriction where the specialization names one. */
  restriction: string | null
  /** Codes that could fill this slot, for the click-to-filter action. */
  eligible: string[]
  /** First square of its group — draws the separator. */
  startsGroup: boolean
  /** Placed but beyond what the degree needs. */
  surplus?: boolean
}

export function buildRailCells(validation: Validation): RailCell[] {
  const cells: RailCell[] = []
  let lastGroup = ''
  for (const slot of validation.slots as Slot[]) {
    cells.push({
      key: slot.id,
      code: slot.filledBy,
      kind: slot.section,
      group: slot.group,
      restriction: slot.restriction,
      eligible: slot.eligible,
      startsGroup: slot.groupId !== lastGroup,
    })
    lastGroup = slot.groupId
  }

  const { freeElectives, freeElectivesNeeded } = validation
  const total = Math.max(freeElectivesNeeded, freeElectives.length)
  for (let i = 0; i < total; i++) {
    cells.push({
      key: `free-${i}`,
      code: freeElectives[i] ?? null,
      kind: 'free',
      group: 'Free electives',
      restriction: null,
      eligible: [],
      startsGroup: i === 0,
      surplus: i >= freeElectivesNeeded,
    })
  }
  return cells
}

export function SlotRail({
  plan,
  validation,
  onOpenCourse,
  onFilterToSlot,
  className,
}: {
  plan: Plan
  validation: Validation
  onOpenCourse: (code: string) => void
  onFilterToSlot: (cell: RailCell) => void
  className?: string
}) {
  const cells = buildRailCells(validation)
  const filled = cells.filter((c) => c.code && !c.surplus).length
  const needed = cells.filter((c) => !c.surplus).length

  return (
    <div className={cn('flex items-center gap-3 overflow-x-auto no-scrollbar', className)}>
      <div className="flex items-center gap-1">
        {cells.map((cell) => (
          <Fragment key={cell.key}>
            {cell.startsGroup && cells[0].key !== cell.key && (
              <span className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden />
            )}
            <SlotSquare
              cell={cell}
              plan={plan}
              onOpenCourse={onOpenCourse}
              onFilterToSlot={onFilterToSlot}
            />
          </Fragment>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
        <span className="mono text-foreground">
          {filled}/{needed}
        </span>
        <span className="hidden sm:inline">slots</span>
        <span className="text-border">·</span>
        <span className="mono">
          {validation.countedCreditHours}/30
        </span>
        <span className="hidden sm:inline">hrs</span>
        {validation.earliestCompletion && (
          <>
            <span className="text-border">·</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1">
                  <GraduationCap className="size-3.5" aria-hidden />
                  <span className="mono">{termShortLabel(validation.earliestCompletion)}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Earliest possible completion at the per-term caps:{' '}
                {termLabel(validation.earliestCompletion)}
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  )
}

function SlotSquare({
  cell,
  plan,
  onOpenCourse,
  onFilterToSlot,
}: {
  cell: RailCell
  plan: Plan
  onOpenCourse: (code: string) => void
  onFilterToSlot: (cell: RailCell) => void
}) {
  const base =
    'group relative flex h-9 w-[4.25rem] shrink-0 flex-col items-start justify-center rounded-md ' +
    'border px-1.5 text-left transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none'

  if (!cell.code) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onFilterToSlot(cell)}
            className={cn(
              base,
              'border-dashed border-border bg-transparent text-muted-foreground hover:border-primary hover:text-primary',
            )}
            aria-label={`Empty slot: ${cell.restriction ?? cell.group}. Show the courses that fit.`}
          >
            <span className="mono text-[11px] opacity-50">——</span>
            <span className="w-full truncate text-[9px] leading-tight opacity-70">
              {cell.restriction ?? cell.group}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-56">
          <div className="font-medium">{cell.restriction ?? cell.group}</div>
          <div className="opacity-80">
            {cell.kind === 'free'
              ? 'Any OMSCS course not already used by the specialization.'
              : `One of ${cell.eligible.length} courses.`}
          </div>
          <div className="mt-1 opacity-60">Click to filter the library to what fits.</div>
        </TooltipContent>
      </Tooltip>
    )
  }

  const placement = placementOf(plan, cell.code)
  const course = COURSE_BY_CODE.get(cell.code)

  return (
    <HoverCard openDelay={120} closeDelay={60}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={() => onOpenCourse(cell.code!)}
          className={cn(
            base,
            cell.kind === 'free'
              ? 'border-gold-surface bg-gold-surface text-gold-foreground hover:brightness-95'
              : 'border-primary bg-primary text-primary-foreground hover:brightness-110',
            cell.surplus && 'opacity-55',
          )}
          aria-label={`${cell.code} — ${course?.title ?? ''}`}
        >
          <span className="mono w-full truncate text-[11px] font-semibold leading-tight">
            {cell.code}
          </span>
          <span className="mono text-[9px] leading-tight opacity-75">
            {placement ? termShortLabel(placement.term) : ''}
            {placement?.grade ? ` · ${placement.grade}` : ''}
          </span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-72" side="bottom" align="start">
        <div className="mono text-xs font-semibold">{cell.code}</div>
        <div className="text-sm leading-snug">{course?.title}</div>
        <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          <div>
            {cell.restriction ? `${cell.group} · ${cell.restriction}` : cell.group}
            {cell.surplus && ' — beyond what the degree needs'}
          </div>
          {placement && <div>Planned for {termLabel(placement.term)}</div>}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
