#!/usr/bin/env python3
"""
Re-scrape every primary source into data/sources/, then run scripts/build-data.py.

    python3 -m venv .venv && ./.venv/bin/pip install pdfplumber
    ./.venv/bin/python scripts/fetch-sources.py
    python3 scripts/build-data.py

Sources
  https://omscs.gatech.edu/current-courses        course list + foundational asterisks
  https://omscs.gatech.edu/<course-slug>          one page per course (~77)
  https://omscs.gatech.edu/specialization-*       the six specialization pages
  https://omscs.gatech.edu/seminars               CS 8001 seminar catalog
  .../Fall 2026 OMSCS Course Offering History.pdf per-term offering matrix
  https://www.omscentral.com                      ratings / difficulty / workload

Tuition rates are NOT scraped: GT publishes them as per-term PDFs that land in the
repo root. See README, "Adding a new term's tuition".
"""
import html
import json
import os
import re
import sys
import time
import urllib.request
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'sources')
CACHE = os.path.join(ROOT, '.scrape-cache')
BASE = 'https://omscs.gatech.edu'
UA = 'Mozilla/5.0 (compatible; gt-omscs-planner data refresh)'

os.makedirs(OUT, exist_ok=True)
os.makedirs(CACHE, exist_ok=True)


def fetch(url, cache_key, binary=False):
    path = os.path.join(CACHE, cache_key)
    if os.path.exists(path):
        mode = 'rb' if binary else 'r'
        with open(path, mode, **({} if binary else {'encoding': 'utf-8'})) as f:
            return f.read()
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
    with open(path, 'wb') as f:
        f.write(raw)
    time.sleep(0.2)
    return raw if binary else raw.decode('utf-8', 'replace')


def clean(t):
    # HTML comments first: GT's CMS leaves commented-out blocks in the body, and the
    # generic tag strip would otherwise leave their "-->" tails behind as visible text.
    t = re.sub(r'(?s)<!--.*?-->', ' ', t)
    t = re.sub(r'(?s)<!--.*$', ' ', t)
    t = re.sub(r'(?s)^.*?-->', ' ', t) if t.lstrip().startswith('-->') else t
    t = re.sub(r'(?s)<[^>]+>', ' ', t)
    t = t.replace('-->', ' ')
    t = html.unescape(t).replace(' ', ' ').replace('​', '')
    return re.sub(r'[ \t]+', ' ', re.sub(r'\s*\n\s*', '\n', t)).strip()


def para_text(fragment):
    f = re.sub(r'(?s)<!--.*?-->', '', fragment)
    f = re.sub(r'(?is)<(script|style).*?</\1>', '', f)
    f = re.sub(r'(?i)<br\s*/?>', '\n', f)
    f = re.sub(r'(?i)</(p|li|h[1-6]|div)>', '\n\n', f)
    f = re.sub(r'(?i)<li[^>]*>', '• ', f)
    return re.sub(r'\n{3,}', '\n\n', clean(f)).strip()


def main_content(s):
    i = s.find('id="main-content"')
    j = s.find('<footer')
    body = s[i:j] if i > 0 else s
    return re.sub(r'(?is)<(script|style|nav).*?</\1>', '', body)


# ────────────────────────────────────────────── 1. course index ──

def scrape_index():
    s = fetch(BASE + '/current-courses', 'current-courses.html')
    i = s.find('Current &amp; Ongoing OMS Courses')
    j = s.find('<h4>Seminars</h4>', i)
    out = []
    for li in re.findall(r'(?s)<li[^>]*>(.*?)</li>', s[i:j]):
        plain = clean(li)
        m = re.search(r'<a href="([^"]+)"[^>]*>(.*?)</a>', li, re.S)
        text = clean(m.group(2)) if m else plain
        cm = re.match(r'\*?\s*([A-Z]{2,4}\s+\d{4}(?:\s+[A-Z0-9]{3})?)\s*:\s*(.+)', text) or \
             re.match(r'\*?\s*([A-Z]{2,4}\s+\d{4}(?:\s+[A-Z0-9]{3})?)\s*:\s*(.+)', plain)
        if not cm:
            print(f'  ! could not parse list item: {plain[:70]}', file=sys.stderr)
            continue
        sups = [clean(x) for x in re.findall(r'<sup>(.*?)</sup>', li)]
        admin = 'analytics' if 'A' in sups else ('cybersecurity' if 'C' in sups else None)
        fm = re.search(r'\(formerly ([^)]+)\)', plain)
        out.append({
            'code': cm.group(1).strip(),
            'title': re.sub(r'\s*\(formerly.*$', '', cm.group(2)).strip(),
            'url': m.group(1) if m else None,
            # The asterisk on this page is the authoritative foundational marker.
            'foundational': plain.lstrip().startswith('*'),
            'admin': admin,
            'formerly': fm.group(1).strip() if fm else None,
        })
    return out


# ─────────────────────────────────────────── 2. course details ──

ICON_MAP = {
    'Foundational-Req': ('foundational', None),
    'OMS-Cybersecurity': ('admin-cyber', None),
    'OMS-Analytics': ('admin-analytics', None),
    'AI-Core': ('ai', 'core'), 'AI-Elec': ('ai', 'elective'),
    'ML-Core': ('ml', 'core'), 'ML-Elec': ('ml', 'elective'),
    'CS-Core': ('cs', 'core'), 'CS-Elec': ('cs', 'elective'),
    'CPR-Core': ('cpr', 'core'), 'CPR-Elec': ('cpr', 'elective'),
    'CG-Core': ('cg', 'core'), 'CG-Elec': ('cg', 'elective'),
    'HCI-Core': ('hci', 'core'), 'HCI-Elec': ('hci', 'elective'),
}
STOP_HEADINGS = {
    'overview', 'preview', 'sample syllabus', 'sample syllabi', 'course content',
    'before taking this class...', 'technical requirements and software',
    'academic integrity', 'course goals', 'course videos', 'textbook',
    'current syllabus', 'course overview', 'sample lesson',
}
ROLE_WORDS = ('instructor', 'creator', 'head ta', 'course developer',
              'instructional designer', 'developer', 'ta', 'co-instructor',
              'lecturer', 'professor')


def scrape_course(entry):
    slug = entry['url'].lstrip('/')
    s = fetch(f'{BASE}/{slug}', f'course-{slug}.html')
    body = main_content(s)

    parts = re.split(r'(?is)<h([1-6])[^>]*>(.*?)</h\1>', body)
    sections = [(clean(parts[k + 1]), parts[k + 2] if k + 2 < len(parts) else '')
                for k in range(1, len(parts), 3)]

    def grab(names):
        for head, content in sections:
            hn = head.strip().rstrip(':').lower()
            if any(hn == n.lower() or hn.startswith(n.lower()) for n in names):
                return para_text(content)
        return None

    background = grab(['Suggested Background Knowledge', 'Recommended Background',
                       'Prerequisites', 'Suggested Background', 'Background Knowledge'])
    if not background:
        cand = grab(['Before Taking This Class'])
        background = cand if cand and len(cand) > 40 else None

    # Instructional team: alternating Name / Role headings after "Instructional Team"
    # (a handful of pages omit that heading and start right after the course title).
    start = next((n + 1 for n, (h, _) in enumerate(sections)
                  if h.strip().lower().startswith('instructional team')), None)
    if start is None:
        start = next((n + 1 for n, (h, _) in enumerate(sections)
                      if re.match(r'^[A-Z]{2,4}\s?\d{4}', h.strip())), None)
    team, pending = [], None
    for head, content in (sections[start:] if start is not None else []):
        h = head.strip()
        if h.lower().rstrip('.') in STOP_HEADINGS:
            break
        if not h:
            continue
        hl = h.lower()
        is_role = any(r == hl or hl.startswith(r) for r in ROLE_WORDS) or \
                  (',' in h and any(r in hl for r in ROLE_WORDS))
        if is_role:
            if pending:
                team.append({'name': pending, 'role': h})
                pending = None
            continue
        if pending:
            team.append({'name': pending, 'role': ''})
        pending = h
        first = para_text(content).split('\n')[0].strip()
        if first and len(first) < 60 and any(r in first.lower() for r in ROLE_WORDS):
            team.append({'name': pending, 'role': first})
            pending = None
    if pending:
        team.append({'name': pending, 'role': ''})

    spec_roles, flags = {}, set()
    for ic in set(re.findall(r'Specialization%20Icons/([A-Za-z\-]+?)(?:_\d+)?\.png', body)):
        key, slot = ICON_MAP.get(ic, ('unknown:' + ic, None))
        (spec_roles.__setitem__(key, slot) if slot else flags.add(key))

    syllabi = []
    for m in re.finditer(r'<a[^>]+href="([^"]*[Ss]yllab[^"]*)"[^>]*>(.*?)</a>', body, re.S):
        url = m.group(1) if m.group(1).startswith('http') else BASE + m.group(1)
        if url not in [x['url'] for x in syllabi]:
            syllabi.append({'label': clean(m.group(2)) or 'Syllabus', 'url': url})

    videos = []
    for m in re.finditer(r'<iframe[^>]+src="(https://www\.youtube\.com/embed/[^"?]+)', body):
        if m.group(1) not in videos:
            videos.append(m.group(1))

    return {
        **entry, 'slug': slug, 'url': f'{BASE}/{slug}',
        'overview': grab(['Overview', 'Course Overview', 'About this Course', 'Course Description']),
        'background': background,
        'goals': grab(['Course Goals', 'Learning Outcomes']),
        'team': team, 'videos': videos, 'syllabi': syllabi,
        'iconSpecRoles': spec_roles, 'iconFlags': sorted(flags),
    }


# ──────────────────────────────────────── 3. specialization pages ──

NUMW = {'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6}
CODE_RE = re.compile(r'\b(CS|CSE|ISYE|MGT|PUBP|INTA|ECE)\s?-?\s?(\d{4})(?:[-\s]([A-Z0-9]{3}))?\b')
SPEC_SLUGS = [
    'specialization-artificial-intelligence-formerly-interactive-intelligence',
    'specialization-computational-perception-and-robotics',
    'specialization-computer-graphics',
    'specialization-computing-systems',
    'specialization-human-computer-interaction',
    'specialization-machine-learning',
]


def codes_in(txt):
    seen, out = set(), []
    for m in CODE_RE.finditer(txt):
        c = f'{m.group(1)} {m.group(2)}'
        if m.group(3) and m.group(1) == 'CS' and m.group(2) == '8803':
            c = f'CS 8803 {m.group(3)}'
        if c not in seen:
            seen.add(c)
            out.append(c)
    return out


def scrape_spec(slug):
    s = fetch(f'{BASE}/{slug}', f'{slug}.html')
    body = main_content(s)
    blocks = []
    for m in re.finditer(r'(?s)<(h[1-6]|p|li)[^>]*>(.*?)</\1>', body):
        txt = re.sub(r'\s+', ' ', clean(m.group(2)))
        if txt:
            blocks.append((m.group(1), txt, bool(re.search(r'(?i)<(strong|b)\b', m.group(2)))))

    title = next((t for tag, t, _ in blocks if tag == 'h1'), slug)
    hm = re.search(r'\((\d+)\s*hours\)', ' '.join(t for tag, t, _ in blocks if tag == 'p'))
    sections, sec, grp, sub = [], None, None, None
    for tag, txt, bold in blocks:
        if tag == 'h4':
            m = re.search(r'\((\d+)\s*hours?\)', txt)
            sec = {'name': re.sub(r'\s*\(.*\)$', '', txt).strip(),
                   'hours': int(m.group(1)) if m else None, 'groups': []}
            sections.append(sec)
            grp = sub = None
        elif sec is None:
            continue
        elif tag == 'p':
            low = txt.lower()
            m = re.search(r'\b(?:pick|take|select|choose)\s+(one|two|three|four|five|six)\b', low) or \
                re.search(r'^and,?\s+(one|two|three|four|five|six)\s*\(\d+\)\s+(?:course|of|from)', low)
            m2 = re.search(r'\((\d+)\)', txt)
            if m or (m2 and ('pick' in low or 'take' in low)):
                grp = {'need': NUMW[m.group(1)] if m else int(m2.group(1)),
                       'label': txt, 'items': [], 'sub': {}}
                sec['groups'].append(grp)
                sub = None
            elif (len(txt) < 70 and not txt.endswith('.')) or low.startswith('sub-area'):
                sub = re.sub(r'^sub-?area\s*:\s*', '', txt, flags=re.I).strip().rstrip(':')
        elif tag == 'li':
            if grp is None:
                grp = {'need': None, 'label': '(implicit)', 'items': [], 'sub': {}}
                sec['groups'].append(grp)
            grp['items'].append({'codes': codes_in(txt), 'text': txt, 'offered': bold, 'sub': sub})
    return {'title': title, 'file': slug + '.html',
            'specHours': int(hm.group(1)) if hm else None, 'sections': sections}


# ───────────────────────────────── 4. offering history (PDF) ──

# Column x-centres of the 12 term columns on the offering-history PDF, and the
# terms they correspond to. Re-derive these if GT changes the sheet's layout:
# print page.extract_words() and read off the header row's x0/x1.
PDF_COL_CENTERS = [134.6, 171.4, 208.2, 245.0, 281.8, 318.7,
                   355.5, 392.3, 429.1, 465.9, 502.7, 539.6]


def scrape_offering_history():
    try:
        import pdfplumber
    except ImportError:
        print('  ! pdfplumber not installed; keeping the existing offering_matrix.json',
              file=sys.stderr)
        return None
    url = (BASE + '/sites/default/files/documents/Other/'
           'Fall%202026%20OMSCS%20Course%20Offering%20History.pdf')
    raw = fetch(url, 'offering-history.pdf', binary=True)
    path = os.path.join(CACHE, 'offering-history.pdf')
    with pdfplumber.open(path) as pdf:
        chars = [c for c in pdf.pages[0].chars if c['text'].strip()]

    # Cluster characters into rows by baseline: the emoji font sits on a different
    # `top` than the text font, so bucketing on `top` alone splits every row.
    chars.sort(key=lambda c: ((c['top'] + c['bottom']) / 2, c['x0']))
    rows, cur, cy = [], [], None
    for c in chars:
        y = (c['top'] + c['bottom']) / 2
        if cy is None or abs(y - cy) <= 5.0:
            cur.append(c)
            cy = y if cy is None else cy
        else:
            rows.append(cur)
            cur, cy = [c], y
    if cur:
        rows.append(cur)

    out, meta = {}, {}
    for row in rows:
        row.sort(key=lambda c: c['x0'])
        txt = ''.join(c['text'] for c in row)
        m = re.search(r'([A-Z]{2,4})(\d{4})(?:-([A-Z0-9]{3}))?', txt)
        if not m or 'Fall' in txt:
            continue
        code = m.group(1) + ' ' + m.group(2) + (' ' + m.group(3) if m.group(3) else '')
        cols = set()
        for c in row:
            if c['text'] in ('\U0001f534', '⬛'):   # 🔴 offered, ⬛ inaugural offering
                cx = (c['x0'] + c['x1']) / 2
                i = min(range(12), key=lambda k: abs(PDF_COL_CENTERS[k] - cx))
                if abs(PDF_COL_CENTERS[i] - cx) < 14:
                    cols.add(i)
        out[code] = sorted(cols)
        meta[code] = {'foundational': '\U0001f175' in txt,
                      'analytics': 'Ⓐ' in txt, 'cyber': 'Ⓒ' in txt}
    return {'terms': ['F22', 'S23', 'U23', 'F23', 'S24', 'U24',
                      'F24', 'S25', 'U25', 'F25', 'S26', 'U26'],
            'rows': out, 'meta': meta}


# ─────────────────────────────────────────────── 5. omscentral ──

def scrape_omscentral():
    s = fetch('https://www.omscentral.com/', 'omscentral.html')
    out = []
    for start in (m.start() for m in re.finditer(re.escape('{\\"_createdAt\\"'), s)):
        depth, i = 0, start
        while i < len(s):
            if s[i] == '{':
                depth += 1
            elif s[i] == '}':
                depth -= 1
                if depth == 0:
                    break
            i += 1
        try:
            obj = json.loads(s[start:i + 1].replace('\\"', '"').replace('\\\\', '\\'))
        except ValueError:
            continue
        if obj.get('_type') == 'course':
            out.append(obj)
    return out


# ────────────────────────────────────────────────── 6. seminars ──

def scrape_seminars():
    s = fetch(BASE + '/seminars', 'seminars.html')
    body = main_content(s)
    split = body.find('Past Offerings')

    def grab(seg, status):
        t = re.sub(r'\s+', ' ', clean(seg))
        out = []
        for part in re.split(r'(?=CS 8001 [A-Z0-9]{2,3}:)', t):
            m = re.match(r'^(CS 8001 [A-Z0-9]{2,3}):\s*(.*)$', part.strip())
            if not m:
                continue
            rest = m.group(2).strip()
            tail = r'\s*(?=(?:Schedule:|Last Offered:|Description:|Syllabus\b|$))'

            def field(label):
                mm = re.search(label + r'\s*(.*?)' + tail, rest)
                return mm.group(1).strip() if mm else ''
            out.append({
                'code': m.group(1),
                'title': re.split(r'\s*(?:Schedule:|Last Offered:|Description:|Syllabus\b)', rest)[0].strip(),
                'schedule': field('Schedule:'), 'lastOffered': field('Last Offered:'),
                'description': field('Description:'), 'status': status,
            })
        return out
    return grab(body[:split], 'scheduled') + grab(body[split:], 'past')


# ────────────────────────────────────────────────────── main ──

def save(name, obj):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        json.dump(obj, f, indent=1, ensure_ascii=False)
        f.write('\n')
    print(f'  {name}')


def main():
    print('Fetching sources (cached under .scrape-cache/ — delete it to force a refetch)')
    index = scrape_index()
    print(f'  {len(index)} courses on the current-courses page '
          f'({sum(1 for c in index if c["foundational"])} foundational)')
    save('current_courses_index.json', index)

    save('courses_parsed.json', [scrape_course(e) for e in index])
    save('specs_parsed.json', {s.replace('specialization-', ''): scrape_spec(s)
                               for s in SPEC_SLUGS})

    matrix = scrape_offering_history()
    if matrix:
        save('offering_matrix.json', matrix)

    save('omscentral_courses.json', scrape_omscentral())
    save('seminars.json', scrape_seminars())
    print('\nNow run:  python3 scripts/build-data.py')


if __name__ == '__main__':
    main()
