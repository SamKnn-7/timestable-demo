/* Simulated DCU Loop + timetable service.
   ------------------------------------------------------------------
   TimeStable has no access to DCU's real Loop (Moodle) or timetable APIs.
   This module mimics the shape of such an integration so the onboarding
   flow can be demonstrated end to end:
     connect -> enrolments -> timetable -> module pages
   Everything here is SAMPLE DATA, generated relative to the current week,
   and is labelled as such in the UI. It never asks for or handles credentials.
   Swap this file for a real server-side adapter with the same method names. */
(() => {
  const TS = window.TS;
  const T = TS.time;

  const UNIVERSITIES = [
    { id: 'dcu', name: 'Dublin City University', short: 'DCU', connector: true },
    { id: 'tcd', name: 'Trinity College Dublin', short: 'TCD', connector: false },
    { id: 'ucd', name: 'University College Dublin', short: 'UCD', connector: false },
    { id: 'tud', name: 'TU Dublin', short: 'TU Dublin', connector: false },
    { id: 'mu', name: 'Maynooth University', short: 'MU', connector: false },
    { id: 'ul', name: 'University of Limerick', short: 'UL', connector: false },
    { id: 'ucc', name: 'University College Cork', short: 'UCC', connector: false },
    { id: 'uog', name: 'University of Galway', short: 'Galway', connector: false },
  ];

  const PROGRAMMES = [
    { id: 'ece', name: 'Electronic & Computer Engineering', award: 'BEng', years: [1, 2, 3, 4], demoYears: [2] },
    { id: 'csc', name: 'Computer Science', award: 'BSc', years: [1, 2, 3, 4], demoYears: [2] },
    { id: 'mec', name: 'Mechatronic Engineering', award: 'BEng', years: [1, 2, 3, 4], demoYears: [] },
    { id: 'bus', name: 'Business Studies', award: 'BBS', years: [1, 2, 3, 4], demoYears: [] },
    { id: 'psy', name: 'Psychology', award: 'BSc', years: [1, 2, 3, 4], demoYears: [] },
  ];

  /* ---- Module catalogue: Computer Science is sample data; ECE2 is added from dcu-ece2-2026.js ---- */
  const MODULES = {
    CA218: {
      code: 'CA218', name: 'Object-Oriented Programming', ects: 5, lecturer: 'Dr Aoife Kearney', hue: 250,
      page: 'read',
      topics: ['Classes, objects and encapsulation', 'Inheritance and polymorphism', 'Interfaces and abstract classes', 'Collections and generics', 'Exceptions and file I/O', 'Unit testing with JUnit'],
      assessments: [
        { id: 'CA218-A2', title: 'Assignment 2: Library system in Java', kind: 'assignment', taskType: 'programming', weight: 20, due: { w: 1, d: 0, t: '17:00' }, effort: 7,
          subtasks: ['Model classes: Book, Member, Loan', 'Loan rules and overdue fines', 'Command-line interface', 'JUnit tests (at least 10)', 'README and submission on Loop'] },
        { id: 'CA218-EX', title: 'Final exam (2 h)', kind: 'exam', weight: 65, due: null, flag: 'Exam date not published yet.' },
      ],
      resources: [
        { title: 'CA218 module page', kind: 'page', status: 'read' },
        { title: 'Assignment 2 specification (Loop page)', kind: 'page', status: 'read' },
      ],
    },
    CA208: {
      code: 'CA208', name: 'Logic & Computation', ects: 5, lecturer: 'Dr Eoin Fahy', hue: 85,
      page: 'read',
      topics: ['Propositional logic', 'Natural deduction', 'Predicate logic', 'Finite automata', 'Regular languages', 'Context-free grammars'],
      tutorialPrep: 35,
      assessments: [
        { id: 'CA208-PS4', title: 'Problem sheet 4: Automata', kind: 'assignment', taskType: 'problems', weight: 10, due: { w: 1, d: 2, t: '17:00' }, effort: 3 },
        { id: 'CA208-EX', title: 'Final exam (2 h)', kind: 'exam', weight: 80, due: null, flag: 'Exam date not published yet.' },
      ],
      resources: [{ title: 'CA208 module page', kind: 'page', status: 'read' }],
    },
    CA216: {
      code: 'CA216', name: 'Operating Systems', ects: 5, lecturer: 'Dr Mark Hennessy', hue: 205,
      page: 'read',
      topics: ['Processes and threads', 'CPU scheduling', 'Synchronisation and deadlock', 'Memory management and paging', 'File systems', 'The Unix shell'],
      lab: { prelab: 30, report: 0, title: 'Lab 7: Pipes and fork()' },
      labChecklist: ['Read the man pages for fork(), pipe() and dup2()', 'Sketch the process tree for the lab exercise', 'Get last week’s shell skeleton compiling'],
      assessments: [
        { id: 'CA216-SH', title: 'Project: a Unix shell in C', kind: 'project', taskType: 'programming', weight: 25, due: { w: 2, d: 0, t: '17:00' }, effort: 12 },
        { id: 'CA216-EX', title: 'Final exam (2 h)', kind: 'exam', weight: 60, due: null, flag: 'Exam date not published yet.' },
      ],
      resources: [{ title: 'CA216 module page', kind: 'page', status: 'read' }, { title: 'Shell project spec.pdf', kind: 'file', status: 'needs-auth', note: 'Opens behind Loop sign-in. Upload it to attach it.' }],
    },
    CA225: {
      code: 'CA225', name: 'Database Systems', ects: 5, lecturer: 'Dr Claire Ní Bhriain', hue: 28,
      page: 'read',
      topics: ['Relational model', 'SQL queries and joins', 'Normalisation', 'Transactions', 'Indexing', 'ER modelling'],
      lab: { prelab: 0, report: 60, reportDueDays: 4, reportDueTime: '17:00', title: 'SQL worksheet' },
      assessments: [
        { id: 'CA225-SQL', title: 'SQL assignment', kind: 'assignment', taskType: 'programming', weight: 15, due: { w: 1, d: 3, t: '17:00' }, effort: 5 },
        { id: 'CA225-EX', title: 'Final exam (2 h)', kind: 'exam', weight: 60, due: null, flag: 'Exam date not published yet.' },
      ],
      resources: [{ title: 'CA225 module page', kind: 'page', status: 'read' }],
    },
    CA226: {
      code: 'CA226', name: 'Web Development', ects: 5, lecturer: 'Dr Rory Gallagher', hue: 150,
      page: 'needs-auth',
      pageNote: 'This module page needs Loop sign-in, so nothing beyond the timetable could be read. Add deadlines yourself.',
      topics: [],
      assessments: [],
      resources: [{ title: 'CA226 module page', kind: 'page', status: 'needs-auth', note: 'Needs Loop sign-in.' }],
    },
  };

  const ECE2 = TS.dcuEce2;
  for (const m of ECE2.modules) MODULES[m.code] = m;

  /* ---- Timetables (weekly pattern; day 0 = Monday) ---- */
  const TIMETABLES = {
    'ece-2': { official: true, modules: ECE2.modules.map((m) => m.code), classes: ECE2.classes },
    'csc-2': {
      modules: ['CA208', 'CA216', 'CA218', 'CA225', 'CA226'],
      classes: [
        { module: 'CA208', kind: 'lecture', day: 0, start: '11:00', end: '12:00', room: 'L114' },
        { module: 'CA225', kind: 'lecture', day: 0, start: '15:00', end: '16:00', room: 'LG26' },
        { module: 'CA216', kind: 'lecture', day: 1, start: '10:00', end: '11:00', room: 'QG13' },
        { module: 'CA226', kind: 'lecture', day: 1, start: '12:00', end: '14:00', room: 'L125' },
        { module: 'CA218', kind: 'lecture', day: 1, start: '14:00', end: '16:00', room: 'LG26' },
        { module: 'CA208', kind: 'tutorial', day: 2, start: '13:00', end: '14:00', room: 'L101' },
        { module: 'CA216', kind: 'lab', day: 2, start: '15:00', end: '17:00', room: 'LG25',
          flag: { type: 'choice', id: 'ca216-slot', message: 'Loop lists two CA216 lab slots. Pick the one you attend.',
            options: [{ value: 'wed', label: 'Wednesday 15:00–17:00', patch: { day: 2, start: '15:00', end: '17:00' } }, { value: 'fri', label: 'Friday 14:00–16:00', patch: { day: 4, start: '14:00', end: '16:00' } }] } },
        { module: 'CA218', kind: 'lab', day: 2, start: '10:00', end: '12:00', room: 'LG25' },
        { module: 'CA208', kind: 'lecture', day: 3, start: '09:00', end: '10:00', room: 'L114' },
        { module: 'CA225', kind: 'lecture', day: 3, start: '14:00', end: '15:00', room: 'LG26' },
        { module: 'CA225', kind: 'lab', day: 3, start: '15:00', end: '17:00', room: 'LG27' },
        { module: 'CA216', kind: 'lecture', day: 4, start: '10:00', end: '11:00', room: 'QG13' },
        { module: 'CA226', kind: 'lab', day: 4, start: '11:00', end: '13:00', room: 'LG25', flag: { type: 'info', id: 'ca226-room', message: 'CA226 lab room changed twice this semester. Check Loop announcements before you go.' } },
      ],
    },
  };

  /* ---- Helpers ---- */
  const latency = (ms) => TS.sleep(ms * (0.85 + Math.random() * 0.3));

  // Resolve a relative due date {w, d, t} against the current week. Anything
  // that would land within the next 20 hours is pushed a week out so the
  // demo stays plausible whatever day it is run on.
  function resolveDue(spec, now, { allowPast = false } = {}) {
    if (!spec) return null;
    let due = T.at(T.addDays(T.weekStart(now), spec.w * 7 + spec.d), spec.t);
    if (!allowPast) while (due < now + 20 * T.HOUR) due = T.addDays(due, 7);
    return due;
  }

  function semesterFor(key, now) {
    if (key === 'ece-2') {
      // Use DCU's real calendar. Outside teaching weeks, replay week 9 so the demo still shows a normal week.
      const tw = Math.floor(T.daysBetween(ECE2.week1, T.weekStart(now)) / 7) + 1;
      const live = tw >= 1 && tw <= ECE2.teachingWeeks;
      const week1Start = live ? ECE2.week1 : T.addDays(T.weekStart(now), -8 * 7);
      const shift = T.daysBetween(ECE2.week1, week1Start);
      return { label: 'Semester 1', week1Start, teachingWeeks: ECE2.teachingWeeks, official: true, replay: !live,
        examWindow: { start: T.addDays(ECE2.examStart, shift), end: T.addDays(ECE2.examEnd, shift) } };
    }
    // Sample courses: teaching week 9 of 12 always contains "now".
    return { label: 'Semester 1', week1Start: T.addDays(T.weekStart(now), -8 * 7), teachingWeeks: 12 };
  }

  const dueInWeek = (sem, a) => T.at(T.addDays(sem.week1Start, (a.week - 1) * 7 + (a.day != null ? a.day : 4)), a.time || '17:00');

  const tokens = new Map();

  const api = {
    isDemo: true,
    universities: UNIVERSITIES,
    programmes: PROGRAMMES,
    hasDemoData(programmeId, year) { return Boolean(TIMETABLES[programmeId + '-' + year]); },
    isOfficial(programmeId, year) { const t = TIMETABLES[programmeId + '-' + year]; return Boolean(t && t.official); },

    /** Simulated authorisation. No credentials are requested or stored. */
    async connect({ universityId, programmeId, year }) {
      await latency(850);
      if (universityId !== 'dcu') throw new Error('The Loop connector is only available for DCU.');
      const key = programmeId + '-' + year;
      if (!TIMETABLES[key]) {
        const err = new Error('No sample timetable for this course and year. The demo includes Electronic & Computer Engineering Year 2 and Computer Science Year 2. You can still upload a calendar file or enter classes by hand.');
        err.code = 'NO_DATA';
        throw err;
      }
      const token = 'demo-' + key + '-' + Math.random().toString(36).slice(2, 8);
      tokens.set(token, key);
      return { token, account: { source: 'DCU Loop (simulated)', programmeId, year } };
    },

    async getEnrolments(token) {
      await latency(650);
      const key = tokens.get(token);
      if (!key) throw new Error('The demo session expired. Connect again.');
      return TIMETABLES[key].modules.map((code) => {
        const m = MODULES[code];
        return { code: m.code, name: m.name, ects: m.ects, lecturer: m.lecturer, hue: m.hue };
      });
    },

    async getTimetable(token, now = Date.now()) {
      await latency(900);
      const key = tokens.get(token);
      if (!key) throw new Error('The demo session expired. Connect again.');
      const tt = TIMETABLES[key];
      return {
        semester: semesterFor(key, now),
        classes: tt.classes.map((c, i) => ({ ...c, id: 'c' + (i + 1) + '-' + c.module.toLowerCase(), weeks: c.weeks || 'all', room: c.room })),
        flags: tt.official ? [{ type: 'info', id: 'undated', message: 'EEN1018 exercises, the EEN1023 lab portfolio and EEN1091 homework count for marks, but DCU doesn\u2019t publish their dates. Add them in Tasks when they\u2019re announced.' }] : [],
      };
    },

    async getModulePage(token, code, now = Date.now()) {
      await latency(380 + (code.charCodeAt(2) % 4) * 90);
      const m = MODULES[code];
      if (!m) return { code, status: 'missing', assessments: [], topics: [], resources: [] };
      const sem = m.official ? semesterFor('ece-2', now) : null;
      return {
        code,
        status: m.page,
        note: m.pageNote || null,
        topics: m.page === 'needs-auth' ? [] : m.topics.slice(),
        lab: m.lab ? { ...m.lab } : null,
        labChecklist: m.labChecklist ? m.labChecklist.slice() : null,
        tutorialPrep: m.tutorialPrep || 0,
        assessments: m.assessments.map((a) => ({
          id: a.id, title: a.title, kind: a.kind, taskType: a.taskType || null, weight: a.weight, note: a.note || null,
          due: m.official ? (a.week ? dueInWeek(sem, a) : null) : a.status === 'submitted' ? resolveDue(a.due, now, { allowPast: true }) : resolveDue(a.due, now),
          week: a.week || null, undated: !!a.undated,
          effortHours: a.effort || null, status: a.status || 'open', flag: a.flag || null, subtasks: a.subtasks ? a.subtasks.slice() : null,
        })),
        resources: m.resources.map((r, i) => ({ id: code.toLowerCase() + '-r' + i, ...r })),
      };
    },

    /** Demo-only: describe a timetable change Loop might push mid-week. */
    proposeChange(state, now = Date.now()) {
      const all = TS.model.expandFixed(state, now, T.addDays(now, 10)).filter((o) => o.source === 'class' && !o.cancelled);
      const occ = all.filter((o) => o.start > now + 20 * T.HOUR);
      const hasPrep = (o) => { const m = state.modules.find((x) => x.id === o.moduleId); return m && (o.kind === 'lab' ? m.lab && m.lab.prelab : o.kind === 'tutorial' && m.tutorialPrep); };
      const target = occ.find((o) => o.kind === 'lab' && hasPrep(o)) || occ.find(hasPrep) || occ[0];
      if (!target) return null;
      const day = T.dayStart(target.start);
      const dur = target.end - target.start;
      const options = [];
      for (const offset of [-1, 1, 2]) {
        const d = T.addDays(day, offset);
        if (T.weekday(d) > 4) continue;
        for (const time of ['16:00', '12:00', '09:00', '15:00']) {
          const s = T.at(d, time);
          if (s >= now + 6 * T.HOUR && !all.some((o) => o.key !== target.key && T.overlap(s, s + dur, o.start, o.end))) options.push(s);
        }
      }
      if (!options.length) return null;
      // Demo control: prefer a change the plan can absorb without missing a graded deadline.
      const absorbs = (s) => {
        const exceptions = [...(state.exceptions || []).filter((e) => e.key !== target.key), { key: target.key, type: 'move', start: s, end: s + dur }];
        return !TS.engine.buildPlan({ ...state, exceptions }, now, { mode: 'minimal' }).report.unscheduled.some((u) => !u.flexible);
      };
      const newStart = options.find(absorbs) || options[0];
      const m = state.modules.find((x) => x.id === target.moduleId);
      return {
        key: target.key, classId: target.classId,
        start: newStart, end: newStart + dur,
        message: `${m.code} ${TS.model.KIND_LABEL[target.kind].toLowerCase()} moved from ${T.fmtDate(target.start)} ${T.hm(target.start)} to ${T.fmtDate(newStart)} ${T.hm(newStart)} (same room).`,
      };
    },
  };

  TS.loopDemo = api;
})();
