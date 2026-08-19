# OMSCS Degree Rules — Source of Truth

> This file is the **authoritative rule set** for the GT OMSCS Planner app.
> The app must read its validation logic from these rules. When GT changes a policy,
> edit this file and ask Claude Code to patch the app to match. Each rule below names
> the file under `src/data/` that carries it — see the README section
> "Editing the rules" for the exact loop.
>
> **Confidence markers used below:**
> - ✅ **VERIFIED** — confirmed from a primary source or from the student's own GT account/bill
> - ⚠️ **VERIFY** — believed correct; must be re-confirmed against the primary source
>
> Student context: Goo Choi · GTID 903886681 · matriculated **Fall 2026** · Catalog year **2026–2027**
> · Program: MS in Computer Science, Online (OMSCS) · Target specialization: **Artificial Intelligence**
> · Target graduation: **Summer 2028** (2 years)
>
> **Primary sources used for the 2026-08-19 verification pass**
>
> | Source | Used for |
> |---|---|
> | [Fall 2026 OMSCS Orientation Document (PDF)](https://omscs.gatech.edu/sites/default/files/documents/Orientation%20Documents/Fall%202026%20Orientation%20Document.pdf) | registration caps, foundational requirement, degree requirements, section codes, calendar |
> | [Degree Requirements](https://omscs.gatech.edu/degree-requirements) | 30 hours, GPA, non-CS/CSE cap |
> | [Current Courses](https://omscs.gatech.edu/current-courses) | course list, foundational asterisks, administering program |
> | [The six specialization pages](https://omscs.gatech.edu/specializations) | specialization structure; **bold titles = offered in OMSCS** |
> | [Fall 2026 Course Offering History (PDF)](https://omscs.gatech.edu/sites/default/files/documents/Other/Fall%202026%20OMSCS%20Course%20Offering%20History.pdf) | per-term availability, Fall 2022 → Summer 2026 |
> | [Seminars](https://omscs.gatech.edu/seminars) | CS 8001 catalog |
> | Bursar rate sheets (3 PDFs in this folder) | tuition and Online Learning Fee |
> | [GT Financial Aid — Enrollment Requirements](https://finaid.gatech.edu/manage-aid/enrollment-requirements) | half-time definition |
> | [omscentral.com](https://www.omscentral.com) | rating, difficulty, workload, review counts |

---

## 1. Degree Requirements ✅ VERIFIED

Sources: <https://omscs.gatech.edu/degree-requirements>; Fall 2026 Orientation Document, Section C.
App data: `src/data/rules.json` → `degree`.

| Rule | Value |
|---|---|
| Total credit hours | **30** |
| Total courses | **10** (every OMSCS degree course is exactly 3 credit hours) |
| Specializations required | **Exactly 1** |
| Specialization size | **15–18 credit hours** (5–6 courses) |
| Free electives | Remaining **12–15 credit hours** (4–5 courses) — any OMSCS course |
| Min grade, specialization courses | **B** |
| Min grade, courses counting toward the 30 hours | **C** |
| Max credit hours at the 4000 level **and/or** with a subject code other than CS or CSE | **6** |
| Min credit hours of CS/CSE 6000/7000/8000-level | **24** (the mirror of the rule above; appears in DegreeWorks) |
| Cumulative GPA to graduate | **3.0** |
| Cumulative GPA to stay in good academic standing | **2.7** |
| Time limit | **6 years** from matriculation (Fall 2026 → end of Summer 2032) |
| Grading | **Letter grade only.** No audit. No pass/fail. Sole exception: CS 8001 seminars. |
| Substitutions | **None approved.** Every OMSCS specialization is completable without substitution. |
| Degree option | The **"Course" option** (no thesis, no project option) |

**Wording correction (2026-08-19).** The cap is not only about subject codes. The Orientation
Document states it verbatim as: *"A maximum of six hours may be taken at the 4000-level and/or
with a subject code other than CS or CSE."* Every course currently offered in OMSCS is 6000-level
or higher, so in practice the cap binds only on non-CS/CSE subject codes (ISYE, MGT, PUBP, INTA,
ECE) — but the rule as written is broader, and the app records it that way.

**Prior Georgia Tech coursework.** Courses already completed at Georgia Tech that are considered
*equivalent* to an OMSCS course cannot count toward the OMSCS degree. Checking equivalence is the
student's responsibility. *(Orientation Document, Section C, item 10.)*

### Foundational requirement ✅ VERIFIED

Source: Fall 2026 Orientation Document, Section B. App data: `src/data/rules.json` → `foundational`.

- Must complete **2 foundational courses with a grade of B or better** within **12 months** of matriculation.
- For a Fall 2026 matriculant that window is **Fall 2026, Spring 2027, Summer 2027** — stated explicitly
  in the Fall 2026 document, not inferred.
- Foundational courses are the ones marked with an asterisk (`*`) on
  <https://omscs.gatech.edu/current-courses>. **51 of the 77 current courses are foundational.**
- A foundational course may simultaneously satisfy a specialization requirement or a free elective.
  The labels are **independent, overlapping** dimensions.
- You do **not** have to satisfy it with your first two courses — only within the window.
- A term in which you earn **below a B**, or in which you **withdraw** from a foundational course,
  still consumes one of the three terms.
- **Newly matriculated students are restricted to registering for foundational courses (and CS 8001
  seminars) only**, until the requirement is satisfied. A non-foundational attempt produces a
  `COHORT RESTRICTION` error in Banner, and *"no exceptions will be made … unless you actually have
  satisfied the requirement."*
- The restriction lifts **shortly after grades post** for the term that completes it. During a Phase I
  window that opens *before* grades are in, the student is still restricted; adjustments happen in Phase II.

**❌ CORRECTED 2026-08-19 — dismissal.** The previous version of this file said *"Failing to meet it
within 12 months means dismissal from the program."* That is **not** what the program says. The Fall
2026 Orientation Document (Foundational Requirement FAQ #6) states:

> *"As of now, students have not been dismissed from the OMSCS program simply for not fulfilling the
> foundational requirement. Students will need to continue enrolling in foundational courses until
> they have satisfied this requirement."*

Academic **standing** (the 2.7 GPA rule) is the separate mechanism that can end enrolment. The app
therefore treats a missed window as a hard requirement failure with the correct consequence text,
not as dismissal.

### CS 8001 seminars ✅ VERIFIED

Sources: Fall 2026 Orientation Document, "OMSCS Seminars" FAQ; <https://omscs.gatech.edu/seminars>.
App data: `src/data/rules.json` → `seminars`, `src/data/seminars.json` (46 seminars, 15 currently scheduled).

- 1 credit hour, **Pass/Fail**. No letter grade, no GPA impact.
- Do **NOT** count toward the 30-hour degree requirement.
- Do **NOT** count toward the foundational requirement.
- Do **NOT** count toward satisfactory academic progress if they are the only thing you enrol in.
- **DO count toward the per-semester maximum hours** — this is the reason they matter to the plan.
- Appear on the transcript.
- **More than one per semester is allowed** within the hour cap, but needs a *duplicate course permit*.
- Open to students who have not yet met the foundational requirement, and to program alumni in
  Special/Non-Degree status.
- The app lets the user add them (they cost money and time) but excludes them from all degree math.

---

## 2. Registration Limits ✅ VERIFIED

Source: Fall 2026 Orientation Document, Section F, item 10. App data: `src/data/rules.json` → `registration`.

| Term | Maximum credit hours | What fits |
|---|---|---|
| **Fall** | **7** | 2 courses (6 hrs) + 1 seminar (1 hr) |
| **Spring** | **7** | 2 courses (6 hrs) + 1 seminar (1 hr) |
| **Summer** | **5** | 1 course (3 hrs) + up to 2 seminars (2 hrs) |

**❌ CORRECTED 2026-08-19 — Summer cap.** The previous version of this file recorded Summer as
*"1 course (3 credit hours) — no seminar slot."* The Orientation Document says:

> *"During the Fall and Spring semesters, all students can, by default, enroll in a maximum of seven
> hours. During the Summer semester, all students can, by default, enroll in a maximum of five hours."*

The practical planning consequence is unchanged — 6 hours will not fit in 5, so Summer still allows
only **one degree course** — but a Summer seminar *is* possible, and the cap the app enforces is
**hours, not course count.**

- The cap applies to **all students including new students**. It is a program-level default and does
  **not** increase with good grades, seniority, or completed hours.
- Registered hours **+** waitlisted hours count together toward the cap.
- **Consequence for planning:** the theoretical fastest completion is
  `2 + 2 + 1 + 2 + 2 + 1 = 10 courses over 6 terms = 2 years exactly, with zero slack.`
  A single dropped or failed course pushes graduation back one full term. The app surfaces this as
  the "zero slack" indicator.

### Section codes ✅ VERIFIED

Source: Fall 2026 Orientation Document, Section F, item 8 and item 13.

| Section | Meaning | OMSCS student can register? |
|---|---|---|
| `O01`, `O02`, `O03`… | OMSCS sections | ✅ Yes |
| `O08`, `O15`, `O23`… (on CS 8803) | OMSCS special-topics sections | ✅ Yes |
| `OCY` | OMS **Cybersecurity** program only | ❌ `MAJOR RESTRICTION` |
| `OAN` | OMS **Analytics** program only | ❌ `MAJOR RESTRICTION` |

`MAJOR RESTRICTION` (and its sibling `CAMPUS RESTRICTION`) does **not** mean the student's major is
wrong. It means the section is reserved for a different degree program or a different campus.
OMSCS students are also ineligible for on-campus and Distance Learning sections, and vice versa.

Thirteen OMS-Cybersecurity courses and ten OMS-Analytics courses have OMSCS-eligible `O##` sections;
those are flagged in `src/data/courses.json` as `administeredBy`.

### Waitlists ✅ VERIFIED

- On the **last two days of registration** all waitlists are cleared and anyone may enrol in any open
  seat. This is the *"free for all"* period. (The previous version of this file attached it to a
  single date; it is the last two days of the registration window.)
- `OPEN - # WAITLISTED` means the visible open seats are reserved for people already on the waitlist.

---

## 3. Prerequisites — IMPORTANT ✅ VERIFIED

Source: Fall 2026 Orientation Document, Course/Program Planning FAQ #6 and #10, quoted verbatim:

> *"There are no official/enforced prerequisites for the OMSCS courses beyond those required for
> admission into the program, so students can take these courses in essentially any order."*

> *"No … students can take OMSCS courses in essentially any order. Students are not required to take
> their specialization courses (or any courses) in a specific order. This means that students can take
> a specialization elective course before taking a specialization core course."*

The only hard gates in the system are:
1. The foundational restriction (§1)
2. The per-term credit-hour cap (§2)
3. Section/major/campus restrictions (§2)
4. The course simply not being offered that term (§6)

**However**, individual course pages on omscs.gatech.edu list *recommended* background (e.g.
"familiarity with Python", "an undergraduate algorithms course", "linear algebra"). These are
**advisory**. Program-wide, the advice is to be comfortable with C, Java, and Python, with no
provision inside the program for making up deficiencies.

**App behaviour:** recommended background is scraped per course into `src/data/courses.json`
(`background`), surfaced verbatim in the course detail panel, and summarised as topic chips by
`backgroundTopics()` in `src/lib/validate.ts`. It appears in the validator as a **soft advisory**
and never rings a placement card. **Never block** a placement on this basis. Do not invent a
prerequisite graph.

---

## 4. Specializations ✅ VERIFIED

OMSCS offers **6** specializations. (The College of Computing MSCS page lists more; only these 6 are
available to OMSCS students, confirmed in the Orientation Document, Section C, item 11.)

App data: `src/data/specializations.json`, generated by `scripts/build-data.py` from the six
specialization pages. **Only courses whose titles are bold on those pages are offered through
OMSCS**; the parser reads the bold markup, so the OMSCS-available subset is derived, not typed by hand.

1. Artificial Intelligence (formerly Interactive Intelligence) — 15 hrs
2. Computational Perception and Robotics — 15 hrs
3. Computer Graphics — 15 hrs
4. Computing Systems — **18 hrs**
5. Human-Computer Interaction — 15 hrs
6. Machine Learning — 15 hrs

Free electives make up the remainder of the 30 hours: 5 courses for every specialization except
Computing Systems, which leaves 4.

### Declaration ✅ VERIFIED

Source: Fall 2026 Orientation Document, Degree Requirements FAQ #2–#5 and Course/Program Planning FAQ #11.

- Declared by the student following the Registrar's instructions; progress is then tracked in
  **DegreeWorks** (<https://degreeaudit.gatech.edu>). No advisor approval needed.
- **Cannot be declared or changed during an active registration period.**
- Recommended after the first two semesters; **required by the time you apply to graduate.**
- Can be changed later at will. Only **one** may be declared.
- Until declared, DegreeWorks dumps all completed courses into a **"Fallthrough Section"** and shows
  no specialization progress. DegreeWorks may also wrongly show "Major Requirements" as complete.
  This is why a brand-new student's DegreeWorks looks empty — it is not a bug.
- Non-CS/CSE coursework and post-matriculation curriculum changes are applied to DegreeWorks
  **manually by an advisor**, typically only once you petition to graduate.

### ⚠️→✅ Excess core courses — NEW RULE, added 2026-08-19

Source: Fall 2026 Orientation Document, Degree Requirements FAQ #6:

> *"…if students take extra specialization core courses and/or extra specialization elective courses
> beyond what is required in their specialization, the extra course(s) can be used only towards the
> 'free' electives. In other words, specialization core courses cannot be used towards the
> specialization elective requirements and vice versa. **The only exception is for students pursuing
> either the Artificial Intelligence or the Computing Systems specialization.**"*

This is a real constraint the earlier version of this file did not capture. It is encoded as
`excessCoreCountsAsSpecElective` per specialization:

| Specialization | Extra core may fill a specialization elective? |
|---|---|
| Artificial Intelligence | ✅ yes (stated on the AI page) |
| Computing Systems | ✅ yes (stated on the Computing Systems page) |
| Computational Perception & Robotics | ❌ no — falls to a free elective |
| Computer Graphics | ❌ no (but its elective list repeats the core courses, so the effect is similar) |
| Human-Computer Interaction | ❌ no |
| Machine Learning | ❌ no |

### 4.1 Artificial Intelligence ✅ VERIFIED

Source: <https://omscs.gatech.edu/specialization-artificial-intelligence-formerly-interactive-intelligence>

**Core — 9 credit hours (3 courses)**
- Take **one (1)** from *Algorithms and Design*: CSE 6140, CS 6300, CS 6301, CS 6505, CS 6515
  - *OMSCS-offered subset:* **CS 6300, CS 6515**
- And **two (2)** from: CS 6476, CS 6601, CS 7637, CS 7641, CS 7643, CS 7650
  - *All six are offered in OMSCS.*

**Electives — 6 credit hours (2 courses)**
- Core courses in excess of the 9-hour requirement may be used as electives.
- Take **two (2)** from either sub-list (no requirement to take one from each):
  - *AI Methods:* CS 6604, CS 7476, CS 7631, CS 7632, CS 7633, CS 7634, CS 7647, CS 7652
    - *OMSCS-offered subset:* **CS 7632**
  - *Cognition, Ethics, and Human-Centered AI:* CS 6440, CS 6460, CS 6603, CS 6750, CS 6795, CS 7610, CS 7651
    - *OMSCS-offered subset:* **CS 6440, CS 6460, CS 6603, CS 6750, CS 6795**

**Free electives — 15 credit hours (5 courses).**

**Note:** every course on the AI specialization list is also a foundational course. A student pursuing
AI never has to choose between "foundational" and "specialization".

**Strategic note the app surfaces:** CS 6300 satisfies the algorithms slot, so an AI student can
complete the degree **without ever taking CS 6515 (Intro to Graduate Algorithms)** — the program's
hardest and highest-attrition course (OMSCentral difficulty 4.05 across 523 reviews). HCI is the only
other specialization that avoids CS 6515 entirely.

### 4.2 Computing Systems ✅ VERIFIED — **18 hours**

Source: <https://omscs.gatech.edu/specialization-computing-systems>

**Core — 9 credit hours (3 courses)**
- CS 6505 **or** CS 6515 → *OMSCS-offered:* **CS 6515**
- And **two (2)** of: CS 6210, CS 6241, CS 6250, CS 6290, CS 6300 (or CS 6301), CS 6390, CS 6400
  - *OMSCS-offered subset:* **CS 6210, CS 6250, CS 6290, CS 6300, CS 6400**
- Core courses in excess of 9 hours may be used as Computing Systems electives.

**Electives — 9 credit hours (3 courses)**, OMSCS-offered subset: **CS 6035, CS 6200, CS 6211,
CS 6238, CS 6260, CS 6261, CS 6262, CS 6263, CS 6264, CS 6291, CS 6310, CS 6340, CS 6422, CS 6675,
CS 6747, CS 7210, CS 7280, CS 7295, CS 7400, CSE 6220, CS 8803 O08.**
(The page also allows *any* CS 8803 special-topics course taught by a School of Computer Science
faculty member; the currently applicable ones are CS 6264 and CS 8803 O08, both listed above.)

**Free electives — 12 credit hours (4 courses).**

### 4.3 Machine Learning ✅ VERIFIED

Source: <https://omscs.gatech.edu/specialization-machine-learning>

**Core — 6 credit hours (2 courses)**
- *Algorithms,* pick one — OMSCS-offered: **CS 6515**
- And pick one of CS 7641 / CSE 6740 — OMSCS-offered: **CS 7641**

**Electives — 9 credit hours (3 courses).** Elective ML courses must have at least 1/3 of their
graded content based on machine learning. OMSCS-offered subset: **CS 6476, CS 6601, CS 6603,
CS 7280, CS 7632, CS 7637, CS 7642, CS 7643, CS 7646, CS 7650, CSE 6242, CSE 6250, ISYE 6420.**

**Free electives — 15 credit hours (5 courses).**

### 4.4 Computational Perception & Robotics ✅ VERIFIED

Source: <https://omscs.gatech.edu/specialization-computational-perception-and-robotics>

**Core — 6 credit hours (2 courses)**
- *Algorithms,* pick one — OMSCS-offered: **CS 6515**
- And pick one of CS 6601 / CS 7641 — both offered.

**Electives — 9 credit hours (3 courses), with at least one (1) from each sub-area:**
- *Perception,* OMSCS-offered: **CS 6475, CS 6476, CS 7639, CS 7650, CS 7711**
- *Robotics,* OMSCS-offered: **CS 7638**

Because CS 7638 is the only OMSCS course on the Robotics sub-list, **CPR is not completable without
CS 7638**. The app models the sub-area minimums explicitly.

**Free electives — 15 credit hours (5 courses).**

### 4.5 Computer Graphics ✅ VERIFIED

Source: <https://omscs.gatech.edu/specialization-computer-graphics>

**Core — 6 credit hours (2 courses)**
- Pick one of **CS 6457, CS 6491, CS 7496** (all offered)
- And pick one of CS 6505 / CS 6515 — OMSCS-offered: **CS 6515**

**Electives — 9 credit hours (3 courses).** OMSCS-offered subset: **CS 6457, CS 6475, CS 6476,
CS 6491, CS 7496.** The elective list repeats the three graphics core courses, so the whole
specialization draws on just six OMSCS courses (those five plus CS 6515) to fill five slots —
**Computer Graphics is the narrowest specialization in the program.** One graphics course goes to
the core slot, CS 6515 takes the algorithms slot, and three of the four remaining courses fill the
electives: four ways to finish, and no room at all to drop one.

**Free electives — 15 credit hours (5 courses).**

### 4.6 Human-Computer Interaction ✅ VERIFIED

Source: <https://omscs.gatech.edu/specialization-human-computer-interaction>

**Core — 6 credit hours (2 courses)**
- CS 6456 **or** CS 7470 → OMSCS-offered: **CS 7470**
- CS 6750
- **No algorithms requirement** — HCI and AI are the two specializations that avoid CS 6515.

**Electives — 9 credit hours (3 courses), with at least one (1) from each sub-area:**
- *Design and evaluation concepts,* OMSCS-offered: **CS 6435, CS 6457, CS 6460, CS 6795**
- *Interactive technology,* OMSCS-offered: **CS 6440, CS 7470, CS 7632, CS 7711**

**Free electives — 15 credit hours (5 courses).**

---

## 5. Course Catalog Data ✅ VERIFIED

**77 courses** on the current-courses page as of 2026-08-19, **51 of them foundational**.
App data: `src/data/courses.json`, generated by `scripts/fetch-sources.py` + `scripts/build-data.py`.

| Field | Source |
|---|---|
| Subject + number (e.g. `CS 6750`) | omscs.gatech.edu/current-courses |
| Title | same |
| Credit hours | 3 (1 for CS 8001) |
| Foundational flag | asterisk on the current-courses page |
| Administering program (Analytics / Cybersecurity) | superscript `A` / `C` on the same page |
| Full description / overview | the individual course page (all 77 scraped) |
| Recommended background / prep | same course page (67 of 77 publish one) |
| Syllabus links, preview and sample-lesson videos, instructional team | same course page |
| Which specializations it satisfies, and in which slot | §4, plus the specialization badge icons GT renders on each course page |
| Rating, Difficulty (1–5), Workload (hrs/week), Review count, review URL, lecture notes, textbooks | omscentral.com (live JSON payload, richer than the CSV in this folder) |
| Term offering pattern (Fall / Spring / Summer) | Course Offering History PDF — see §6 |

**Foundational-flag discrepancy, noted 2026-08-19.** The Course Offering History PDF does *not* carry
the 🅵 marker for **CS 6422, CS 6457, CS 6491**, but the current-courses page *does* asterisk all
three. The current-courses page is authoritative — it is the page the policy text itself points at
("Courses denoted with an asterisk (*) are considered foundational … any course not listed on this
page is not foundational"). The app uses the asterisks; the PDF marker is treated as stale.

**Do NOT model seat counts, waitlists, or CRNs as planning constraints.** This is a planner, not a
registration tool. The app does not read `Fall 2026 GT OMSCS Classes.csv` at all.

---

## 6. Term Offering Patterns ✅ VERIFIED

Source: [Fall 2026 OMSCS Course Offering History](https://omscs.gatech.edu/sites/default/files/documents/Other/Fall%202026%20OMSCS%20Course%20Offering%20History.pdf),
covering **Fall 2022 → Summer 2026** (12 terms). App data: `src/data/offerings.json`.

GT's own caveat, reproduced in the app: *course offering history is informational only and is not a
guarantee of future availability; a term's offerings are not final until shortly before that term's
Phase I registration.*

Summer is a compressed term; all OMSCS summer courses are **"Full Summer"** — the program runs no
Early Short or Late Short Summer sections.

**Summer-inclusive (56 courses)** — ran in at least one Summer between 2023 and 2026:
CS 6035, 6200, 6238, 6250, 6262, 6263, 6264, 6265, 6290, 6291, 6300, 6310, 6340, 6422, 6435, 6440,
6457, 6460, 6491, 6515, 6601, 6603, 6675, 6747, 6750, 6795, 7240, 7280, 7295, 7400, 7470, 7496,
7632, 7637, 7638, 7641, 7642, 7643, 7646, 7650, 7711, CS 8803 O08, O15, O17, O20, O24, O27, ORO,
CSE 6220, INTA 6450, ISYE 6501, 6525, 6644, MGT 6311, MGT 8813, PUBP 6725.

**Every Summer 2023–2026 (43 courses)** — the reliable Summer set, a useful subset when Summer is
your only slot: CS 6035, 6200, 6238, 6250, 6262, 6263, 6264, 6265, 6290, 6291, 6300, 6310, 6340,
6440, 6457, 6460, 6515, 6601, 6603, 6675, 6747, 6750, 6795, 7280, 7400, 7470, 7632, 7637, 7638,
7642, 7643, 7646, 7650, CS 8803 O08, O15, O17, CSE 6220, INTA 6450, ISYE 6501, 6525, 6644,
MGT 6311, PUBP 6725.

**Fall/Spring only (17 courses):** CS 6150, 6210, 6211, 6260, 6261, 6400, 6475, 6476, 7210, 7639,
CSE 6242, CSE 6250, CSE 6742, ISYE 6402, ISYE 6420, ISYE 6669, PUBP 8823.

**Never observed in a Fall term (3):** CS 7711, CS 8803 O27, CS 8803 ORO — all recent additions that
have so far only run in Spring/Summer.

**No offering history at all (4):** CS 6271, CS 8803 O25, ECE 8843, ISYE 6414. These are on the
current-courses page but absent from the history PDF. The app shows "No offering history" and does
not warn about their placement.

The previous version of this file listed CS 6238, 6250, 6262 … as summer-inclusive and CS 6211 as
Fall/Spring-only; **CS 6211 is confirmed Fall/Spring only**, and the fuller lists above supersede the
earlier partial ones. **CS 6435, 6422, 6491, 7240, 7496, 7711 and several CS 8803 sections are also
summer-inclusive** and were missing from the earlier list.

**App behaviour:** a course placed in a term it has never historically run in produces a **soft
warning**, never a block.

---

## 7. Cost Model ✅ VERIFIED

App data: `src/data/tuition.json`. Verified against the student's actual Banner "Tuition and Fees for
Fall 2026" estimate **and** the three official Bursar rate sheets in this folder.

**Fall 2026 actual (Banner):**
```
OMS1  OMSCS Tuition (6 credit hours) ....... $1,362.00   → $227.00 / credit hour
OLF   Online Learning Fee (4+ hours) ....... $  531.00
                                             ─────────
                                     TOTAL   $1,893.00
```

**Published rates, per term:**

| Term | OMSCS per credit hour | Online Learning Fee, < 4 hrs | Online Learning Fee, 4+ hrs |
|---|---|---|---|
| Fall 2026 | **$227** | $212 | $531 |
| Spring 2027 | **$227** | $212 | $531 |
| **Summer 2027** | **$227** | **$183** | **$455** |

**❌ CORRECTED 2026-08-19 — the Summer Online Learning Fee is lower.** The earlier version of this
file recorded a single fee structure of $212 / $531 for all terms. The Summer 2027 Bursar sheet
publishes **$183 / $455**. Every mandatory fee at Georgia Tech is lower in Summer; the Online
Learning Fee is no exception. The app therefore carries rates forward **per season** — an unpublished
future Summer inherits Summer 2027's fee, not Fall 2026's.

Derived per-term totals at published rates:

| Load | Fall / Spring | Summer |
|---|---|---|
| 1 course (3 hrs) | (3 × 227) + 212 = **$893** | (3 × 227) + 183 = **$864** |
| 1 course + 1 seminar (4 hrs) | (4 × 227) + 531 = **$1,439** | (4 × 227) + 455 = **$1,363** |
| 2 courses (6 hrs) | (6 × 227) + 531 = **$1,893** | *over the Summer cap* |
| 2 courses + 1 seminar (7 hrs) | (7 × 227) + 531 = **$2,120** | *over the Summer cap* |

**Note the fee cliff:** in Fall or Spring the marginal cost of the *second* course is
$681 tuition + $319 additional fee = **$1,000**, which is more than the first course costs in total.
In a Summer term the same cliff appears when a seminar takes you from 3 hours to 4: +$227 tuition
+$272 fee = **$499** for a single credit hour.

At two courses in Fall and Spring and one in Summer, the two-year AI plan comes to **$9,300** in
tuition and fees before books — $1,893 × 4 plus $864 × 2. Each seminar added along the way costs
$227 more (or $499 if it is the one that pushes a Summer term from 3 hours to 4).

**Residency:** the student's Banner profile reads `Out-of-State Resident`, but billing applies
**$227/hr**, which the Bursar sheet identifies as the **In-State (Resident)** column. (The
out-of-state and out-of-country columns read $236 and $248.) OMSCS applies the in-state rate
regardless of residency classification. The app computes from the published rate table, not from the
residency field, and records the other two columns for reference only.

**Other charges to remember:** OMSCS students are **ineligible for the GT Payment Plan**. Students
holding an F or J visa pay an additional **$100 International Student Fee** each term. Non-payment by
the deadline cancels the schedule; reinstatement costs $200.

For terms with no published PDF (Fall 2027 onward), the app carries forward the most recent known
rates **for the same season** and labels those semester costs **"est"** in the UI.

---

## 8. Academic Calendar — Fall 2026 ✅ VERIFIED

Source: Fall 2026 Orientation Document, Section J. App data: `src/data/calendar.json`.

| Date | Event |
|---|---|
| Aug 13, 2026, 6:00 PM ET | Registration time tickets available |
| Aug 17–28, 2026 (11:59 PM ET) | Registration for Fall 2026 |
| Aug 24, 2026 | Classes begin; course materials available that week |
| Aug 27–28, 2026 | "Free for all" period — waitlists cleared, any open seat is registerable |
| Aug 28, 2026, 11:59 PM ET | Last day to register / add / drop without a `W` |
| **Aug 31, 2026, 4:00 PM ET** | **Fee payment deadline.** Non-payment cancels the schedule; reinstatement costs $200. |
| Sep 7, 2026 | Labor Day — Institute holiday |
| Oct 5–6, 2026 | Fall Break |
| Oct 31, 2026, 11:59 PM ET | Withdrawal deadline (grade of `W`) |
| Nov 2, 2026, 11:59 PM ET | Grade substitution deadline |
| Nov 25, 2026 | Student Recess Day |
| Nov 26–27, 2026 | Thanksgiving Break |
| Dec 10–17, 2026 | Final exams |
| Dec 17, 2026 | Last day of term |
| Dec 22, 2026, after 6:00 PM ET | Grades available |

**Graduation application deadlines (OMSCS departmental, earlier than the Institute's):**
Spring graduation — October 15 · Summer graduation — March 15 · Fall graduation — June 1.
Apply in the semester **preceding** the one you intend to graduate in.

Future-term dates are not yet published. The app shows a per-semester deadline block where dates are
known and links to <https://registrar.gatech.edu/calendar> where they are not.

---

## 9. Financial Aid Interaction ✅ VERIFIED

Source: <https://finaid.gatech.edu/manage-aid/enrollment-requirements>, quoted verbatim:

> *"All federal educational loans require at least half-time enrollment, which is defined as six (6)
> hours applicable to your degree."*

- Therefore a **1-course term (3 hours) is below half-time and is not loan-eligible**.
- **Every Summer term is automatically below half-time**, since Summer allows only one degree course.
  A seminar does not fix this — a seminar is 1 hour, so 3 + 1 = 4 < 6, and seminar hours are not
  "applicable to your degree" in any case.
- Consequence for the 2-year AI plan: 4 of the 6 terms are loan-eligible, and both Summers are not.
- The app flags which planned semesters are loan-eligible. This is informational only — the app is
  not a financial advisor and says so.

---

## 10. Grades, Repeats, and Standing ✅ VERIFIED

Source: Fall 2026 Orientation Document, Grades/GPA Requirement FAQ.

- **You may not repeat, on a letter-grade basis, a course in which you already earned a B or higher.**
- For a repeated course, the **newest** grade is used for satisfying a requirement, but the original
  grade stays in the GPA unless a **graduate grade substitution** is approved.
- A retaken course can satisfy **only one** requirement; one course never covers two.
- A `W` appears on the transcript but has **no GPA impact**. Retaking after a `W` leaves both the `W`
  and the new grade on the transcript.
- Graduate grade substitution has been available since Summer 2022 and is **not retroactive**; it runs
  through DocuSign by a published deadline (Nov 2 for Fall 2026).
- Minimum GPA to stay in good academic standing is **2.7**; **3.0** is required to graduate.

**App behaviour:** the plan holds one placement per course code, so repeats are not modelled as
separate attempts. Enter the grade you expect to count. Grades of `W` and `P` are excluded from the
GPA and earn no credit.

---

## 11. Change Log

| Date | Change |
|---|---|
| 2026-08-20 | Initial rule set compiled. Fall 2026 registration and billing verified against the student's Banner account. |
| 2026-08-20 | App architecture changed to no-login: localStorage by default, opt-in Firestore sync via URL plan ID. No rule content affected. |
| 2026-08-19 | **Full verification pass against primary sources.** Every ⚠️ VERIFY item resolved. Specifics below. |
| 2026-08-19 | §2 **CORRECTED**: Summer registration cap is **5 credit hours**, not 3. A Summer seminar is possible; two Summer degree courses still are not. Source: Fall 2026 Orientation Document, Section F.10. |
| 2026-08-19 | §7 **CORRECTED**: the Summer Online Learning Fee is **$183 / $455**, not $212 / $531. A 1-course Summer costs $864, not $893. Rates now carry forward per season. Source: Summer 2027 Bursar rate sheet. |
| 2026-08-19 | §1 **CORRECTED**: missing the foundational window does **not** mean dismissal. Source: Orientation Document, Foundational Requirement FAQ #6. |
| 2026-08-19 | §4 **NEW RULE**: excess specialization core courses fall to **free** electives, not specialization electives — except for AI and Computing Systems. Source: Orientation Document, Degree Requirements FAQ #6. |
| 2026-08-19 | §4.2–4.6 replaced the hypothesised structures with the verified ones from all six specialization pages, filtered to OMSCS-offered (bold) courses. Computing Systems confirmed at **18 hours**; CPR confirmed to require CS 7638; Computer Graphics confirmed to have exactly five OMSCS courses for six slots. |
| 2026-08-19 | §1 **CLARIFIED**: the 6-hour cap covers 4000-level courses *and/or* non-CS/CSE subject codes. Added the 2.7 good-standing GPA. |
| 2026-08-19 | §6 **VERIFIED and expanded** from the Fall 2026 Course Offering History PDF: 56 summer-inclusive courses (43 every summer), 17 Fall/Spring-only, 4 with no history. |
| 2026-08-19 | §5 noted the foundational-flag discrepancy between the offering-history PDF and the current-courses page; the asterisks win. |
| 2026-08-19 | §8 added Labor Day, the grade-substitution deadline, Student Recess Day, Thanksgiving, the "free for all" period definition, and the graduation application deadlines. |
| 2026-08-19 | §9 **VERIFIED** the half-time definition against GT Financial Aid rather than assuming the federal default. |
| 2026-08-19 | §10 added — repeat, grade substitution, `W`, and academic standing rules. |
| 2026-08-19 | §1 seminars: added that they **do** count toward the per-semester hour cap, and that multiple seminars per term need a duplicate course permit. |
