import { useMemo, useState } from 'react'
import { Award, Filter, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import type { Course, Plan, Seminar, TermId } from '@/types'
import { COURSES, SEMINARS, SPEC_BY_ID, offeringSummary } from '@/lib/catalog'
import { checkCap } from '@/lib/placement'
import { placementOf } from '@/lib/plan'
import { termLabel, termShortLabel } from '@/lib/terms'
import { MetricRow } from '@/components/metric'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type LibrarySort = 'relevance' | 'code' | 'rating' | 'difficulty' | 'workload' | 'reviews'

export interface LibraryFilter {
  q: string
  toggles: string[]
  season: 'any' | 'FA' | 'SP' | 'SU'
  maxDifficulty: number
  sort: LibrarySort
  /** Set by clicking an empty slot on the rail: show only what fits that slot. */
  slotCodes: string[] | null
  slotLabel: string | null
}

export const EMPTY_FILTER: LibraryFilter = {
  q: '',
  toggles: [],
  season: 'any',
  maxDifficulty: 5,
  sort: 'relevance',
  slotCodes: null,
  slotLabel: null,
}

const SORTS: { id: LibrarySort; label: string }[] = [
  { id: 'relevance', label: 'Relevance' },
  { id: 'code', label: 'Code' },
  { id: 'rating', label: 'Rating' },
  { id: 'difficulty', label: 'Difficulty' },
  { id: 'workload', label: 'Workload' },
  { id: 'reviews', label: 'Reviews' },
]

function relevance(course: Course, specId: string): number {
  const spec = SPEC_BY_ID.get(specId)
  const named = spec?.groups.some((g) => g.courses.includes(course.code)) ?? false
  const role = course.gtSpecRoles[specId]
  if (named && role === 'core') return 0
  if (named) return 1
  if (course.foundational) return 3
  return 4
}

export function LibraryPanel({
  plan,
  filter,
  setFilter,
  focusedTerm,
  onOpenCourse,
  onPlace,
  onDragCode,
}: {
  plan: Plan
  filter: LibraryFilter
  setFilter: (f: LibraryFilter) => void
  focusedTerm: TermId | null
  onOpenCourse: (code: string) => void
  onPlace: (code: string, term: TermId) => void
  onDragCode: (code: string | null) => void
}) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const spec = SPEC_BY_ID.get(plan.specialization)
  const specCodes = useMemo(
    () => new Set(spec ? spec.groups.flatMap((g) => g.courses) : []),
    [spec],
  )

  const showSeminars = filter.toggles.includes('seminars')

  const courses = useMemo(() => {
    const q = filter.q.trim().toLowerCase()
    const words = q.split(/\s+/).filter(Boolean)
    const slotSet = filter.slotCodes ? new Set(filter.slotCodes) : null

    const out = COURSES.filter((c) => {
      if (slotSet && slotSet.size && !slotSet.has(c.code)) return false
      if (filter.toggles.includes('foundational') && !c.foundational) return false
      if (filter.toggles.includes('spec') && !specCodes.has(c.code)) return false
      if (filter.toggles.includes('cscse') && !c.isCsCse) return false
      if (filter.toggles.includes('unplaced') && placementOf(plan, c.code)) return false
      if (filter.season !== 'any') {
        const o = c.offerings
        const ok = filter.season === 'FA' ? o.fall : filter.season === 'SP' ? o.spring : o.summer
        if (!ok) return false
      }
      if (filter.maxDifficulty < 5 && (c.omscentral?.difficulty ?? 0) > filter.maxDifficulty) return false
      if (!words.length) return true
      const hay = `${c.code} ${c.title} ${c.omscentral?.tags?.join(' ') ?? ''} ${c.overview ?? ''}`.toLowerCase()
      return words.every((w) => hay.includes(w))
    })

    const cmp: Record<LibrarySort, (a: Course, b: Course) => number> = {
      code: (a, b) => a.code.localeCompare(b.code),
      rating: (a, b) => (b.omscentral?.rating ?? -1) - (a.omscentral?.rating ?? -1),
      difficulty: (a, b) => (a.omscentral?.difficulty ?? 99) - (b.omscentral?.difficulty ?? 99),
      workload: (a, b) => (a.omscentral?.workload ?? 999) - (b.omscentral?.workload ?? 999),
      reviews: (a, b) => (b.omscentral?.reviewCount ?? 0) - (a.omscentral?.reviewCount ?? 0),
      relevance: (a, b) =>
        relevance(a, plan.specialization) - relevance(b, plan.specialization) ||
        (b.omscentral?.rating ?? 0) - (a.omscentral?.rating ?? 0),
    }
    return out.sort((a, b) => cmp[filter.sort](a, b) || a.code.localeCompare(b.code))
  }, [filter, plan, specCodes])

  const seminars = useMemo(() => {
    const q = filter.q.trim().toLowerCase()
    return SEMINARS.filter(
      (s) => s.status === 'scheduled' && (!q || `${s.code} ${s.title}`.toLowerCase().includes(q)),
    )
  }, [filter.q])

  const advancedCount =
    (filter.season !== 'any' ? 1 : 0) + (filter.maxDifficulty < 5 ? 1 : 0) + (filter.sort !== 'relevance' ? 1 : 0)

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      <div className="space-y-2 border-b p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={filter.q}
            onChange={(e) => setFilter({ ...filter, q: e.target.value })}
            placeholder="Search courses…"
            className="h-8 pl-8 text-sm"
            aria-label="Search courses"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <ToggleGroup
            type="multiple"
            size="sm"
            variant="outline"
            value={filter.toggles}
            onValueChange={(v) => setFilter({ ...filter, toggles: v })}
            className="flex-1"
          >
            <ToggleGroupItem value="foundational" aria-label="Foundational courses only" className="px-2 text-xs">
              <Award className="size-3" aria-hidden />
            </ToggleGroupItem>
            <ToggleGroupItem value="spec" aria-label={`Counts for ${spec?.short}`} className="px-2 text-xs">
              {spec?.short}
            </ToggleGroupItem>
            <ToggleGroupItem value="unplaced" aria-label="Not yet placed" className="px-2 text-xs">
              New
            </ToggleGroupItem>
            <ToggleGroupItem value="cscse" aria-label="CS and CSE only" className="px-2 text-xs">
              CS
            </ToggleGroupItem>
            <ToggleGroupItem value="seminars" aria-label="Seminars" className="px-2 text-xs">
              CS&nbsp;8001
            </ToggleGroupItem>
          </ToggleGroup>

          <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="relative h-8 px-2">
                <SlidersHorizontal className="size-3.5" aria-hidden />
                {advancedCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground">
                    {advancedCount}
                  </span>
                )}
                <span className="sr-only">Filters</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Runs in</Label>
                <Select
                  value={filter.season}
                  onValueChange={(v) => setFilter({ ...filter, season: v as LibraryFilter['season'] })}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any term</SelectItem>
                    <SelectItem value="FA">Fall</SelectItem>
                    <SelectItem value="SP">Spring</SelectItem>
                    <SelectItem value="SU">Summer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sort by</Label>
                <Select
                  value={filter.sort}
                  onValueChange={(v) => setFilter({ ...filter, sort: v as LibrarySort })}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORTS.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center justify-between text-xs">
                  Max difficulty
                  <span className="mono text-muted-foreground">
                    {filter.maxDifficulty === 5 ? 'any' : filter.maxDifficulty.toFixed(1)}
                  </span>
                </Label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={0.5}
                  value={filter.maxDifficulty}
                  onChange={(e) => setFilter({ ...filter, maxDifficulty: Number(e.target.value) })}
                  className="w-full accent-primary"
                  aria-label="Maximum difficulty"
                />
              </div>
              {advancedCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    setFilter({ ...filter, season: 'any', maxDifficulty: 5, sort: 'relevance' })
                  }
                >
                  Reset filters
                </Button>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {filter.slotLabel && (
          <div className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-2 py-1 text-xs">
            <Filter className="size-3 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1 truncate">
              Fits <span className="font-medium">{filter.slotLabel}</span>
            </span>
            <button
              type="button"
              onClick={() => setFilter({ ...filter, slotCodes: null, slotLabel: null })}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Clear slot filter"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      <ScrollArea className="min-h-0 w-full flex-1 [&>[data-radix-scroll-area-viewport]>div]:!block">
        <div className="divide-y">
          {showSeminars
            ? seminars.map((s) => (
                <SeminarRow
                  key={s.code}
                  seminar={s}
                  plan={plan}
                  focusedTerm={focusedTerm}
                  onOpenCourse={onOpenCourse}
                  onPlace={onPlace}
                  onDragCode={onDragCode}
                />
              ))
            : courses.map((c, i) => {
                const relevant = specCodes.has(c.code)
                const divider =
                  filter.sort === 'relevance' &&
                  !filter.slotCodes &&
                  (i === 0 || specCodes.has(courses[i - 1].code) !== relevant)
                return (
                  <div key={c.code}>
                    {divider && (
                      <div className="bg-muted/60 px-3 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                        {relevant ? `Counts toward ${spec?.short}` : 'Free electives'}
                      </div>
                    )}
                    <CourseRow
                      course={c}
                      plan={plan}
                      focusedTerm={focusedTerm}
                      onOpenCourse={onOpenCourse}
                      onPlace={onPlace}
                      onDragCode={onDragCode}
                    />
                  </div>
                )
              })}
          {!showSeminars && courses.length === 0 && (
            <div className="space-y-2 p-6 text-center">
              <p className="text-sm text-muted-foreground">Nothing matches those filters.</p>
              <Button variant="outline" size="sm" onClick={() => setFilter(EMPTY_FILTER)}>
                Clear filters
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
        <span className="mono">{showSeminars ? seminars.length : courses.length}</span> of{' '}
        <span className="mono">{showSeminars ? SEMINARS.filter((s) => s.status === 'scheduled').length : COURSES.length}</span>
      </div>
    </div>
  )
}

function CourseRow({
  course,
  plan,
  focusedTerm,
  onOpenCourse,
  onPlace,
  onDragCode,
}: {
  course: Course
  plan: Plan
  focusedTerm: TermId | null
  onOpenCourse: (code: string) => void
  onPlace: (code: string, term: TermId) => void
  onDragCode: (code: string | null) => void
}) {
  const placement = placementOf(plan, course.code)
  const oc = course.omscentral
  const cap = focusedTerm ? checkCap(plan, course.code, focusedTerm) : null
  const canAdd = Boolean(focusedTerm) && (cap?.ok ?? false)

  return (
    <HoverCard openDelay={420} closeDelay={80}>
      <HoverCardTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', course.code)
            e.dataTransfer.effectAllowed = 'move'
            onDragCode(course.code)
          }}
          onDragEnd={() => onDragCode(null)}
          onClick={() => onOpenCourse(course.code)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onOpenCourse(course.code)
            }
          }}
          className={cn(
            'group flex cursor-grab items-start gap-2 px-3 py-2 transition-colors hover:bg-accent/60',
            'focus-visible:bg-accent focus-visible:outline-none',
            placement && 'border-l-2 border-l-primary',
          )}
        >
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="mono text-[12px] font-semibold">{course.code}</span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
                {course.title}
              </span>
            </div>
            <div className="flex min-w-0 flex-wrap items-end gap-x-3 gap-y-1">
              <MetricRow
                rating={oc?.rating}
                difficulty={oc?.difficulty}
                workload={oc?.workload}
              />
              <div className="flex items-center gap-1.5 pb-0.5">
                {course.foundational && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Award className="size-3 text-gold" aria-label="Foundational" />
                    </TooltipTrigger>
                    <TooltipContent>Foundational course</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="mono text-[10px] text-muted-foreground">
                      {course.offerings.known
                        ? [
                            course.offerings.fall && 'F',
                            course.offerings.spring && 'Sp',
                            course.offerings.summer && 'Su',
                          ]
                            .filter(Boolean)
                            .join('·') || '—'
                        : '?'}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{offeringSummary(course)}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>

          {placement ? (
            <Badge variant="secondary" className="mono mt-0.5 shrink-0 text-[10px]">
              {termShortLabel(placement.term)}
            </Badge>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={!canAdd}
                    className="mt-0.5 size-6 shrink-0 text-muted-foreground opacity-70 group-hover:opacity-100 group-hover:text-foreground disabled:opacity-30"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (focusedTerm && canAdd) onPlace(course.code, focusedTerm)
                    }}
                    aria-label={
                      focusedTerm ? `Add ${course.code} to ${termLabel(focusedTerm)}` : 'Choose a term first'
                    }
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {!focusedTerm
                  ? 'Select a term on the board first'
                  : cap && !cap.ok
                    ? cap.reason
                    : `Add to ${termLabel(focusedTerm)}`}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="right" align="start" className="w-80">
        <div className="mono text-xs font-semibold">{course.code}</div>
        <div className="mb-2 text-sm leading-snug">{course.title}</div>
        {course.overview && (
          <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground">
            {course.overview}
          </p>
        )}
        <Separator className="my-2" />
        <p className="text-xs text-muted-foreground">
          {course.gtSpecRoles[plan.specialization]
            ? `Counts as a ${SPEC_BY_ID.get(plan.specialization)?.short} ${course.gtSpecRoles[plan.specialization]} course.`
            : 'Free elective under the current specialization.'}
        </p>
      </HoverCardContent>
    </HoverCard>
  )
}

function SeminarRow({
  seminar,
  plan,
  focusedTerm,
  onOpenCourse,
  onPlace,
  onDragCode,
}: {
  seminar: Seminar
  plan: Plan
  focusedTerm: TermId | null
  onOpenCourse: (code: string) => void
  onPlace: (code: string, term: TermId) => void
  onDragCode: (code: string | null) => void
}) {
  const placement = placementOf(plan, seminar.code)
  const cap = focusedTerm ? checkCap(plan, seminar.code, focusedTerm) : null
  const canAdd = Boolean(focusedTerm) && (cap?.ok ?? false)
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', seminar.code)
        onDragCode(seminar.code)
      }}
      onDragEnd={() => onDragCode(null)}
      onClick={() => onOpenCourse(seminar.code)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpenCourse(seminar.code)
      }}
      className={cn(
        'group flex cursor-grab items-start gap-2 px-3 py-2 hover:bg-accent/60',
        placement && 'border-l-2 border-l-primary',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="mono text-[12px] font-semibold">{seminar.code}</span>
          <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
            {seminar.title}
          </span>
        </div>
        <div className="mono text-[10px] text-muted-foreground">
          1 hr · pass/fail · not counted toward the degree
        </div>
      </div>
      {placement ? (
        <Badge variant="secondary" className="mono shrink-0 text-[10px]">
          {termShortLabel(placement.term)}
        </Badge>
      ) : (
        <Button
          size="icon"
          variant="ghost"
          disabled={!canAdd}
          className="size-6 shrink-0 text-muted-foreground opacity-70 group-hover:opacity-100 disabled:opacity-30"
          onClick={(e) => {
            e.stopPropagation()
            if (focusedTerm && canAdd) onPlace(seminar.code, focusedTerm)
          }}
          aria-label={focusedTerm ? `Add ${seminar.code} to ${termLabel(focusedTerm)}` : 'Choose a term'}
        >
          <Plus className="size-3.5" aria-hidden />
        </Button>
      )}
    </div>
  )
}
