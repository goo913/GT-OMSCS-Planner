# Redesign Request — GT OMSCS Planner

The engine is right. Keep it. **This is a UI/UX rewrite only.**

Do not change validation logic, the rule set, the Firestore sync, or the data pipeline — except for the three functional bugs listed in §7. Everything else here is presentation.

**Start the interface over.** Do not incrementally adjust the current layout; it is dense past the point of being readable and patching it will preserve the underlying structure that caused that. Rebuild the view layer around the principles below.

---

## 1. The core problem

Right now the app shows **everything, permanently, at once**: a three-column layout where the course library, the semester board, and a right rail of prose all compete, on top of a header band that eats 350px before any content appears.

Nothing is prioritized, so nothing reads. The specific failures:

| What's on screen | Why it fails |
|---|---|
| Three panes side by side, none dismissible | The eye has no entry point. Every pane is fighting for the same attention. |
| Right rail full of explanatory prose (prerequisites paragraph, fee-cliff paragraph, carried-forward-rates paragraph, half-time paragraph) | This is **read-once** content occupying **always-visible** space. |
| Course card shows `4.3 · 2.5 · 10h` as three unlabeled colored bars | Unreadable. Nobody can tell which number is rating, which is difficulty, which is workload. |
| Semester card carries term name, cost, hours, workload bar, hrs/wk, half-time badge, foundational-window badge, course cards, four deadline rows, a calendar link, and a notes field | One card, eight information types. Every semester is a wall of text. |
| Empty 2028–29 and 2029 terms render at full size | The target is a 2-year plan. These are noise. |
| Navy, gold, green, and red all used as micro-bars and badges simultaneously | Four hues at equal weight means color carries no meaning. |

**The fix is not "remove features." It is progressive disclosure.** Every feature stays. Almost none of it stays permanently visible.

---

## 2. Design system

Adopt **shadcn/ui** — https://ui.shadcn.com/ — as the component foundation. Install it properly (`components.json`, `src/components/ui/`), don't hand-roll approximations.

Components that should carry most of this UI:
`Sidebar` · `Sheet` · `Dialog` · `Popover` · `HoverCard` · `Tooltip` · `Collapsible` · `Accordion` · `Tabs` · `Badge` · `Card` · `Separator` · `ScrollArea` · `Resizable` · `Switch` · `Select` · `Command` · `Progress` · `Table` · `Alert` · `DropdownMenu` · `Toggle Group`

### Color — https://ui.shadcn.com/colors

- **Base scale: `neutral`.** This is roughly 95% of the interface — surfaces, borders, text, dividers, inactive states.
- **Georgia Tech navy `#003057` = the single primary.** Filled requirement slots, primary buttons, the active/selected state. One color, used consistently, meaning "this is filled / this is active."
- **Georgia Tech gold `#B3A369` = one accent, used sparingly.** Reserve it for specialization identity — the specialization slot group, the specialization badge on a course. Nothing else.
- **`destructive` red only for real rule violations.** Over the credit cap. Foundational window blown. Not for "difficulty is high."
- **Remove green entirely.** A completed requirement reads as *filled navy*, not as green. Green currently competes with gold and dilutes both.
- Difficulty/workload bars use the **neutral scale by intensity**, not hue — light neutral to dark neutral. Higher difficulty = darker bar. This removes three colors from the screen and is more legible than red/green.
- Full dark mode via shadcn CSS variables.

### Typography
- shadcn defaults (Geist / Inter) for UI text.
- **Monospace for every course code and every number.** Course codes are identifiers; ratings, hours, and dollars are data. `tabular-nums` everywhere numbers stack in a column.
- Real hierarchy: most text one or two steps smaller than it is now, with a small number of genuinely prominent elements. Right now everything is 12–13px and equally loud.

### Icons — https://react-icons.github.io/react-icons/
Replace text labels with icons wherever the meaning is unambiguous. Every icon that isn't self-evident gets a `Tooltip`. Suggested vocabulary (use one family consistently, e.g. `lucide` via react-icons or `lucide-react`):

| Meaning | Icon |
|---|---|
| Rating | star |
| Difficulty | gauge / activity |
| Workload | clock |
| Review count | message-square |
| Foundational | award or shield |
| Term availability | calendar |
| Cost | dollar-sign |
| Warning / violation | alert-triangle |
| Info / explain | info |
| External link | arrow-up-right |
| Notes | sticky-note |
| Collapse / expand | chevrons |

### Logo
Use `Georgia_Tech_Yellow_Jackets_logo.svg`. Small, in the header, left of the title, sized to the text. It is an identity mark, not decoration — do not let it grow.

---

## 3. Layout

### Desktop

```
┌──────────────────────────────────────────────────────────────┐
│  [logo] OMSCS Planner    [AI ▾]  [⚙]  [⌘K]  [⋯]              │  ← slim header, one line
├──────────────────────────────────────────────────────────────┤
│  ▪▪▪▪▪▪▫▫▫▫   7/10 slots · 21/30 hrs · Summer 2028           │  ← slot rail, ONE row
├────────┬────────────────────────────────────────┬────────────┤
│        │                                        │            │
│ Course │          SEMESTER BOARD                │ Require-   │
│ library│          (the primary surface)         │ ments      │
│        │                                        │            │
│ ◀      │                                        │      ▶     │
└────────┴────────────────────────────────────────┴────────────┘
```

- **The semester board is the app.** It gets the space by default.
- **Both side panels are shadcn `Sidebar`s: collapsible and resizable.** Remember collapsed/expanded state and width. Either or both can be closed, and the board expands to fill.
- **Header is one line.** Logo, title, specialization `Select`, settings, command palette, overflow menu. Nothing else.
- **The slot rail is one horizontal row of 10 squares** with a compact readout. Not the current 350px block with four labeled groups stacked. Group membership is conveyed by a thin separator and a `Tooltip`/`HoverCard` on hover, not by permanent headers.

### The slot rail should be interactive, not decorative
This is the best idea in the current app and it's being wasted as a display.

- **Filled slot** — navy, course code in mono. Hover → `HoverCard` with title, term, and the requirement it satisfies. Click → scroll the board to that course and highlight it.
- **Empty slot** — dashed neutral outline. Hover → `Tooltip` naming what fits ("AI Core — one of six courses"). **Click → filters the course library to exactly the courses that can fill it, and opens the library if it's closed.**

That one interaction converts the rail from a progress bar into the primary way to plan.

### Mobile
Three panes cannot coexist on a phone. Use a **bottom tab bar**: `Board` · `Library` · `Requirements`. The slot rail stays pinned under the header, horizontally scrollable. Library and Requirements open as full-height shadcn `Sheet`s. Tap-to-assign is the only placement path — no drag.

---

## 4. Component-level direction

### 4.1 Course card in the library — shrink hard

Two lines by default:

```
CS 6750   Human-Computer Interaction              [+]
★ 4.04   ◐ 2.57   ◷ 12h   ·  FOUND  ·  F Sp Su
```

- Icons instead of words. Numbers in mono.
- The three metric bars stay, but as **thin neutral-intensity bars under their numbers**, not three colored bars in a row.
- Hover → `HoverCard` with the first ~2 sentences of the description and which requirement it satisfies.
- Click anywhere on the card → **course detail `Dialog`** (§4.4).
- `[+]` places it into the currently focused term. Remove the separate "Place" button and swap icon — one primary action, the rest in a `DropdownMenu` on right-click / long-press.
- Filters (`Foundational`, `Counts for AI`, `Not placed`, `CS/CSE only`, `Seminars`) become a shadcn `ToggleGroup`, one compact row. The difficulty slider and term `Select` collapse into a single "Filters" `Popover` with a count badge when active.

### 4.2 Semester card — one line of chrome, then courses

```
Fall 2026                    2/2 · 6 hrs · $1,893   [ⓘ] [⋯]
────────────────────────────────────────────────────
  CS 6035   Introduction to Information Security
  CS 6750   Human-Computer Interaction
  ＋ Add course
```

Everything currently crowding this card moves behind affordances:
- **Deadlines (4 rows) + calendar link** → the `[ⓘ]` `Popover`.
- **half-time badge, foundational-window badge, workload hrs/wk** → also in that popover, or as small icon-only indicators with tooltips. `half-time` in particular is financial-aid trivia that does not need to be on the board at all times.
- **Workload bar** → a single thin bar under the header line, unlabeled, with the number in the tooltip.
- **Notes** → `[⋯]` menu, and only render the notes area when a note exists.
- **Cost** → the number only; the derivation goes in the tooltip.

### 4.3 Which terms render
- Show terms **from the matriculation term through the last term containing a course**, plus **exactly one empty term** as the next drop target.
- A **`＋ Add term`** button appends the next one.
- Terms beyond the plan (2028–29, 2029) do not render at all until they contain something.
- Keep the academic-year grouping, but collapse it to a thin `Separator` with a small year label — not a full header row with a course count and a cost.

### 4.4 Course detail Dialog — currently missing, and it's the biggest gap

A shadcn `Dialog` that opens from **anywhere a course appears** — library card, placed card on the board, filled requirement slot. Right now clicking a placed course does nothing, which is the single most frustrating thing in the app.

Contents, in this order:
1. `CS 6750` · Human-Computer Interaction · 3 hrs · `FOUND` · terms offered
2. **Metrics row** — rating, difficulty, workload, review count, each with icon and bar
3. **Description** (scraped)
4. **Topics the course names as background** — as an advisory list, phrased as the course's own words, not as a claim about the user. (Your earlier judgment call here was correct — keep it.)
5. **Requirement fit** — which slot it fills under the current specialization, and under the other five if switched
6. **Placement** — term `Select`, grade `Select` (only when grade tracking is on), remove
7. **Links** — GT course page, OMSCentral reviews, syllabus, sample videos

### 4.5 Requirements sidebar — collapse the prose

- Each requirement is **one line**: icon + short name + `3/5`. That's it.
- Click or hover → `Popover` with the full rule text and what's missing.
- Use an `Accordion` if grouping is needed; default all sections collapsed except violations.
- **Violations bubble to the top**, in `destructive`, and are the only thing expanded by default.
- **Cost**: one line — `Estimated total  $9,300` — expanding to the per-term `Table`. The fee-cliff explanation, the carried-forward-rates note, and the half-time note become `[ⓘ]` popovers attached to the specific number each one explains. **None of them are paragraphs on the screen by default.**
- The prerequisites explainer paragraph is removed from the rail entirely. It belongs in the course detail dialog and in the README.

### 4.6 Settings — new, via `Sheet` or `Dialog` from the header gear

| Setting | Default |
|---|---|
| **Track grades** | **Off** |
| Target graduation term | Summer 2028 |
| Show cost estimates | On |
| Show workload estimates | On |
| Density (comfortable / compact) | Comfortable |
| Theme (light / dark / system) | System |

**Grade tracking off** must genuinely simplify the app, not just hide a dropdown:
- No grade `Select` on any card or dialog
- **GPA requirement disappears from the requirements list**
- The B-minimum and C-minimum rules become **advisory notes** on the relevant slots ("will require a B") rather than pass/fail checks
- The foundational check counts *planned* courses instead of *passed* ones, and says so

### 4.7 Command palette (`⌘K` / `Ctrl+K`)
shadcn `Command`. Search and place a course, jump to a term, toggle a setting, switch specialization, export. For a keyboard user this replaces most of the chrome the current UI spends space on.

---

## 5. Keep the report view

The earlier single-file prototype (`omscs_ai_planner.html`) had a quality worth preserving: a **calm, top-to-bottom, numbered-section read** — verdict, then requirements, then slots, then semesters. It was pleasant to *read*, where the current app is only usable to *operate*.

Add a second view, toggled in the header (`Tabs` or `ToggleGroup`): **Plan** (the board, for working) and **Summary** (a scrolling read-only report: verdict, requirement checklist, slot map, semester-by-semester with costs and deadlines, total cost table, pacing). The Summary view is also what the existing print stylesheet should target.

Two views, two jobs. Don't try to make one screen do both — that is exactly how the current layout got overloaded.

---

## 6. Interaction rules

- **Drag and drop stays on desktop**, with a clear drop-target highlight and a `destructive` state when the drop would violate the cap.
- **Tap-to-assign is the mobile path**, and it is first-class.
- Every destructive action (remove course, clear term, reset plan) uses `AlertDialog` — except removing a single course, which should just work with an **undo `Toast`**.
- Empty states get one line and one action, not explanatory paragraphs.
- Animate only state changes that need to be noticed (slot filling, violation appearing). Nothing decorative.
- Keyboard: tab order follows visual order, visible focus rings, `Esc` closes overlays, arrow keys move between slots.

---

## 7. Functional bugs to fix

1. **The per-term credit cap is not enforced.** Three courses can be placed in one Fall term (9 hrs against a 7-hr cap). Placement that would exceed the cap must be **blocked at the drop**, with an inline reason and an offer to replace an existing course. Enforce it on **credit hours** (Fall/Spring ≤ 7, Summer ≤ 5) **and** on degree-course count (Fall/Spring ≤ 2, Summer ≤ 1) — the verified rules in `OMSCS_RULES.md` §2 are hours-based with a separate course-count limit, and both must hold.
2. **Clicking a placed course card does nothing.** It must open the detail dialog (§4.4).
3. **Grade tracking cannot be turned off.** Add the setting (§4.6) and make the requirement set respond to it.

---

## 8. Acceptance

- At 1440px, with both sidebars open, the semester board still gets at least half the width.
- With both sidebars closed, the board is the whole screen and nothing is lost.
- No paragraph of explanatory prose is visible on first load. Every explanation is one click or one hover away.
- At 380px, a course can be found and placed in under four taps, with no horizontal scrolling anywhere.
- Total distinct hues on screen at rest: neutral + navy + gold. Red appears only when a rule is actually broken.
- Every number on screen either has an icon or a label. No bare unlabeled figures.
- First paint shows a usable board with no loading wall.
