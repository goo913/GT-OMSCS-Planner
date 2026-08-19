# Build Request: GT OMSCS Degree Planner

Build a complete, production-ready web app in this repo. **Do all of it in one pass — no phases, no MVP-then-iterate.** Take as long as you need. Research first, then build.

---

## 0. Read these before writing any code

**In this folder (`/Users/goo/Documents/Projects/GT-OMSCS-Planner/`):**

| File | What it is |
|---|---|
| `OMSCS_RULES.md` | **The authoritative rule set.** All degree/registration/cost validation logic must derive from this file. It marks each rule ✅ VERIFIED or ⚠️ VERIFY — you must independently confirm every ⚠️ item and correct the file if it is wrong. |
| `omscentral.com - Rates.csv` | Rating / Difficulty / Workload / Review-count for ~137 OMSCS courses, scraped from omscentral.com |
| `Fall 2026 GT OMSCS Classes.csv` | Fall 2026 OSCAR class search dump (99 online CS sections) — useful for course codes, titles, instructors. **Seat/waitlist data in here is for reference only; ignore it for planning.** |
| `GT_OMSCS_Fall2026.xlsx` | Same data enriched with foundational flags and specialization mapping |
| `omscs_ai_planner.html` | An earlier single-file prototype. Useful for the requirement-slot concept. **Do not extend it — this is a rewrite.** |
| `Fall 2026 Tuition and Fee Rates per Semester.pdf` | Official GT Bursar rate sheet |
| `Spring 2027 Tuition and Fee Rates per Semester.pdf` | Official GT Bursar rate sheet |
| `Summer 2027 Tuition and Fee Rates per Semester.pdf` | Official GT Bursar rate sheet |

**Also look at:** `/Users/goo/Documents/Eunbee/gsu-grad-planner/` — a degree planner I built previously for a different school. Read it for UX ideas (course library on the left, drag into semester columns, live progress bars in the header). **You are not required to reuse any of it.** If you want a different structure, do that instead. It is a reference, not a constraint.

---

## 1. Research phase — do this first

Fetch and parse the primary sources. Do not rely on memory or on `OMSCS_RULES.md` alone.

1. **https://omscs.gatech.edu/current-courses** — the full course list. The asterisk (`*`) marks foundational courses. Note the footnote codes for Analytics/Cybersecurity-administered courses.
2. **Every individual course page** linked from that list (roughly 60 pages). For each course extract: full description/overview, recommended background/preparation, syllabus link, sample-video link, instructor(s).
3. **The "Course Offering History" PDF** linked from the current-courses page. Derive a `{fall, spring, summer}` availability flag per course.
4. **https://omscs.gatech.edu/degree-requirements** and **https://omscs.gatech.edu/specializations** and **https://www.cc.gatech.edu/ms-computer-science-specializations** — the exact requirement structure for **all six** OMSCS specializations. Filter each list down to courses actually offered in OMSCS.
5. **The most recent OMSCS Orientation Document** (PDF, linked from omscs.gatech.edu) — confirms registration caps, the foundational requirement, seminar rules, section-code restrictions.
6. **The three tuition PDFs in this folder** — extract per-credit-hour rate and Online Learning Fee tiers per term.
7. **omscentral.com** — if you can pull richer data than the CSV (per-semester review trends, recent reviews), do; otherwise the CSV is sufficient.

**When your research contradicts `OMSCS_RULES.md`, update `OMSCS_RULES.md`** with the correct value, flip the marker to ✅ VERIFIED, cite the source URL, and add a line to its change log. That file must stay the single source of truth after you're done.

Write all derived course data to versioned JSON under `src/data/` (e.g. `courses.json`, `specializations.json`, `tuition.json`, `offerings.json`). **Never hard-code rules or rates inside components.**

---

## 2. What the app must do

### 2.1 Core interaction
- **Course library** — every OMSCS course, browsable and searchable.
- **Realtime shared state** — two people may have the app open at once on different devices. Edits should appear on the other screen without a refresh.
- **Semester board** — columns for each term from Fall 2026 forward (Fall / Spring / Summer, ~4 years out). Assign courses to terms by **drag and drop on desktop** and by **tap-to-assign on mobile** (drag-and-drop is unusable on phones — the tap path must be first-class, not a fallback afterthought).
- **Mark courses complete with a grade.** Fall 2026 is already registered: CS 6035 and CS 6750. I will enter those myself — **do not hard-code them.**
- The user must feel free to place anything anywhere. **Rules produce warnings and a running verdict, not hard blocks** — except where the rule is genuinely absolute (per-term course cap, non-CS/CSE cap). Even then, allow the placement and show it in red rather than silently refusing.

### 2.2 Course detail view
Clicking any course opens a detail panel showing:
- Full description and recommended background (scraped)
- Rating / Difficulty / Workload / review count, with small visual bars
- Which specializations it satisfies and in which slot
- Foundational status
- Term availability
- Outbound links: GT course page, OMSCentral reviews, syllabus

### 2.3 Graduation validator
A persistent panel answering **"can I graduate, and what's missing?"** Every rule in `OMSCS_RULES.md` §1–§4 must be checked live:
- 30 credit hours / 10 courses
- Specialization complete (per-slot: e.g. AI = algorithms 1, core 2, electives 2)
- Foundational: 2 courses with B+ **within the first 3 terms** — check the term placement, not just the count
- ≤ 6 credit hours non-CS/CSE
- ≥ 24 credit hours CS/CSE 6000+
- Cumulative GPA ≥ 3.0 (projected from entered grades)
- Per-term cap: Fall/Spring ≤ 2 courses + 1 seminar; **Summer ≤ 1 course**
- 6-year time limit
- Seminars excluded from all degree math
- Soft warnings: recommended background not met, course placed in a term it's never offered in, semester workload over ~30 hrs/week

### 2.4 Cost estimator
- Per-semester cost from the parsed tuition tables (tuition = rate × hours; plus the correct Online Learning Fee tier).
- Running total for the whole plan.
- Clearly label semesters using carried-forward rates as **estimated**.
- Show the fee cliff explicitly — going from 1 course to 2 in a term costs ~$1,000 more, not ~$681.
- Flag which semesters are ≥ 6 hours (federal-loan half-time eligible) and which are not.

### 2.5 Specialization what-if
Let me switch the active specialization among all six and instantly re-validate the same set of planned courses. Show which courses would still count and which would become free electives.

### 2.6 Things I'd find useful (your call on execution)
- Target-graduation-date selector that says whether the plan is feasible given the per-term caps, and shows the earliest possible completion.
- A "zero slack" indicator: at max load, 10 courses over 6 terms means one dropped course = one lost semester.
- Workload forecast per semester summed from OMSCentral hours, with a visual load bar.
- Sort/filter the library by difficulty, workload, rating, foundational, specialization relevance, term availability.
- Compare 2–3 courses side by side.
- Per-semester notes field.
- Known deadlines per semester (payment deadline, withdrawal deadline) where published.
- Print/export the plan (and a JSON export as a manual backup path).

Add anything else you think genuinely helps. Skip anything that would just be decoration.

---

## 3. Technical requirements

- **Stack:** React + Vite + TypeScript. I already work in React/Vite daily, so match that.

- **NO AUTHENTICATION OF ANY KIND. This is a deliberate product decision, not an oversight.**
  No login screen. No accounts. No Google sign-in. No email/password. **No anonymous auth either** — do not call `signInAnonymously()` or any other auth method "silently in the background." Do not add a sign-in step, a gate, a setup wizard, or a "create your plan" onboarding flow.
  The app opens directly into the planner with the plan already loaded. Anyone who has the GitHub Pages URL can read and edit. That is intended: this is one person's degree plan, maintained by two people who both need full access, and neither of them wants to log in.
  **If you find yourself adding an auth mechanism for security reasons, stop — that is explicitly out of scope. Ask me instead.**

- **Persistence: one single fixed Firestore document.** Not per-user, not per-URL, not keyed by a generated ID. A hard-coded path such as `plans/goo` holds the entire plan. Everyone who opens the app reads and writes that same document.
  - Subscribe with `onSnapshot` so both devices see each other's edits live instead of overwriting one another.
  - Debounce writes (~500ms) so dragging a course doesn't fire a write per frame.
  - Two people may edit simultaneously. Structure the document so realtime updates merge at the field level rather than replacing the whole object on every interaction. Last-write-wins at the field level is fine.
  - Show a small, quiet sync indicator (`synced` / `saving` / `offline`). No modal, no toast spam.

- **Firestore rules** — commit `firestore.rules` opening read/write on that one document path and denying everything else in the database:

  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /plans/goo {
        allow read: if true;
        allow write: if request.resource.data.keys().hasOnly([/* your top-level keys */]);
      }
      match /{document=**} {
        allow read, write: if false;
      }
    }
  }
  ```
  Adjust the key list to match your actual schema, and put the deploy command in the README. Keep the project on the free Spark plan with no billing account attached — worst case under abuse is exhausted quota for a day, never a bill.

- **Backup is the safety net.** Because there is no account and no recovery path, include an always-reachable **Export plan (JSON)** and **Import plan** control, and keep a rolling snapshot in `localStorage` after every successful sync.

- **Config:** read Firebase config from `import.meta.env.VITE_*`. Provide a committed `.env.example`. `.gitignore` must exclude `.env.local`.

- **Offline/degraded mode:** if Firebase is unreachable, keep operating fully from `localStorage` and reconcile when it comes back. **Never lose the plan.**

- **Hosting:** deploy to **GitHub Pages** via a GitHub Actions workflow on push to `main`. Set `base` in `vite.config.ts` to the repo name. Firebase env values come from GitHub Actions repository secrets. Include the workflow file.

- **Mobile:** fully responsive, usable one-handed on a phone. Test the tap-to-assign flow at ~380px width. This is a hard requirement, not a nice-to-have.

- **First paint must be useful.** No auth gate, no loading wall, no empty state that requires setup. The course library and semester board render immediately.

- **Accessibility:** keyboard-navigable, visible focus states, sensible contrast.

## 4. Design direction

Not a generic dashboard. This is a **planning instrument** — something I'll stare at while deciding whether to spend two years and $9,000. Aim for a considered, information-dense, calm interface.

- Georgia Tech's palette is the honest starting point: navy `#003057`, gold `#B3A369`. Push it somewhere with more character than a bootstrap template — a slightly cool paper background, real typographic hierarchy, tabular figures for all numbers.
- **Monospace for course codes and all numeric data.** They are identifiers and data, and should read as such.
- The requirement slots are the emotional center of the app — 10 slots that visibly fill. Make that the thing I want to look at.
- Use color semantically and sparingly: filled/complete, partial, over-limit. Not decoratively.
- Dense but breathable. I'd rather see everything on one screen than click through tabs.

---

## 5. Deliverables

1. Working app, fully built and running locally.
2. All scraped/derived data committed as JSON under `src/data/`.
3. `OMSCS_RULES.md` updated with everything you verified or corrected.
4. `firestore.rules` in the repo, plus the exact `firebase deploy --only firestore:rules` command (or console steps) in the README.
5. `.env.example`, `.gitignore`, GitHub Actions deploy workflow.
6. `README.md` covering: local dev setup, how to add a new term's tuition PDF, how to update the course catalog when GT changes it, and **how to edit `OMSCS_RULES.md` and have you patch the validation logic to match**.
7. Deployed and reachable at the GitHub Pages URL.

---

## 6. Non-goals

- Not a registration tool. Does not talk to OSCAR/Banner. Seat counts, waitlists, and CRNs are not planning inputs.
- No accounts, no login, no user profiles. Identity is just "which plan ID is in your URL".
- Not real-time collaborative editing with cursors/presence. Last-write-wins on a shared document is sufficient.
- Not a financial advisor. Cost figures are estimates from published rate tables and must say so.

---

## 7. Ground rules for you

- **Verify before you encode.** Every ⚠️ VERIFY item in `OMSCS_RULES.md` gets checked against a primary source. If a source is ambiguous, encode the conservative reading and leave a `// TODO(verify):` comment plus a note in the rules file.
- **Do not invent prerequisites.** OMSCS enforces none between courses. Recommended background is advisory only. See `OMSCS_RULES.md` §3.
- Rules and rates live in data files, not in component logic.
- Ask me if something is genuinely ambiguous. Otherwise use your judgment and keep going.
