/* Application state + actions.
   Persistence: browser localStorage only (demo). This file is the single
   boundary to swap for a real backend (e.g. Supabase tables per record type). */
(() => {
  const TS = window.TS;
  const T = TS.time;
  const HUES = [28, 205, 250, 85, 150, 345, 115, 180, 60, 15];

  const initialSetup = () => ({
    step: 'welcome',
    name: '', universityId: 'dcu', programmeId: 'ece', year: 2,
    source: 'loop',
    imported: null, resolutions: {}, excludedModules: [], excludedClasses: [],
    prefs: { ...TS.engine.DEFAULT_PREFS },
    commitments: [],
    ratings: {},
    visited: ['welcome'],
  });

  const initialState = () => ({
    version: 1,
    onboarded: false,
    setup: initialSetup(),
    profile: null, connection: null, semester: null,
    prefs: { ...TS.engine.DEFAULT_PREFS },
    modules: [], classes: [], assessments: [], commitments: [], exceptions: [], blocks: [],
    tasks: [], sessions: [], buffers: [], planReport: null, log: [],
    proposal: null, active: null,
    reviews: { mine: [], reported: [] },
    notifications: { dayPlan: true, beforeSession: true, deadlines: true, replan: true },
    ui: { theme: 'system', hiddenModules: [], hiddenTypes: [] },
  });

  const saved = TS.storage.read(TS.brand.storageKey);
  const store = TS.createStore(saved && saved.version === 1 ? saved : initialState(), { persistKey: TS.brand.storageKey });
  TS.store = store;
  TS.useStore = (sel) => { const s = TS.useSyncExternalStore(store.subscribe, store.get); return sel ? sel(s) : s; };

  /* ---------- Theme ---------- */
  function applyTheme(theme) {
    const root = document.documentElement;
    // Only clear a theme we set ourselves, so a host page's own theme choice is respected.
    if (theme === 'light' || theme === 'dark') { root.setAttribute('data-theme', theme); root.setAttribute('data-ts-theme', '1'); }
    else if (root.hasAttribute('data-ts-theme')) { root.removeAttribute('data-theme'); root.removeAttribute('data-ts-theme'); }
  }
  applyTheme(store.get().ui.theme);

  /* ---------- Selectors ---------- */
  const sel = {
    module: (s, id) => s.modules.find((m) => m.id === id),
    task: (s, id) => s.tasks.find((t) => t.id === id),
    session: (s, id) => s.sessions.find((x) => x.id === id),
    hue: (s, moduleId) => { const m = s.modules.find((x) => x.id === moduleId); return m ? m.hue : 260; },
    teachingWeek: (s, t = Date.now()) => TS.model.teachingWeek(s.semester, t),
    taskProgress(s, t) {
      const est = TS.model.taskEstimate(t);
      return { done: Math.min(t.done || 0, est), est, pct: est ? Math.min(1, (t.done || 0) / est) : 0 };
    },
    upcomingSessions: (s, now) => s.sessions.filter((x) => x.status === 'planned' && x.end > now).sort((a, b) => a.start - b.start),
    needsCheckIn: (s, now) => s.sessions.filter((x) => x.status === 'planned' && x.end <= now && x.end > T.addDays(T.dayStart(now), -2)).sort((a, b) => b.start - a.start),
  };
  TS.sel = sel;

  /* ---------- Helpers ---------- */
  function applyPlan(draft, plan) {
    draft.tasks = plan.tasks;
    draft.sessions = plan.sessions;
    draft.buffers = plan.buffers;
    draft.planReport = plan.report;
  }

  function logEntry(draft, s, status, actualMin, workMin) {
    draft.log.push({ id: TS.uid('log'), sessionId: s.id, taskId: s.taskId, moduleId: s.moduleId, type: s.type, status, plannedMin: (s.end - s.start) / T.MIN, actualMin, workMin, at: Date.now(), sessionStart: s.start });
  }

  /** Build a proposal from the current (already updated) state and open the review sheet. */
  function propose(reason, { silentIfNoChange = false, detail = null, mode = 'minimal', warning = null } = {}) {
    const s = store.get();
    const now = Date.now();
    const plan = TS.engine.buildPlan(s, now, { mode });
    const diff = TS.engine.diffPlans(s.sessions, plan.sessions, now);
    const newUnfit = plan.report.unscheduled.filter((u) => !u.flexible);
    if (!diff.changes.length) {
      store.set((d) => { d.tasks = plan.tasks; d.planReport = plan.report; d.buffers = plan.buffers; });
      if (!silentIfNoChange) TS.toast(reason + '. Nothing in your plan needed to move.' + (warning ? ' ' + warning : ''), { tone: warning ? 'warn' : 'ok', duration: warning ? 9000 : 4200 });
      return null;
    }
    store.set((d) => {
      d.proposal = { id: TS.uid('p'), reason, detail, warning, createdAt: now, plan, diff, open: true, unfit: newUnfit };
      d.tasks = plan.tasks; // tasks are facts (deadlines, anchors) and always stay current
    });
    return diff;
  }

  /* ---------- Actions ---------- */
  const A = {
    setTheme(theme) { store.set((d) => { d.ui.theme = theme; }); applyTheme(theme); },

    /* Setup */
    setup(patch) { store.set((d) => { Object.assign(d.setup, typeof patch === 'function' ? patch(d.setup) : patch); }); },
    setupGo(step) { store.set((d) => { d.setup.step = step; if (!d.setup.visited.includes(step)) d.setup.visited.push(step); }); },
    setupPrefs(patch) { store.set((d) => { Object.assign(d.setup.prefs, patch); }); },
    resetSetup() { store.set((d) => { d.setup = initialSetup(); }); },

    /** Commit the setup draft into real records and generate the first plan. */
    finishSetup() {
      const s = store.get();
      const su = s.setup;
      const imp = su.imported;
      if (!imp) throw new Error('Nothing imported yet.');
      const prog = TS.loopDemo.programmes.find((p) => p.id === su.programmeId);
      const uni = TS.loopDemo.universities.find((u) => u.id === su.universityId);
      const used = new Set();
      const modules = imp.modules.map((m, i) => {
        let hue = m.hue;
        if (hue == null || used.has(hue)) hue = HUES.find((h) => !used.has(h)) || HUES[i % HUES.length];
        used.add(hue);
        const r = su.ratings[m.code] || {};
        return {
          id: m.code, code: m.code, name: m.name, ects: m.ects || 5, lecturer: m.lecturer || null, hue,
          difficulty: r.difficulty || 2, confidence: r.confidence || 2, include: !su.excludedModules.includes(m.code),
          topics: m.topics || [], lab: m.lab || null, labChecklist: m.labChecklist || null, tutorialPrep: m.tutorialPrep || 0,
          pageStatus: m.pageStatus || 'none', pageNote: m.pageNote || null, resources: m.resources || [], notes: '',
        };
      });
      const classes = imp.classes.map((c) => {
        let out = { id: c.id, moduleId: c.module, kind: c.kind, day: c.day, start: c.start, end: c.end, room: c.room || null, weeks: c.weeks || 'all', include: !su.excludedClasses.includes(c.id) };
        if (c.flag && c.flag.type === 'choice') {
          const pick = c.flag.options.find((o) => o.value === su.resolutions[c.flag.id]);
          if (pick) out = { ...out, ...pick.patch };
        }
        if (c.edited) out = { ...out, ...c.edited };
        return out;
      });
      const assessments = (imp.assessments || []).map((a) => ({ ...a }));
      store.set((d) => {
        d.profile = { name: su.name.trim() || 'Student', universityId: su.universityId, universityName: uni ? uni.name : '', programmeId: su.programmeId, programmeName: prog ? prog.award + ' ' + prog.name : 'Your course', year: su.year };
        d.connection = { source: imp.origin, label: imp.origin === 'loop' ? 'DCU Loop (simulated)' : imp.origin === 'ics' ? 'Calendar file' : 'Manual entry', at: Date.now(), detail: imp.originDetail || null };
        d.semester = imp.semester;
        d.prefs = { ...su.prefs };
        d.modules = modules; d.classes = classes; d.assessments = assessments;
        d.commitments = su.commitments.filter((c) => c.title.trim() && c.days.length && T.toMin(c.end) > T.toMin(c.start)).map((c) => ({ ...c }));
        d.exceptions = []; d.blocks = []; d.tasks = []; d.sessions = []; d.log = []; d.proposal = null; d.active = null;
      });
      const plan = TS.engine.buildPlan(store.get(), Date.now());
      store.set((d) => { applyPlan(d, plan); });
      return plan;
    },
    enterApp() { store.set((d) => { d.onboarded = true; }); TS.go('today'); },

    /* Replanning */
    replan(reason = 'You asked for a fresh plan') { return propose(reason, { mode: 'full', detail: 'Everything not done or pinned is re-placed around your current timetable.' }); },
    acceptProposal() {
      const p = store.get().proposal;
      if (!p) return;
      store.set((d) => { applyPlan(d, p.plan); d.proposal = null; });
      TS.toast('Plan updated. ' + TS.plural(p.diff.changes.length, 'change') + ' applied.', { tone: 'ok' });
    },
    rejectProposal() {
      store.set((d) => { d.proposal = null; });
      TS.toast('Kept your current plan. Nothing was moved.');
    },
    hideProposal() { store.set((d) => { if (d.proposal) d.proposal.open = false; }); },
    showProposal() { store.set((d) => { if (d.proposal) d.proposal.open = true; }); },

    /* Sessions */
    startSession(id) { store.set((d) => { d.active = { sessionId: id, startedAt: Date.now() }; }); },
    stopSession() { store.set((d) => { d.active = null; }); },
    checkIn(id, status, { actualMin, fraction } = {}) {
      const s0 = sel.session(store.get(), id);
      if (!s0) return;
      const planned = (s0.end - s0.start) / T.MIN;
      store.set((d) => {
        const s = d.sessions.find((x) => x.id === id);
        const t = d.tasks.find((x) => x.id === s.taskId);
        const prevWork = s.workMin || 0;
        let work = 0;
        if (status === 'done') work = planned;
        if (status === 'partial') work = Math.round(planned * (fraction != null ? fraction : 0.5));
        s.status = status;
        s.actualMin = status === 'missed' ? 0 : Math.round(actualMin != null ? actualMin : status === 'partial' ? work : planned);
        s.workMin = work;
        if (t) t.done = Math.max(0, (t.done || 0) - prevWork + work);
        if (d.active && d.active.sessionId === id) d.active = null;
        logEntry(d, s, status, s.actualMin, work);
      });
      const st = store.get();
      const t = sel.task(st, s0.taskId);
      if (status === 'done') {
        const est = t ? TS.model.taskEstimate(t) : 0;
        if (t && t.done >= est && t.status !== 'done') {
          TS.toast('That covers the estimate for “' + t.title + '”. Is the whole task finished?', { tone: 'ok', duration: 8000, action: { label: 'Mark task done', run: () => A.completeTask(t.id) } });
        } else TS.toast('Logged ' + T.fmtDur(st.sessions.find((x) => x.id === id).actualMin) + ' on ' + (t ? t.title : 'this session') + '.', { tone: 'ok' });
      } else if (status === 'missed') {
        propose('You missed “' + s0.title + '”', { detail: 'Its ' + T.fmtDur(planned) + ' of work needs a new home.' });
      } else if (status === 'partial') {
        propose('“' + s0.title + '” is only partly done', { detail: 'The unfinished part needs a new slot.' });
      }
    },
    undoCheckIn(id) {
      store.set((d) => {
        const s = d.sessions.find((x) => x.id === id);
        if (!s) return;
        const t = d.tasks.find((x) => x.id === s.taskId);
        if (t) t.done = Math.max(0, (t.done || 0) - (s.workMin || 0));
        s.status = 'planned'; s.actualMin = null; s.workMin = 0;
        d.log = d.log.filter((l) => l.sessionId !== id);
      });
    },
    moveSession(id, start, end) {
      const st = store.get();
      const s = sel.session(st, id);
      const check = TS.engine.checkMove(st, s, start, end, Date.now());
      if (!check.ok) { TS.toast(check.error, { tone: 'danger' }); return false; }
      store.set((d) => { const x = d.sessions.find((y) => y.id === id); x.start = start; x.end = end; x.pinned = true; });
      if (check.warnings.length) TS.toast('Moved and pinned. ' + check.warnings[0], { tone: 'warn', duration: 6000 });
      else TS.toast('Moved to ' + T.fmtWhen(start) + ' and pinned. Replans will leave it there.', { tone: 'ok', action: { label: 'Undo', run: () => store.set((d) => { const x = d.sessions.find((y) => y.id === id); x.start = s.start; x.end = s.end; x.pinned = s.pinned; }) } });
      return true;
    },
    togglePin(id) { store.set((d) => { const x = d.sessions.find((y) => y.id === id); if (x) x.pinned = !x.pinned; }); },
    needsMoreTime(taskId, extraMin) {
      store.set((d) => { const t = d.tasks.find((x) => x.id === taskId); if (t) t.userEstimate = TS.model.taskEstimate(t) + extraMin; });
      const t = sel.task(store.get(), taskId);
      propose('“' + t.title + '” needs ' + T.fmtDur(extraMin) + ' more', { detail: 'Estimate raised to ' + T.fmtDur(TS.model.taskEstimate(t)) + '.' });
    },

    /* Tasks */
    completeTask(id) {
      const now = Date.now();
      const st = store.get();
      const removed = st.sessions.filter((s) => s.taskId === id && s.status === 'planned' && s.start >= now);
      store.set((d) => {
        const t = d.tasks.find((x) => x.id === id);
        if (t) { t.status = 'done'; t.completedAt = now; }
        d.sessions = d.sessions.filter((s) => !(s.taskId === id && s.status === 'planned' && s.start >= now));
        if (t && t.assessmentId) { const a = d.assessments.find((x) => x.id === t.assessmentId); if (a) a.status = 'submitted'; }
      });
      TS.toast('Task complete.' + (removed.length ? ' Freed ' + TS.plural(removed.length, 'upcoming session') + '.' : ''), { tone: 'ok', action: { label: 'Undo', run: () => A.reopenTask(id, removed) } });
    },
    reopenTask(id, restoreSessions = []) {
      store.set((d) => {
        const t = d.tasks.find((x) => x.id === id);
        if (t) { t.status = 'open'; t.completedAt = null; if (t.assessmentId) { const a = d.assessments.find((x) => x.id === t.assessmentId); if (a) a.status = 'open'; } }
        d.sessions.push(...restoreSessions);
      });
    },
    toggleSubtask(taskId, subId) { store.set((d) => { const t = d.tasks.find((x) => x.id === taskId); const st = t && t.subtasks.find((x) => x.id === subId); if (st) st.done = !st.done; }); },
    addSubtask(taskId, title) { store.set((d) => { const t = d.tasks.find((x) => x.id === taskId); if (t) t.subtasks.push({ id: TS.uid('st'), title, done: false }); }); },
    updateTask(id, patch, { replan = false } = {}) {
      store.set((d) => { const t = d.tasks.find((x) => x.id === id); if (t) Object.assign(t, patch); if (patch.title && t.source === 'auto') t.userTitle = patch.title; });
      if (replan) propose('You changed “' + sel.task(store.get(), id).title + '”');
    },
    addTask(input) {
      const id = 'user:' + TS.uid('task');
      const now = Date.now();
      store.set((d) => {
        d.tasks.push({
          id, source: 'user', moduleId: input.moduleId, type: input.type, title: input.title.trim(), description: input.description || '',
          estimate: input.estimate, userEstimate: null, done: 0, status: 'open', due: input.due || null, earliest: input.earliest || now,
          weight: input.weight != null && input.weight !== '' ? Number(input.weight) : null, dependsOn: input.dependsOn || [], subtasks: [], notes: '',
        });
      });
      propose('Added “' + input.title.trim() + '”', { detail: T.fmtDur(input.estimate) + (input.due ? ', due ' + T.fmtWhen(input.due) : ', no deadline') });
      return id;
    },
    deleteTask(id) {
      store.set((d) => { d.tasks = d.tasks.filter((t) => t.id !== id); d.sessions = d.sessions.filter((s) => !(s.taskId === id && s.status === 'planned')); });
      TS.toast('Task deleted.');
    },

    /* Fixed commitments */
    cancelOccurrence(occ, note) {
      store.set((d) => { d.exceptions = d.exceptions.filter((e) => e.key !== occ.key); d.exceptions.push({ key: occ.key, type: 'cancel', note: note || null, at: Date.now() }); });
      propose(occ.title + ' on ' + T.fmtDate(occ.start) + ' is cancelled', { detail: 'Work tied to it is re-checked, and the freed time is available.' });
    },
    moveOccurrence(occ, start, end, note) {
      store.set((d) => { d.exceptions = d.exceptions.filter((e) => e.key !== occ.key); d.exceptions.push({ key: occ.key, type: 'move', start, end, note: note || null, at: Date.now() }); });
      const clashes = TS.model.expandFixed(store.get(), T.addDays(start, -1), T.addDays(end, 1)).filter((o) => !o.cancelled && o.key !== occ.key && T.overlap(start, end, o.start, o.end));
      const warning = clashes.length ? 'The new time overlaps ' + clashes.map((o) => o.title + ' (' + T.fmtRange(o.start, o.end) + ')').join(' and ') + '. Fixed commitments are never moved automatically, so decide which one to go to.' : null;
      propose(occ.title + ' moved to ' + T.fmtDate(start) + ' ' + T.fmtRange(start, end), { detail: note || 'Sessions that depend on it are re-checked.', warning });
    },
    restoreOccurrence(key) {
      store.set((d) => { d.exceptions = d.exceptions.filter((e) => e.key !== key); });
      propose('Class restored to its usual time');
    },
    addBlock(start, end, note) {
      store.set((d) => { d.blocks.push({ id: TS.uid('blk'), start, end, note: note || 'Unavailable' }); });
      propose('You’re unavailable ' + T.fmtDate(start) + ' ' + T.fmtRange(start, end), { detail: 'Sessions in that time need to move.' });
    },
    removeBlock(id) { store.set((d) => { d.blocks = d.blocks.filter((b) => b.id !== id); }); propose('Unavailable time removed', { silentIfNoChange: true }); },
    saveCommitments(list) { store.set((d) => { d.commitments = list; }); propose('Your commitments changed'); },

    /* Modules */
    updateModule(id, patch, { replan = false } = {}) {
      store.set((d) => { const m = d.modules.find((x) => x.id === id); if (m) Object.assign(m, patch); });
      if (replan) propose('You re-rated ' + id, { silentIfNoChange: true });
    },
    addResource(moduleId, res) { store.set((d) => { const m = d.modules.find((x) => x.id === moduleId); if (m) m.resources.push({ id: TS.uid('res'), ...res }); }); },
    removeResource(moduleId, resId) { store.set((d) => { const m = d.modules.find((x) => x.id === moduleId); if (m) m.resources = m.resources.filter((r) => r.id !== resId); }); },
    updateAssessment(id, patch) { store.set((d) => { const a = d.assessments.find((x) => x.id === id); if (a) Object.assign(a, patch); }); propose('Assessment details changed', { silentIfNoChange: true }); },

    /* Preferences */
    updatePrefs(patch) { store.set((d) => { Object.assign(d.prefs, patch); }); propose('Your study preferences changed', { silentIfNoChange: true }); },
    updateNotifications(patch) { store.set((d) => { Object.assign(d.notifications, patch); }); },
    updateProfile(patch) { store.set((d) => { Object.assign(d.profile, patch); }); },
    setHidden(kind, list) { store.set((d) => { d.ui[kind] = list; }); },

    /* Reviews */
    addReview(r) { store.set((d) => { d.reviews.mine.push({ id: TS.uid('rev'), at: Date.now(), status: 'pending', ...r }); }); },
    reportReview(id) { store.set((d) => { if (!d.reviews.reported.includes(id)) d.reviews.reported.push(id); }); },

    /* Demo controls */
    simulateLoopChange() {
      const st = store.get();
      const ch = TS.loopDemo.proposeChange(st, Date.now());
      if (!ch) { TS.toast('No upcoming lab to move in the next 10 days.', { tone: 'warn' }); return; }
      const occ = TS.model.expandFixed(st, Date.now(), T.addDays(Date.now(), 11)).find((o) => o.key === ch.key);
      A.moveOccurrence(occ, ch.start, ch.end, 'Change pushed by Loop (simulated): ' + ch.message);
    },
    resetAll() {
      TS.storage.remove(TS.brand.storageKey);
      store.replace(initialState());
      applyTheme('system');
      TS.go('');
    },
  };
  TS.actions = A;
})();
