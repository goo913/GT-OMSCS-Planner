/**
 * Realtime sync checks against the live Firestore document. Destructive: it writes to
 * and clears the shared plan, so only run it against a throwaway document or when the
 * real plan is exported.
 *
 *   firebase firestore:delete plans/goo --project <id> --force
 *   npm run dev -- --port 5199
 *   npm i --no-save playwright-core
 *   node scripts/realtime-test.mjs
 */
import { chromium } from 'playwright-core'
const URL = process.env.URL || 'http://localhost:5199/GT-OMSCS-Planner/'
const b = await chromium.launch({ channel: 'chrome' })
let fails = 0
const ok = (l, c) => { if (!c) fails++; console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`) }
const mk = async () => {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } })
  await ctx.addInitScript(() => localStorage.clear())
  const p = await ctx.newPage()
  p.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0, 200)))
  await p.goto(URL, { waitUntil: 'load' })
  await p.waitForTimeout(2500)
  return p
}
const A = await mk(), B = await mk()
const pill = async (p) => await p.locator('[data-sync]').first().getAttribute('data-sync')
ok(`device A connects (pill: ${await pill(A)})`, (await pill(A)) === 'synced')
ok(`device B connects (pill: ${await pill(B)})`, (await pill(B)) === 'synced')

// A places a course
await A.getByRole('searchbox').fill('6601')
await A.waitForTimeout(400)
await A.locator('[role="button"][draggable="true"]').first().getByRole('button').first().click()
await A.waitForTimeout(1600)
ok(`A shows saving then synced (pill: ${await pill(A)})`, (await pill(A)) === 'synced')
await B.waitForTimeout(1800)
ok('B sees the placement without a refresh',
   (await B.locator('[role="button"][draggable="true"]').filter({ hasText: 'CS 6601' }).count()) > 0)

// B changes a shared setting; A should see it
await B.getByRole('button', { name: 'Settings' }).click()
await B.waitForTimeout(400)
await B.getByRole('switch', { name: /Track grades/i }).click()
await B.waitForTimeout(1600)
await B.keyboard.press('Escape')
await A.waitForTimeout(1800)
ok('A sees the setting B changed', (await A.getByText(/Cumulative GPA/).count()) > 0)

// field-level merge: A edits a note while B places a different course
await A.locator('section[aria-label="Fall 2026"] button[aria-label^="More actions"]').click()
await A.getByRole('menuitem', { name: /note/i }).click()
await A.locator('textarea[aria-label="Note for Fall 2026"]').fill('typed on device A')
await B.getByRole('searchbox').fill('6795')
await B.waitForTimeout(400)
await B.locator('[role="button"][draggable="true"]').first().getByRole('button').first().click()
await B.waitForTimeout(2200)
await A.waitForTimeout(2200)
const aText = await A.locator('main, body').innerText()
ok('concurrent edits merge — A keeps its note',
   (await A.locator('textarea[aria-label="Note for Fall 2026"]').inputValue()) === 'typed on device A')
ok('  … and gains B\'s course', /CS 6795/.test(aText))

// offline resilience
await A.context().setOffline(true)
await A.locator('button[aria-label="Remove CS 6601"]').first().click()
await A.waitForTimeout(1500)
ok(`A reports offline (pill: ${await pill(A)})`, ['offline', 'saving'].includes(await pill(A)))
ok('  … and keeps working locally', (await A.locator('button[aria-label="Remove CS 6601"]').count()) === 0)
await A.context().setOffline(false)
await A.waitForTimeout(500)
await A.locator('textarea[aria-label="Note for Fall 2026"]').fill('typed on device A while reconnecting')
await A.waitForTimeout(2500)
ok(`A reconnects (pill: ${await pill(A)})`, (await pill(A)) === 'synced')
await B.waitForTimeout(2000)
ok('  … and the queued removal reaches B',
   (await B.locator('button[aria-label="Remove CS 6601"]').count()) === 0)

await b.close()
console.log(fails ? `\n${fails} realtime check(s) FAILED` : '\nAll realtime checks passed.')
process.exit(fails ? 1 : 0)
