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
const pill = async p => (await p.locator('.sync').first().innerText()).trim()
ok(`device A connects (pill: ${await pill(A)})`, (await pill(A)) === 'synced')
ok(`device B connects (pill: ${await pill(B)})`, (await pill(B)) === 'synced')

// A places a course
await A.getByRole('searchbox').fill('6601')
await A.waitForTimeout(300)
await A.locator('.course-row').first().getByRole('button', { name: /Place/ }).click()
await A.waitForTimeout(150)
await A.locator('section.term').first().locator('.term-drop').click()
await A.waitForTimeout(1600)
ok(`A shows saving then synced (pill: ${await pill(A)})`, (await pill(A)) === 'synced')
await B.waitForTimeout(1800)
ok('B sees the placement without a refresh',
   (await B.locator('.placement').filter({ hasText: 'CS 6601' }).count()) === 1)

// B sets a grade; A should see it
await B.locator('.placement').filter({ hasText: 'CS 6601' }).locator('select').selectOption('A')
await B.waitForTimeout(1600)
await A.waitForTimeout(1500)
ok('A sees the grade B entered', (await A.locator('.placement').filter({ hasText: 'CS 6601' }).locator('select').inputValue()) === 'A')

// field-level merge: A edits a note while B places a different course
await A.locator('#note-2026FA').fill('typed on device A')
await B.getByRole('searchbox').fill('6750')
await B.waitForTimeout(300)
await B.locator('.course-row').first().getByRole('button', { name: /Place/ }).click()
await B.waitForTimeout(120)
await B.locator('section.term').first().locator('.term-drop').click()
await B.waitForTimeout(2200)
await A.waitForTimeout(2000)
const aText = await A.locator('section.term').first().innerText()
ok('concurrent edits merge — A keeps its note', (await A.locator('#note-2026FA').inputValue()) === 'typed on device A')
ok('  … and gains B\'s course', /CS 6750/.test(aText))
const bNote = await B.locator('#note-2026FA').inputValue()
ok('  … B receives A\'s note', bNote === 'typed on device A')

// offline resilience
await A.context().setOffline(true)
await A.locator('.placement').filter({ hasText: 'CS 6601' }).getByRole('button', { name: /Remove/ }).click()
await A.waitForTimeout(1500)
ok(`A reports offline (pill: ${await pill(A)})`, ['offline', 'saving'].includes(await pill(A)))
ok('  … and keeps working locally', (await A.locator('.placement').filter({ hasText: 'CS 6601' }).count()) === 0)
await A.context().setOffline(false)
await A.waitForTimeout(500)
await A.locator('#note-2026FA').fill('typed on device A while reconnecting')
await A.waitForTimeout(2500)
ok(`A reconnects (pill: ${await pill(A)})`, (await pill(A)) === 'synced')
await B.waitForTimeout(2000)
ok('  … and the queued removal reaches B',
   (await B.locator('.placement').filter({ hasText: 'CS 6601' }).count()) === 0)

await b.close()
console.log(fails ? `\n${fails} realtime check(s) FAILED` : '\nAll realtime checks passed.')
process.exit(fails ? 1 : 0)
