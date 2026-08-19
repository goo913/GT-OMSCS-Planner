import { Clock, Gauge, MessageSquare, Star } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * Rating, difficulty, workload, reviews — every number carries its icon, and the
 * bar under it reads as neutral *intensity* rather than hue. Darker means more.
 * That keeps red and green off the screen entirely and makes two courses easier to
 * compare than three differently-coloured bars ever were.
 */
export type MetricKind = 'rating' | 'difficulty' | 'workload' | 'reviews'

const META: Record<
  MetricKind,
  { Icon: typeof Star; label: string; max: number; suffix: string; decimals: number }
> = {
  rating: { Icon: Star, label: 'Rating', max: 5, suffix: '', decimals: 2 },
  difficulty: { Icon: Gauge, label: 'Difficulty', max: 5, suffix: '', decimals: 2 },
  workload: { Icon: Clock, label: 'Workload', max: 30, suffix: 'h', decimals: 0 },
  reviews: { Icon: MessageSquare, label: 'Reviews', max: 0, suffix: '', decimals: 0 },
}

/** Five steps of neutral. Rating inverts — a high rating should read as light, not heavy. */
function intensityVar(fraction: number, invert: boolean): string {
  const f = invert ? 1 - fraction : fraction
  const step = Math.min(5, Math.max(1, Math.ceil(f * 5) || 1))
  return `var(--scale-${step})`
}

export function Metric({
  kind,
  value,
  showBar = true,
  className,
}: {
  kind: MetricKind
  value: number | null | undefined
  showBar?: boolean
  className?: string
}) {
  const { Icon, label, max, suffix, decimals } = META[kind]
  const has = value !== null && value !== undefined

  const body = (
    <span className={cn('inline-flex flex-col gap-0.5', className)}>
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Icon className="size-3 shrink-0" aria-hidden />
        <span className="mono text-[11px] text-foreground/80">
          {has ? value.toFixed(decimals) + suffix : '—'}
        </span>
      </span>
      {showBar && max > 0 && (
        <span className="block h-[3px] w-9 overflow-hidden rounded-full bg-muted">
          {has && (
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.min(100, (value / max) * 100)}%`,
                background: intensityVar(Math.min(1, value / max), kind === 'rating'),
              }}
            />
          )}
        </span>
      )}
    </span>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{body}</TooltipTrigger>
      <TooltipContent>
        {label}
        {has ? (
          <>
            {': '}
            <span className="mono">
              {value.toFixed(decimals)}
              {suffix}
            </span>
            {max > 0 && <span className="opacity-70"> / {max}</span>}
          </>
        ) : (
          ' — no data'
        )}
      </TooltipContent>
    </Tooltip>
  )
}

/** The metric strip under a course title. */
export function MetricRow({
  rating,
  difficulty,
  workload,
  reviews,
  showBars = true,
  className,
}: {
  rating?: number | null
  difficulty?: number | null
  workload?: number | null
  reviews?: number | null
  showBars?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-end gap-3', className)}>
      <Metric kind="rating" value={rating} showBar={showBars} />
      <Metric kind="difficulty" value={difficulty} showBar={showBars} />
      <Metric kind="workload" value={workload} showBar={showBars} />
      {reviews !== undefined && <Metric kind="reviews" value={reviews} showBar={false} />}
    </div>
  )
}

/** A bare progress bar in the neutral ramp, for semester workload. */
export function IntensityBar({
  value,
  max,
  className,
}: {
  value: number
  max: number
  className?: string
}) {
  const fraction = max === 0 ? 0 : Math.min(1, value / max)
  return (
    <span className={cn('block h-[3px] w-full overflow-hidden rounded-full bg-muted', className)}>
      <span
        className="block h-full rounded-full transition-[width]"
        style={{ width: `${fraction * 100}%`, background: intensityVar(fraction, false) }}
      />
    </span>
  )
}
