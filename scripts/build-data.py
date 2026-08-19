#!/usr/bin/env python3
"""
Build the app's canonical data files under src/data/ from primary sources.

Inputs (checked into data/sources/, produced by scripts/fetch-sources.sh):
  data/sources/current_courses_index.json   parsed omscs.gatech.edu/current-courses
  data/sources/courses_parsed.json          parsed individual course pages
  data/sources/specs_parsed.json            parsed six specialization pages
  data/sources/offering_matrix.json         parsed "Course Offering History" PDF
  data/sources/omscentral_courses.json      omscentral.com embedded course payload
  data/sources/seminars.json                parsed omscs.gatech.edu/seminars
  *.pdf tuition rate sheets in the repo root

Outputs (src/data/):
  courses.json  specializations.json  offerings.json  tuition.json
  seminars.json  calendar.json  rules.json
"""
import json, os, re, sys, subprocess, hashlib
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data', 'sources')
OUT = os.path.join(ROOT, 'src', 'data')
os.makedirs(OUT, exist_ok=True)

DATA_VERSION = '2026.08.19'
NOW = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def load(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return json.load(f)


def write(name, obj):
    p = os.path.join(OUT, name)
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(obj, f, indent=1, ensure_ascii=False)
        f.write('\n')
    print(f'  wrote {os.path.relpath(p, ROOT)}  ({os.path.getsize(p) / 1024:.0f} KB)')


# ─────────────────────────────────────────────────────────── terms ──

SEASONS = ['FA', 'SP', 'SU']


def term_id(year, season):
    return f'{year}{season}'


def term_index(year, season):
    """Monotonic ordering: Fall Y < Spring Y+1 < Summer Y+1 < Fall Y+1."""
    if season == 'FA':
        return year * 3
    return (year - 1) * 3 + (1 if season == 'SP' else 2)


def parse_term(tid):
    return int(tid[:4]), tid[4:]


def term_label(tid):
    y, s = parse_term(tid)
    return {'FA': 'Fall', 'SP': 'Spring', 'SU': 'Summer'}[s] + f' {y}'


# ──────────────────────────────────────────────────── offerings ──

# The offering-history PDF predates a few course renumberings. Map the old
# CS 8803 special-topics number to the permanent number it became.
RENUMBERED = {
    'CS 8803 O23': 'CS 7240',
    'CS 8803 O29': 'CS 7711',
    'CS 8803 O10': 'CS 6603',
    'CS 8803 O12': 'CS 6211',
    'CS 8803 O21': 'CS 7295',
    'CS 8803 O13': 'CS 7400',
    'CS 8803 O22': 'CS 6261',
    'CS 8803 O11': 'CS 6264',
    'CS 8803 O02': 'CS 6200',
    'CS 8803 O04': 'CS 6291',
    'CS 8803 O07': 'CS 6263',
    'CS 8803 O01': 'CS 7638',
    'CS 8803 O03': 'CS 7642',
    'CS 8803 O09': 'CS 7639',
    'CS 8803 O16': 'CS 6435',
    'CS 8803 O31': 'CS 6271',
    'CS 8813': 'CS 6747',
}


def build_offerings():
    m = load('offering_matrix.json')
    # column order in the PDF, oldest first
    cols = [(2022, 'FA'), (2023, 'SP'), (2023, 'SU'), (2023, 'FA'), (2024, 'SP'), (2024, 'SU'),
            (2024, 'FA'), (2025, 'SP'), (2025, 'SU'), (2025, 'FA'), (2026, 'SP'), (2026, 'SU')]
    rows = {}
    for code, idxs in m['rows'].items():
        code = RENUMBERED.get(code, code)
        terms = [term_id(*cols[i]) for i in idxs]
        rows.setdefault(code, set()).update(terms)

    out = {}
    for code, terms in rows.items():
        terms = sorted(terms, key=lambda t: term_index(*parse_term(t)))
        seasons = {s: [t for t in terms if t.endswith(s)] for s in SEASONS}
        out[code] = {
            'history': terms,
            'fall': len(seasons['FA']) > 0,
            'spring': len(seasons['SP']) > 0,
            'summer': len(seasons['SU']) > 0,
            'counts': {s.lower(): len(v) for s, v in seasons.items()},
            # "every" = ran in all four observed instances of that season
            'everyFall': len(seasons['FA']) == 4,
            'everySpring': len(seasons['SP']) == 4,
            'everySummer': len(seasons['SU']) == 4,
            'lastOffered': terms[-1] if terms else None,
        }
    return out, [term_id(*c) for c in cols]


# ────────────────────────────────────────────────────── courses ──

SUBJECT_RE = re.compile(r'^([A-Z]{2,4})\s+(\d{4})(?:\s+([A-Z0-9]{3}))?$')


def norm_omscentral_code(c):
    # omscentral uses "CS-7641"
    m = re.match(r'^([A-Z]{2,4})-(\d{4})$', c)
    return f'{m.group(1)} {m.group(2)}' if m else c


def build_courses(offerings):
    index = load('current_courses_index.json')
    pages = {p['code']: p for p in load('courses_parsed.json')}
    oc_raw = load('omscentral_courses.json')

    oc = {}
    for c in oc_raw:
        for code in c.get('codes', []):
            k = norm_omscentral_code(code)
            prev = oc.get(k)
            # keep the entry with the most reviews when a code appears twice
            if prev is None or (c.get('reviewCount') or 0) > (prev.get('reviewCount') or 0):
                oc[k] = c

    courses = []
    for entry in index:
        code = entry['code']
        m = SUBJECT_RE.match(code)
        subject, number, section = m.group(1), m.group(2), m.group(3)
        page = pages.get(code, {})
        o = oc.get(code, {})
        off = offerings.get(code)

        # A course is "non-CS/CSE" for the 6-hour cap if its subject code is neither.
        is_cs_cse = subject in ('CS', 'CSE')

        courses.append({
            'code': code,
            'subject': subject,
            'number': int(number),
            'section': section,
            'title': entry['title'],
            'creditHours': 3,
            'foundational': entry['foundational'],
            'administeredBy': entry['admin'],
            'formerly': entry['formerly'],
            'isCsCse': is_cs_cse,
            'level': int(number) // 1000 * 1000,
            'url': 'https://omscs.gatech.edu/' + entry['url'].lstrip('/'),
            'slug': entry['url'].lstrip('/'),
            'overview': page.get('overview'),
            'background': page.get('background'),
            'goals': page.get('goals'),
            'team': page.get('team') or [],
            'videos': page.get('videos') or [],
            'syllabi': page.get('syllabi') or [],
            # Core/elective role per specialization, taken from the badge icons GT
            # renders on each course page (e.g. AI-Core.png -> {"ai": "core"}).
            'gtSpecRoles': page.get('iconSpecRoles') or {},
            'offerings': {
                'fall': off['fall'] if off else None,
                'spring': off['spring'] if off else None,
                'summer': off['summer'] if off else None,
                'everyFall': off['everyFall'] if off else None,
                'everySpring': off['everySpring'] if off else None,
                'everySummer': off['everySummer'] if off else None,
                'history': off['history'] if off else [],
                'lastOffered': off['lastOffered'] if off else None,
                'known': off is not None,
            },
            'omscentral': ({
                'slug': o.get('slug'),
                'url': f"https://www.omscentral.com/courses/{o.get('slug')}/reviews" if o.get('slug') else None,
                'rating': o.get('rating'),
                'difficulty': o.get('difficulty'),
                'workload': o.get('workload'),
                'reviewCount': o.get('reviewCount') or 0,
                'description': o.get('description'),
                'notesUrl': o.get('notesURL'),
                'tags': o.get('tags') or [],
                'textbooks': o.get('textbooks') or [],
            } if o else None),
        })

    courses.sort(key=lambda c: (c['subject'], c['number'], c['section'] or ''))
    return courses


# ─────────────────────────────────────────────── specializations ──

# Structure verified against each specialization page on omscs.gatech.edu
# (bold course titles = offered through OMSCS). `subgroups` encode the
# "at least one from each sub-area" constraints stated on the CPR and HCI pages.
SPEC_META = {
    'artificial-intelligence-formerly-interactive-intelligence': {
        'id': 'ai', 'name': 'Artificial Intelligence', 'short': 'AI',
        'formerName': 'Interactive Intelligence',
        'excessCoreCountsAsSpecElective': True,
        'groups': [
            {'id': 'algorithms', 'section': 'core', 'label': 'Algorithms and Design',
             'src': (0, 0)},
            {'id': 'ai-core', 'section': 'core', 'label': 'AI Core', 'src': (0, 1)},
            {'id': 'ai-elective', 'section': 'elective', 'label': 'AI Electives', 'src': (1, 0)},
        ],
    },
    'computational-perception-and-robotics': {
        'id': 'cpr', 'name': 'Computational Perception and Robotics', 'short': 'CPR',
        'excessCoreCountsAsSpecElective': False,
        'groups': [
            {'id': 'algorithms', 'section': 'core', 'label': 'Algorithms', 'src': (0, 0)},
            {'id': 'cpr-core', 'section': 'core', 'label': 'AI or ML Core', 'src': (0, 1)},
            {'id': 'cpr-elective', 'section': 'elective', 'label': 'Perception & Robotics Electives',
             'src': (1, 0), 'subgroupMins': {'Perception': 1, 'Robotics': 1}},
        ],
    },
    'computer-graphics': {
        'id': 'cg', 'name': 'Computer Graphics', 'short': 'CG',
        'excessCoreCountsAsSpecElective': False,
        'groups': [
            {'id': 'cg-core', 'section': 'core', 'label': 'Graphics Core', 'src': (0, 0)},
            {'id': 'algorithms', 'section': 'core', 'label': 'Algorithms', 'src': (0, 1)},
            {'id': 'cg-elective', 'section': 'elective', 'label': 'Graphics Electives', 'src': (1, 0)},
        ],
    },
    'computing-systems': {
        'id': 'cs', 'name': 'Computing Systems', 'short': 'CS',
        'excessCoreCountsAsSpecElective': True,
        'groups': [
            {'id': 'algorithms', 'section': 'core', 'label': 'Algorithms', 'src': (0, 0), 'need': 1},
            {'id': 'systems-core', 'section': 'core', 'label': 'Systems Core', 'src': (0, 1)},
            {'id': 'systems-elective', 'section': 'elective', 'label': 'Systems Electives', 'src': (1, 0)},
        ],
    },
    'human-computer-interaction': {
        'id': 'hci', 'name': 'Human-Computer Interaction', 'short': 'HCI',
        'excessCoreCountsAsSpecElective': False,
        'groups': [
            {'id': 'hci-ui', 'section': 'core', 'label': 'User Interface Core',
             'src': (0, 0), 'need': 1, 'items': [0]},
            {'id': 'hci-core', 'section': 'core', 'label': 'HCI Core',
             'src': (0, 0), 'need': 1, 'items': [1]},
            {'id': 'hci-elective', 'section': 'elective', 'label': 'HCI Electives', 'src': (1, 0),
             'subgroupMins': {'Design and evaluation concepts': 1, 'Interactive technology': 1}},
        ],
    },
    'machine-learning': {
        'id': 'ml', 'name': 'Machine Learning', 'short': 'ML',
        'excessCoreCountsAsSpecElective': False,
        'groups': [
            {'id': 'algorithms', 'section': 'core', 'label': 'Algorithms', 'src': (0, 0)},
            {'id': 'ml-core', 'section': 'core', 'label': 'Machine Learning Core', 'src': (0, 1)},
            {'id': 'ml-elective', 'section': 'elective', 'label': 'Machine Learning Electives',
             'src': (1, 0)},
        ],
    },
}

SPEC_URL = 'https://omscs.gatech.edu/specialization-{}'


def build_specializations(course_codes):
    parsed = load('specs_parsed.json')
    specs = []
    for page_key, meta in SPEC_META.items():
        page = parsed[page_key]
        sections = page['sections']
        groups = []
        for gdef in meta['groups']:
            si, gi = gdef['src']
            g = sections[si]['groups'][gi]
            items = g['items']
            if 'items' in gdef:
                items = [items[i] for i in gdef['items']]
            need = gdef.get('need', g['need']) or 1

            offered, all_courses, subgroups = [], [], {}
            for it in items:
                codes = [c for c in it['codes'] if c in course_codes]
                all_courses.extend(it['codes'])
                if not it['offered']:
                    continue
                # a bolded "A or B" line contributes whichever alternative OMSCS offers
                for c in codes:
                    if c not in offered:
                        offered.append(c)
                    if it['sub']:
                        subgroups.setdefault(it['sub'], [])
                        if c not in subgroups[it['sub']]:
                            subgroups[it['sub']].append(c)

            group = {
                'id': f"{meta['id']}-{gdef['id']}",
                'section': gdef['section'],
                'label': gdef['label'],
                'need': need,
                'creditHours': need * 3,
                'courses': offered,
                'catalogCourses': sorted(set(all_courses)),
                'sourceText': g['label'] if g['label'] != '(implicit)' else None,
            }
            # A single sub-list is an artifact of an "or" line between two <li>s,
            # not a real sub-area; only real multi-way splits carry constraints.
            if len(subgroups) > 1:
                mins = gdef.get('subgroupMins', {})
                group['subgroups'] = [
                    {'id': re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-'),
                     'label': name, 'min': mins.get(name, 0), 'courses': codes}
                    for name, codes in subgroups.items()
                ]
            groups.append(group)

        spec_hours = sum(g['creditHours'] for g in groups)
        specs.append({
            'id': meta['id'],
            'name': meta['name'],
            'short': meta['short'],
            'formerName': meta.get('formerName'),
            'url': SPEC_URL.format(page_key),
            'specializationHours': spec_hours,
            'freeElectiveHours': 30 - spec_hours,
            'freeElectiveCourses': (30 - spec_hours) // 3,
            # Orientation FAQ: extra core courses fall to FREE electives, not
            # specialization electives — except for AI and Computing Systems,
            # whose pages explicitly allow excess core as a specialization elective.
            'excessCoreCountsAsSpecElective': meta['excessCoreCountsAsSpecElective'],
            'minGrade': 'B',
            'groups': groups,
        })
    specs.sort(key=lambda s: s['name'])
    return specs


# ────────────────────────────────────────────────────── tuition ──

def build_tuition():
    """Parsed from the official GT Bursar rate sheets in the repo root.

    OMSCS is billed at the In-State (Resident) per-credit-hour rate regardless of
    the residency classification on the student record; the Bursar sheet's other
    two columns ($236 out-of-state, $248 out-of-country) are recorded for reference.
    """
    return {
        'terms': {
            '2026FA': {
                'perCreditHour': 227,
                'perCreditHourAlt': {'outOfState': 236, 'outOfCountry': 248},
                'onlineLearningFee': {'under4Hours': 212, 'atLeast4Hours': 531},
                'estimated': False,
                'source': 'Fall 2026 Tuition and Fee Rates per Semester.pdf',
            },
            '2027SP': {
                'perCreditHour': 227,
                'perCreditHourAlt': {'outOfState': 236, 'outOfCountry': 248},
                'onlineLearningFee': {'under4Hours': 212, 'atLeast4Hours': 531},
                'estimated': False,
                'source': 'Spring 2027 Tuition and Fee Rates per Semester.pdf',
            },
            '2027SU': {
                'perCreditHour': 227,
                'perCreditHourAlt': {'outOfState': 236, 'outOfCountry': 248},
                # Summer runs a reduced Online Learning Fee — verified on the
                # Summer 2027 sheet ($183 / $455, vs $212 / $531 in Fall and Spring).
                'onlineLearningFee': {'under4Hours': 183, 'atLeast4Hours': 455},
                'estimated': False,
                'source': 'Summer 2027 Tuition and Fee Rates per Semester.pdf',
            },
        },
        # For terms with no published sheet, carry forward the most recent known
        # rates FOR THE SAME SEASON, because the Online Learning Fee differs in Summer.
        'carryForward': {'FA': '2026FA', 'SP': '2027SP', 'SU': '2027SU'},
        'notes': [
            'Estimates only. Figures come from the published Georgia Tech Bursar rate '
            'sheets and exclude textbooks, proctoring, and any course-specific fees.',
            'OMSCS students are ineligible for the GT Payment Plan (Fall 2026 Orientation Document).',
            'International students holding an F or J visa also pay a $100 International Student Fee.',
        ],
        'sourceUrl': 'https://bursar.gatech.edu/tuition-fees',
    }


# ───────────────────────────────────────────────────── calendar ──

def build_calendar():
    """Published dates only. Everything else links out to the Registrar."""
    return {
        'registrarUrl': 'https://registrar.gatech.edu/calendar',
        'terms': {
            '2026FA': {
                'source': 'Fall 2026 OMSCS Orientation Document',
                'sourceUrl': 'https://omscs.gatech.edu/sites/default/files/documents/Orientation%20Documents/Fall%202026%20Orientation%20Document.pdf',
                'dates': [
                    {'date': '2026-08-13', 'label': 'Registration time tickets available', 'note': '6:00pm ET'},
                    {'date': '2026-08-17', 'label': 'Registration opens', 'note': 'through Aug 28'},
                    {'date': '2026-08-24', 'label': 'First day of class'},
                    {'date': '2026-08-28', 'label': 'Last day to register / drop without a W', 'kind': 'deadline'},
                    {'date': '2026-08-31', 'label': 'Tuition and fee payment deadline', 'kind': 'payment', 'note': '4:00pm ET'},
                    {'date': '2026-09-07', 'label': 'Labor Day — Institute holiday'},
                    {'date': '2026-10-05', 'label': 'Fall Break', 'note': 'Oct 5–6'},
                    {'date': '2026-10-31', 'label': 'Last day to withdraw with a W', 'kind': 'deadline'},
                    {'date': '2026-11-02', 'label': 'Grade substitution deadline', 'kind': 'deadline'},
                    {'date': '2026-11-25', 'label': 'Student Recess Day'},
                    {'date': '2026-11-26', 'label': 'Thanksgiving Break', 'note': 'Nov 26–27'},
                    {'date': '2026-12-10', 'label': 'Final exams', 'note': 'Dec 10–17'},
                    {'date': '2026-12-17', 'label': 'End of term'},
                    {'date': '2026-12-22', 'label': 'Grades available', 'note': 'after 6:00pm ET'},
                ],
            },
        },
        'graduationApplicationDeadlines': [
            {'term': 'SP', 'label': 'Spring graduation', 'deadline': 'October 15'},
            {'term': 'SU', 'label': 'Summer graduation', 'deadline': 'March 15'},
            {'term': 'FA', 'label': 'Fall graduation', 'deadline': 'June 1'},
        ],
    }


# ──────────────────────────────────────────────────────── rules ──

def build_rules():
    """Every degree/registration constant the validator reads. Nothing here is
    duplicated in component code — see README 'Editing the rules'."""
    return {
        'version': DATA_VERSION,
        'degree': {
            'totalCreditHours': 30,
            'totalCourses': 10,
            'creditHoursPerCourse': 3,
            'specializationsRequired': 1,
            'minGpaToGraduate': 3.0,
            'minGpaGoodStanding': 2.7,
            'minGradeSpecialization': 'B',
            'minGradeCountsTowardDegree': 'C',
            'maxNonCsCseCreditHours': 6,
            'minCsCse6000PlusCreditHours': 24,
            'timeLimitYears': 6,
            'letterGradeOnly': True,
            'substitutionsAllowed': False,
            'source': 'https://omscs.gatech.edu/degree-requirements',
            'nonCsCseRuleText': 'A maximum of six hours may be taken at the 4000-level and/or with a subject code other than CS or CSE.',
        },
        'foundational': {
            'coursesRequired': 2,
            'minGrade': 'B',
            'windowMonths': 12,
            'windowTerms': 3,
            'restrictsRegistrationUntilMet': True,
            'restrictionLiftsAfterGradesPost': True,
            'seminarsExempt': True,
            'dismissalOnFailure': False,
            'notes': [
                'A foundational course may simultaneously satisfy a specialization requirement or a free elective.',
                'A term in which you earn below a B — or withdraw — still consumes one of the three terms.',
                'Until the requirement is met, registration is restricted to foundational courses and OMSCS seminars; a non-foundational attempt returns COHORT RESTRICTION in Banner.',
                'The restriction lifts shortly after grades post, so a Phase I window that opens before grades are in is still restricted.',
                'Per the Fall 2026 Orientation Document, students have not been dismissed solely for missing this deadline; they must keep enrolling in foundational courses until it is satisfied.',
            ],
            'source': 'Fall 2026 OMSCS Orientation Document, Section B',
        },
        'registration': {
            'maxCreditHours': {'FA': 7, 'SP': 7, 'SU': 5},
            'maxDegreeCourses': {'FA': 2, 'SP': 2, 'SU': 1},
            'waitlistedHoursCountTowardCap': True,
            'appliesToAllStudents': True,
            'source': 'Fall 2026 OMSCS Orientation Document, Section F, item 10',
            'notes': [
                'The cap is on credit hours, not course count: Fall and Spring allow 7 hours (2 courses + 1 seminar), Summer allows 5 hours (1 course + up to 2 seminars).',
                'Seminars count toward the per-semester hour cap even though they do not count toward the degree.',
                'Registered hours and waitlisted hours count together toward the cap.',
                'Taking two seminars in one term requires a duplicate course permit.',
            ],
        },
        'seminars': {
            'code': 'CS 8001',
            'creditHours': 1,
            'grading': 'pass/fail',
            'countsTowardDegree': False,
            'countsTowardFoundational': False,
            'countsTowardGpa': False,
            'countsTowardTermHourCap': True,
            'countsTowardSatisfactoryProgress': False,
        },
        'prerequisites': {
            'enforced': False,
            'text': 'There are no official/enforced prerequisites for OMSCS courses beyond those required for admission, so students can take these courses in essentially any order.',
            'source': 'Fall 2026 OMSCS Orientation Document, Course/Program Planning FAQ #6',
        },
        'sectionCodes': [
            {'pattern': 'O##', 'meaning': 'OMSCS section', 'omscsEligible': True},
            {'pattern': 'OAN', 'meaning': 'OMS Analytics only', 'omscsEligible': False,
             'error': 'MAJOR RESTRICTION'},
            {'pattern': 'OCY', 'meaning': 'OMS Cybersecurity only', 'omscsEligible': False,
             'error': 'MAJOR RESTRICTION'},
        ],
        'specializationDeclaration': {
            'where': 'Registrar / DegreeWorks (degreeaudit.gatech.edu)',
            'advisorApprovalNeeded': False,
            'blockedDuringActiveRegistration': True,
            'requiredBy': 'the time you apply to graduate',
            'changeable': True,
            'onlyOne': True,
            'undeclaredBehaviour': 'Until you declare, DegreeWorks files every completed course under a "Fallthrough Section" and shows no specialization progress.',
        },
        'financialAid': {
            'halfTimeCreditHours': 6,
            'note': 'Federal Direct Loans require at least half-time enrollment (6 credit hours). Every Summer term is below half-time, since Summer allows only one degree course.',
            'disclaimer': 'Informational only. This app is not a financial advisor — confirm with the Office of Scholarships and Financial Aid.',
        },
        'gradePoints': {'A': 4.0, 'B': 3.0, 'C': 2.0, 'D': 1.0, 'F': 0.0},
        'nonGpaGrades': ['W', 'S', 'U', 'P', 'I'],
        'workload': {
            'comfortableHoursPerWeek': 30,
            'note': 'Georgia Tech estimates roughly 3 hours per week per credit hour plus lecture time; two courses runs about 18+ hours per week before OMSCentral-reported project load.',
        },
    }


def build_seminars():
    sems = load('seminars.json')
    for s in sems:
        s['creditHours'] = 1
        s['grading'] = 'pass/fail'
    return sems


# ───────────────────────────────────────────────────────── main ──

def main():
    print('Building src/data/ …')
    offerings, history_terms = build_offerings()
    courses = build_courses(offerings)
    codes = {c['code'] for c in courses}

    missing = sorted(set(offerings) - codes)
    unknown = sorted(c['code'] for c in courses if not c['offerings']['known'])
    if missing:
        print(f'  note: offering history has {len(missing)} code(s) not on the current list: {missing}')
    if unknown:
        print(f'  note: {len(unknown)} current course(s) have no offering history: {unknown}')

    meta = {'version': DATA_VERSION, 'generatedAt': NOW}

    write('courses.json', {
        **meta,
        'source': 'https://omscs.gatech.edu/current-courses + individual course pages',
        'ratingsSource': 'https://www.omscentral.com',
        'count': len(courses),
        'courses': courses,
    })
    write('specializations.json', {
        **meta,
        'source': 'https://omscs.gatech.edu/specializations',
        'specializations': build_specializations(codes),
    })
    write('offerings.json', {
        **meta,
        'source': 'Fall 2026 OMSCS Course Offering History (PDF)',
        'sourceUrl': 'https://omscs.gatech.edu/sites/default/files/documents/Other/Fall%202026%20OMSCS%20Course%20Offering%20History.pdf',
        'observedTerms': history_terms,
        'disclaimer': 'Course offering history is informational only and is not a guarantee of '
                      'future availability; a term\'s offerings are not final until shortly '
                      'before that term\'s Phase I registration.',
        'byCourse': offerings,
    })
    write('tuition.json', {**meta, **build_tuition()})
    write('calendar.json', {**meta, **build_calendar()})
    write('rules.json', build_rules())
    write('seminars.json', {
        **meta,
        'source': 'https://omscs.gatech.edu/seminars',
        'seminars': build_seminars(),
    })
    print('Done.')


if __name__ == '__main__':
    main()
