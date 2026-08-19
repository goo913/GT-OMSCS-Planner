import { useState } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleDashed,
  DollarSign,
  Info,
  Target,
} from 'lucide-react'
import type { Plan, TermId } from '@/types'
import type { Check as RuleCheck, Validation } from '@/lib/validate'
import { RULES } from '@/lib/catalog'
import { TUITION_NOTES, costForTerm, feeCliff, money, ratesFor } from '@/lib/cost'
import { termFromIndex, termIndex, termLabel } from '@/lib/terms'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * One line per requirement. The rule text, the derivation, and every "why is this
 * number what it is" explanation lives behind a popover attached to the thing it
 * explains — never as a paragraph on the screen.
 */
export function RequirementsPanel({
  plan,
  validation,
  showCost,
  onTarget,
}: {
  plan: Plan
  validation: Validation
  showCost: boolean
  onTarget: (t: TermId | null) => void
}) {
  const violations = validation.checks.filter((c) => c.status === 'fail')
  const hard = validation.checks.filter((c) => c.severity === 'hard' && c.status !== 'fail')
  const soft = validation.checks.filter((c) => c.severity === 'soft' && c.status !== 'fail')

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      <Verdict validation={validation} />
      <ScrollArea className="min-h-0 w-full flex-1 [&>[data-radix-scroll-area-viewport]>div]:!block">
        <div className="space-y-1 p-2">
          {violations.length > 0 && (
            <section className="mb-2 space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-1.5">
              {violations.map((c) => (
                <CheckRow key={c.id} check={c} />
              ))}
            </section>
          )}

          {hard.map((c) => (
            <CheckRow key={c.id} check={c} />
          ))}

          {soft.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent">
                <ChevronDown
                  className="size-3 transition-transform group-data-[state=closed]:-rotate-90"
                  aria-hidden
                />
                Advisories
                <Badge variant="secondary" className="ml-auto h-4 px-1.5 text-[10px]">
                  {soft.filter((c) => c.status === 'warn').length}
                </Badge>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pt-1">
                {soft.map((c) => (
                  <CheckRow key={c.id} check={c} />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          <Separator className="my-2" />
          <Pacing plan={plan} validation={validation} onTarget={onTarget} />

          {showCost && (
            <>
              <Separator className="my-2" />
              <CostSummary validation={validation} />
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function Verdict({ validation }: { validation: Validation }) {
  const { verdict } = validation
  const tone =
    verdict.status === 'fail'
      ? 'text-destructive'
      : verdict.status === 'ok'
        ? 'text-primary'
        : 'text-foreground'
  return (
    <div className="border-b px-3 py-3">
      <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
        Can I graduate?
      </div>
      <div className={cn('text-base leading-snug font-medium', tone)}>{verdict.headline}</div>
      <p className="mt-0.5 text-xs text-muted-foreground">{verdict.detail}</p>
    </div>
  )
}

function StatusIcon({ status }: { status: RuleCheck['status'] }) {
  if (status === 'fail') return <AlertTriangle className="size-3.5 shrink-0 text-destructive" aria-hidden />
  if (status === 'ok') return <Check className="size-3.5 shrink-0 text-primary" aria-hidden />
  if (status === 'warn') return <Info className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
  return <CircleDashed className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
}

function CheckRow({ check }: { check: RuleCheck }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent',
            'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
          )}
        >
          <StatusIcon status={check.status} />
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-xs',
              check.status === 'fail' && 'font-medium text-destructive',
            )}
          >
            {check.label}
          </span>
          {check.have !== undefined && check.need !== undefined && (
            <span className="mono shrink-0 text-[11px] text-muted-foreground">
              {check.have}/{check.need}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="left" className="w-80 space-y-2">
        <div className="flex items-center gap-2">
          <StatusIcon status={check.status} />
          <span className="text-sm font-medium">{check.label}</span>
        </div>
        {check.have !== undefined && check.need !== undefined && (
          <div className="mono text-xs text-muted-foreground">
            {check.have} of {check.need} {check.unit ?? ''}
          </div>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">{check.detail}</p>
        {check.severity === 'soft' && (
          <p className="text-[11px] text-muted-foreground/70">
            Advisory — this never blocks a placement.
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}

function Pacing({
  plan,
  validation,
  onTarget,
}: {
  plan: Plan
  validation: Validation
  onTarget: (t: TermId | null) => void
}) {
  const { earliestCompletion, slackTerms, remainingCourses } = validation
  const start = earliestCompletion ?? plan.matriculationTerm
  // The currently-set target has to stay in the list even when it is now behind the
  // earliest possible finish — otherwise the Select renders blank and the plan looks
  // like it has no target at exactly the moment the target became unreachable.
  const options = [...new Set([
    ...(plan.targetGraduationTerm ? [plan.targetGraduationTerm] : []),
    ...Array.from({ length: 13 }, (_, i) => termFromIndex(termIndex(start) + i)),
  ])].sort((a, b) => termIndex(a) - termIndex(b))

  const infeasible = slackTerms !== null && slackTerms < 0
  const zeroSlack = slackTerms === 0 && remainingCourses > 0

  return (
    <div className="space-y-2 px-2">
      <div className="flex items-center gap-2">
        <Target className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex-1 text-xs text-muted-foreground">Target</span>
        <Select
          value={plan.targetGraduationTerm ?? 'none'}
          onValueChange={(v) => onTarget(v === 'none' ? null : v)}
        >
          <SelectTrigger size="sm" className="h-7 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No target</SelectItem>
            {options.map((t) => (
              <SelectItem key={t} value={t}>
                {termLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {infeasible && (
        <p className="rounded-md bg-destructive/10 px-2 py-1.5 text-[11px] leading-relaxed text-destructive">
          Not reachable — {remainingCourses} course{remainingCourses === 1 ? '' : 's'} left puts the
          earliest finish at {termLabel(earliestCompletion!)}.
        </p>
      )}
      {zeroSlack && (
        <p className="rounded-md bg-gold-muted px-2 py-1.5 text-[11px] leading-relaxed text-gold">
          Zero slack — every remaining term runs at the cap, so one dropped course costs a full term.
        </p>
      )}
      {!infeasible && !zeroSlack && slackTerms !== null && slackTerms > 0 && (
        <p className="px-2 text-[11px] text-muted-foreground">
          {slackTerms} spare term{slackTerms === 1 ? '' : 's'} against the target.
        </p>
      )}
    </div>
  )
}

function CostSummary({ validation }: { validation: Validation }) {
  const [open, setOpen] = useState(false)
  const rows = validation.terms
    .filter((t) => t.creditHours > 0)
    .map((t) => costForTerm(t.term, t.creditHours))
  const total = rows.reduce((n, r) => n + r.total, 0)
  const estimated = rows.filter((r) => r.estimated).reduce((n, r) => n + r.total, 0)
  const belowHalf = rows.filter((r) => !r.loanEligible)
  const cliffTerm = rows.find((r) => !r.estimated)?.term ?? '2026FA'
  const cliff = feeCliff(cliffTerm)
  const rate = ratesFor(cliffTerm)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent">
        <DollarSign className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex-1 text-xs">Estimated total</span>
        <span className="mono text-xs font-medium">{money(total)}</span>
        <ChevronDown
          className="size-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 pt-2">
        {rows.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Place a course to see what it costs.</p>
        ) : (
          <Table className="text-[11px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-6 px-1">Term</TableHead>
                <TableHead className="h-6 px-1 text-right">Hrs</TableHead>
                <TableHead className="h-6 px-1 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.term} className="hover:bg-transparent">
                  <TableCell className="px-1 py-1">
                    <span className={r.estimated ? 'text-muted-foreground' : ''}>
                      {termLabel(r.term)}
                    </span>
                    {r.estimated && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="ml-1 cursor-help text-muted-foreground">*</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-64">
                          Georgia Tech has not published rates for this term. Carried forward from{' '}
                          {termLabel(r.basedOn)} — each season carries forward from its own most
                          recent sheet, because Summer runs a lower online learning fee.
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {!r.loanEligible && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="mono ml-1 cursor-help text-muted-foreground">&lt;½</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-64">{RULES.financialAid.note}</TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell className="mono px-1 py-1 text-right">{r.creditHours}</TableCell>
                  <TableCell className="mono px-1 py-1 text-right">{money(r.total)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 hover:bg-transparent">
                <TableCell className="px-1 py-1 font-medium">Total</TableCell>
                <TableCell className="mono px-1 py-1 text-right font-medium">
                  {rows.reduce((n, r) => n + r.creditHours, 0)}
                </TableCell>
                <TableCell className="mono px-1 py-1 text-right font-medium">{money(total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}

        <div className="mt-2 flex flex-wrap gap-1.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px]">
                <Info className="size-3" aria-hidden />
                Fee cliff
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 text-xs leading-relaxed" side="left">
              The online learning fee jumps from{' '}
              <span className="mono">{money(rate.onlineLearningFee.under4Hours)}</span> to{' '}
              <span className="mono">{money(rate.onlineLearningFee.atLeast4Hours)}</span> at 4 credit
              hours, so in {termLabel(cliffTerm)} the second course in a term costs{' '}
              <span className="mono">{money(cliff.marginal)}</span> — more than the first course
              costs on its own (<span className="mono">{money(cliff.oneCourse)}</span>).
            </PopoverContent>
          </Popover>

          {estimated > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px]">
                  <Info className="size-3" aria-hidden />
                  {money(estimated)} estimated
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 text-xs leading-relaxed" side="left">
                That much of the total uses carried-forward rates because Georgia Tech has not
                published those terms yet.
              </PopoverContent>
            </Popover>
          )}

          {belowHalf.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px]">
                  <Info className="size-3" aria-hidden />
                  {belowHalf.length} below half-time
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 text-xs leading-relaxed" side="left">
                {belowHalf.map((r) => termLabel(r.term)).join(', ')}. {RULES.financialAid.note}
              </PopoverContent>
            </Popover>
          )}
        </div>

        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/70">
          {TUITION_NOTES[0]} {RULES.financialAid.disclaimer}
        </p>
      </CollapsibleContent>
    </Collapsible>
  )
}
