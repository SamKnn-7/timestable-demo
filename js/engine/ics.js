/* Calendar import: URL validation, ICS parsing and conversion to weekly classes.
   Imported text is treated as untrusted data: it is parsed, never executed,
   and every detected class goes through the review step before it is saved. */
(() => {
  const TS = window.TS;
  const T = TS.time;

  function checkFeedUrl(raw) {
    let s = String(raw || '').trim();
    if (!s) return { ok: false, error: 'Paste a calendar link first.' };
    if (/^webcals?:\/\//i.test(s)) s = s.replace(/^webcals?:\/\//i, 'https://');
    if (!/^https?:\/\//i.test(s)) return { ok: false, error: 'That doesn’t look like a web address. It should start with https:// or webcal://.' };
    let u;
    try { u = new URL(s); } catch (e) { return { ok: false, error: 'That doesn’t look like a web address. It should start with https:// or webcal://.' }; }
    if (!/^https?:$/.test(u.protocol)) return { ok: false, error: 'Only https and webcal links can be read.' };
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();
    if (host.includes('loop.dcu.ie')) return { ok: false, kind: 'loop-page', error: 'That is a Loop page, not a calendar feed. Loop pages need you to be signed in, so TimeStable can’t read them from a link. Use the Loop connector, or export your calendar from Loop as an .ics file and upload it.' };
    if (path.endsWith('.pdf')) return { ok: false, kind: 'pdf', error: 'That link is a PDF. Upload the file instead; PDFs are read by the extraction service, not as a feed.' };
    if (host.includes('calendar.google.com') && !path.endsWith('.ics')) return { ok: false, kind: 'gcal', error: 'That is a Google Calendar page. In Google Calendar settings, copy the “Secret address in iCal format” instead.' };
    return { ok: true, url: u.href, sameOrigin: u.origin === location.origin };
  }

  async function fetchFeed(url) {
    let res;
    try { res = await fetch(url, { credentials: 'omit' }); }
    catch (e) {
      const err = new Error('Your browser wasn’t allowed to read that link. Most calendar sites block other websites from reading their feeds directly. In the full version TimeStable fetches feeds on its own server; for now, download the .ics file and upload it.');
      err.code = 'BLOCKED';
      throw err;
    }
    if (!res.ok) throw new Error('The link returned an error (' + res.status + '). Check it is a public calendar link.');
    const text = await res.text();
    if (!/BEGIN:VCALENDAR/.test(text)) throw new Error('The link worked, but it returned a web page rather than a calendar feed.');
    return text;
  }

  function parseDate(value, params) {
    const m = String(value).match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
    if (!m) return null;
    const [, y, mo, d, h = '00', mi = '00', s = '00', z] = m;
    if (z) return Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
    return new Date(+y, +mo - 1, +d, +h, +mi, +s).getTime(); // floating / TZID: read as local wall-clock
  }

  function parseICS(text) {
    const unfolded = String(text).replace(/\r?\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/);
    const events = [];
    let cur = null;
    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
      if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
      if (!cur) continue;
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const left = line.slice(0, idx);
      const value = line.slice(idx + 1).replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
      const [name, ...paramParts] = left.split(';');
      const params = Object.fromEntries(paramParts.map((p) => p.split('=')));
      const key = name.toUpperCase();
      if (key === 'DTSTART') cur.start = parseDate(value, params);
      else if (key === 'DTEND') cur.end = parseDate(value, params);
      else if (key === 'SUMMARY') cur.summary = value.trim().slice(0, 140);
      else if (key === 'LOCATION') cur.location = value.trim().slice(0, 80);
      else if (key === 'DESCRIPTION') cur.description = value.trim().slice(0, 300);
      else if (key === 'RRULE') cur.rrule = Object.fromEntries(value.split(';').map((p) => p.split('=')));
    }
    return events.filter((e) => e.start && e.end && e.end > e.start);
  }

  const CODE_RE = /\b([A-Z]{2,4})\s?(\d{3,4}[A-Z]?)\b/;
  function kindFrom(text) {
    const s = text.toLowerCase();
    if (/\b(lab|practical|prac)\b/.test(s)) return 'lab';
    if (/\b(tut|tutorial|seminar|workshop)\b/.test(s)) return 'tutorial';
    return 'lecture';
  }

  /** Convert parsed events to weekly classes for the review step. */
  function toImport(events, now = Date.now()) {
    const groups = new Map();
    const flags = [];
    let skipped = 0;
    for (const e of events) {
      const m = (e.summary || '').match(CODE_RE);
      const code = m ? m[1] + m[2] : null;
      const day = T.weekday(e.start);
      const start = T.hm(e.start);
      const end = T.hm(e.end);
      if (e.end - e.start > 6 * T.HOUR) { skipped++; continue; }
      const key = [code || e.summary, day, start, end].join('|');
      if (!groups.has(key)) groups.set(key, { code, summary: e.summary || 'Untitled', day, start, end, room: e.location || null, dates: [], rrule: e.rrule || null, kind: kindFrom((e.summary || '') + ' ' + (e.description || '')) });
      groups.get(key).dates.push(e.start);
    }
    const first = Math.min(...events.map((e) => e.start));
    const week1Start = T.weekStart(first);
    const weeksSince = Math.floor(T.daysBetween(week1Start, T.weekStart(now)) / 7) + 1;
    const semester = { label: 'Semester', week1Start: weeksSince >= 1 && weeksSince <= 15 ? week1Start : T.addDays(T.weekStart(now), -8 * 7), teachingWeeks: 12 };

    const modules = new Map();
    const classes = [];
    let i = 0;
    for (const g of groups.values()) {
      const code = g.code || 'MISC';
      if (!modules.has(code)) {
        const name = g.code ? g.summary.replace(CODE_RE, '').replace(/\b(lecture|lab|practical|tutorial|tut|seminar)\b/gi, '').replace(/[-–:|()]+/g, ' ').replace(/\s+/g, ' ').trim() : 'Other classes';
        modules.set(code, { code, name: name || code, ects: 5, lecturer: null, hue: null, pageStatus: 'none' });
      }
      let weeks = 'all';
      const interval = g.rrule && +g.rrule.INTERVAL;
      const sorted = g.dates.slice().sort((a, b) => a - b);
      const gaps = sorted.slice(1).map((d, k) => Math.round(T.daysBetween(sorted[k], d) / 7));
      const alt = interval === 2 || (gaps.length >= 2 && gaps.every((x) => x === 2));
      if (alt) {
        const tw = Math.floor(T.daysBetween(semester.week1Start, T.weekStart(sorted[0])) / 7) + 1;
        weeks = tw % 2 === 1 ? 'odd' : 'even';
      }
      const id = 'ics' + ++i + '-' + code.toLowerCase();
      const c = { id, module: code, kind: g.kind, day: g.day, start: g.start, end: g.end, room: g.room, weeks };
      if (!g.code) c.flag = { type: 'info', id: 'nocode-' + id, message: '“' + g.summary + '” has no module code, so it was filed under “Other classes”. Remove it if it isn’t a class.' };
      else if (alt) c.flag = { type: 'info', id: 'alt-' + id, message: g.summary + ' repeats every second week. It was set to ' + (weeks === 'odd' ? 'odd' : 'even') + ' teaching weeks from the file’s dates.' };
      classes.push(c);
    }
    if (skipped) flags.push({ type: 'info', id: 'skipped', message: TS.plural(skipped, 'event') + ' longer than 6 hours (like all-day events) were left out.' });
    return { semester, modules: [...modules.values()], classes, flags, eventCount: events.length };
  }

  TS.ics = { checkFeedUrl, fetchFeed, parseICS, toImport };
})();
