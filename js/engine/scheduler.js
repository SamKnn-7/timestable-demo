/* TimeStable scheduling engine.
   ------------------------------------------------------------------
   Deterministic, constraint-first placement:
     1. Fixed commitments (+ transition padding) and kept sessions are busy time.
     2. Free time = the student's study window minus busy time, per day.
     3. Each day has a study cap (lighter at weekends) and a flex reserve.
     4. Tasks are ordered earliest-deadline-first (prerequisites before dependants),
        split into sessions, and each session goes to the best-scoring slot:
        preferred focus time, spread toward a target day, day balance, breaks.
     5. Anything that cannot fit is reported with the reason, never dropped silently.
   No randomness: the same inputs always give the same plan. */
(() => {
  const TS = window.TS;
  const T = TS.time;
  const { MIN, DAY, HOUR } = T;

  const DEFAULT_PREFS = {
    wake: '07:30', sleep: '23:30', dayStart: '09:00', dayEnd: '21:30',
    focus: ['morning', 'afternoon'], sessionLen: 50, maxStudyMin: 270, lighterWeekends: true,
    buffer: 0.15, breakMin: 10,
  };
  const DEEP = new Set(['assignment', 'programming', 'labreport', 'examprep']);
  const SHORT = new Set(['review', 'revision']);
  const FLEXIBLE = new Set(['review', 'revision', 'reading']); // weekly practice, no external deadline

  function sessionLenFor(type, prefs) {
    const p = prefs.sessionLen || 50;
    if (DEEP.has(type)) return Math.max(p, 45);
    if (SHORT.has(type)) return Math.min(p, 45);
    if (type === 'prelab') return Math.max(Math.min(p, 60), 30);
    return p;
  }

  /** Split `total` minutes into near-equal sessions of about `len` (multiples of 5). */
  function chunkSizes(total, len) {
    total = Math.max(0, Math.round(total / 5) * 5);
    if (total === 0) return [];
    if (total <= len * 1.3) return [total];
    const n = Math.round(total / len);
    const base = Math.floor(total / n / 5) * 5;
    const out = new Array(n).fill(base);
    let rest = total - base * n;
    for (let i = 0; rest > 0; i++) { out[i % n] += 5; rest -= 5; }
    return out;
  }

  const durMin = (s) => (s.end - s.start) / MIN;

  /**
   * Core placement.
   * @param {object} input { now, horizonEnd, fixed, tasks, prefs, kept, modules }
   * @returns {{ sessions, buffers, unscheduled, report, days }}
   */
  function plan(input) {
    const now = input.now;
    const prefs = { ...DEFAULT_PREFS, ...(input.prefs || {}) };
    const horizonEnd = input.horizonEnd;
    const start = T.roundUp(now, 15);
    const brk = (prefs.breakMin || 0) * MIN;
    const minChunkMs = 25 * MIN;
    const modules = new Map((input.modules || []).map((m) => [m.id, m]));
    const kept = input.kept || [];

    /* ---- 1. busy time ---- */
    const busy = [];
    for (const o of input.fixed || []) {
      if (o.cancelled) continue;
      const pad = o.source === 'class' ? 10 : o.source === 'commitment' ? 15 : 0;
      busy.push({ start: o.start - pad * MIN, end: o.end + pad * MIN });
    }
    for (const s of kept) if (s.status === 'planned' && s.end > now) busy.push({ start: s.start - brk, end: s.end + brk });

    /* ---- 2. days, windows, capacity ---- */
    const sleepMin = T.toMin(prefs.sleep);
    const wakeMin = T.toMin(prefs.wake);
    const days = [];
    for (let d = T.dayStart(start); d < horizonEnd; d = T.addDays(d, 1)) {
      const weekend = T.weekday(d) >= 5;
      let ws = Math.max(T.at(d, prefs.dayStart), T.at(d, T.fromMin(Math.min(wakeMin + 45, 1439))));
      let we = T.at(d, prefs.dayEnd);
      if (sleepMin >= 18 * 60) we = Math.min(we, T.at(d, T.fromMin(sleepMin - 30)));
      ws = Math.max(ws, start);
      const free = we > ws ? TS.iv.subtract([{ start: ws, end: we }], busy).filter((i) => i.end - i.start >= minChunkMs) : [];
      const capMin = Math.round(prefs.maxStudyMin * (weekend && prefs.lighterWeekends ? 0.5 : 1));
      // Count work already done or still pinned today against today's cap.
      const keptLoad = TS.sum(kept.filter((s) => T.sameDay(s.start, d) && (s.status === 'done' || s.status === 'partial' || (s.status === 'planned' && s.end > now))),
        (s) => (s.status === 'planned' ? durMin(s) : s.actualMin || durMin(s)));
      const freeMin = TS.iv.total(free) / MIN;
      const capacity = Math.max(0, Math.min(capMin, freeMin + keptLoad));
      days.push({ day: d, ws, we, weekend, free, freeMin, capMin, capacity, reserve: Math.round(capacity * prefs.buffer), load: keptLoad, sessions: [] });
    }
    const dayOf = (t) => days.find((D) => T.sameDay(D.day, t));

    /* ---- 3. work items ---- */
    const keptFutureByTask = new Map();
    for (const s of kept) if (s.status === 'planned' && s.end > now) keptFutureByTask.set(s.taskId, (keptFutureByTask.get(s.taskId) || 0) + durMin(s));

    const items = [];
    for (const t of input.tasks || []) {
      if (t.status === 'done' || t.orphan) continue;
      const est = TS.model.taskEstimate(t);
      const remaining = est - (t.done || 0) - (keptFutureByTask.get(t.id) || 0);
      if (remaining < 10) continue;
      const earliest = Math.max(start, t.earliest || start);
      let finishBy = t.due ? t.due : horizonEnd;
      if (t.anchorStart && (t.type === 'prelab' || t.type === 'problems')) finishBy = Math.min(finishBy, t.anchorStart - 10 * MIN);
      let planMin = remaining;
      let partial = false;
      if (finishBy > horizonEnd) {
        // Deadline beyond the planning window: plan a proportional, slightly front-loaded share now.
        const frac = Math.min(1, (horizonEnd - earliest) / Math.max(HOUR, finishBy - earliest));
        planMin = Math.min(remaining, Math.ceil((remaining * frac) / 15) * 15);
        partial = planMin < remaining;
        finishBy = horizonEnd;
      }
      if (planMin < 10) continue;
      const base = { task: t, remaining, earliest, finishBy, partial, flexible: FLEXIBLE.has(t.type) || !!t.soft };
      if (FLEXIBLE.has(t.type) && planMin > 40) {
        // Weekly practice: a guaranteed core session, the rest only if there is room.
        items.push({ ...base, planMin: 30, tierHint: 1 });
        items.push({ ...base, planMin: planMin - 30, tierHint: 3 });
      } else items.push({ ...base, planMin });
    }
    // Tiers: 0 = deadlines inside the window, 1 = core weekly practice,
    // 2 = fair share of later graded deadlines, 3 = extra practice.
    // Within a tier: earliest deadline first, heavier weight first on ties.
    const tier = (i) => (i.tierHint != null ? i.tierHint : i.partial || i.task.type === 'examprep' ? 2 : FLEXIBLE.has(i.task.type) ? 1 : 0);
    const dueKey = (i) => (i.partial && i.task.due ? i.task.due : i.finishBy);
    items.sort((a, b) => (tier(a) - tier(b)) || (dueKey(a) - dueKey(b)) || ((b.task.weight || 0) - (a.task.weight || 0)) || (b.planMin - a.planMin) || (a.task.id < b.task.id ? -1 : 1));
    // Prerequisites first.
    const ordered = [];
    const seen = new Set();
    const byId = new Map();
    for (const i of items) if (!byId.has(i.task.id)) byId.set(i.task.id, i);
    const visit = (it, stack = new Set()) => {
      if (seen.has(it) || stack.has(it)) return;
      stack.add(it);
      for (const dep of it.task.dependsOn || []) { const d = byId.get(dep); if (d) visit(d, stack); }
      seen.add(it);
      ordered.push(it);
    };
    items.forEach((it) => visit(it));

    /* ---- 4. placement ---- */
    const sessions = [];
    const unscheduled = [];
    const placedEnd = new Map();
    for (const s of kept) if (s.status === 'planned' && s.end > now) placedEnd.set(s.taskId, Math.max(placedEnd.get(s.taskId) || 0, s.end));

    const scoreSlot = (c, len, D, task, target, sameTask) => {
      let s = 0;
      const end = c + len * MIN;
      if ((prefs.focus || []).includes(T.period(c))) s += 1.4;
      const endMin = T.minOfDay(end) || 1440;
      if (endMin > 21 * 60) s -= ((endMin - 21 * 60) / 60) * 1.2;
      if (T.minOfDay(c) < 9 * 60) s -= 0.6;
      s -= (Math.abs(c - target) / DAY) * (DEEP.has(task.type) ? 1.2 : 0.9);
      s -= (2.2 * (D.load + len)) / Math.max(60, D.capacity);
      s -= sameTask * 2.5;
      if (task.due && task.due - now < 2 * DAY) s -= ((c - now) / DAY) * 2;
      if (D.weekend) s -= 0.4;
      for (const o of D.sessions) {
        const gap = Math.min(Math.abs(c - o.end), Math.abs(o.start - end));
        if (gap <= brk + 5 * MIN) s -= 0.8;
      }
      return s;
    };

    const findSlot = (len, notBefore, finishBy, target, task, pass) => {
      let best = null;
      const oncePerDay = !DEEP.has(task.type);
      for (const D of days) {
        if (D.we <= notBefore || D.ws >= finishBy) continue;
        const limit = pass === 1 ? D.capacity - D.reserve : D.capacity;
        if (D.load + len > limit) continue;
        const sameTask = D.sessions.filter((s) => s.taskId === task.id).length;
        if (pass === 1 && (sameTask >= 2 || (oncePerDay && sameTask >= 1))) continue;
        if (pass === 2 && sameTask >= 3) continue;
        for (const f of D.free) {
          const lo = T.roundUp(Math.max(f.start, notBefore), 5);
          const hiRaw = Math.min(f.end, finishBy) - len * MIN;
          if (hiRaw < lo) continue;
          const cands = [lo];
          for (let c = lo + 30 * MIN; c <= hiRaw; c += 30 * MIN) cands.push(c);
          const hi = T.roundTo(hiRaw - 7 * MIN, 15);
          if (hi > lo && hi <= hiRaw) cands.push(hi);
          for (const c of cands) {
            const sc = scoreSlot(c, len, D, task, target, sameTask);
            if (!best || sc > best.score + 1e-9) best = { start: c, end: c + len * MIN, D, score: sc };
          }
        }
      }
      return best;
    };

    const diagnose = (len, notBefore, finishBy, keepReserve) => {
      const window = days.filter((D) => D.we > notBefore && D.ws < finishBy);
      const freeMin = TS.sum(window, (D) => TS.sum(D.free.filter((f) => f.end > notBefore && f.start < finishBy), (f) => (Math.min(f.end, finishBy) - Math.max(f.start, notBefore)) / MIN));
      const capLeft = TS.sum(window, (D) => Math.max(0, D.capacity - (keepReserve ? D.reserve : 0) - D.load));
      if (notBefore >= finishBy) return { code: 'window', text: 'There is no time left between when it can start and its deadline.' };
      if (freeMin < len) return { code: 'free', text: 'Your timetable has only ' + T.fmtDur(Math.max(0, freeMin)) + ' of free study time before then.' };
      if (capLeft < len) return { code: 'cap', text: 'Your daily study limit is already used on the days before the deadline.' };
      return { code: 'gap', text: 'No single free gap of ' + T.fmtDur(len) + ' is left before the deadline.' };
    };

    for (const it of ordered) {
      const t = it.task;
      const len = sessionLenFor(t.type, prefs);
      const sizes = chunkSizes(it.planMin, len);
      let notBefore = it.earliest;
      for (const dep of t.dependsOn || []) if (placedEnd.has(dep)) notBefore = Math.max(notBefore, placedEnd.get(dep));
      // Where should the work sit? Spread across the window, finishing a little early for big pieces.
      let softEnd = it.finishBy;
      if (DEEP.has(t.type) && t.due && !it.partial) softEnd = Math.max(notBefore + 6 * HOUR, it.finishBy - 18 * HOUR);
      if (t.type === 'prelab' && t.anchorStart) softEnd = Math.max(notBefore + HOUR, t.anchorStart - 6 * HOUR);
      const span = Math.max(0, softEnd - notBefore);
      const n0 = sizes.length;
      let missing = 0;
      let reason = null;
      let usedFlex = false;
      for (let i = 0; i < sizes.length; i++) {
        const size = sizes[i];
        // Target positions are fixed from the original split so work stays spread even if a piece is split later.
        const frac = Math.min(1, (Math.min(i, n0 - 1) + 0.5) / n0);
        const target = t.type === 'prelab' && t.anchorStart ? Math.max(notBefore, t.anchorStart - 20 * HOUR) : notBefore + span * frac * 0.9;
        let best = findSlot(size, notBefore, it.finishBy, target, t, 1);
        if (!best && !it.flexible && !it.partial) { best = findSlot(size, notBefore, it.finishBy, target, t, 2); if (best) usedFlex = true; }
        if (!best && size >= 50) {
          // Fragmented timetables: try two shorter sessions instead of one long one.
          const a = Math.round(size / 2 / 5) * 5;
          sizes.splice(i, 1, a, size - a);
          i--;
          continue;
        }
        if (!best) {
          missing = TS.sum(sizes.slice(i));
          reason = diagnose(size, notBefore, it.finishBy, it.flexible);
          break;
        }
        const D = best.D;
        const s = {
          id: 's_' + t.id.replace(/[^a-zA-Z0-9]/g, '') + '_' + best.start.toString(36),
          taskId: t.id, moduleId: t.moduleId, type: t.type, title: t.title,
          start: best.start, end: best.end, status: 'planned', pinned: false,
          usedFlex: pass2Used(D, size),
        };
        D.sessions.push(s);
        D.load += size;
        D.free = TS.iv.subtract(D.free, [{ start: best.start - brk, end: best.end + brk }]).filter((f) => f.end - f.start >= minChunkMs);
        sessions.push(s);
        placedEnd.set(t.id, Math.max(placedEnd.get(t.id) || 0, best.end));
        // Parts are numbered by time afterwards, so a later piece may land before an earlier one.
      }
      if (missing > 0) {
        unscheduled.push({ taskId: t.id, moduleId: t.moduleId, title: t.title, type: t.type, minutes: missing, due: t.due || null, reason, flexible: it.flexible || it.partial, deferred: it.partial || t.type === 'examprep' });
      }
      it.usedFlex = usedFlex;
      it.partialNote = it.partial ? { planned: it.planMin - missing, total: it.remaining } : null;
    }
    function pass2Used(D, size) { return D.load + size > D.capacity - D.reserve; }

    /* ---- 5. explanations ---- */
    const taskById = new Map((input.tasks || []).map((t) => [t.id, t]));
    const itemById = new Map(ordered.map((i) => [i.task.id, i]));
    const fixedByKey = new Map((input.fixed || []).map((o) => [o.key, o]));
    const allByTask = new Map();
    for (const s of [...kept.filter((k) => k.status === 'planned' && k.end > now), ...sessions]) {
      if (!allByTask.has(s.taskId)) allByTask.set(s.taskId, []);
      allByTask.get(s.taskId).push(s);
    }
    for (const list of allByTask.values()) list.sort((a, b) => a.start - b.start).forEach((s, i) => { s.part = i + 1; s.parts = list.length; });
    for (const s of sessions) {
      const t = taskById.get(s.taskId);
      s.why = explain(s, t, modules.get(t.moduleId), fixedByKey, itemById.get(t.id), prefs, now);
    }

    /* ---- 6. flex buffers: visible reserve on the roomiest weekdays ---- */
    const buffers = [];
    for (let ws = T.weekStart(start); ws < horizonEnd; ws = T.addDays(ws, 7)) {
      const cands = days
        .filter((D) => D.day >= ws && D.day < T.addDays(ws, 7) && !D.weekend && D.capacity - D.load >= 45)
        .map((D) => ({ D, slot: D.free.filter((f) => f.end - f.start >= 45 * MIN).sort((a, b) => b.start - a.start)[0] }))
        .filter((x) => x.slot)
        .sort((a, b) => (b.D.capacity - b.D.load) - (a.D.capacity - a.D.load))
        .slice(0, 2);
      for (const { D, slot } of cands) {
        const len = Math.min(60, D.capacity - D.load, (slot.end - slot.start) / MIN);
        const end = T.roundTo(Math.min(slot.end, D.we) - 5 * MIN, 15);
        const b = { id: 'flex_' + T.dateKey(D.day), start: end - len * MIN, end };
        if (b.start >= slot.start) buffers.push(b);
      }
    }

    /* ---- 7. report ---- */
    const mergedMap = new Map();
    for (const u of unscheduled) { const m = mergedMap.get(u.taskId); if (m) m.minutes += u.minutes; else mergedMap.set(u.taskId, { ...u }); }
    const mergedUnscheduled = [...mergedMap.values()];
    const plannedMin = TS.sum(sessions, durMin);
    const report = {
      generatedAt: now, horizonStart: start, horizonEnd,
      freeMin: Math.round(TS.sum(days, (D) => D.freeMin)),
      capacityMin: Math.round(TS.sum(days, (D) => D.capacity)),
      plannedMin, sessionsCount: sessions.length, tasksPlanned: new Set(sessions.map((s) => s.taskId)).size,
      bufferMin: Math.round(TS.sum(buffers, durMin)),
      unscheduled: mergedUnscheduled, partials: ordered.filter((i) => i.partialNote && i.partialNote.planned > 0).map((i) => ({ taskId: i.task.id, title: i.task.title, ...i.partialNote })),
      usedFlex: ordered.filter((i) => i.usedFlex).map((i) => i.task.id),
      days: days.map((D) => ({ day: D.day, capacity: D.capacity, load: D.load, freeMin: D.freeMin })),
    };
    return { sessions, buffers, unscheduled: mergedUnscheduled, report };
  }

  function explain(s, t, m, fixedByKey, item, prefs, now) {
    const code = m ? m.code : '';
    const lines = [];
    const due = t.due ? T.fmtWhen(t.due, now) : null;
    const anchor = t.anchorKey ? fixedByKey.get(t.anchorKey) : null;
    switch (t.type) {
      case 'prelab':
        lines.push('Prepares you for the ' + code + ' lab on ' + T.fmtDate(anchor ? anchor.start : t.due) + ' at ' + T.hm(anchor ? anchor.start : t.due) + '. It has to be done before the lab starts.');
        break;
      case 'labreport':
        lines.push('Write-up for the ' + code + ' lab you did on ' + T.fmtDate(anchor ? anchor.start : t.earliest) + '. Due ' + due + '.');
        break;
      case 'problems':
        lines.push(t.anchorKey ? 'Attempt the ' + code + ' tutorial questions before the tutorial on ' + T.fmtDate(t.due) + '.' : t.title + ' for ' + code + ', due ' + due + (t.weight ? ' (' + t.weight + '% of the module).' : '.'));
        break;
      case 'review':
        lines.push('Go over this week’s ' + code + ' lectures while they’re fresh.');
        break;
      case 'examprep':
        lines.push('Revision for the ' + code + ' exam (' + t.weight + '% of the module). DCU\u2019s exam period starts ' + T.fmtDate(t.due) + '.');
        break;
      case 'revision':
        lines.push('Weekly active recall for ' + code + (m && m.confidence === 1 ? '. You rated your confidence as low, so it gets extra practice.' : ', so the exam isn’t a cram.'));
        break;
      default:
        lines.push((s.parts > 1 ? 'Part ' + s.part + ' of ' + s.parts + ' for ' : '') + t.title + ', due ' + due + (t.weight ? ' (' + t.weight + '% of ' + code + ').' : '.'));
    }
    const place = [];
    if ((prefs.focus || []).includes(T.period(s.start))) place.push('in your ' + T.period(s.start) + ' focus time');
    if (DEEP.has(t.type) && t.type !== 'examprep' && s.parts > 1) place.push('spread out so the day before the deadline stays light');
    if (t.type === 'prelab') place.push('the day before the lab where possible');
    if (item && item.partial) place.push('more sessions follow next week');
    if (s.usedFlex) place.push('uses some of your flex time because the week is full');
    if (place.length) lines.push('Placed ' + place.join(', ') + '.');
    return lines.join(' ');
  }

  /* ------------------------------------------------------------------
     buildPlan: full pipeline from stored state.
     Keeps history (done / partial / missed), sessions in the past or in progress,
     and anything the student pinned by hand. Everything else is re-placed.
     ------------------------------------------------------------------ */
  /** Is a planned session still valid for its task (ordering, deadline, anchor)? */
  function stillValid(t, s) {
    if (t.anchorStart && (t.type === 'prelab' || t.type === 'problems')) { if (s.end > t.anchorStart - 10 * MIN) return false; }
    else if (t.due && s.end > t.due) return false;
    if (t.earliest && s.start < t.earliest - MIN && t.type === 'labreport') return false;
    return true;
  }

  /**
   * opts.mode:
   *   'full'    – re-place every unpinned future session (initial plan, "Replan my week").
   *   'minimal' – keep every future session that is still valid and only place what is
   *               missing. Used for adaptive changes so the week doesn't reshuffle.
   */
  function buildPlan(state, now, opts = {}) {
    const mode = opts.mode || 'full';
    const horizonEnd = T.addDays(T.weekStart(now), 14);
    const derived = TS.model.deriveTasks(state, now, horizonEnd);
    const tasks = TS.model.syncTasks(state.tasks || [], derived, now);
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const fixed = TS.model.expandFixed(state, T.weekStart(now), horizonEnd);
    const hardFixed = fixed.filter((o) => !o.cancelled);
    const released = [];
    let kept = [];
    const candidates = new Map();
    for (const s0 of state.sessions || []) {
      const s = { ...s0 };
      if (s.status !== 'planned') { kept.push(s); continue; }
      if (s.end <= now) { kept.push(s); continue; } // past, awaiting check-in
      const t = taskMap.get(s.taskId);
      if (!t || t.status === 'done' || t.orphan) continue; // finished or no longer needed
      if (s.start < now) { kept.push(s); continue; } // in progress
      const clash = hardFixed.find((o) => T.overlap(s.start, s.end, o.start, o.end));
      if (s.pinned) {
        if (clash) released.push({ session: s, clash }); // the proposal moves it and says so
        else kept.push(s);
        continue;
      }
      if (mode !== 'minimal' || clash || !stillValid(t, s)) continue;
      if (!candidates.has(t.id)) candidates.set(t.id, []);
      candidates.get(t.id).push(s);
    }
    // Minimal mode: keep valid sessions up to what each task still needs.
    for (const [tid, list] of candidates) {
      const t = taskMap.get(tid);
      const already = TS.sum(kept.filter((k) => k.taskId === tid && k.status === 'planned' && k.end > now), durMin);
      let budget = TS.model.taskEstimate(t) - (t.done || 0) - already;
      list.sort((a, b) => a.start - b.start);
      for (const s of list) { const d = durMin(s); if (budget >= d - 5) { kept.push(s); budget -= d; } }
    }
    let result = plan({ now, horizonEnd, fixed, tasks, prefs: state.prefs, kept, modules: state.modules });
    // Minimal mode: if deadline work no longer fits, unpinned sessions that are less urgent give way
    // (practice, or work due later than the squeezed task) and are re-placed in the same pass.
    const hardMissing = (r) => TS.sum(r.unscheduled.filter((u) => !u.flexible), (u) => u.minutes);
    if (mode === 'minimal' && hardMissing(result) > 0) {
      const deadlineOf = (t) => (!t ? Infinity : t.anchorStart && (t.type === 'prelab' || t.type === 'problems') ? t.anchorStart : t.due || Infinity);
      const missing = result.unscheduled.filter((u) => !u.flexible).map((u) => deadlineOf(taskMap.get(u.taskId)));
      const minDl = Math.min(...missing), cutoff = Math.max(...missing);
      const yields = (s) => {
        if (s.status !== 'planned' || s.pinned || s.start < now || s.start >= cutoff) return false;
        const t = taskMap.get(s.taskId) || {};
        return FLEXIBLE.has(s.type) || t.soft || deadlineOf(t) > minDl;
      };
      const kept2 = kept.filter((s) => !yields(s));
      const r2 = plan({ now, horizonEnd, fixed, tasks, prefs: state.prefs, kept: kept2, modules: state.modules });
      if (hardMissing(r2) < hardMissing(result)) { result = r2; kept = kept2; }
    }
    return {
      tasks,
      sessions: [...kept, ...result.sessions],
      buffers: result.buffers,
      report: { ...result.report, released: released.map((r) => ({ sessionId: r.session.id, title: r.session.title, clash: r.clash.title })) },
      horizonEnd,
    };
  }

  /** Compare two session lists (future planned only) and describe the changes. */
  function diffPlans(oldSessions, newSessions, now) {
    const fut = (list) => list.filter((s) => s.status === 'planned' && s.start >= now);
    const group = (list) => { const m = new Map(); for (const s of fut(list)) { if (!m.has(s.taskId)) m.set(s.taskId, []); m.get(s.taskId).push(s); } for (const l of m.values()) l.sort((a, b) => a.start - b.start); return m; };
    const A = group(oldSessions);
    const B = group(newSessions);
    const changes = [];
    let unchanged = 0;
    const ids = new Set([...A.keys(), ...B.keys()]);
    for (const id of ids) {
      const a = (A.get(id) || []).slice();
      const b = (B.get(id) || []).slice();
      for (let i = a.length - 1; i >= 0; i--) {
        const j = b.findIndex((x) => x.start === a[i].start && x.end === a[i].end);
        if (j >= 0) { unchanged++; a.splice(i, 1); b.splice(j, 1); }
      }
      const n = Math.min(a.length, b.length);
      for (let i = 0; i < n; i++) changes.push({ type: 'moved', taskId: id, title: b[i].title, moduleId: b[i].moduleId, from: a[i], to: b[i], wasPinned: !!a[i].pinned });
      for (let i = n; i < b.length; i++) changes.push({ type: 'added', taskId: id, title: b[i].title, moduleId: b[i].moduleId, to: b[i] });
      for (let i = n; i < a.length; i++) changes.push({ type: 'removed', taskId: id, title: a[i].title, moduleId: a[i].moduleId, from: a[i], wasPinned: !!a[i].pinned });
    }
    changes.sort((x, y) => ((x.to || x.from).start - (y.to || y.from).start));
    return { changes, unchanged };
  }

  /** Validate a manual move. Returns { ok, error?, warnings[] }. */
  function checkMove(state, session, start, end, now) {
    const warnings = [];
    const fixed = TS.model.expandFixed(state, T.dayStart(start), T.addDays(T.dayStart(start), 1)).filter((o) => !o.cancelled);
    const clash = fixed.find((o) => T.overlap(start, end, o.start, o.end));
    if (clash) return { ok: false, error: 'That overlaps ' + clash.title + ' (' + T.fmtRange(clash.start, clash.end) + ').', warnings };
    const other = (state.sessions || []).find((s) => s.id !== session.id && s.status === 'planned' && T.overlap(start, end, s.start, s.end));
    if (other) return { ok: false, error: 'That overlaps another study session: ' + other.title + '.', warnings };
    if (end <= now) warnings.push('That time is already in the past.');
    const task = (state.tasks || []).find((t) => t.id === session.taskId);
    if (task) {
      if (task.anchorStart && (task.type === 'prelab' || task.type === 'problems') && end > task.anchorStart) warnings.push('This is now after the class it prepares for.');
      else if (task.due && end > task.due) warnings.push('This is now after the deadline (' + T.fmtWhen(task.due, now) + ').');
      if (task.earliest && start < task.earliest - 1) warnings.push('This is before the work can start (' + T.fmtWhen(task.earliest, now) + ').');
    }
    const p = { ...DEFAULT_PREFS, ...(state.prefs || {}) };
    const sMin = T.minOfDay(start);
    if (sMin < T.toMin(p.wake) || T.minOfDay(end) > T.toMin(p.sleep) && T.toMin(p.sleep) > 600) warnings.push('This is outside your waking hours.');
    return { ok: true, warnings };
  }

  /** Warnings for an existing session (shown on the calendar). */
  function sessionWarnings(state, s) {
    if (s.status !== 'planned') return [];
    const task = (state.tasks || []).find((t) => t.id === s.taskId);
    if (!task) return [];
    const out = [];
    if (task.anchorStart && (task.type === 'prelab' || task.type === 'problems') && s.end > task.anchorStart) out.push('After the class it prepares for');
    else if (task.due && s.end > task.due) out.push('After the deadline');
    const fixed = TS.model.expandFixed(state, T.dayStart(s.start), T.addDays(T.dayStart(s.start), 1)).filter((o) => !o.cancelled);
    const clash = fixed.find((o) => T.overlap(s.start, s.end, o.start, o.end));
    if (clash) out.push('Clashes with ' + clash.title);
    return out;
  }

  TS.engine = { DEFAULT_PREFS, chunkSizes, sessionLenFor, plan, buildPlan, diffPlans, checkMove, sessionWarnings };
})();
