/**
 * Browser flow checks — the interactions that are easy to break silently:
 * tap-to-assign at phone width, drag and drop on desktop, the detail sheet,
 * the specialization what-if, and keyboard reachability.
 *
 * Needs a dev server and a local Chrome:
 *   npm run dev -- --port 5199
 *   npm i --no-save playwright-core
 *   node scripts/flow-test.mjs
 */
import { chromium } from 'playwright-core'
const URL = process.env.URL || 'http://localhost:5199/GT-OMSCS-Planner/'
const browser = await chromium.launch({ channel: 'chrome' })
let fails = 0
const ok = (label, cond) => { if (!cond) fails++; console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}`) }

// ── mobile tap-to-assign at 380px ────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 380, height: 820 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', e => errs.push(e.message))
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForTimeout(900)

  await page.getByRole('button', { name: 'Courses' }).click()
  await page.getByRole('searchbox').fill('6035')
  await page.waitForTimeout(300)
  const placeBtn = page.locator('.course-row').first().getByRole('button', { name: /Place/ })
  ok('library shows a Place button', await placeBtn.count() === 1)
  await placeBtn.click()
  await page.waitForTimeout(200)
  const bar = page.locator('.assignbar')
  ok('tap-to-assign bar appears', await bar.isVisible())
  const barBox = await bar.boundingBox()
  ok('assign bar is reachable at the bottom of a 820px screen', barBox.y + barBox.height <= 830)
  const termBtn = bar.locator('.assignbar-terms button').first()
  ok('term targets are ≥38px tall (thumb-sized)', (await termBtn.boundingBox()).height >= 38)
  await termBtn.click()
  await page.waitForTimeout(400)
  ok('assign bar dismisses after choosing', !(await bar.isVisible().catch(() => false)))
  await page.getByRole('button', { name: 'Plan' }).click()
  await page.waitForTimeout(300)
  const placed = page.locator('.placement').filter({ hasText: 'CS 6035' })
  ok('the course lands on the board', await placed.count() === 1)
  ok('slot strip counts it', /1 of 10/.test(await page.locator('.slotstrip-title').innerText()))

  // remove it again
  await placed.getByRole('button', { name: /Remove/ }).click()
  await page.waitForTimeout(300)
  ok('removing takes it back off', await page.locator('.placement').count() === 0)
  ok('no page errors on mobile', errs.length === 0)
  // horizontal overflow check
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  ok(`no horizontal overflow at 380px (${overflow}px)`, overflow <= 1)
  await ctx.close()
}

// ── desktop drag and drop ────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', e => errs.push(e.message))
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForTimeout(900)
  await page.getByRole('searchbox').fill('6601')
  await page.waitForTimeout(300)

  const src = page.locator('.course-row').first()
  const target = page.locator('section.term').first()
  await src.hover()
  await page.mouse.down()
  await target.hover()
  await page.mouse.move(...(await target.boundingBox().then(b => [b.x + b.width / 2, b.y + 60])))
  await page.mouse.up()
  await page.waitForTimeout(400)
  let dropped = await page.locator('.placement').filter({ hasText: 'CS 6601' }).count()
  if (dropped === 0) {
    // Synthetic mouse events do not trigger the HTML5 drag protocol in Chromium;
    // dispatch the drag events directly to exercise the same handlers.
    await page.evaluate(() => {
      const dt = new DataTransfer()
      dt.setData('text/plain', 'CS 6601')
      const row = document.querySelector('.course-row')
      row.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }))
      const term = document.querySelector('section.term')
      term.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }))
      term.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
    })
    await page.waitForTimeout(400)
    dropped = await page.locator('.placement').filter({ hasText: 'CS 6601' }).count()
  }
  ok('drag and drop places a course', dropped === 1)

  // course detail
  await page.locator('.placement').filter({ hasText: 'CS 6601' }).locator('.course-code').click()
  await page.waitForTimeout(400)
  const sheet = page.locator('.sheet')
  ok('detail sheet opens', await sheet.isVisible())
  const txt = await sheet.innerText()
  ok('  … shows the scraped overview', /artificial intelligence/i.test(txt))
  ok('  … shows recommended background', /Recommended background/i.test(txt))
  ok('  … shows OMSCentral numbers', /rating \/ 5/i.test(txt) && /difficulty \/ 5/i.test(txt))
  ok('  … links to the GT course page', await sheet.getByRole('link', { name: /GT course page/ }).count() === 1)
  ok('  … links to OMSCentral reviews', await sheet.getByRole('link', { name: /OMSCentral reviews/ }).count() === 1)
  ok('  … shows which specializations it serves', /AI:|ML:|CPR:/.test(txt))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  ok('Escape closes the sheet', await page.locator('.sheet').count() === 0)

  // specialization what-if
  const before = await page.locator('.slotstrip').innerText()
  await page.locator('#spec-select').selectOption('hci')
  await page.waitForTimeout(400)
  const after = await page.locator('.slotstrip').innerText()
  ok('switching specialization re-validates the same plan', before !== after && /hci core|user interface/i.test(after))
  const freeBlock = after.slice(after.search(/free electives/i))
  ok('  … and CS 6601 becomes a free elective under HCI', freeBlock.includes('CS 6601'))
  ok('  … while it held an AI Core slot before', !before.slice(before.search(/free electives/i)).includes('CS 6601'))
  await page.locator('#spec-select').selectOption('ai')
  await page.waitForTimeout(300)

  // keyboard reachability: tab from the top and make sure we walk real controls
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur() })
  const walked = []
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    walked.push(await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      return { tag: el.tagName }
    }))
  }
  const real = walked.filter(Boolean)
  ok('keyboard tabbing reaches interactive controls', real.length >= 8)
  ok('  … and they are focusable elements, not divs',
      real.every(w => ['BUTTON', 'INPUT', 'SELECT', 'A', 'TEXTAREA'].includes(w.tag)))

  ok('no page errors on desktop', errs.length === 0)
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} flow check(s) FAILED` : '\nAll flow checks passed.')
process.exit(fails ? 1 : 0)
