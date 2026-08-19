# GT OMSCS Planner

A degree planner for the Georgia Tech Online MS in Computer Science. Ten requirement slots that
visibly fill, a semester board you drag or tap courses into, a validator that answers *"can I
graduate, and what's missing?"* against every rule the program actually enforces, and a cost
estimate built from the published Bursar rate sheets.

It opens straight into the plan. No login, no accounts, no setup wizard — see
[Why there is no login](#why-there-is-no-login).

**Live:** <https://goo913.github.io/GT-OMSCS-Planner/>

---

## What it does

| | |
|---|---|
| **Slot rail** | The ten slots the degree is made of, in one row. Navy = specialization, gold = free elective. Click a filled slot to open that course; **click an empty one to filter the library to exactly the courses that can fill it**. |
| **Semester board** | The primary surface. One card per term with a single line of chrome; everything else — deadlines, workload, half-time status, notes — sits behind the `ⓘ` and `⋯` affordances. Only terms that hold something render, plus one empty term as the next target. |
| **Graduation validator** | Every rule in `OMSCS_RULES.md` §1–§4, checked live: 30 hours, specialization slots, the foundational requirement *and its term window*, the 6-hour non-CS/CSE cap, the 24-hour CS/CSE floor, projected GPA, per-term registration caps, the six-year limit. Plus soft advisories: term availability, semester workload, recommended background. |
| **Cost estimator** | Per-semester tuition and Online Learning Fee, a running total, the fee cliff spelled out, and which semesters clear the half-time line for federal loans. Semesters using carried-forward rates are labelled `est`. |
| **Specialization what-if** | Switch among all six specializations and re-validate the same plan instantly. Courses that stop counting fall visibly into the free electives. |
| **Pacing** | Earliest possible completion given the per-term caps, feasibility of a target term, and a zero-slack warning when every remaining term runs at the cap. |
| **Course detail** | Scraped overview, recommended background, instructional team, OMSCentral rating / difficulty / workload / review count, which specializations it serves and in which slot, term availability, and outbound links to the GT page, OMSCentral, syllabi, and preview videos. |
| **Two views** | **Plan** for working (board + library + requirements) and **Summary** for reading — a calm numbered report of verdict, requirements, slot map, semesters, and cost. Summary is what prints. |
| **Command palette** | `⌘K` / `Ctrl+K` to find and place a course, jump to a term, switch specialization, or flip a setting. |
| **Settings** | Grade tracking (**off by default**), cost and workload display, target term, density, theme. |
| **Export / import** | Always-reachable JSON export and import, plus a rolling `localStorage` snapshot after every successful sync. |

Rules produce a verdict, not a block — with one exception. The **per-term registration cap is
enforced at the drop**, because Banner will simply refuse a registration that breaks it, so a plan
that exceeds it is not a plan. The refusal names the limit and offers to swap a course out. Every
other rule reports and lets you carry on.

**Not** a registration tool. It does not talk to OSCAR or Banner, and seat counts, waitlists, and
CRNs are not modelled at all.

---

## Local development

```bash
npm install
cp .env.example .env.local     # optional — see below
npm run dev
```

Open the URL Vite prints (note the `/GT-OMSCS-Planner/` path — that is the GitHub Pages base).

Without `.env.local` the app runs entirely from `localStorage` and the sync pill reads
`local only`. Everything works; it just does not sync between devices.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm test` | Rule scenarios (`scripts/validate-selftest.ts`) — **run this after any rule or data change** |
| `npm run test:flows` | Browser checks for the interface: cap enforcement, the course dialog, grade tracking, the slot rail, sidebars, ⌘K, mobile, and the colour budget. Needs a dev server and `npm i --no-save playwright-core`. Runs offline from localStorage, so it never touches the shared plan. |
| `npm run test:realtime` | Two-browser Firestore sync checks. **Destructive** — it writes to and clears the shared plan document. Export first. |
| `npm run lint` | oxlint |
| `npm run data` | Rebuild `src/data/*.json` from `data/sources/` |
| `npm run data:refresh` | Re-scrape omscs.gatech.edu and omscentral.com, then rebuild |

---

## Interface

The view layer is [shadcn/ui](https://ui.shadcn.com) on Tailwind v4, with the components under
`src/components/ui/` (added via the CLI, `components.json` at the root).

**Colour is spent deliberately.** Three hues at rest and no more:

| | |
|---|---|
| `neutral` | ~95% of the interface — surfaces, borders, text, inactive states |
| GT navy `#003057` | the single primary: filled slots, active states, selection |
| GT gold `#B3A369` | one accent, reserved for specialization identity |
| `destructive` | **only** when a rule is actually broken |

Difficulty and workload read as neutral *intensity* rather than hue — darker means more. That keeps
red and green off the screen and makes two courses easier to compare than three coloured bars did.
`npm run test:flows` asserts the hue budget, so a stray colour fails the build check rather than
quietly accumulating.

Every number carries an icon or a label, course codes and figures are monospace with `tabular-nums`,
and no paragraph of explanatory prose is visible on first load — the fee-cliff note, the
carried-forward-rates note, the half-time note and every rule's full text live in popovers attached
to the number each one explains.

Layout: a one-line header, the slot rail, then three resizable panes. Either sidebar collapses and
the board takes the space; widths and collapsed state persist. On a phone the panes become a bottom
tab bar with full-height sheets, and tap-to-assign is the only placement path.

---

## Why there is no login

This is a deliberate product decision, not an oversight.

It is one person's degree plan, maintained by two people who both need full access and neither of
whom wants to sign in. The whole plan lives in **one fixed Firestore document** — `plans/goo`.
Anyone with the GitHub Pages URL can read and edit it. That is intended.

There is no sign-in screen, no accounts, no Google sign-in, no email/password, and **no anonymous
auth either** — nothing calls `signInAnonymously()` or any other auth method in the background.
`src/lib/firebase.ts` imports only `firebase/app` and `firebase/firestore`; the auth SDK is not a
dependency of the app at all.

Security comes from the shape of what is writable, not from identity:

- `firestore.rules` opens exactly one document path and denies the entire rest of the database.
- A write is rejected unless the resulting document still has exactly the plan's top-level keys,
  with the right types and bounded sizes.
- `normalizePlan()` in `src/lib/plan.ts` re-validates everything on the way in, dropping unknown
  course codes and malformed placements rather than rendering them.
- The project stays on the Firebase **Spark (free)** plan with **no billing account attached**, so
  the worst case under abuse is an exhausted daily quota for a day — never a bill.

Because there is no account and no recovery path, **export regularly**. The `⋯` menu has
`Export plan (JSON)` and `Import plan…`, and a snapshot of the last successful sync is kept in
`localStorage` under `gt-omscs-planner:last-synced`.

---

## Firebase setup

Optional. Skip it entirely if you only ever use one device.

1. Create a project at <https://console.firebase.google.com>. **Do not attach a billing account** —
   stay on the Spark plan.
2. Create a Firestore database (production mode is fine; the rules below replace the defaults).
3. Add a Web app, copy the config, and put it in `.env.local`:

   ```
   VITE_FIREBASE_API_KEY=…
   VITE_FIREBASE_AUTH_DOMAIN=…
   VITE_FIREBASE_PROJECT_ID=…
   VITE_FIREBASE_STORAGE_BUCKET=…
   VITE_FIREBASE_MESSAGING_SENDER_ID=…
   VITE_FIREBASE_APP_ID=…
   VITE_PLAN_DOC_PATH=plans/goo
   ```

   These values are public by design — they ship in the client bundle. They are not secrets.
   `.env.local` is gitignored anyway so the file itself never lands in the repo.

4. Deploy the rules:

   ```bash
   npm i -g firebase-tools          # once
   firebase login
   firebase use --add               # pick the project, alias it "default"
   firebase deploy --only firestore:rules
   ```

   Or paste `firestore.rules` into **Firestore → Rules** in the console and click Publish.

5. Confirm: open the app in two browsers, move a course, and watch it appear in the other within a
   second or so. The pill in the header reads `saving` then `synced`.

**If you change `VITE_PLAN_DOC_PATH`, change the matching `match /plans/goo` line in
`firestore.rules` and redeploy** — otherwise every write is denied. The pill then reads
`not saved` in red rather than `offline`, because a rules rejection will not fix itself the way a
dropped connection does. The plan keeps working from `localStorage` either way; export it.

### How syncing behaves

- `onSnapshot` on the one document; remote edits land without a refresh.
- Writes are debounced ~500 ms and sent as **dotted field paths** (`placements.CS_6601.term`), so two
  people editing different courses merge at the field level instead of overwriting each other's
  document. Last write wins per field.
- Pending writes are flushed on `pagehide` and `visibilitychange`, so closing a tab mid-debounce
  does not lose an edit.
- If Firestore is unreachable the app keeps running fully from `localStorage` and re-queues the
  pending patch for the next successful flush. The plan is never lost.
- The pill distinguishes the two failure modes: `offline` retries by itself; `not saved` means the
  rules rejected the write and needs you to look at `firestore.rules`.
- The Firebase SDK is loaded with a dynamic `import()`, so first paint never waits on it.

---

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds and publishes on every push to `main`.

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions → Secrets**, add the six `VITE_FIREBASE_*` values.
3. Optionally add a repository **variable** `VITE_PLAN_DOC_PATH` (defaults to `plans/goo`).
4. Push to `main`.

The workflow runs `npm test` before building, so a data edit that breaks a documented rule stops the
deploy instead of shipping.

`vite.config.ts` reads `BASE_PATH` (the workflow sets it to `/<repo-name>/`). For a custom domain,
set `BASE_PATH=/`.

---

## Where the data comes from

Nothing about the degree is hard-coded in a component. Everything lives in `src/data/`:

| File | Contents | Source |
|---|---|---|
| `courses.json` | 77 courses: title, foundational flag, administering program, overview, recommended background, instructional team, syllabi, preview videos, GT specialization badges, term availability, OMSCentral metrics | omscs.gatech.edu course pages + omscentral.com |
| `specializations.json` | All six specializations as ordered slot groups, filtered to OMSCS-offered courses, with sub-area minimums | the six specialization pages (bold titles = offered in OMSCS) |
| `offerings.json` | Per-course `{fall, spring, summer}` plus the full 12-term history | Fall 2026 Course Offering History PDF |
| `tuition.json` | Per-credit-hour rate and Online Learning Fee tiers, per term, plus per-season carry-forward | the three Bursar rate sheets in the repo root |
| `rules.json` | Every degree, registration, foundational, seminar, grading, and financial-aid constant | `OMSCS_RULES.md` |
| `calendar.json` | Published Fall 2026 dates and the graduation application deadlines | Fall 2026 Orientation Document |
| `seminars.json` | The CS 8001 catalog, scheduled and past | omscs.gatech.edu/seminars |

`data/sources/` holds the raw parsed scrapes those files are generated from, committed so a rebuild
is reproducible without hitting the network.

### Updating the course catalog when GT changes it

GT refreshes the course list, the specialization pages, and the offering-history PDF every term.

```bash
python3 -m venv .venv
./.venv/bin/pip install pdfplumber
rm -rf .scrape-cache                          # force a refetch
./.venv/bin/python scripts/fetch-sources.py   # ~85 pages + the offering PDF, cached as it goes
python3 scripts/build-data.py
npm test
git diff --stat src/data data/sources
```

`fetch-sources.py` prints the course count and foundational count as it goes — if either moves,
read the diff before committing. `build-data.py` prints a note for any current course with no
offering history and for any history row that is no longer on the current list.

Two things to watch for:

- **A renumbered course.** GT promotes `CS 8803 O##` special topics to permanent numbers. Add the
  mapping to `RENUMBERED` in `scripts/build-data.py` so the course keeps its offering history.
- **The offering-history PDF changing layout.** `scrape_offering_history()` maps emoji to term
  columns by x-position, using the constants in `PDF_COL_CENTERS`. If GT adds or removes a term
  column, re-derive them: open the PDF with pdfplumber, `print(page.extract_words())`, and read the
  header row's `x0`/`x1` for each term.

### Adding a new term's tuition

GT publishes one rate sheet per term at <https://bursar.gatech.edu/tuition-fees>.

1. Drop the PDF in the repo root, named like the ones already there
   (`Fall 2027 Tuition and Fee Rates per Semester.pdf`).
2. Read the OMSCS row and the Online Learning Fee row:

   ```bash
   ./.venv/bin/python -c "
   import pdfplumber, sys
   with pdfplumber.open(sys.argv[1]) as pdf:
       for pg in pdf.pages:
           for line in (pg.extract_text() or '').split(chr(10)):
               if 'Computer Science (OMSCS)' in line or 'Online Learning Fee' in line:
                   print(line)
   " "Fall 2027 Tuition and Fee Rates per Semester.pdf"
   ```

   The OMSCS row reads `$<in-state> /hr $<out-of-state> /hr $<out-of-country>/hr`. **OMSCS bills the
   in-state column regardless of your residency classification** — that is the first number.

3. Add the term to `build_tuition()` in `scripts/build-data.py`, keyed `YYYY` + `FA`/`SP`/`SU`, with
   `estimated: False` and the PDF's filename as `source`. Update `carryForward` for that season so
   unpublished future terms inherit the newest sheet.
4. `npm run data && npm test`.

**Do not** assume the Online Learning Fee is the same across seasons. Summer runs lower — $183/$455
against Fall and Spring's $212/$531 — which is exactly why `carryForward` is keyed by season.

---

## Editing `OMSCS_RULES.md` and having the validation follow

`OMSCS_RULES.md` is the source of truth. The app never reads it directly — it reads `src/data/`,
which is generated from it. The loop is:

1. **Edit `OMSCS_RULES.md`.** Put the new value in the right section, flip the confidence marker,
   cite the source URL, and add a line to the change log at the bottom.
2. **Tell Claude Code what changed**, e.g.:

   > *"I updated §2 of OMSCS_RULES.md — the Summer cap is now 6 hours. Patch the app to match."*

   Claude will edit `build_rules()` in `scripts/build-data.py` (not a component), regenerate
   `src/data/rules.json`, update the affected check in `src/lib/validate.ts` if the rule's *shape*
   changed rather than just its number, add or amend a scenario in
   `scripts/validate-selftest.ts`, and run `npm test`.
3. **Read the test output.** Every documented rule has a named scenario; a rule change that breaks
   an unrelated one is the signal to look closer.

Where each section lands:

| `OMSCS_RULES.md` | Data | Checked in `src/lib/validate.ts` |
|---|---|---|
| §1 degree requirements | `rules.json → degree` | `credit-hours`, `non-cs-cse`, `cs-cse-24`, `gpa`, `min-grades`, `time-limit` |
| §1 foundational | `rules.json → foundational` | `foundational`, `foundational-lock` |
| §1 seminars | `rules.json → seminars` | excluded from all degree math by `isSeminarCode()` |
| §2 registration caps | `rules.json → registration` | `term-cap`, and the pacing calculator |
| §3 prerequisites | `rules.json → prerequisites` | `background` (advisory only — never a block) |
| §4 specializations | `specializations.json` | one `spec-*` check per group, plus `free-electives` |
| §6 offering patterns | `offerings.json` | `offering-season` (advisory) |
| §7 cost | `tuition.json` | `src/lib/cost.ts` |
| §8 calendar | `calendar.json` | rendered per term on the board |
| §9 financial aid | `rules.json → financialAid` | half-time flags on the board and cost panel |

Rules that are a **number** usually need only a data edit. Rules that change **shape** — a new
sub-area minimum, a different way of counting a slot — need a matching change in `validate.ts`.
The specialization matcher (`assignSpecialization`) handles "take N from this list" and "at least
one from each sub-area" generically; anything stranger than that is new code.

---

## Project layout

```
src/
  data/            generated JSON — the only place rules and rates live
  lib/
    terms.ts       term ids, ordering, ranges, the six-year limit
    catalog.ts     merged course + seminar catalog and lookups
    validate.ts    the validator: slot matching and every check
    placement.ts   the one rule enforced rather than reported: the per-term cap
    cost.ts        tuition, fees, the fee cliff, half-time
    plan.ts        plan shape, normalisation, export/import
    store.ts       usePlan(): localStorage + debounced Firestore sync
    firebase.ts    lazy SDK init. No auth, on purpose.
  hooks/
    use-prefs.ts   device-local preferences (theme, density, panel state)
  components/
    ui/            shadcn/ui primitives, added via the CLI
    app-header     one line: logo, specialization, view toggle, ⌘K, settings
    slot-rail      the ten slots; click an empty one to filter the library
    board          semester cards; one line of chrome, then courses
    library-panel  search, ToggleGroup filters, two-line course rows
    requirements-  one line per rule, full text in a popover; cost collapses
      panel
    course-dialog  opens from anywhere a course appears
    summary-view   the read: numbered sections, and what prints
    command-palette, settings-sheet, metric, logo
scripts/
  fetch-sources.py   re-scrape every primary source into data/sources/
  build-data.py      data/sources/ + the tuition PDFs -> src/data/
  validate-selftest.ts  rule scenarios (npm test)
  flow-test.mjs      browser interaction checks
data/sources/      raw parsed scrapes, committed for reproducibility
firestore.rules    one open document, everything else denied
```

The validator is pure: `validate(plan)` in, a `Validation` out. It has no React in it and is the
right place to start reading. `checkCap(plan, code, term)` in `placement.ts` is the only other
decision-maker — it is what refuses a drop.

---

## Accessibility and print

Keyboard-navigable throughout with visible focus rings, `Escape` closes every overlay, and `⌘K`
reaches most of the app without the mouse. Radix primitives carry the dialog, menu, and listbox
semantics; icons that are not self-evident have tooltips, and icon-only buttons have labels.
`prefers-reduced-motion` is respected. Light and dark follow the system, with an override in
Settings.

`⋯ → Print summary` switches to the Summary view and prints that — a top-to-bottom report rather
than a screenshot of a working surface.

---

## Caveats

Cost figures are estimates from published rate tables and exclude textbooks, proctoring, and
course-specific fees. This is not financial advice. Course offering history is informational only —
GT does not finalise a term's offerings until shortly before that term's Phase I registration.
Recommended background is advisory: OMSCS enforces no prerequisites, and the app never blocks a
placement on it.
