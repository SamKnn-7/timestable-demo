/* Today: what's on, what's next, am I on track. */
(() => {
  const TS = window.TS;
  const { html, Icon, useMemo, cx } = TS;
  const T = TS.time;
  const A = TS.actions;

  /** Everything on a given day, for timeline/calendar use. */
  TS.dayItems = (st, day, fixedCache) => {
    const end = T.addDays(day, 1);
    const fixed = (fixedCache || TS.model.expandFixed(st, day, end)).filter((o) => o.start < end && o.end > day);
    const sessions = st.sessions.filter((s) => s.start < end && s.end > day);
    const buffers = (st.buffers || []).filter((b) => b.start < end && b.end > day);
    return { fixed, sessions, buffers };
  };

  TS.pageActions = () => html`
    <button className="btn btn-secondary btn-sm" onClick=${() => TS.openOverlay('addTask')}><${Icon} name="Plus" />Add task</button>
    <button className="btn btn-secondary btn-sm" onClick=${() => TS.openOverlay('unavailable')}><${Icon} name="Ban" />I’m unavailable</button>
    <button className="btn btn-secondary btn-sm" onClick=${() => A.replan()}><${Icon} name="RefreshCw" />Replan</button>
    <${TS.Menu} label="Demo controls" icon="FlaskConical" buttonClass="btn btn-ghost btn-sm" text="Demo" items=${[
      { section: 'Simulate an event' },
      { label: 'Loop pushes a lab time change', icon: 'Plug', run: () => A.simulateLoopChange() },
      { label: 'Skip my next session', icon: 'CircleX', run: () => { const n = TS.sel.upcomingSessions(TS.store.get(), Date.now())[0]; if (n) A.checkIn(n.id, 'missed'); else TS.toast('No upcoming session to skip.'); } },
      { label: 'Start setup again', icon: 'Undo2', run: () => A.resetAll() },
    ]} />`;

  function ProposalBanner() {
    const p = TS.useStore((s) => s.proposal);
    if (!p || p.open) return null;
    return html`<div className="notice notice-accent" style=${{ marginBottom: '18px', alignItems: 'center' }}><${Icon} name="RefreshCw" />
      <div className="grow"><strong>A revised plan is waiting.</strong> ${p.reason}. ${TS.plural(p.diff.changes.length, 'change')} proposed.</div>
      <button className="btn btn-primary btn-sm" onClick=${() => A.showProposal()}>Review</button></div>`;
  }
  TS.ProposalBanner = ProposalBanner;

  function UnfitBanner() {
    const r = TS.useStore((s) => s.planReport);
    const hard = r ? r.unscheduled.filter((u) => !u.flexible) : [];
    if (!hard.length) return null;
    return html`<div className="notice notice-warn" style=${{ marginBottom: '18px' }}><${Icon} name="TriangleAlert" /><div className="grow">
      <strong>${TS.plural(hard.length, 'deadline')} can’t be fully covered.</strong> ${hard.map((u) => T.fmtDur(u.minutes) + ' of “' + u.title + '” before ' + T.fmtWhen(u.due)).join('; ')}. ${hard[0].reason.text}
      <div className="row wrap" style=${{ marginTop: '8px' }}><button className="btn btn-secondary btn-sm" onClick=${() => TS.go('preferences')}>Adjust daily limit</button><button className="btn btn-ghost btn-sm" onClick=${() => TS.go('tasks')}>Review tasks</button></div>
    </div></div>`;
  }
  TS.UnfitBanner = UnfitBanner;

  function TimelineCard({ item, st, now }) {
    const { kind, data } = item;
    if (kind === 'fixed') {
      const o = data;
      const m = o.moduleId ? TS.sel.module(st, o.moduleId) : null;
      return html`<button className=${cx('tl-card', o.source === 'class' ? 'm ev-class' : o.source === 'block' ? 'ev-block' : 'ev-personal', o.cancelled && 'ev-cancelled', o.end <= now && 'is-past')} style=${m ? { '--h': m.hue } : null}
        onClick=${() => TS.openOverlay('occurrence', { occKey: o.key, from: T.dayStart(o.start) })}>
        <span className="tl-title"><${Icon} name=${TS.kindIcon(o)} size=${14} /><span className="truncate">${o.source === 'class' ? m.name + ' · ' + TS.model.KIND_LABEL[o.kind] : o.title}</span>${o.cancelled && html`<span className="badge badge-danger">Cancelled</span>`}${o.moved && html`<span className="badge badge-accent">Moved</span>`}</span>
        <span className="tl-meta"><span className="mono">${T.fmtRange(o.start, o.end)}</span>${o.room && html`<span><${Icon} name="MapPin" size=${12} /> ${o.room}</span>`}${o.source === 'class' && html`<span className="mono">${m.code}</span>`}</span>
      </button>`;
    }
    if (kind === 'buffer') {
      return html`<div className="tl-card ev-buffer"><span className="tl-title small"><${Icon} name="CircleDashed" size=${14} />Flex time</span><span className="tl-meta"><span className="mono">${T.fmtRange(data.start, data.end)}</span><span>Kept free for catch-up or things that come up</span></span></div>`;
    }
    const s = data;
    const m = TS.sel.module(st, s.moduleId);
    const warn = TS.engine.sessionWarnings(st, s);
    return html`<button className=${cx('tl-card m ev-study', s.status === 'done' && 'ev-done', s.status === 'missed' && 'ev-missed', s.end <= now && s.status === 'planned' && 'is-past')} style=${{ '--h': m ? m.hue : 260 }}
      onClick=${() => TS.openOverlay('session', { id: s.id })}>
      <span className="tl-title"><${Icon} name=${TS.typeIcon(s.type)} size=${14} /><span className="truncate">${s.title}</span>
        ${s.pinned && html`<${Icon} name="Pin" size=${12} className="faint" />`}${warn.length > 0 && html`<${Icon} name="TriangleAlert" size=${13} className="flag-ic" label=${warn[0]} />`}
        ${s.status === 'done' && html`<span className="badge badge-ok">Done</span>`}${s.status === 'partial' && html`<span className="badge badge-warn">Partly</span>`}${s.status === 'missed' && html`<span className="badge badge-danger">Missed</span>`}</span>
      <span className="tl-meta"><span className="mono">${T.fmtRange(s.start, s.end)}</span><span>${TS.typeLabel(s.type)}${s.parts > 1 ? ' · ' + s.part + '/' + s.parts : ''}</span>${m && html`<span className="mono">${m.code}</span>`}</span>
    </button>`;
  }

  function Timeline({ st, day, now }) {
    const { fixed, sessions, buffers } = TS.dayItems(st, day);
    const items = [
      ...fixed.map((o) => ({ kind: 'fixed', start: o.start, end: o.end, data: o })),
      ...sessions.map((s) => ({ kind: 'session', start: s.start, end: s.end, data: s })),
      ...buffers.map((b) => ({ kind: 'buffer', start: b.start, end: b.end, data: b })),
    ].sort((a, b) => a.start - b.start || a.end - b.end);
    if (!items.length) return html`<${TS.Empty} icon="CalendarCheck" title="Nothing scheduled">No classes, shifts or study sessions on this day.<//>`;
    const isToday = T.sameDay(day, now);
    const out = [];
    let nowPlaced = !isToday;
    let lastEnd = null;
    items.forEach((it, i) => {
      if (!nowPlaced && it.start > now) {
        out.push(html`<div key="now" className="tl-now" aria-label=${'Now, ' + T.hm(now)}><span className="t">${T.hm(now)}</span><span className="line"></span></div>`);
        nowPlaced = true;
      }
      if (lastEnd && it.start - lastEnd >= 45 * T.MIN) out.push(html`<div key=${'g' + i} className="tl-row"><span></span><span className="tl-gap">${T.fmtDur((it.start - lastEnd) / T.MIN)} free</span></div>`);
      out.push(html`<div key=${it.kind + (it.data.id || it.data.key)} className="tl-row"><span className="tl-time">${T.hm(it.start)}</span><${TimelineCard} item=${it} st=${st} now=${now} /></div>`);
      lastEnd = Math.max(lastEnd || 0, it.end);
    });
    if (!nowPlaced) out.push(html`<div key="now" className="tl-now"><span className="t">${T.hm(now)}</span><span className="line"></span></div>`);
    return html`<div className="timeline">${out}</div>`;
  }

  function NextCard({ st, now }) {
    const active = st.active && TS.sel.session(st, st.active.sessionId);
    const next = active || TS.sel.upcomingSessions(st, now)[0];
    if (!next) {
      return html`<section className="next"><div className="eyebrow">Next up</div><div className="next-title">Nothing planned</div>
        <p className="next-why">Every session in your plan is done or checked in. Add a task, or enjoy the space.</p>
        <div className="next-actions"><button className="btn btn-secondary" onClick=${() => TS.openOverlay('addTask')}><${Icon} name="Plus" />Add a task</button></div></section>`;
    }
    const m = TS.sel.module(st, next.moduleId);
    const t = TS.sel.task(st, next.taskId);
    const elapsed = active ? now - st.active.startedAt : 0;
    const startsIn = next.start - now;
    const when = active ? 'In progress' : startsIn <= 0 ? 'Now' : T.fmtWhen(next.start, now) + ' · ' + T.fmtRel(next.start, now);
    const mm = Math.floor(elapsed / 60000), ss = Math.floor((elapsed % 60000) / 1000);
    return html`<section className="next m" style=${{ '--h': m ? m.hue : 260 }} aria-label="Next up">
      <div className="row-between"><div className="row" style=${{ gap: '8px' }}><span className="eyebrow">${active ? 'Focusing on' : 'Next up'}</span></div><${TS.ModTag} module=${m} short /></div>
      <div className="stack-sm" style=${{ gap: '6px' }}>
        <div className="next-title">${next.title}</div>
        <div className="next-when">${T.fmtRange(next.start, next.end)} · ${T.fmtDur((next.end - next.start) / T.MIN)} · ${when}</div>
      </div>
      ${active && html`<div className="focus-timer" aria-live="off">${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}</div>`}
      ${next.why && html`<p className="next-why">${next.why}</p>`}
      ${t && t.due && html`<div className="row small muted" style=${{ gap: '8px' }}><${Icon} name="Flag" size=${14} /><span>${t.anchorStart && (t.type === 'prelab' || t.type === 'problems')
        ? html`Needed before the ${m ? m.code : ''} ${t.type === 'prelab' ? 'lab' : 'tutorial'} · <span className="mono">${T.fmtWhen(t.anchorStart, now)}</span>`
        : html`${t.title !== next.title ? t.title + ' · ' : ''}${t.type === 'examprep' ? 'Exam period starts ' : t.title !== next.title ? 'due ' : 'Due '}<span className="mono">${t.type === 'examprep' ? T.fmtDate(t.due) : T.fmtWhen(t.due, now)}</span>${t.weight ? ' · ' + t.weight + '% of ' + (m ? m.code : 'the module') : ''}`}</span></div>`}
      <div className="next-actions">
        ${active ? html`<button className="btn btn-primary" onClick=${() => TS.openOverlay('session', { id: next.id, mode: 'checkin' })}><${Icon} name="Square" />Finish</button>
          <button className="btn btn-ghost" onClick=${() => A.stopSession()}>Stop timer</button>`
        : html`<button className="btn btn-primary" onClick=${() => A.startSession(next.id)}><${Icon} name="Play" />Start${startsIn > 5 * T.MIN ? ' early' : ''}</button>
          <button className="btn btn-secondary" onClick=${() => TS.openOverlay('session', { id: next.id })}>Details</button>`}
      </div>
    </section>`;
  }

  function WeekTrack({ st, now }) {
    const ws = T.weekStart(now);
    const we = T.addDays(ws, 7);
    const week = st.sessions.filter((s) => s.start >= ws && s.start < we);
    const planned = TS.sum(week, (s) => (s.end - s.start) / T.MIN);
    const done = TS.sum(week, (s) => s.workMin || 0);
    const expected = TS.sum(week.filter((s) => s.end <= now), (s) => (s.end - s.start) / T.MIN);
    const unchecked = week.filter((s) => s.end <= now && s.status === 'planned').length;
    let status, tone;
    if (expected === 0) { status = 'Your plan starts today'; tone = 'badge-accent'; }
    else if (done >= expected * 0.85) { status = 'On track'; tone = 'badge-ok'; }
    else if (unchecked) { status = TS.plural(unchecked, 'session') + ' to check in'; tone = 'badge-warn'; }
    else { status = 'Behind by ' + T.fmtHours(expected - done); tone = 'badge-warn'; }
    const perDay = Array.from({ length: 7 }, (_, i) => {
      const d = T.addDays(ws, i);
      const list = week.filter((s) => T.sameDay(s.start, d));
      return { d, planned: TS.sum(list, (s) => (s.end - s.start) / T.MIN), done: TS.sum(list, (s) => s.workMin || 0) };
    });
    const max = Math.max(60, ...perDay.map((p) => p.planned));
    return html`<section className="panel panel-pad stack" aria-label="This week">
      <div className="row-between"><h2 className="panel-title">This week</h2><span className=${'badge ' + tone}>${status}</span></div>
      <div className="row-between" style=${{ alignItems: 'baseline' }}>
        <span><span className="display" style=${{ fontSize: '28px' }}>${T.fmtHours(done)}</span><span className="muted small"> of ${T.fmtHours(planned)} study done</span></span>
        ${status.startsWith('Behind') && html`<button className="btn btn-secondary btn-sm" onClick=${() => A.replan('You’re behind this week')}>Replan</button>`}
      </div>
      <div className="track-days" role="img" aria-label="Planned and completed study per day">
        ${perDay.map((p, i) => html`<div key=${i} className=${cx('track-day', T.sameDay(p.d, now) && 'is-today')}>
          <div className="bar" style=${{ height: Math.max(4, (p.planned / max) * 54) + 'px' }}><i style=${{ height: p.planned ? (p.done / p.planned) * 100 + '%' : 0 }}></i></div>
          <span>${T.DOW[i][0]}</span></div>`)}
      </div>
      <div className="row xs faint" style=${{ gap: '16px' }}><span><span className="key key-plan"></span>Planned</span><span><span className="key key-done"></span>Logged</span></div>
    </section>`;
  }

  function Deadlines({ st, now }) {
    const list = st.tasks
      .filter((t) => t.status !== 'done' && t.due && t.due > now && t.due < T.addDays(now, 10) && (t.assessmentId || t.type === 'labreport' || t.type === 'prelab' || t.source === 'user'))
      .sort((a, b) => a.due - b.due).slice(0, 6);
    return html`<section className="panel panel-pad stack-sm" aria-label="Upcoming deadlines">
      <div className="row-between" style=${{ marginBottom: '4px' }}><h2 className="panel-title">Deadlines, next 10 days</h2><a className="small" href="#tasks">All tasks</a></div>
      ${list.length === 0 ? html`<p className="small muted">Nothing due in the next 10 days.</p>` : html`<div>
        ${list.map((t) => { const m = TS.sel.module(st, t.moduleId); const p = TS.sel.taskProgress(st, t); const soon = t.due - now < 2 * T.DAY; return html`<div key=${t.id} className="deadline">
          <span className="deadline-title"><${TS.Pip} hue=${m ? m.hue : 260} /><span className="truncate">${t.title}</span></span>
          <span className=${cx('deadline-due', soon && 'soon')}>${T.fmtWhen(t.due, now)}</span>
          <span className="xs faint" style=${{ gridColumn: '1 / -1', marginTop: '-2px' }}>${m ? m.code : ''} · ${TS.typeLabel(t.type)}${t.weight ? ' · ' + t.weight + '%' : ''} · ${T.fmtDur(p.done)} / ${T.fmtDur(p.est)}</span>
          <${TS.Meter} value=${p.pct} hue=${m ? m.hue : null} thin label=${t.title + ' progress'} />
        </div>`; })}
      </div>`}
    </section>`;
  }

  function CheckIns({ st, now }) {
    const list = TS.sel.needsCheckIn(st, now).slice(0, 4);
    if (!list.length) return null;
    return html`<section className="stack-sm" aria-label="Check in">
      <div className="section-title"><h2 className="h3">How did these go?</h2><span className="small faint">Checking in keeps the plan honest</span></div>
      <div className="checkin">${list.map((s) => { const m = TS.sel.module(st, s.moduleId); return html`<div key=${s.id} className="checkin-item">
        <div className="stack-sm" style=${{ gap: '2px', minWidth: 0 }}><span className="row" style=${{ gap: '8px', fontWeight: 600 }}><${TS.Pip} hue=${m ? m.hue : 260} /><span className="truncate">${s.title}</span></span><span className="xs faint mono">${T.fmtWhen(s.start, now)}–${T.hm(s.end)}</span></div>
        <div className="row" style=${{ gap: '6px' }}>
          <button className="btn btn-secondary btn-sm" onClick=${() => A.checkIn(s.id, 'done')}><${Icon} name="Check" />Done</button>
          <button className="btn btn-ghost btn-sm" onClick=${() => TS.openOverlay('session', { id: s.id, mode: 'checkin' })}>Other</button>
        </div></div>`; })}</div>
    </section>`;
  }

  function TodayView() {
    const st = TS.useStore();
    const now = TS.useNow(1000);
    const today = T.dayStart(now);
    const tomorrow = T.addDays(today, 1);
    const tw = TS.sel.teachingWeek(st, now);
    const h = new Date(now).getHours();
    const greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const name = st.profile && st.profile.name !== 'Student' ? ', ' + st.profile.name : '';
    const left = st.sessions.filter((s) => T.sameDay(s.start, now) && s.status === 'planned' && s.end > now).length;
    return html`<div className="page">
      <header className="page-head">
        <div><h1 className="h1">${greet}${name}</h1><p className="page-sub">${T.fmtDateLong(now)} · ${st.semester ? st.semester.label + ', week ' + tw : ''} · ${left ? TS.plural(left, 'study session') + ' left today.' : 'No more study planned today.'}</p></div>
        <div className="page-actions">${TS.pageActions()}</div>
      </header>
      <${ProposalBanner} />
      <${UnfitBanner} />
      <div className="today">
        <div className="stack" style=${{ gap: '28px' }}>
          <${CheckIns} st=${st} now=${now} />
          <section aria-label="Today’s timeline" className="stack-sm">
            <div className="section-title"><h2 className="h3">Today</h2><a className="small" href="#week">Open week</a></div>
            <${Timeline} st=${st} day=${today} now=${now} />
          </section>
          <section aria-label="Tomorrow" className="stack-sm">
            <div className="section-title"><h2 className="h3">Tomorrow <span className="faint" style=${{ fontWeight: 500 }}>· ${T.fmtDate(tomorrow)}</span></h2></div>
            <${Timeline} st=${st} day=${tomorrow} now=${now} />
          </section>
        </div>
        <aside className="today-side">
          <${NextCard} st=${st} now=${now} />
          <${WeekTrack} st=${st} now=${now} />
          <${Deadlines} st=${st} now=${now} />
        </aside>
      </div>
    </div>`;
  }

  TS.TodayView = TodayView;
  TS.Timeline = Timeline;
})();
