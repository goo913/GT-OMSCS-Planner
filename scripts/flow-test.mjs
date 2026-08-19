/**
 * Browser checks for the things the redesign is accountable for: the per-term cap is
 * enforced at the drop, a placed course opens its dialog, grade tracking changes the
 * requirement set, the slot rail filters the library, the sidebars collapse, ⌘K works,
 * a phone can place a course in a few taps, and only three hues are on screen at rest.
 *
 * Runs entirely against localStorage — Firestore is blocked so the shared plan is
 * never touched.
 *
 *   npm run dev -- --port 5199
 *   npm i --no-save playwright-core
 *   node scripts/flow-test.mjs
 */
import { chromium } from 'playwright-core'
const URL = process.env.URL || 'http://localhost:5199/GT-OMSCS-Planner/'
const b = await chromium.launch({ channel: 'chrome' })
let fails = 0
const ok = (l, c) => { if (!c) fails++; console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`) }

// Work from a local-only plan so the shared Firestore doc is untouched.
const seed = {
  schemaVersion: 1, specialization: 'ai', matriculationTerm: '2026FA',
  targetGraduationTerm: '2028SU',
  placements: {
    CS_6035: { code: 'CS 6035', term: '2026FA', grade: null },
    CS_6750: { code: 'CS 6750', term: '2026FA', grade: null },
  },
  notes: {}, settings: { trackGrades: false, showCost: true, showWorkload: true }, updatedAt: 0,
}

const mk = async (opts = {}) => {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, ...opts })
  // Keep the UI tests off the shared document: this exercises the view layer, and the
  // app is designed to run fully from localStorage when Firestore is unreachable.
  await ctx.route(/firestore\.googleapis\.com|firebaseinstallations|googleapis\.com/, (r) => r.abort())
  await ctx.addInitScript((p) => {
    localStorage.clear()
    localStorage.setItem('gt-omscs-planner:plan', JSON.stringify(p))
  }, seed)
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  page.on('console', (m) => {
    const t = m.text()
    if (m.type() === 'error' && !/googleapis|firestore|ERR_FAILED|Failed to fetch/i.test(t)) {
      errs.push('console: ' + t)
    }
  })
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForTimeout(1600)
  return { page, errs }
}

/* ── §7.1 the cap is enforced at the drop ───────────────────────── */
{
  const { page, errs } = await mk()
  const fall = page.locator('section[aria-label="Fall 2026"]')
  ok('Fall 2026 shows 2 of 2 courses', /2\/2/.test(await fall.locator('header').innerText()))

  // drag a third course into a full term
  await page.getByRole('searchbox').fill('6601')
  await page.waitForTimeout(300)
  await page.evaluate(() => {
    const dt = new DataTransfer()
    dt.setData('text/plain', 'CS 6601')
    const row = document.querySelector('[role="button"][draggable="true"]')
    row.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }))
    const term = [...document.querySelectorAll('section')].find(
      (s) => s.getAttribute('aria-label') === 'Fall 2026',
    )
    term.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }))
    term.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
  })
  await page.waitForTimeout(700)
  ok('a third course is refused', (await fall.locator('[role="button"][draggable="true"]').count()) === 2)
  const toastText = await page.locator('[data-sonner-toast]').first().innerText().catch(() => '')
  ok('  … with an inline reason', /full/i.test(toastText) && /2 courses/i.test(toastText))
  ok('  … and an offer to replace', /replace/i.test(toastText))

  // taking the offer swaps
  await page.getByRole('button', { name: /^Replace / }).click()
  await page.waitForTimeout(800)
  const after = await fall.innerText()
  ok('accepting the swap places the new course', /CS 6601/.test(after))
  ok('  … and removes the one it replaced', (await fall.locator('[role="button"][draggable="true"]').count()) === 2)
  ok('no page errors', errs.length === 0, errs)
  await page.context().close()
}

/* ── §7.2 clicking a placed course opens the dialog ─────────────── */
{
  const { page, errs } = await mk()
  await page.locator('section[aria-label="Fall 2026"] [role="button"][draggable="true"]').first().click()
  await page.waitForTimeout(500)
  const dialog = page.locator('[role="dialog"]')
  ok('clicking a placed course opens the detail dialog', await dialog.isVisible())
  const t = await dialog.innerText()
  ok('  … with the scraped description', /Overview/i.test(t))
  ok('  … the requirement fit across specializations', /Requirement fit/i.test(t))
  ok('  … and the background advisory', /Recommended background/i.test(t))
  ok('  … no grade control while tracking is off', !/planned/i.test(t))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  ok('Escape closes it', (await page.locator('[role="dialog"]').count()) === 0)
  ok('no page errors', errs.length === 0, errs)
  await page.context().close()
}

/* ── §7.3 grade tracking toggles the requirement set ────────────── */
{
  const { page, errs } = await mk()
  ok('GPA is absent while grade tracking is off', !(await page.getByText(/Cumulative GPA/).count()))
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.waitForTimeout(400)
  await page.getByRole('switch', { name: /Track grades/i }).click()
  await page.waitForTimeout(500)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  ok('turning it on brings the GPA requirement back', (await page.getByText(/Cumulative GPA/).count()) > 0)
  ok('no page errors', errs.length === 0, errs)
  await page.context().close()
}

/* ── the slot rail is an instrument ─────────────────────────────── */
{
  const { page, errs } = await mk()
  const empty = page.locator('button[aria-label^="Empty slot"]').first()
  const label = await empty.getAttribute('aria-label')
  await empty.click()
  await page.waitForTimeout(500)
  const chip = await page.getByText(/^Fits/).innerText().catch(() => '')
  ok(`clicking an empty slot filters the library (${label?.slice(0, 34)}…)`, /Fits/.test(chip))
  const count = await page.locator('.divide-y > div').count()
  ok('  … down to a short list', count > 0 && count < 20)
  await page.getByRole('button', { name: 'Clear slot filter' }).click()
  await page.waitForTimeout(300)
  ok('  … and the filter clears', (await page.getByText(/^Fits/).count()) === 0)

  const filled = page.locator('button[aria-label^="CS "]').first()
  await filled.click()
  await page.waitForTimeout(500)
  ok('clicking a filled slot opens that course', await page.locator('[role="dialog"]').isVisible())
  ok('no page errors', errs.length === 0, errs)
  await page.context().close()
}

/* ── layout: sidebars collapse and the board takes the space ────── */
{
  const { page, errs } = await mk()
  const boardWidth = () => page.evaluate(() => {
    const el = document.querySelector('[data-panel][data-panel-id="board"]') ||
      [...document.querySelectorAll('[data-panel]')][1]
    return el ? el.getBoundingClientRect().width : 0
  })
  const wide = await boardWidth()
  ok(`board gets at least half the width with both sidebars open (${Math.round(wide)}px of 1440)`, wide >= 720)
  await page.getByRole('button', { name: 'Toggle course library' }).click()
  await page.getByRole('button', { name: 'Toggle requirements' }).click()
  await page.waitForTimeout(600)
  const full = await boardWidth()
  ok(`both closed, the board is the whole screen (${Math.round(full)}px)`, full > 1380)
  ok('no page errors', errs.length === 0, errs)
  await page.context().close()
}

/* ── command palette ────────────────────────────────────────────── */
{
  const { page, errs } = await mk()
  await page.keyboard.press('Meta+k')
  await page.waitForTimeout(500)
  ok('⌘K opens the command palette', await page.locator('[role="dialog"]').isVisible())
  await page.keyboard.type('7641')
  await page.waitForTimeout(400)
  ok('  … and searches courses', (await page.getByRole('option').count()) > 0)
  await page.keyboard.press('Escape')
  ok('no page errors', errs.length === 0, errs)
  await page.context().close()
}

/* ── mobile at 380px ────────────────────────────────────────────── */
{
  const { page, errs } = await mk({ viewport: { width: 380, height: 820 }, isMobile: true, hasTouch: true })
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  ok(`no horizontal overflow at 380px (${overflow}px)`, overflow <= 1)
  ok('bottom tab bar is present', (await page.getByRole('navigation', { name: 'Main' }).count()) === 1)

  // tap 1: open the library. tap 2: focus a term first? board is default; count taps to place.
  let taps = 0
  await page.getByRole('button', { name: 'Library' }).click(); taps++
  await page.waitForTimeout(500)
  const sheet = page.locator('[role="dialog"]')
  await sheet.getByRole('searchbox').fill('6601')
  await page.waitForTimeout(400)
  await sheet.locator('[role="button"][draggable="true"]').first().getByRole('button').first().click(); taps++
  await page.waitForTimeout(700)
  const placed = await page.locator('text=CS 6601').count()
  ok(`a course is found and placed in ${taps} taps`, placed > 0 && taps <= 4)
  ok('no page errors', errs.length === 0, errs)
  await page.context().close()
}

/* ── colour budget at rest ──────────────────────────────────────── */
{
  const { page, errs } = await mk()
  const hues = await page.evaluate(() => {
    const buckets = new Set()
    const add = (hue) => buckets.add(Math.round(hue / 30) * 30 % 360)
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') continue
      for (const prop of ['color', 'backgroundColor', 'borderTopColor', 'borderLeftColor']) {
        const v = cs[prop]
        // Chrome reports authored oklch() values verbatim.
        const ok = v.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
        if (ok) {
          const [, , c, h] = ok.map(Number)
          if (c > 0.02) add(h)
          continue
        }
        const m = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
        if (!m) continue
        const [r, g, bl] = [+m[1], +m[2], +m[3]]
        const a = m[4] === undefined ? 1 : +m[4]
        if (a < 0.06) continue
        const max = Math.max(r, g, bl)
        const min = Math.min(r, g, bl)
        if (max - min < 18) continue
        const d = max - min
        let h6 = max === r ? ((g - bl) / d + 6) % 6 : max === g ? (bl - r) / d + 2 : (r - g) / d + 4
        add(h6 * 60)
      }
    }
    return [...buckets].sort((a, b) => a - b)
  })
  // GT navy sits near 250 in oklch hue, gold near 90. Anything near 30 is red.
  ok(`hues found: ${hues.join(', ')} — navy and gold only`, hues.length > 0 && hues.length <= 3)
  ok('  … no red at rest', !hues.some((h) => h <= 40 || h >= 330))
  ok('no page errors', errs.length === 0, errs)
  await page.context().close()
}

await b.close()
console.log(fails ? `\n${fails} check(s) FAILED` : '\nAll redesign checks passed.')
process.exit(fails ? 1 : 0)
