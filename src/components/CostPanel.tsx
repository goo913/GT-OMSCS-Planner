import type { TermId } from '../types'
import type { Validation } from '../lib/validate'
import { RULES } from '../lib/catalog'
import { TUITION_NOTES, TUITION_SOURCE_URL, costForTerm, feeCliff, money, ratesFor } from '../lib/cost'
import { termLabel } from '../lib/terms'

export function CostPanel({ validation }: { validation: Validation }) {
  const rows = validation.terms
    .filter((t) => t.creditHours > 0)
    .map((t) => costForTerm(t.term, t.creditHours))
  const total = rows.reduce((n, r) => n + r.total, 0)
  const estimatedTotal = rows.filter((r) => r.estimated).reduce((n, r) => n + r.total, 0)
  const belowHalfTime = rows.filter((r) => !r.loanEligible)

  const cliffTerm: TermId = rows.find((r) => !r.estimated)?.term ?? '2026FA'
  const cliff = feeCliff(cliffTerm)
  const rate = ratesFor(cliffTerm)

  return (
    <section className="panel" aria-label="Cost estimate">
      <div className="panel-head">
        <h2>Cost estimate</h2>
        <span className="num" style={{ fontSize: 13, fontWeight: 700 }}>
          {money(total)}
        </span>
      </div>
      <div className="panel-body">
        {rows.length === 0 ? (
          <p className="dim" style={{ margin: 0, fontSize: 12 }}>
            Place a course to see what a semester costs.
          </p>
        ) : (
          <table className="cost-table">
            <thead>
              <tr>
                <th>Term</th>
                <th>Hrs</th>
                <th>Tuition</th>
                <th>Fee</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.term} data-estimated={r.estimated}>
                  <td>
                    {termLabel(r.term)}
                    {r.estimated && (
                      <span className="tag-est" style={{ marginLeft: 4 }} title={`Carried forward from ${termLabel(r.basedOn)}`}>
                        est
                      </span>
                    )}
                    {!r.loanEligible && (
                      <span className="tag-nohalf" style={{ marginLeft: 4 }} title={RULES.financialAid.note}>
                        &lt;½
                      </span>
                    )}
                  </td>
                  <td>{r.creditHours}</td>
                  <td>{money(r.tuition)}</td>
                  <td>{money(r.onlineLearningFee)}</td>
                  <td>{money(r.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>{rows.reduce((n, r) => n + r.creditHours, 0)}</td>
                <td>{money(rows.reduce((n, r) => n + r.tuition, 0))}</td>
                <td>{money(rows.reduce((n, r) => n + r.onlineLearningFee, 0))}</td>
                <td>{money(total)}</td>
              </tr>
            </tfoot>
          </table>
        )}

        <div className="callout gold">
          <b>The fee cliff.</b> The Online Learning Fee jumps from{' '}
          <span className="num">{money(rate.onlineLearningFee.under4Hours)}</span> to{' '}
          <span className="num">{money(rate.onlineLearningFee.atLeast4Hours)}</span> at 4 credit hours, so in{' '}
          {termLabel(cliffTerm)} the second course in a term costs{' '}
          <span className="num">{money(cliff.marginal)}</span> ({money(cliff.tuitionPart)} tuition +{' '}
          {money(cliff.feePart)} fee) — more than the first course costs on its own (
          <span className="num">{money(cliff.oneCourse)}</span>).
        </div>

        {estimatedTotal > 0 && (
          <div className="callout">
            <b>{money(estimatedTotal)}</b> of that total uses carried-forward rates because Georgia Tech has
            not published those terms yet. Summer carries a lower Online Learning Fee than Fall and
            Spring, so each season carries forward from its own most recent sheet.
          </div>
        )}

        {belowHalfTime.length > 0 && (
          <div className="callout">
            <b>
              {belowHalfTime.length} semester{belowHalfTime.length === 1 ? '' : 's'} below half-time
            </b>{' '}
            ({belowHalfTime.map((r) => termLabel(r.term)).join(', ')}). {RULES.financialAid.note}
          </div>
        )}

        <p className="dim" style={{ fontSize: 10.5, lineHeight: 1.5, marginBottom: 0, marginTop: 10 }}>
          {TUITION_NOTES.join(' ')} {RULES.financialAid.disclaimer}{' '}
          <a href={TUITION_SOURCE_URL} target="_blank" rel="noreferrer">
            Bursar rates ↗
          </a>
        </p>
      </div>
    </section>
  )
}
