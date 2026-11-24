/* Week / day calendar with drag-to-reschedule and a mobile agenda. */
(() => {
  const TS = window.TS;
  const { html, Icon, useState, useEffect, useRef, useMemo, cx } = TS;
  const T = TS.time;
  const A = TS.actions;
  const HOUR_H = 52;
  const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function useMedia(q) {
    const [m, setM] = useState(() => window.matchMedia(q).matches);
    useEffect(() => { const mq = window.matchMedia(q); const on = () => setM(mq.matches); mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); }, [q]);
    return m;
  }
  TS.useMedia = useMedia;

  function layout(items) {
    const sorted = items.slice().sort((a, b) => a.start - b.start || b.end - a.end);
    let cluster = [], lanes = [], clusterEnd = -Infinity;
    const flush = () => { cluster.forEach((it) => { it.lanes = lanes.length; }); cluster = []; lanes = []; };
    for (const it of sorted) {
      if (it.start >= clusterEnd) { flush(); clusterEnd = -Infinity; }
      let lane = lanes.findIndex((end) => end <= it.start);
      if (lane < 0) { lane = lanes.length; lanes.push(it.end); } else lanes[lane] = it.end;
      it.lane = lane;
      cluster.push(it);
      clusterEnd = Math.max(clusterEnd, it.end);
    }
    flush();
    return sorted;
  }

  function rangeLabel(ws, days) {
    const a = new Date(ws), b = new Date(T.addDays(ws, days - 1));
    if (days === 1) return T.fmtDateLong(ws);
    return a.getMonth() === b.getMonth() ? a.getDate() + '–' + b.getDate() + ' ' + MON_LONG[a.getMonth()] : a.getDate() + ' ' + MON_LONG[a.getMonth()].slice(0, 3) + ' – ' + b.getDate() + ' ' + MON_LONG[b.getMonth()].slice(0, 3);
  }

  function Filters({ st }) {
    const hm = st.ui.hiddenModules, ht = st.ui.hiddenTypes;
    const toggle = (kind, list, v) => A.setHidden(kind, list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
    return html`<div className="filters" role="group" aria-label="Calendar filters">
      ${st.modules.filter((m) => m.include !== false).map((m) => html`<button key=${m.id} type="button" className="chip m" style=${{ '--h': m.hue }} aria-pressed=${!hm.includes(m.id)} onClick=${() => toggle('hiddenModules', hm, m.id)}><span className="pip"></span><span className="mono">${m.code}</span></button>`)}
      <span className="filter-sep" aria-hidden="true"></span>
      ${[['class', 'Classes'], ['study', 'Study'], ['personal', 'Personal'], ['flex', 'Flex time']].map(([k, l]) => html`<button key=${k} type="button" className="chip" aria-pressed=${!ht.includes(k)} onClick=${() => toggle('hiddenTypes', ht, k)}>${l}</button>`)}
    </div>`;
  }

  function EventBlock({ it, st, H0, onPointerDown, dragging }) {
    const top = ((T.minOfDay(it.start) - H0 * 60) / 60) * HOUR_H;
    const mins = (it.end - it.start) / T.MIN;
    const height = Math.max(18, (mins / 60) * HOUR_H - 2);
    const style = { top: top + 'px', height: height + 'px' };
    if (it.lanes > 1) { style.left = `calc(${(it.lane / it.lanes) * 100}% + 2px)`; style.width = `calc(${100 / it.lanes}% - 4px)`; style.right = 'auto'; }
    const compact = mins < 60;
    if (it.kind === 'buffer') {
      return html`<div className="ev ev-buffer compact" style=${{ ...style, cursor: 'default' }} title="Flex time: kept free for catch-up or things that come up">
        <span className="ev-title"><${Icon} name="CircleDashed" size=${11} /><span>Flex time</span></span></div>`;
    }
    if (it.kind === 'fixed') {
      const o = it.data;
      const m = o.moduleId ? TS.sel.module(st, o.moduleId) : null;
      const label = o.source === 'class' ? m.code + ' ' + TS.model.KIND_LABEL[o.kind] : o.title;
      return html`<button type="button" className=${cx('ev', o.source === 'class' ? 'm ev-class' : o.source === 'block' ? 'ev-block' : 'ev-personal', o.cancelled && 'ev-cancelled', compact && 'compact')} style=${{ ...style, '--h': m ? m.hue : null }}
        onClick=${() => TS.openOverlay('occurrence', { occKey: o.key, from: T.dayStart(o.start) })} aria-label=${label + ', ' + T.fmtRange(o.start, o.end) + (o.cancelled ? ', cancelled' : '')}>
        <span className="ev-title"><${Icon} name=${TS.kindIcon(o)} size=${11} /><span>${label}</span>${o.moved && html`<${Icon} name="RefreshCw" size=${10} />`}</span>
        <span className="ev-meta">${T.fmtRange(o.start, o.end)}${!compact && o.room ? ' · ' + o.room : ''}</span>
      </button>`;
    }
    const s = it.data;
    const m = TS.sel.module(st, s.moduleId);
    const warn = TS.engine.sessionWarnings(st, s);
    const draggable = s.status === 'planned' && s.start > Date.now();
    return html`<button type="button" className=${cx('ev m ev-study', draggable && 'draggable', s.status === 'done' && 'ev-done', s.status === 'missed' && 'ev-missed', compact && 'compact', dragging && 'dragging')}
      style=${{ ...style, '--h': m ? m.hue : 260 }} onPointerDown=${draggable ? (e) => onPointerDown(e, s, top) : null}
      onClick=${(e) => { if (e.detail === 0 || !draggable) TS.openOverlay('session', { id: s.id }); }}
      aria-label=${s.title + ', ' + T.fmtRange(s.start, s.end) + (s.status !== 'planned' ? ', ' + s.status : '') + (warn.length ? ', ' + warn[0] : '')}>
      <span className="ev-title">${s.status === 'done' ? html`<${Icon} name="Check" size=${11} />` : s.pinned ? html`<${Icon} name="Pin" size=${11} />` : html`<span className="pip" style=${{ width: '7px', height: '7px' }}></span>`}<span>${s.title}</span>${warn.length > 0 && html`<${Icon} name="TriangleAlert" size=${11} className="flag-ic" />`}</span>
      <span className="ev-meta">${compact ? T.fmtDur(mins) : T.fmtRange(s.start, s.end) + ' · ' + (m ? m.code : '')}</span>
    </button>`;
  }

  function WeekView() {
    const st = TS.useStore();
    const now = TS.useNow(30000);
    const narrow = useMedia('(max-width: 720px)');
    const [ws, setWs] = useState(T.weekStart(now));
    const [view, setView] = useState('week');
    const [dayIdx, setDayIdx] = useState(T.weekday(now));
    const [drag, setDrag] = useState(null);
    const [showPast, setShowPast] = useState(false);
    const bodyRef = useRef(null);
    const scrollRef = useRef(null);
    const dragRef = useRef(null);

    const days = view === 'day' && !narrow ? [T.addDays(ws, dayIdx)] : Array.from({ length: 7 }, (_, i) => T.addDays(ws, i));
    const from = days[0], to = T.addDays(days[days.length - 1], 1);
    const hm = st.ui.hiddenModules, ht = st.ui.hiddenTypes;
    const fixed = useMemo(() => TS.model.expandFixed(st, from, to), [st, from, to]);

    const visible = (it) => {
      if (it.kind === 'buffer') return !ht.includes('flex');
      if (it.kind === 'session') return !ht.includes('study') && !hm.includes(it.data.moduleId);
      if (it.data.source === 'class') return !ht.includes('class') && !hm.includes(it.data.moduleId);
      return !ht.includes('personal');
    };
    const itemsFor = (d) => {
      const e = T.addDays(d, 1);
      return [
        ...fixed.filter((o) => o.start >= d && o.start < e).map((o) => ({ kind: 'fixed', start: o.start, end: o.end, data: o, id: o.key })),
        ...st.sessions.filter((s) => s.start >= d && s.start < e).map((s) => ({ kind: 'session', start: s.start, end: s.end, data: s, id: s.id })),
        ...(st.buffers || []).filter((b) => b.start >= d && b.start < e).map((b) => ({ kind: 'buffer', start: b.start, end: b.end, data: b, id: b.id })),
      ].filter(visible);
    };
    const allItems = days.flatMap(itemsFor);
    const minStart = Math.min(7 * 60, ...allItems.map((i) => T.minOfDay(i.start)));
    const maxEnd = Math.max(22 * 60, ...allItems.map((i) => T.minOfDay(i.end) || 1440));
    const H0 = Math.floor(minStart / 60), H1 = Math.min(24, Math.ceil(maxEnd / 60));
    const hours = Array.from({ length: H1 - H0 }, (_, i) => H0 + i);
    const colH = (H1 - H0) * HOUR_H;
    const prefs = st.prefs;

    useEffect(() => {
      const el = scrollRef.current;
      if (!el) return;
      const target = days.some((d) => T.sameDay(d, now)) ? Math.max(0, T.minOfDay(now) / 60 - H0 - 2) : Math.max(0, 8 - H0);
      el.scrollTop = target * HOUR_H;
    }, [ws, view]);

    /* ---- drag ---- */
    const onPointerDown = (e, s, top) => {
      if (e.button !== 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      dragRef.current = { s, x0: e.clientX, y0: e.clientY, grab: e.clientY - rect.top, moved: false, dur: s.end - s.start };
      const move = (ev) => {
        const d = dragRef.current;
        if (!d) return;
        if (!d.moved && Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0) < 5) return;
        d.moved = true;
        const cols = [...bodyRef.current.querySelectorAll('.cal-col')];
        let ci = cols.findIndex((c) => { const r = c.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX < r.right; });
        if (ci < 0) ci = ev.clientX < cols[0].getBoundingClientRect().left ? 0 : cols.length - 1;
        const r = cols[ci].getBoundingClientRect();
        let min = ((ev.clientY - d.grab - r.top) / HOUR_H) * 60 + H0 * 60;
        min = Math.round(min / 15) * 15;
        min = TS.clamp(min, H0 * 60, H1 * 60 - d.dur / T.MIN);
        const start = T.at(days[ci], T.fromMin(min));
        const check = TS.engine.checkMove(TS.store.get(), d.s, start, start + d.dur, Date.now());
        d.target = { ci, min, start, check };
        setDrag({ id: d.s.id, ...d.target });
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        const d = dragRef.current;
        dragRef.current = null;
        setDrag(null);
        if (!d) return;
        if (!d.moved) { TS.openOverlay('session', { id: d.s.id }); return; }
        if (d.target) {
          if (d.target.check.ok) { if (d.target.start !== d.s.start) A.moveSession(d.s.id, d.target.start, d.target.start + d.dur); }
          else TS.toast(d.target.check.error, { tone: 'danger' });
        }
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    };

    const horizon = T.addDays(T.weekStart(now), 14);
    const beyond = ws >= horizon;
    const before = T.addDays(ws, 7) <= T.weekStart(now);
    const tw = TS.model.teachingWeek(st.semester, ws);
    const step = (n) => { if (view === 'day' && !narrow) { const ni = dayIdx + n; if (ni < 0) { setWs(T.addDays(ws, -7)); setDayIdx(6); } else if (ni > 6) { setWs(T.addDays(ws, 7)); setDayIdx(0); } else setDayIdx(ni); } else setWs(T.addDays(ws, 7 * n)); };
    const studyPlanned = (d) => TS.sum(st.sessions.filter((s) => T.sameDay(s.start, d)), (s) => (s.end - s.start) / T.MIN);

    return html`<div className="page">
      <header className="page-head">
        <div><h1 className="h1">${rangeLabel(days[0], days.length)}</h1><p className="page-sub">${st.semester ? st.semester.label + (tw >= 1 && tw <= st.semester.teachingWeeks ? ', teaching week ' + tw : tw > st.semester.teachingWeeks ? ', after teaching weeks' : '') : ''}</p></div>
        <div className="page-actions">${TS.pageActions()}</div>
      </header>
      <${TS.ProposalBanner} />
      <div className="cal-toolbar">
        <div className="row" style=${{ gap: '4px' }}>
          <button className="btn btn-secondary btn-icon btn-sm" aria-label="Previous" onClick=${() => step(-1)}><${Icon} name="ChevronLeft" /></button>
          <button className="btn btn-secondary btn-sm" onClick=${() => { setWs(T.weekStart(now)); setDayIdx(T.weekday(now)); }}>Today</button>
          <button className="btn btn-secondary btn-icon btn-sm" aria-label="Next" onClick=${() => step(1)}><${Icon} name="ChevronRight" /></button>
        </div>
        ${!narrow && html`<${TS.Seg} label="View" value=${view} onChange=${setView} options=${[{ value: 'week', label: 'Week' }, { value: 'day', label: 'Day' }]} />`}
        <div className="cal-legend" style=${{ marginLeft: 'auto' }}>
          <span><span className="sw fixed"></span>Fixed</span><span><span className="sw study"></span>Study (drag to move)</span><span><span className="sw personal"></span>Personal</span><span><span className="sw buffer"></span>Flex</span>
        </div>
      </div>
      <${Filters} st=${st} />
      ${beyond && html`<div className="notice" style=${{ marginBottom: '14px' }}><${Icon} name="CalendarClock" /><div>Study sessions are planned two weeks ahead, so this week shows fixed classes and commitments only. Sessions appear as it gets closer.</div></div>`}
      ${before && html`<div className="notice" style=${{ marginBottom: '14px' }}><${Icon} name="History" /><div>This week is before your plan started.</div></div>`}

      ${narrow ? html`<div className="agenda">
        ${!showPast && days.some((d) => T.sameDay(d, now)) && T.weekday(now) > 0 && html`<button className="btn btn-ghost btn-sm" style=${{ justifySelf: 'start' }} onClick=${() => setShowPast(true)}><${Icon} name="ChevronDown" />Show earlier days this week</button>`}
        ${days.filter((d) => showPast || !days.some((x) => T.sameDay(x, now)) || d >= T.dayStart(now)).map((d) => html`<section key=${d} className="agenda-day">
          <div className="agenda-dayhead"><span className="h3" style=${{ color: T.sameDay(d, now) ? 'var(--accent)' : null }}>${T.fmtDate(d)}</span>${studyPlanned(d) > 0 && html`<span className="xs faint mono">${T.fmtDur(studyPlanned(d))} study</span>`}</div>
          <${TS.Timeline} st=${st} day=${d} now=${now} />
        </section>`)}</div>`
      : html`<div className="cal" style=${{ '--cols': days.length }}>
        <div className="cal-scroll" ref=${scrollRef}>
          <div className="cal-head">
            <div></div>
            ${days.map((d, i) => html`<div key=${d} className=${cx('cal-dayhead', T.sameDay(d, now) && 'is-today')}>
              <span className="dn">${T.DOW[T.weekday(d)]}</span><span className="dd">${new Date(d).getDate()}</span>
              ${studyPlanned(d) > 0 && html`<span className="dl" title="Study planned">${T.fmtDur(studyPlanned(d))}</span>`}
            </div>`)}
          </div>
          <div className="cal-body" ref=${bodyRef}>
            <div className="cal-times" style=${{ height: colH + 'px' }}>${hours.map((h) => h > H0 && html`<span key=${h} style=${{ top: (h - H0) * HOUR_H + 'px' }}>${String(h).padStart(2, '0')}:00</span>`)}</div>
            ${days.map((d, ci) => {
              const items = layout(itemsFor(d).map((x) => ({ ...x })));
              const isToday = T.sameDay(d, now);
              const pastDay = T.addDays(d, 1) <= now;
              const winTop = ((T.toMin(prefs.dayStart) - H0 * 60) / 60) * HOUR_H;
              const winBot = ((T.toMin(prefs.dayEnd) - H0 * 60) / 60) * HOUR_H;
              return html`<div key=${d} className=${cx('cal-col', pastDay && 'is-past-day')} style=${{ height: colH + 'px' }} aria-label=${T.fmtDateLong(d)}>
                ${winTop > 0 && html`<div className="outside" style=${{ top: 0, height: winTop + 'px' }}></div>`}
                ${winBot < colH && html`<div className="outside" style=${{ top: winBot + 'px', bottom: 0 }}></div>`}
                ${isToday && html`<div className="past-shade" style=${{ height: Math.max(0, ((T.minOfDay(now) - H0 * 60) / 60) * HOUR_H) + 'px' }}></div>`}
                ${items.map((it) => html`<${EventBlock} key=${it.id} it=${it} st=${st} H0=${H0} onPointerDown=${onPointerDown} dragging=${drag && drag.id === it.id} />`)}
                ${isToday && html`<div className="now-line" style=${{ top: ((T.minOfDay(now) - H0 * 60) / 60) * HOUR_H + 'px' }} aria-label=${'Now ' + T.hm(now)}></div>`}
                ${drag && drag.ci === ci && html`<div className=${cx('ev-ghost', !drag.check.ok && 'invalid')} style=${{ top: ((drag.min - H0 * 60) / 60) * HOUR_H + 'px', height: (((TS.sel.session(st, drag.id).end - TS.sel.session(st, drag.id).start) / T.MIN) / 60) * HOUR_H - 2 + 'px' }}>
                  ${T.hm(drag.start)}${drag.check.ok ? '' : ' · clash'}${drag.check.ok && drag.check.warnings.length ? ' · ' + drag.check.warnings[0] : ''}</div>`}
              </div>`;
            })}
          </div>
        </div>
      </div>`}
    </div>`;
  }

  TS.WeekView = WeekView;
})();
