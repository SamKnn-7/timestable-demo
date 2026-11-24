/* Engine tests. Run by opening tests.html. Pure functions only; never touches saved app data. */
(() => {
  const TS = window.TS;
  const T = TS.time;
  const E = TS.engine;
  const M = TS.model;
  const results = [];
  const test = (name, fn) => { try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, msg: e.message }); } };
  const ok = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };
  const eq = (a, b, msg) => { if (a !== b) throw new Error((msg || 'expected equal') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };

  /* A fixed "now": Tuesday 17 Nov 2026, 10:00 local (independent of when tests run). */
  const NOW = new Date(2026, 10, 17, 10, 0).getTime();
  const WS = T.weekStart(NOW);

  function baseState(extra = {}) {
    return {
      semester: { label: 'Semester 1', week1Start: T.addDays(WS, -8 * 7), teachingWeeks: 12 },
      prefs: { ...E.DEFAULT_PREFS },
      modules: [
        { id: 'EEN1022', code: 'EEN1022', name: 'Digital & Analogue Electronics I', ects: 5, hue: 28, difficulty: 2, confidence: 2, topics: ['A', 'B'], lab: { prelab: 60, report: 120, reportDueDays: 7, reportDueTime: '17:00', title: 'Lab 5: Counters' }, tutorialPrep: 30 },
        { id: 'EEN1091', code: 'EEN1091', name: 'C/C++ Programming for Engineers', ects: 5, hue: 300, difficulty: 2, confidence: 2, topics: ['X'], tutorialPrep: 0 },
      ],
      classes: [
        { id: 'c1', moduleId: 'EEN1022', kind: 'lecture', day: 0, start: '10:00', end: '11:00', weeks: 'all' },
        { id: 'c2', moduleId: 'EEN1022', kind: 'lab', day: 3, start: '14:00', end: '17:00', weeks: 'odd' },
        { id: 'c3', moduleId: 'EEN1091', kind: 'lecture', day: 1, start: '14:00', end: '16:00', weeks: 'all' },
        { id: 'c4', moduleId: 'EEN1022', kind: 'tutorial', day: 2, start: '11:00', end: '12:00', weeks: 'all' },
      ],
      assessments: [
        { id: 'A2', moduleId: 'EEN1091', title: 'Assignment 2', kind: 'assignment', taskType: 'programming', weight: 20, due: T.at(T.addDays(WS, 7), '17:00'), effortHours: 6, status: 'open' },
      ],
      commitments: [{ id: 'job', title: 'Job', kind: 'work', days: [5], start: '10:00', end: '16:00' }],
      exceptions: [], blocks: [], tasks: [], sessions: [],
      ...extra,
    };
  }
  const commit = (st, plan) => ({ ...st, tasks: plan.tasks, sessions: plan.sessions });

  /* ---------- time ---------- */
  test('weekStart returns the Monday at 00:00', () => { const d = new Date(WS); eq(d.getDay(), 1); eq(d.getHours(), 0); });
  test('addDays keeps wall-clock time across the October DST change', () => {
    const before = T.at(new Date(2026, 9, 24).getTime(), '10:00');
    const after = T.addDays(before, 2);
    eq(new Date(after).getHours(), 10); eq(new Date(after).getDate(), 26);
  });
  test('teaching week of NOW is 9', () => eq(M.teachingWeek(baseState().semester, NOW), 9));
  test('roundUp lands on the 15-minute grid', () => { const t = T.roundUp(new Date(2026, 10, 17, 10, 7, 30).getTime(), 15); eq(T.hm(t), '10:15'); });
  test('roundUp near midnight rolls to the next day', () => { const t = T.roundUp(new Date(2026, 10, 17, 23, 55).getTime(), 15); eq(T.dateKey(t), '2026-11-18'); eq(T.hm(t), '00:00'); });
  test('a store holding Undo functions (toasts) can be updated again', () => {
    const s = TS.createStore([], { clone: false });
    s.set((l) => [...l, { id: 1, action: { run: () => 1 } }]);
    s.set((l) => [...l, { id: 2 }]);
    eq(s.get().length, 2); eq(s.get()[0].action.run(), 1);
  });

  /* ---------- chunking ---------- */
  test('chunkSizes sums to the total and stays near the session length', () => {
    for (const [total, len] of [[480, 50], [130, 50], [60, 50], [45, 25], [600, 90]]) {
      const c = E.chunkSizes(total, len);
      eq(TS.sum(c), total, 'sum for ' + total);
      ok(c.every((x) => x <= len * 1.3 + 5 && x >= 15), 'sizes ' + c.join(','));
    }
  });

  /* ---------- occurrences ---------- */
  test('alternate-week labs only appear in matching teaching weeks', () => {
    const st = baseState();
    const occ = M.expandFixed(st, WS, T.addDays(WS, 14)).filter((o) => o.kind === 'lab');
    eq(occ.length, 1, 'one lab in two weeks');
    eq(M.teachingWeek(st.semester, occ[0].start) % 2, 1);
  });
  test('a cancelled occurrence is flagged, not removed', () => {
    const st = baseState();
    const lab = M.expandFixed(st, WS, T.addDays(WS, 7)).find((o) => o.kind === 'lab');
    const st2 = { ...st, exceptions: [{ key: lab.key, type: 'cancel' }] };
    const again = M.expandFixed(st2, WS, T.addDays(WS, 7)).find((o) => o.key === lab.key);
    ok(again && again.cancelled);
  });

  /* ---------- scheduling constraints ---------- */
  const st0 = baseState();
  const plan0 = E.buildPlan(st0, NOW);
  const fixed0 = M.expandFixed(st0, WS, plan0.horizonEnd).filter((o) => !o.cancelled);
  const fut = plan0.sessions.filter((s) => s.status === 'planned');

  test('produces sessions', () => ok(fut.length > 5, 'only ' + fut.length));
  test('no two study sessions overlap', () => {
    const s = fut.slice().sort((a, b) => a.start - b.start);
    for (let i = 1; i < s.length; i++) ok(s[i].start >= s[i - 1].end, 'overlap at ' + T.fmtDate(s[i].start) + ' ' + T.hm(s[i].start));
  });
  test('no session overlaps a class, shift or commitment', () => {
    for (const s of fut) { const c = fixed0.find((o) => T.overlap(s.start, s.end, o.start, o.end)); ok(!c, s.title + ' clashes with ' + (c && c.title)); }
  });
  test('sessions stay inside the study window', () => {
    for (const s of fut) { ok(T.minOfDay(s.start) >= T.toMin(st0.prefs.dayStart), 'starts early'); ok((T.minOfDay(s.end) || 1440) <= T.toMin(st0.prefs.dayEnd), 'ends late ' + T.hm(s.end)); }
  });
  test('nothing is planned in the past', () => { for (const s of fut) ok(s.start >= NOW, 'past session'); });
  test('every session finishes before its deadline', () => {
    for (const s of fut) { const t = plan0.tasks.find((x) => x.id === s.taskId); if (t.due && !t.partial) ok(s.end <= t.due, s.title + ' after due'); }
  });
  test('pre-lab work is finished before the lab starts', () => {
    const pre = fut.filter((s) => s.type === 'prelab');
    ok(pre.length > 0, 'no pre-lab sessions');
    for (const s of pre) { const t = plan0.tasks.find((x) => x.id === s.taskId); ok(s.end <= t.anchorStart, 'pre-lab after lab'); }
  });
  test('lab reports start only after the lab ends', () => {
    for (const s of fut.filter((x) => x.type === 'labreport')) { const t = plan0.tasks.find((x) => x.id === s.taskId); ok(s.start >= t.earliest, 'report before lab'); }
  });
  test('a big assignment is split across several days', () => {
    const a = fut.filter((s) => s.taskId === 'assess:A2');
    ok(a.length >= 4, 'sessions ' + a.length);
    ok(new Set(a.map((s) => T.dateKey(s.start))).size >= 3, 'days ' + new Set(a.map((s) => T.dateKey(s.start))).size);
  });
  test('daily study never exceeds the daily limit', () => {
    const byDay = new Map();
    for (const s of fut) byDay.set(T.dateKey(s.start), (byDay.get(T.dateKey(s.start)) || 0) + (s.end - s.start) / T.MIN);
    for (const [d, m] of byDay) { const we = T.weekday(new Date(d + 'T12:00').getTime()) >= 5; ok(m <= st0.prefs.maxStudyMin * (we ? 0.5 : 1) + 1, d + ': ' + m); }
  });
  test('planning is deterministic', () => {
    const again = E.buildPlan(baseState(), NOW);
    eq(JSON.stringify(again.sessions.map((s) => [s.taskId, s.start, s.end])), JSON.stringify(plan0.sessions.map((s) => [s.taskId, s.start, s.end])));
  });
  test('fixed commitments are never changed by planning', () => {
    const st = commit(st0, plan0);
    const after = M.expandFixed(st, WS, plan0.horizonEnd).filter((o) => !o.cancelled);
    eq(JSON.stringify(after.map((o) => [o.key, o.start, o.end])), JSON.stringify(fixed0.map((o) => [o.key, o.start, o.end])));
  });

  /* ---------- impossible workloads ---------- */
  test('an impossible deadline is reported, not silently dropped', () => {
    const st = baseState({ assessments: [{ id: 'X', moduleId: 'EEN1091', title: 'Huge', kind: 'assignment', taskType: 'assignment', weight: 50, due: T.at(T.addDays(NOW, 1), '12:00'), effortHours: 20, status: 'open' }] });
    const p = E.buildPlan(st, NOW);
    const u = p.report.unscheduled.find((x) => x.taskId === 'assess:X');
    ok(u && u.minutes > 0, 'not reported');
    const placed = TS.sum(p.sessions.filter((s) => s.taskId === 'assess:X'), (s) => (s.end - s.start) / T.MIN);
    eq(placed + u.minutes, 1200, 'placed + missing = needed');
    ok(!u.flexible, 'graded deadline must be hard');
    ok(u.reason && u.reason.text.length > 10, 'needs a reason');
  });

  /* ---------- dependencies ---------- */
  test('a dependent task starts after its prerequisite', () => {
    const due = T.at(T.addDays(WS, 6), '17:00');
    const st = baseState({ assessments: [], tasks: [
      { id: 'user:a', source: 'user', moduleId: 'EEN1091', type: 'assignment', title: 'Design', estimate: 120, done: 0, status: 'open', due, earliest: NOW, dependsOn: [] },
      { id: 'user:b', source: 'user', moduleId: 'EEN1091', type: 'assignment', title: 'Build', estimate: 120, done: 0, status: 'open', due, earliest: NOW, dependsOn: ['user:a'] },
    ] });
    const p = E.buildPlan(st, NOW);
    const aEnd = Math.max(...p.sessions.filter((s) => s.taskId === 'user:a').map((s) => s.end));
    const bStart = Math.min(...p.sessions.filter((s) => s.taskId === 'user:b').map((s) => s.start));
    ok(isFinite(aEnd) && isFinite(bStart), 'both placed');
    ok(bStart >= aEnd, 'Build before Design');
  });

  /* ---------- adaptive replanning ---------- */
  test('cancelling a lecture only touches work tied to that module’s lectures (minimal replan)', () => {
    const st = commit(st0, plan0);
    const lec = M.expandFixed(st, NOW, T.addDays(NOW, 7)).find((o) => o.kind === 'lecture' && o.start > NOW);
    const st2 = { ...st, exceptions: [{ key: lec.key, type: 'cancel' }] };
    const p = E.buildPlan(st2, NOW, { mode: 'minimal' });
    const changes = E.diffPlans(st.sessions, p.sessions, NOW).changes;
    ok(changes.every((c) => c.taskId.startsWith('review:' + lec.moduleId)), 'unrelated sessions moved: ' + changes.map((c) => c.title).join(', '));
  });
  test('cancelling a tutorial with nothing tied to it moves nothing', () => {
    const st = commit(st0, plan0);
    const tut = M.expandFixed(st, T.addDays(WS, 7), T.addDays(WS, 14)).find((o) => o.kind === 'tutorial');
    const st2 = { ...st, exceptions: [{ key: tut.key, type: 'cancel' }] };
    const p = E.buildPlan(st2, NOW, { mode: 'minimal' });
    const changes = E.diffPlans(st.sessions, p.sessions, NOW).changes;
    ok(changes.every((c) => c.taskId === 'tut:' + tut.key), 'unrelated sessions moved: ' + changes.map((c) => c.title).join(', '));
  });
  test('moving a lab earlier moves its pre-lab before the new time', () => {
    const st = commit(st0, plan0);
    const lab = M.expandFixed(st, NOW, T.addDays(NOW, 10)).find((o) => o.kind === 'lab' && o.start > NOW);
    const newStart = T.at(T.addDays(T.dayStart(lab.start), -1), '16:00');
    const st2 = { ...st, exceptions: [{ key: lab.key, type: 'move', start: newStart, end: newStart + 3 * T.HOUR }] };
    const p = E.buildPlan(st2, NOW, { mode: 'minimal' });
    const pre = p.sessions.filter((s) => s.taskId === 'prelab:' + lab.key && s.status === 'planned');
    ok(pre.length > 0, 'pre-lab dropped');
    for (const s of pre) ok(s.end <= newStart, 'pre-lab ' + T.fmtDate(s.start) + ' ' + T.hm(s.end) + ' after moved lab');
    for (const s of p.sessions.filter((x) => x.status === 'planned' && x.start >= NOW)) ok(!T.overlap(s.start, s.end, newStart, newStart + 3 * T.HOUR), 'session on top of moved lab');
  });
  test('pinned sessions stay where the student put them', () => {
    const st = commit(st0, plan0);
    const target = st.sessions.find((s) => s.status === 'planned' && s.start > NOW + T.DAY);
    const sessions = st.sessions.map((s) => (s.id === target.id ? { ...s, pinned: true } : s));
    const p = E.buildPlan({ ...st, sessions }, NOW, { mode: 'full' });
    const kept = p.sessions.find((s) => s.id === target.id);
    ok(kept && kept.start === target.start && kept.end === target.end, 'pinned session moved');
  });
  test('a missed session’s work is planned again', () => {
    const st = commit(st0, plan0);
    const target = st.sessions.find((s) => s.taskId === 'assess:A2' && s.status === 'planned');
    const sessions = st.sessions.map((s) => (s.id === target.id ? { ...s, status: 'missed' } : s));
    const p = E.buildPlan({ ...st, sessions }, NOW, { mode: 'minimal' });
    const plannedA2 = TS.sum(p.sessions.filter((s) => s.taskId === 'assess:A2' && s.status === 'planned'), (s) => (s.end - s.start) / T.MIN);
    const before = TS.sum(st.sessions.filter((s) => s.taskId === 'assess:A2' && s.status === 'planned'), (s) => (s.end - s.start) / T.MIN);
    eq(plannedA2, before, 'same amount of work still planned');
    ok(!p.sessions.some((s) => s.id === target.id && s.status === 'planned'), 'missed session resurrected');
  });
  test('completing a session does not complete the task', () => {
    const st = commit(st0, plan0);
    const target = st.sessions.find((s) => s.taskId === 'assess:A2');
    const tasks = st.tasks.map((t) => (t.id === 'assess:A2' ? { ...t, done: (target.end - target.start) / T.MIN } : t));
    const p = E.buildPlan({ ...st, tasks, sessions: st.sessions.map((s) => (s.id === target.id ? { ...s, status: 'done' } : s)) }, NOW, { mode: 'minimal' });
    eq(p.tasks.find((t) => t.id === 'assess:A2').status, 'open');
  });
  test('manual moves onto a class are refused', () => {
    const st = commit(st0, plan0);
    const s = st.sessions.find((x) => x.status === 'planned');
    const lec = M.expandFixed(st, NOW, T.addDays(NOW, 7)).find((o) => o.kind === 'lecture' && o.start > NOW);
    const r = E.checkMove(st, s, lec.start, lec.start + (s.end - s.start), NOW);
    ok(!r.ok && /overlaps/.test(r.error));
  });

  /* ---------- import ---------- */
  test('ICS parsing: weekly classes, alternate weeks and missing codes', () => {
    const ics = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'DTSTART:20260921T090000', 'DTEND:20260921T100000', 'RRULE:FREQ=WEEKLY', 'SUMMARY:CA116 Lecture - Programming', 'LOCATION:L128', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART:20260924T100000', 'DTEND:20260924T130000', 'RRULE:FREQ=WEEKLY;INTERVAL=2', 'SUMMARY:EE101 Practical', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART:20260925T140000', 'DTEND:20260925T150000', 'SUMMARY:Peer mentoring', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const ev = TS.ics.parseICS(ics);
    eq(ev.length, 3);
    const imp = TS.ics.toImport(ev, NOW);
    const lec = imp.classes.find((c) => c.module === 'CA116');
    eq(lec.day, 0); eq(lec.start, '09:00'); eq(lec.kind, 'lecture');
    const lab = imp.classes.find((c) => c.module === 'EE101');
    eq(lab.kind, 'lab'); eq(lab.weeks, 'odd');
    ok(imp.classes.some((c) => c.module === 'MISC' && c.flag), 'uncoded event flagged');
  });
  test('Feed links: webcal accepted, Loop pages and PDFs explained', () => {
    ok(TS.ics.checkFeedUrl('webcal://example.com/cal.ics').ok);
    const l = TS.ics.checkFeedUrl('https://loop.dcu.ie/course/view.php?id=1');
    ok(!l.ok && l.kind === 'loop-page');
    ok(!TS.ics.checkFeedUrl('https://example.com/timetable.pdf').ok);
    ok(!TS.ics.checkFeedUrl('not a url').ok);
  });

  /* ---------- analytics ---------- */
  test('Week Dial totals equal the underlying records', () => {
    if (!TS.analytics) throw new Error('analytics not loaded');
    const st = { ...commit(st0, plan0), log: [] };
    const a = TS.analytics.allocate(st, WS, 'planned', NOW);
    const occ = M.expandFixed(st, WS, T.addDays(WS, 7)).filter((o) => !o.cancelled && o.source !== 'block');
    const ses = st.sessions.filter((s) => s.start >= WS && s.start < T.addDays(WS, 7));
    const expected = TS.sum(occ, (o) => (o.end - o.start) / T.MIN) + TS.sum(ses, (s) => (s.end - s.start) / T.MIN);
    eq(Math.round(a.total), Math.round(expected));
  });
  test('Logged mode counts only checked-in study', () => {
    const st = { ...commit(st0, plan0), log: [] };
    const a = TS.analytics.allocate(st, WS, 'logged', NOW);
    eq(TS.sum(a.list, (c) => c.studyMin || 0), 0);
  });

  /* ---------- the demo data itself ---------- */
  test('Loop demo only claims data for the two sample courses', () => {
    ok(TS.loopDemo.hasDemoData('ece', 2) && TS.loopDemo.hasDemoData('csc', 2) && !TS.loopDemo.hasDemoData('bus', 1));
  });

  /* ---------- published ECE2 timetable ---------- */
  const O = TS.dcuEce2;
  const ece = { semester: { label: 'Semester 1', week1Start: O.week1, teachingWeeks: 12 }, modules: O.modules.map((m) => ({ ...m, id: m.code })), classes: O.classes.map((c, i) => ({ ...c, id: 'c' + i, moduleId: c.module })), commitments: [], exceptions: [], blocks: [] };
  const eceOn = (y, m, d) => { const a = new Date(y, m - 1, d).getTime(); return M.expandFixed(ece, a, T.addDays(a, 1)).map((o) => ece.classes.find((c) => c.id === o.classId).activity); };
  const eceCount = (a, b) => M.expandFixed(ece, a, b).length;
  test('ECE2 has 6 modules, 30 credits and 21 published activities', () => { eq(O.modules.length, 6); eq(TS.sum(O.modules, (m) => m.ects), 30); eq(O.classes.length, 21); });
  test('ECE2 class counts match MyTimetable month by month', () => {
    eq(eceCount(new Date(2026, 8, 1).getTime(), new Date(2026, 9, 2).getTime()), 62, '1 Sep to 1 Oct');
    eq(eceCount(new Date(2026, 9, 1).getTime(), new Date(2026, 10, 1).getTime()), 63, 'October');
    eq(eceCount(new Date(2026, 10, 1).getTime(), new Date(2026, 11, 1).getTime()), 66, 'November');
    eq(eceCount(new Date(2026, 11, 1).getTime(), new Date(2027, 0, 1).getTime()), 0, 'December');
  });
  test('No ECE2 classes on the 26 October public holiday', () => eq(eceOn(2026, 10, 26).length, 0));
  test('23 Nov is teaching week 12 with the published Monday classes', () => {
    eq(M.teachingWeek(ece.semester, new Date(2026, 10, 23).getTime()), 12);
    eq(eceOn(2026, 11, 23).join(' '), 'EEN1018[1]OC/L1/01 EEG1009[1]OC/L1/01 EEN1022[1]OC/P1/01 EEG1009[1]OC/P1/01');
  });
  test('Room changes follow the published weeks', () => {
    ok(eceOn(2026, 9, 23).includes('EEN1022[1]OC/L2/01') && eceOn(2026, 9, 30).includes('EEN1022[1]OC/L2/02'));
    ok(eceOn(2026, 10, 7).includes('EEN1018[1]OC/L2/01') && eceOn(2026, 10, 14).includes('EEN1018[1]OC/L2/02'));
  });
  test('Week labels read like the official timetable', () => { eq(M.weeksLabel([2, 3, 4, 5, 6, 7, 9, 10, 11, 12]), 'Weeks 2\u20137, 9\u201312'); eq(M.weeksLabel([12]), 'Week 12'); });

  /* ---------- render ---------- */
  const passed = results.filter((r) => r.ok).length;
  const el = document.getElementById('results');
  el.innerHTML = `<h1 class="h1">Engine tests</h1><p class="lead" id="summary">${passed} of ${results.length} passed</p>` +
    results.map((r) => `<div class="row" style="padding:8px 0;border-top:1px solid var(--line);align-items:flex-start"><span class="badge ${r.ok ? 'badge-ok' : 'badge-danger'}">${r.ok ? 'PASS' : 'FAIL'}</span><span>${r.name}${r.ok ? '' : `<br><span class="small" style="color:var(--danger)">${r.msg}</span>`}</span></div>`).join('');
  window.__testResults = { passed, total: results.length, failed: results.filter((r) => !r.ok) };
  console.log('[tests] ' + passed + '/' + results.length + ' passed');
})();
