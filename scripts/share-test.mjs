/**
 * The whole point of the app: one plan, the same for everyone who opens the URL.
 *
 * This covers the case that broke it — a browser that already holds the plan in
 * localStorage while the shared document is empty. Before the boot reconciliation
 * that browser rendered the plan happily and published nothing, so the app was
 * quietly single-device.
 *
 * DESTRUCTIVE: writes to and reads the real shared document. Clear it first.
 *   firebase firestore:delete plans/goo --project <id> --force
 *   npm run dev -- --port 5199
 *   npm i --no-save playwright-core
 *   node scripts/share-test.mjs
 */
import { chromium } from 'playwright-core'
const URL = process.env.URL || 'http://localhost:5199/GT-OMSCS-Planner/'
const b = await chromium.launch({ channel: 'chrome' })
let fails = 0
const ok = (l, c) => { if (!c) fails++; console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`) }

// "your computer": a browser that already holds the plan in localStorage,
// while the shared document is empty — exactly the state that broke.
const myPlan = {
  schemaVersion: 1, specialization: 'ai', matriculationTerm: '2026FA',
  targetGraduationTerm: '2028SU',
  placements: {
    CS_6035: { code: 'CS 6035', term: '2026FA', grade: null, updatedAt: 1 },
    CS_6750: { code: 'CS 6750', term: '2026FA', grade: null, updatedAt: 1 },
  },
  notes: { '2026FA': 'Registered.' },
  settings: { trackGrades: false, showCost: true, showWorkload: true },
  updatedAt: 1700000000000,
}

const mine = await b.newContext({ viewport: { width: 1400, height: 900 } })
await mine.addInitScript((p) => {
  localStorage.clear()
  localStorage.setItem('gt-omscs-planner:plan', JSON.stringify(p))
}, myPlan)
const me = await mine.newPage()
me.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 160)))
await me.goto(URL, { waitUntil: 'load' })
await me.waitForTimeout(4000)
ok('my computer still shows my plan', (await me.locator('button[aria-label="Remove CS 6035"]').count()) === 1)
ok(`  … and it publishes itself (${await me.locator('[data-sync]').getAttribute('data-sync')})`,
   (await me.locator('[data-sync]').getAttribute('data-sync')) === 'synced')

// "her laptop": a browser that has never opened the app
const hers = await b.newContext({ viewport: { width: 1400, height: 900 } })
await hers.addInitScript(() => localStorage.clear())
const her = await hers.newPage()
await her.goto(URL, { waitUntil: 'load' })
await her.waitForTimeout(4000)
const herText = await her.locator('body').innerText()
ok('her laptop sees my courses', /CS 6035/.test(herText) && /CS 6750/.test(herText))
ok('  … and my note',
   (await her.locator('textarea[aria-label="Note for Fall 2026"]').inputValue()) === 'Registered.')
ok('  … and my target term', /Summer 2028/.test(herText))

// and edits still flow both ways afterwards
await her.getByRole('searchbox').fill('7637')
await her.waitForTimeout(400)
await her.locator('[role=button][draggable=true]').first().getByRole('button').first().click()
await her.waitForTimeout(2500)
await me.waitForTimeout(2500)
ok('her edit reaches my computer', (await me.locator('body').innerText()).includes('CS 7637'))

// ── edits made while the write could not land are not stranded either ──
{
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } })
  await ctx.addInitScript(() => localStorage.clear())
  const p = await ctx.newPage()
  await p.goto(URL, { waitUntil: 'load' })
  await p.waitForTimeout(3500)

  // go offline, make an edit, and close the tab before it can ever be sent
  await ctx.setOffline(true)
  await p.getByRole('searchbox').fill('7643')
  await p.waitForTimeout(400)
  await p.locator('[role=button][draggable=true]').first().getByRole('button').first().click()
  await p.waitForTimeout(1500)
  const stored = await p.evaluate(() => localStorage.getItem('gt-omscs-planner:plan'))
  ok('an offline edit is kept locally', /CS 7643/.test(stored))
  await ctx.close()

  // reopen with the network back: the stranded edit should publish itself
  const ctx2 = await b.newContext({ viewport: { width: 1400, height: 900 } })
  await ctx2.addInitScript((v) => {
    localStorage.clear()
    localStorage.setItem('gt-omscs-planner:plan', v)
  }, stored)
  const p2 = await ctx2.newPage()
  await p2.goto(URL, { waitUntil: 'load' })
  await p2.waitForTimeout(4000)
  ok('  … and reaches the shared plan on the next visit',
     (await p2.locator('[data-sync]').getAttribute('data-sync')) === 'synced')

  const fresh = await b.newContext({ viewport: { width: 1400, height: 900 } })
  await fresh.addInitScript(() => localStorage.clear())
  const p3 = await fresh.newPage()
  await p3.goto(URL, { waitUntil: 'load' })
  await p3.waitForTimeout(4000)
  ok('  … where everyone else can see it', (await p3.locator('body').innerText()).includes('CS 7643'))
}

await b.close()
console.log(fails ? `\n${fails} check(s) FAILED` : '\nSharing works.')
process.exit(fails ? 1 : 0)
