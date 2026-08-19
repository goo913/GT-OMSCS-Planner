import type { Validation } from '../lib/validate'
import type { Plan } from '../types'
import { COURSE_BY_CODE } from '../lib/catalog'
import { placementOf } from '../lib/plan'
import { termShortLabel } from '../lib/terms'

/**
 * The ten requirement slots. This is the thing worth staring at: every slot the degree
 * needs, in order, visibly filling. Specialization slots take navy, free electives gold.
 */
export function SlotStrip({
  plan,
  validation,
  onOpen,
}: {
  plan: Plan
  validation: Validation
  onOpen: (code: string) => void
}) {
  const { slots, spec, freeElectives, freeElectivesNeeded } = validation

  const groups: { key: string; label: string; hint: string; cells: Cell[] }[] = []
  for (const slot of slots) {
    const last = groups[groups.length - 1]
    const cell: Cell = {
      code: slot.filledBy,
      hint: slot.restriction ?? `${slot.eligible.length} option${slot.eligible.length === 1 ? '' : 's'}`,
      kind: slot.section,
    }
    if (last && last.key === slot.groupId) last.cells.push(cell)
    else
      groups.push({
        key: slot.groupId,
        label: slot.group,
        hint: slot.section === 'core' ? 'core' : 'elective',
        cells: [cell],
      })
  }

  const freeCells: Cell[] = Array.from({ length: Math.max(freeElectivesNeeded, freeElectives.length) }, (_, i) => ({
    code: freeElectives[i] ?? null,
    hint: 'any OMSCS course',
    kind: 'free',
  }))

  const specFilled = slots.filter((s) => s.filledBy).length
  const freeFilled = Math.min(freeElectives.length, freeElectivesNeeded)
  const totalFilled = specFilled + freeFilled

  return (
    <section className="slotstrip" aria-label="Requirement slots">
      <div className="slotstrip-top">
        <span className="slotstrip-title">
          {totalFilled} of 10 requirement slots filled
        </span>
        <span className="meter" aria-hidden>
          {Array.from({ length: slots.length + freeElectivesNeeded }, (_, i) => {
            const isSpec = i < slots.length
            const on = isSpec ? i < specFilled : i - slots.length < freeFilled
            return <i key={i} className={on ? (isSpec ? 'on' : 'on gold') : ''} />
          })}
        </span>
        <span className="num dim" style={{ fontSize: 11.5 }}>
          {validation.countedCreditHours} / 30 hrs
        </span>
        {validation.gpa !== null && (
          <span className="num dim" style={{ fontSize: 11.5 }}>
            GPA {validation.gpa.toFixed(2)}
          </span>
        )}
      </div>

      <div className="slot-groups">
        {groups.map((g) => (
          <div className="slot-group" key={g.key}>
            <div className="slot-group-label">
              <span className="eyebrow">{g.label}</span>
              <span className="eyebrow dim">{g.cells.filter((c) => c.code).length}/{g.cells.length}</span>
            </div>
            <div className="slot-cells">
              {g.cells.map((c, i) => (
                <SlotCell key={i} cell={c} plan={plan} onOpen={onOpen} />
              ))}
            </div>
          </div>
        ))}

        <div className="slot-group">
          <div className="slot-group-label">
            <span className="eyebrow">Free electives</span>
            <span className="eyebrow dim">
              {freeFilled}/{freeElectivesNeeded}
            </span>
          </div>
          <div className="slot-cells">
            {freeCells.map((c, i) => (
              <SlotCell key={i} cell={c} plan={plan} onOpen={onOpen} extra={i >= freeElectivesNeeded} />
            ))}
          </div>
        </div>
      </div>

      <p className="dim" style={{ fontSize: 11, marginTop: 9, marginBottom: 0 }}>
        {spec.name} · {spec.specializationHours} specialization hrs + {spec.freeElectiveHours} free
        elective hrs.{' '}
        {spec.excessCoreCountsAsSpecElective
          ? 'Core courses beyond the requirement may fill a specialization elective.'
          : 'Core courses beyond the requirement fall to free electives, not specialization electives.'}
      </p>
    </section>
  )
}

interface Cell {
  code: string | null
  hint: string
  kind: 'core' | 'elective' | 'free'
}

function SlotCell({
  cell,
  plan,
  onOpen,
  extra = false,
}: {
  cell: Cell
  plan: Plan
  onOpen: (code: string) => void
  extra?: boolean
}) {
  if (!cell.code) {
    return (
      <div className="slot open" aria-label={`Open slot: ${cell.hint}`}>
        <span className="slot-code dim">——</span>
        <span className="slot-hint">{cell.hint}</span>
      </div>
    )
  }
  const placement = placementOf(plan, cell.code)
  const course = COURSE_BY_CODE.get(cell.code)
  return (
    <button
      type="button"
      className={`slot filled${cell.kind === 'free' ? ' free' : ''}`}
      onClick={() => onOpen(cell.code!)}
      title={`${cell.code} — ${course?.title ?? ''}${extra ? ' (beyond what the degree needs)' : ''}`}
      style={extra ? { opacity: 0.55 } : undefined}
    >
      <span className="slot-code">{cell.code}</span>
      <span className="slot-meta">
        {placement ? termShortLabel(placement.term) : ''}
        {placement?.grade ? ` · ${placement.grade}` : ''}
      </span>
    </button>
  )
}
