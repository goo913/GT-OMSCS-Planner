import { COURSE_BY_CODE, SPEC_BY_ID, offeringSummary } from '../lib/catalog'
import { backgroundTopics } from '../lib/validate'

/** Two or three courses side by side, for the "which of these do I take?" moment. */
export function Compare({
  codes,
  specId,
  onRemove,
  onClear,
  onOpen,
}: {
  codes: string[]
  specId: string
  onRemove: (code: string) => void
  onClear: () => void
  onOpen: (code: string) => void
}) {
  if (!codes.length) return null
  const courses = codes.map((c) => COURSE_BY_CODE.get(c)).filter(Boolean) as NonNullable<
    ReturnType<typeof COURSE_BY_CODE.get>
  >[]
  if (!courses.length) return null
  const spec = SPEC_BY_ID.get(specId)

  const rows: [string, (c: (typeof courses)[number]) => string][] = [
    ['Title', (c) => c.title],
    ['Rating', (c) => c.omscentral?.rating?.toFixed(2) ?? '—'],
    ['Difficulty', (c) => c.omscentral?.difficulty?.toFixed(2) ?? '—'],
    ['Workload', (c) => (c.omscentral?.workload ? `${Math.round(c.omscentral.workload)} h/wk` : '—')],
    ['Reviews', (c) => String(c.omscentral?.reviewCount ?? 0)],
    ['Foundational', (c) => (c.foundational ? 'Yes' : 'No')],
    ['Offered', (c) => offeringSummary(c)],
    [
      `${spec?.short ?? 'Spec'} slot`,
      (c) => {
        const g = spec?.groups.filter((x) => x.courses.includes(c.code)) ?? []
        return g.length ? g.map((x) => x.label).join(' / ') : 'free elective'
      },
    ],
    ['Subject', (c) => (c.isCsCse ? c.subject : `${c.subject} (non-CS/CSE)`)],
    ['Background', (c) => backgroundTopics(c).join(', ') || '—'],
  ]

  return (
    <section className="panel no-print" aria-label="Course comparison">
      <div className="panel-head">
        <h2>Compare</h2>
        <button className="btn sm ghost" onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="panel-body" style={{ overflowX: 'auto' }}>
        <table className="compare-table">
          <thead>
            <tr>
              <th />
              {courses.map((c) => (
                <th key={c.code}>
                  <button
                    className="course-code"
                    style={{ background: 'none', border: 0, padding: 0 }}
                    onClick={() => onOpen(c.code)}
                  >
                    {c.code}
                  </button>{' '}
                  <button className="btn sm ghost" onClick={() => onRemove(c.code)} aria-label={`Remove ${c.code}`}>
                    ×
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, get]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {courses.map((c) => (
                  <td key={c.code} className={label === 'Title' || label === 'Background' ? '' : 'num'}>
                    {get(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
