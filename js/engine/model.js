/* Domain model: turns stored records into dated occurrences and academic tasks.
   Pure functions, no UI. Used by the scheduler, the views and the tests. */
(() => {
  const TS = window.TS;
  const T = TS.time;
  const MIN = T.MIN;

  const KIND_LABEL = { lecture: 'Lecture', lab: 'Lab', tutorial: 'Tutorial', makeup: 'Make-up', work: 'Work', gym: 'Gym', sport: 'Sport', society: 'Society', personal: 'Personal', unavailable: 'Unavailable' };
  const TASK_TYPES = {
    prelab: { label: 'Pre-lab', icon: 'FlaskConical' },
    labreport: { label: 'Lab report', icon: 'NotebookPen' },
    assignment: { label: 'Assignment', icon: 'FileText' },
    programming: { label: 'Programming', icon: 'Layers' },
    problems: { label: 'Problem sheet', icon: 'ListChecks' },
    review: { label: 'Lecture review', icon: 'BookOpen' },
    revision: { label: 'Active recall', icon: 'Brain' },
    examprep: { label: 'Exam revision', icon: 'GraduationCap' },
    reading: { label: 'Reading', icon: 'Library' },
    personal: { label: 'Personal', icon: 'Coffee' },
  };
  const COMMIT_KINDS = {
    work: { label: 'Part-time job', icon: 'Briefcase' },
    gym: { label: 'Gym', icon: 'Dumbbell' },
    sport: { label: 'Sport', icon: 'Target' },
    society: { label: 'Society', icon: 'Users' },
    personal: { label: 'Personal', icon: 'Coffee' },
  };

  function teachingWeek(sem, t) {
    if (!sem) return null;
    return Math.floor(T.daysBetween(sem.week1Start, T.weekStart(t)) / 7) + 1;
  }
  function weekMatches(weeks, tw) {
    if (!weeks || weeks === 'all' || tw == null) return true;
    if (Array.isArray(weeks)) return weeks.includes(tw);
    if (weeks === 'odd') return tw % 2 === 1;
    if (weeks === 'even') return tw % 2 === 0;
    return true;
  }

  /** "Weeks 2–7, 9–12" from a list of teaching weeks. */
  function weeksLabel(weeks) {
    if (weeks === 'odd') return 'Odd weeks';
    if (weeks === 'even') return 'Even weeks';
    if (!Array.isArray(weeks) || weeks.length >= 12) return 'Every week';
    const parts = [];
    for (const w of weeks) {
      const last = parts[parts.length - 1];
      if (last && last[1] === w - 1) last[1] = w; else parts.push([w, w]);
    }
    return (weeks.length === 1 ? 'Week ' : 'Weeks ') + parts.map(([a, b]) => (a === b ? a : a + '\u2013' + b)).join(', ');
  }

  /** Dated occurrences of classes, commitments and unavailability between [from, to). */
  function expandFixed(state, from, to) {
    const out = [];
    const sem = state.semester;
    const mods = new Map((state.modules || []).map((m) => [m.id, m]));
    const exceptions = new Map((state.exceptions || []).map((e) => [e.key, e]));
    const lo = T.addDays(T.dayStart(from), -7);
    const hi = T.addDays(T.dayStart(to), 8);
    for (let day = lo; day < hi; day = T.addDays(day, 1)) {
      const wd = T.weekday(day);
      const tw = teachingWeek(sem, day);
      const inTeaching = !sem || (tw >= 1 && tw <= sem.teachingWeeks);
      if (inTeaching) {
        for (const c of state.classes || []) {
          if (c.include === false || c.day !== wd || !weekMatches(c.weeks, tw)) continue;
          const mod = mods.get(c.moduleId);
          if (!mod || mod.include === false) continue;
          const key = c.id + '@' + T.dateKey(day);
          const start = T.at(day, c.start);
          const end = T.at(day, c.end);
          const o = {
            key, source: 'class', classId: c.id, moduleId: c.moduleId, kind: c.kind,
            title: mod.code + ' ' + KIND_LABEL[c.kind], start, end, room: c.room || null,
            origStart: start, origEnd: end, teachingWeek: tw,
          };
          const ex = exceptions.get(key);
          if (ex && ex.type === 'cancel') { o.cancelled = true; o.note = ex.note || null; }
          if (ex && ex.type === 'move') { o.start = ex.start; o.end = ex.end; o.moved = true; o.note = ex.note || null; if (ex.room) o.room = ex.room; }
          out.push(o);
        }
      }
      for (const cm of state.commitments || []) {
        if (!cm.days || !cm.days.includes(wd)) continue;
        out.push({
          key: cm.id + '@' + T.dateKey(day), source: 'commitment', commitmentId: cm.id, kind: cm.kind,
          title: cm.title, start: T.at(day, cm.start), end: T.at(day, cm.end), room: cm.location || null,
        });
      }
    }
    for (const b of state.blocks || []) {
      out.push({ key: b.id, source: 'block', blockId: b.id, kind: 'unavailable', title: b.note || 'Unavailable', start: b.start, end: b.end });
    }
    return out.filter((o) => o.end > from && o.start < to).sort((a, b) => a.start - b.start || a.end - b.end);
  }

  /* Effort scaling from the student's own ratings (1 = low, 3 = high). */
  function effortFactor(m) {
    const d = m && m.difficulty != null ? m.difficulty : 2;
    const c = m && m.confidence != null ? m.confidence : 2;
    return 1 + 0.15 * (d - 2) + 0.15 * (2 - c);
  }
  const r5 = (x) => Math.max(15, Math.round(x / 5) * 5);

  function contactMinutesPerWeek(state, moduleId) {
    return TS.sum((state.classes || []).filter((c) => c.moduleId === moduleId && c.include !== false), (c) => {
      const d = T.toMin(c.end) - T.toMin(c.start);
      if (Array.isArray(c.weeks)) return (d * c.weeks.length) / 12;
      return c.weeks === 'odd' || c.weeks === 'even' ? d / 2 : d;
    });
  }
  /** ECTS guide: 1 ECTS ≈ 25 h of work over ~15 weeks (12 teaching + study/exam weeks). */
  function independentTargetPerWeek(state, m) {
    const contact = contactMinutesPerWeek(state, m.id) / 60;
    return Math.max(0, (m.ects * 25 - contact * 12) / 15) * 60;
  }

  /** Derive academic tasks from labs, tutorials, lectures and assessments. */
  function deriveTasks(state, now, horizonEnd) {
    const out = [];
    const mods = new Map((state.modules || []).filter((m) => m.include !== false).map((m) => [m.id, m]));
    const occ = expandFixed(state, T.addDays(T.weekStart(now), -7), T.addDays(horizonEnd, 7))
      .filter((o) => o.source === 'class' && !o.cancelled);

    // Next upcoming lab per module gets the current lab-sheet title.
    const nextLab = new Map();
    for (const o of occ) if (o.kind === 'lab' && o.start > now && !nextLab.has(o.moduleId)) nextLab.set(o.moduleId, o.key);

    for (const o of occ) {
      const m = mods.get(o.moduleId);
      if (!m) continue;
      const f = effortFactor(m);
      if (o.kind === 'lab' && m.lab) {
        const isNext = nextLab.get(o.moduleId) === o.key;
        if (m.lab.prelab > 0 && o.start > now && o.start < horizonEnd) {
          out.push({
            id: 'prelab:' + o.key, moduleId: m.id, type: 'prelab',
            title: isNext && m.lab.title ? 'Pre-lab: ' + m.lab.title.replace(/^Lab \d+:\s*/, '') : 'Pre-lab for ' + T.fmtDate(o.start) + ' lab',
            estimate: r5(m.lab.prelab * f), due: o.start, earliest: Math.max(now, T.addDays(T.dayStart(o.start), -6)),
            anchorKey: o.key, anchorStart: o.start, weight: null, source: 'auto',
            description: 'Do this before the lab so you can use the session well.',
          });
        }
        if (m.lab.report > 0) {
          const due = T.at(T.addDays(T.dayStart(o.origStart || o.start), m.lab.reportDueDays || 7), m.lab.reportDueTime || '17:00');
          if (due > now && o.start < horizonEnd) {
            out.push({
              id: 'report:' + o.key, moduleId: m.id, type: 'labreport',
              title: 'Lab report: ' + T.fmtDayMonth(o.start) + ' lab', estimate: r5(m.lab.report * f), due,
              earliest: Math.max(now, o.end), anchorKey: o.key, anchorStart: o.start, weight: null, source: 'auto',
              description: 'Write-up for the lab on ' + T.fmtDate(o.start) + '. Can only start once the lab is done.',
            });
          }
        }
      }
      if (o.kind === 'tutorial' && m.tutorialPrep > 0 && o.start > now && o.start < horizonEnd) {
        out.push({
          id: 'tut:' + o.key, moduleId: m.id, type: 'problems', soft: true, title: 'Tutorial sheet for ' + T.fmtDate(o.start),
          estimate: r5(m.tutorialPrep * f), due: o.start, earliest: Math.max(now, T.addDays(T.dayStart(o.start), -4)),
          anchorKey: o.key, anchorStart: o.start, weight: null, source: 'auto',
          description: 'Attempt the questions before the tutorial so you can ask about the ones that didn’t work.',
        });
      }
    }

    // Weekly lecture review + active recall, per module, for this week and next.
    for (let ws = T.weekStart(now); ws < horizonEnd; ws = T.addDays(ws, 7)) {
      const we = T.addDays(ws, 7);
      const due = T.at(T.addDays(ws, 6), '21:00');
      if (due <= now) continue;
      const tw = teachingWeek(state.semester, ws);
      for (const m of mods.values()) {
        const f = effortFactor(m);
        const lectures = occ.filter((o) => o.moduleId === m.id && o.kind === 'lecture' && o.start >= ws && o.start < we);
        if (lectures.length) {
          out.push({
            id: 'review:' + m.id + ':' + T.dateKey(ws), moduleId: m.id, type: 'review', title: 'Review this week’s lectures',
            estimate: r5(Math.max(25, 10 * lectures.length * f)), due, earliest: Math.max(now, lectures[0].end), weight: null, source: 'auto',
            description: 'Rewrite the key points from ' + TS.plural(lectures.length, 'lecture') + ' and note anything to ask in the tutorial.',
          });
        }
        // After teaching ends, exam revision replaces weekly recall.
        if (state.semester && state.semester.examWindow && tw > state.semester.teachingWeeks) continue;
        const conf = m.confidence != null ? m.confidence : 2;
        const base = conf === 1 ? 60 : conf === 3 ? 25 : 40;
        const topics = m.topics || [];
        const topic = topics.length ? topics[TS.clamp(Math.floor(((tw || 1) - 1) / 2), 0, topics.length - 1)] : null;
        out.push({
          id: 'recall:' + m.id + ':' + T.dateKey(ws), moduleId: m.id, type: 'revision',
          title: topic ? 'Active recall: ' + topic : 'Active recall: lecture notes', estimate: r5(base * (1 + 0.15 * ((m.difficulty || 2) - 2))),
          due, earliest: Math.max(now, ws), weight: null, source: 'auto',
          description: 'Close the notes and test yourself. Spread across the semester so the exam isn’t a cram.',
        });
      }
    }

    // Assessments with a known deadline (exams are handled through weekly recall).
    const examWindow = state.semester && state.semester.examWindow;
    for (const a of state.assessments || []) {
      const m = mods.get(a.moduleId);
      if (m && examWindow && a.kind === 'exam' && !a.due && a.weight && examWindow.start > now) {
        out.push({
          id: 'examprep:' + a.id, moduleId: m.id, type: 'examprep', soft: true, title: 'Exam revision: ' + m.name,
          estimate: r5((a.weight / 10) * 60 * effortFactor(m)), due: examWindow.start, earliest: now, weight: a.weight, source: 'auto',
          description: 'A planning target. The individual exam date isn\u2019t published yet, so revision is aimed at the start of the exam period.',
        });
      }
      if (!m || !a.due || a.due <= now || a.kind === 'exam' || a.status === 'submitted') continue;
      const type = a.taskType || (a.kind === 'quiz' ? 'problems' : 'assignment');
      const hours = a.effortHours || (a.kind === 'quiz' ? 1 : a.kind === 'project' ? 10 : 6);
      out.push({
        id: 'assess:' + a.id, moduleId: m.id, type, title: a.title, estimate: r5(hours * 60 * effortFactor(m)), due: a.due,
        earliest: Math.max(now, a.opens || now), weight: a.weight, assessmentId: a.id, source: 'auto',
        subtasks: (a.subtasks || []).map((s, i) => ({ id: a.id + '-st' + i, title: s, done: false })),
        description: a.note || null,
      });
    }
    return out;
  }

  /** Merge freshly derived tasks with stored ones, keeping the student's progress and edits. */
  function syncTasks(prev, derived, now) {
    const byId = new Map(prev.map((t) => [t.id, t]));
    const next = [];
    for (const d of derived) {
      const ex = byId.get(d.id);
      if (ex) {
        next.push({
          ...d,
          done: ex.done || 0, status: ex.status || 'open', userEstimate: ex.userEstimate != null ? ex.userEstimate : null,
          notes: ex.notes || '', subtasks: ex.subtasks && ex.subtasks.length ? ex.subtasks : d.subtasks || [],
          completedAt: ex.completedAt || null, title: ex.userTitle || d.title, userTitle: ex.userTitle || null,
        });
        byId.delete(d.id);
      } else {
        next.push({ done: 0, status: 'open', userEstimate: null, notes: '', subtasks: [], ...d });
      }
    }
    for (const t of byId.values()) {
      if (t.source === 'user') next.push(t);
      else if ((t.done || 0) > 0 || t.status === 'done') next.push({ ...t, orphan: true });
    }
    return next;
  }

  const taskEstimate = (t) => (t.userEstimate != null ? t.userEstimate : t.estimate);

  TS.model = {
    KIND_LABEL, TASK_TYPES, COMMIT_KINDS,
    teachingWeek, weekMatches, weeksLabel, expandFixed, deriveTasks, syncTasks, effortFactor,
    contactMinutesPerWeek, independentTargetPerWeek, taskEstimate,
  };
})();
