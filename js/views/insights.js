/* Insights: the Week Dial and analytics derived only from recorded data. */
(() => {
  const TS = window.TS;
  const { html, Icon, useState, useMemo, cx } = TS;
  const T = TS.time;

  const CATS = {
    work: { label: 'Work', color: 'var(--cat-work)', kinds: ['work'] },
    move: { label: 'Exercise & sport', color: 'var(--cat-move)', kinds: ['gym', 'sport'] },
    soc: { label: 'Societies', color: 'var(--cat-soc)', kinds: ['society'] },
    other: { label: 'Other commitments', color: 'var(--cat-other)', kinds: ['personal'] },
  };
  const catOfKind = (k) => Object.keys(CATS).find((c) => CATS[c].kinds.includes(k)) || 'other';
  const modColor = (hue, alpha = 1) => `oklch(var(--m-solid-l) var(--m-solid-c) ${hue} / ${alpha})`;

  /** Allocation for one week. mode 'planned' uses the plan; 'logged' uses check-ins (classes counted as scheduled once they've happened). */
  function allocate(st, ws, mode, now) {
    const we = T.addDays(ws, 7);
    const occ = TS.model.expandFixed(st, ws, we).filter((o) => !o.cancelled && o.source !== 'block' && (mode === 'planned' || o.end <= now));
    const sessions = st.sessions.filter((s) => s.start >= ws && s.start < we && (mode === 'planned' ? true : (s.status === 'done' || s.status === 'partial')));
    const cats = new Map();
    const get = (id, base) => { if (!cats.has(id)) cats.set(id, { id, minutes: 0, classMin: 0, studyMin: 0, sessions: 0, items: new Map(), ...base }); return cats.get(id); };
    const slots = Array.from({ length: 168 }, () => new Map());
    const addSlots = (start, end, id) => {
      for (let t = start; t < end;) {
        const h = Math.floor((t - ws) / T.HOUR);
        const next = Math.min(end, ws + (h + 1) * T.HOUR);
        if (h >= 0 && h < 168) slots[h].set(id, (slots[h].get(id) || 0) + (next - t));
        t = next;
      }
    };
    for (const o of occ) {
      const min = (o.end - o.start) / T.MIN;
      if (o.source === 'class') {
        const m = TS.sel.module(st, o.moduleId);
        const c = get(o.moduleId, { label: m.code, name: m.name, hue: m.hue, module: true });
        c.minutes += min; c.classMin += min;
        c.items.set(TS.model.KIND_LABEL[o.kind] + 's', (c.items.get(TS.model.KIND_LABEL[o.kind] + 's') || 0) + min);
        addSlots(o.start, o.end, 'c:' + o.moduleId);
      } else {
        const id = catOfKind(o.kind);
        const c = get(id, { label: CATS[id].label, color: CATS[id].color });
        c.minutes += min; c.items.set(o.title, (c.items.get(o.title) || 0) + min);
        addSlots(o.start, o.end, 'k:' + id);
      }
    }
    for (const s of sessions) {
      const min = mode === 'planned' ? (s.end - s.start) / T.MIN : s.actualMin || 0;
      const m = TS.sel.module(st, s.moduleId);
      if (!m) continue;
      const c = get(s.moduleId, { label: m.code, name: m.name, hue: m.hue, module: true });
      c.minutes += min; c.studyMin += min; c.sessions++;
      const k = TS.typeLabel(s.type);
      c.items.set(k, (c.items.get(k) || 0) + min);
      addSlots(s.start, s.end, 's:' + s.moduleId);
    }
    const list = [...cats.values()].filter((c) => c.minutes > 0).sort((a, b) => (!!b.module - !!a.module) || b.minutes - a.minutes);
    const total = TS.sum(list, (c) => c.minutes);
    const hourly = slots.map((m) => { let best = null, v = 0; for (const [k, x] of m) if (x > v) { v = x; best = k; } return best; });
    return { list, total, hourly, occ, sessions };
  }

  function arc(cx, cy, r0, r1, a0, a1) {
    a1 = Math.min(a1, a0 + 359.99);
    const p = (r, a) => [cx + r * Math.cos(((a - 90) * Math.PI) / 180), cy + r * Math.sin(((a - 90) * Math.PI) / 180)];
    const L = a1 - a0 > 180 ? 1 : 0;
    const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r1} ${r1} 0 ${L} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}A${r0} ${r0} 0 ${L} 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z`;
  }

  function slotColor(st, key, dimmed) {
    if (!key) return { fill: 'var(--track)' };
    const [type, id] = key.split(':');
    if (type === 'k') return { fill: CATS[id].color, opacity: dimmed ? 0.18 : 1 };
    const m = TS.sel.module(st, id);
    const hue = m ? m.hue : 260;
    return { fill: modColor(hue, type === 's' ? 0.5 : 1), opacity: dimmed ? 0.18 : 1 };
  }

  function WeekDial({ st, data, selected, onSelect, mode }) {
    const C = 200;
    const gap = data.list.length > 1 ? 1.4 : 0;
    let a = 0;
    const segs = data.list.map((c) => {
      const sweep = (c.minutes / data.total) * 360;
      const s = { c, a0: a + gap / 2, a1: a + sweep - gap / 2 };
      a += sweep;
      return s;
    });
    // Chronological outer ring: merge equal neighbours into runs.
    const runs = [];
    data.hourly.forEach((k, h) => { const last = runs[runs.length - 1]; if (last && last.k === k) last.n++; else runs.push({ k, h, n: 1 }); });
    const selKey = selected ? (CATS[selected] ? 'k:' + selected : null) : null;
    const runDim = (k) => selected && k && !(k === selKey || k === 'c:' + selected || k === 's:' + selected);
    const sel = data.list.find((c) => c.id === selected);
    return html`<div className="dial-wrap">
      <svg viewBox="-10 -10 420 420" role="group" aria-label=${'Week dial: ' + T.fmtHours(data.total) + ' ' + mode}>
        <title>Where the week goes</title>
        ${runs.map((r, i) => { const col = slotColor(st, r.k, runDim(r.k)); return html`<path key=${'r' + i} d=${arc(C, C, 178, 192, (r.h / 168) * 360, ((r.h + r.n) / 168) * 360)} style=${{ fill: col.fill, opacity: col.opacity == null ? 1 : col.opacity, transition: 'opacity .2s' }} />`; })}
        ${Array.from({ length: 7 }, (_, d) => { const ang = ((d * 24) / 168) * 360 - 90; const r0 = 174, r1 = 196; const x0 = C + r0 * Math.cos((ang * Math.PI) / 180), y0 = C + r0 * Math.sin((ang * Math.PI) / 180), x1 = C + r1 * Math.cos((ang * Math.PI) / 180), y1 = C + r1 * Math.sin((ang * Math.PI) / 180);
          const mid = (((d + 0.5) * 24) / 168) * 360 - 90; const lx = C + 164 * Math.cos((mid * Math.PI) / 180), ly = C + 164 * Math.sin((mid * Math.PI) / 180);
          return html`<g key=${'d' + d}><line x1=${x0} y1=${y0} x2=${x1} y2=${y1} style=${{ stroke: 'var(--bg)', strokeWidth: 2.5 }} />
            <text x=${lx} y=${ly} textAnchor="middle" dominantBaseline="central" style=${{ fill: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500 }}>${T.DOW[d]}</text></g>`; })}
        ${segs.length === 0 && html`<circle cx=${C} cy=${C} r="132" style=${{ fill: 'none', stroke: 'var(--track)', strokeWidth: 38 }} />`}
        ${segs.map((s) => { const on = selected === s.c.id; const dim = selected && !on; const fill = s.c.module ? modColor(s.c.hue) : s.c.color; return html`<path key=${s.c.id} className="dial-seg" tabIndex="0" role="button"
            aria-label=${(s.c.module ? s.c.label + ' ' + s.c.name : s.c.label) + ': ' + T.fmtHours(s.c.minutes) + ', ' + Math.round((s.c.minutes / data.total) * 100) + '%'} aria-pressed=${on}
            d=${arc(C, C, on ? 108 : 112, on ? 156 : 150, s.a0, s.a1)} style=${{ fill, opacity: dim ? 0.3 : 1 }}
            onClick=${() => onSelect(on ? null : s.c.id)} onKeyDown=${(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(on ? null : s.c.id))} />`; })}
      </svg>
      <div className="dial-center"><div className="dial-center-inner">
        ${sel ? html`<span className="dial-label">${sel.module ? sel.label : sel.label}</span>
            <span className="dial-big">${T.fmtHours(sel.minutes)}</span>
            <span className="dial-cap">${Math.round((sel.minutes / data.total) * 100)}% of tracked time${sel.module ? html`<br />${T.fmtHours(sel.classMin)} classes · ${T.fmtHours(sel.studyMin)} study` : ''}</span>`
          : html`<span className="dial-big">${T.fmtHours(data.total)}</span><span className="dial-cap">${mode === 'planned' ? 'planned this week' : 'logged so far'}<br />Select a segment</span>`}
      </div></div>
    </div>`;
  }

  function freeBefore(st, now, until) {
    const p = st.prefs;
    const fixed = TS.model.expandFixed(st, now, until).filter((o) => !o.cancelled);
    const busy = [...fixed, ...st.sessions.filter((s) => s.status === 'planned' && s.end > now)].map((o) => ({ start: o.start, end: o.end }));
    let total = 0;
    for (let d = T.dayStart(now); d < until; d = T.addDays(d, 1)) {
      const ws = Math.max(now, T.at(d, p.dayStart)), we = Math.min(until, T.at(d, p.dayEnd));
      if (we > ws) total += TS.iv.total(TS.iv.subtract([{ start: ws, end: we }], busy).filter((i) => i.end - i.start >= 30 * T.MIN));
    }
    return total / T.MIN;
  }

  function InsightsView() {
    const st = TS.useStore();
    const now = TS.useNow(60000);
    const [period, setPeriod] = useState('this');
    const [mode, setMode] = useState('planned');
    const [selected, setSelected] = useState(null);
    const ws = period === 'this' ? T.weekStart(now) : T.addDays(T.weekStart(now), 7);
    const data = useMemo(() => allocate(st, ws, mode, now), [st, ws, mode, Math.floor(now / 600000)]);
    const logs = st.log.filter((l) => l.status !== 'missed' && l.actualMin);

    /* Derived insights (only from records) */
    const insights = [];
    const mods = data.list.filter((c) => c.module);
    if (mods.length) {
      const top = mods.slice().sort((a, b) => b.minutes - a.minutes)[0];
      insights.push(html`<span><b>${top.label} ${top.name}</b> takes the most time ${mode === 'planned' ? 'in this plan' : 'so far'}: <b>${T.fmtHours(top.minutes)}</b> (${T.fmtHours(top.classMin)} classes, ${T.fmtHours(top.studyMin)} study).</span>`);
    }
    const dayTotals = Array.from({ length: 7 }, (_, i) => { const d = T.addDays(ws, i), e = T.addDays(d, 1); return TS.sum(data.occ.filter((o) => o.start >= d && o.start < e), (o) => (o.end - o.start) / T.MIN) + TS.sum(data.sessions.filter((s) => s.start >= d && s.start < e), (s) => (mode === 'planned' ? (s.end - s.start) / T.MIN : s.actualMin || 0)); });
    const wkAvg = TS.sum(dayTotals.slice(0, 5)) / 5;
    const maxI = dayTotals.indexOf(Math.max(...dayTotals));
    if (wkAvg > 0 && dayTotals[maxI] >= wkAvg * 1.25) insights.push(html`<span>Your week is heaviest on <b>${T.DOW_LONG[maxI]}</b>: <b>${T.fmtHours(dayTotals[maxI])}</b> of classes, commitments and study, against a weekday average of ${T.fmtHours(wkAvg)}.</span>`);
    const classMin = TS.sum(data.list, (c) => c.classMin || 0), studyMin = TS.sum(data.list, (c) => c.studyMin || 0);
    if (classMin + studyMin > 0) insights.push(html`<span>Independent study is <b>${Math.round((studyMin / (classMin + studyMin)) * 100)}%</b> of your academic time ${mode === 'planned' ? 'in this plan' : 'logged'} (${T.fmtHours(studyMin)} study, ${T.fmtHours(classMin)} classes).</span>`);
    const nextBig = st.tasks.filter((t) => t.status !== 'done' && t.due && t.due > now && t.assessmentId && (t.weight || 0) >= 10).sort((a, b) => a.due - b.due)[0];
    if (nextBig && period === 'this') {
      const free = freeBefore(st, now, nextBig.due);
      const left = Math.max(0, TS.model.taskEstimate(nextBig) - (nextBig.done || 0));
      insights.push(html`<span>You have <b>${T.fmtHours(free)}</b> of unplanned time in your study window before <b>${nextBig.title}</b> is due (${T.fmtWhen(nextBig.due, now)}). About ${T.fmtHours(left)} of it is still to do.</span>`);
    }
    const byType = new Map();
    for (const l of logs) { const k = TS.typeLabel(l.type); const v = byType.get(k) || { n: 0, planned: 0, actual: 0 }; v.n++; v.planned += l.plannedMin; v.actual += l.actualMin; byType.set(k, v); }
    const estRows = [...byType.entries()].sort((a, b) => b[1].n - a[1].n);
    const strong = estRows.find(([, v]) => v.n >= 3 && Math.abs(v.actual / v.planned - 1) >= 0.15);
    if (strong) { const r = strong[1].actual / strong[1].planned - 1; insights.push(html`<span><b>${strong[0]}</b> sessions take about <b>${Math.round(Math.abs(r) * 100)}% ${r > 0 ? 'longer' : 'less time'}</b> than planned (${strong[1].n} logged).</span>`); }

    const days14 = Array.from({ length: 14 }, (_, i) => { const d = T.addDays(T.dayStart(now), i - 13); return { d, min: TS.sum(logs.filter((l) => T.sameDay(l.sessionStart || l.at, d)), (l) => l.actualMin) }; });
    const maxDay = Math.max(30, ...days14.map((x) => x.min));
    const loadMax = Math.max(60, ...dayTotals);

    return html`<div className="page">
      <header className="page-head">
        <div><h1 className="h1">Where your time goes</h1></div>
        <div className="page-actions">
          <${TS.Seg} label="Week" value=${period} onChange=${(v) => { setPeriod(v); setSelected(null); }} options=${[{ value: 'this', label: 'This week' }, { value: 'next', label: 'Next week' }]} />
          <${TS.Seg} label="Source" value=${mode} onChange=${(v) => { setMode(v); setSelected(null); }} options=${[{ value: 'planned', label: 'Planned' }, { value: 'logged', label: 'Logged' }]} />
        </div>
      </header>
      ${mode === 'logged' && !logs.length && html`<div className="notice" style=${{ marginBottom: '18px' }}><${Icon} name="Info" /><div><strong>No study logged yet.</strong> Check in after sessions and this view fills in. Until then it only shows classes and commitments that have already happened (counted as scheduled; attendance isn’t tracked).</div></div>`}
      <div className="ins-top">
        <${WeekDial} st=${st} data=${data} selected=${selected} onSelect=${setSelected} mode=${mode} />
        <div className="stack" style=${{ gap: '18px', minWidth: 0 }}>
          <div className="legend" role="group" aria-label="Categories">
            ${data.list.map((c) => html`<button key=${c.id} type="button" className="legend-row" aria-pressed=${selected === c.id} onClick=${() => setSelected(selected === c.id ? null : c.id)}>
              <span className="sw" style=${{ background: c.module ? modColor(c.hue) : c.color }}></span>
              <span className="truncate">${c.module ? html`<span className="mono" style=${{ fontSize: '12px' }}>${c.label}</span> ${c.name}` : c.label}</span>
              <span className="v">${T.fmtHours(c.minutes)}</span><span className="v">${Math.round((c.minutes / data.total) * 100)}%</span></button>`)}
            ${data.list.length === 0 && html`<p className="small muted">Nothing to show for this week yet.</p>`}
          </div>
          ${(() => { const c = data.list.find((x) => x.id === selected); if (!c) return html`<p className="xs faint">Outer ring: Monday to Sunday, hour by hour. Solid is fixed time and tint is study.</p>`;
            return html`<div className="breakdown"><b>${c.module ? c.label + ' ' + c.name : c.label}</b>
              ${[...c.items.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => html`<div key=${k} className="row-between"><span className="muted">${k}</span><span className="mono xs">${T.fmtHours(v)}</span></div>`)}
              ${c.module && html`<a className="small" href=${'#module-' + c.id.toLowerCase()}>Open ${c.label}</a>`}</div>`; })()}
        </div>
      </div>

      <div className="ins-grid">
        <section className="panel panel-pad"><h2 className="panel-title" style=${{ marginBottom: '6px' }}>Patterns this week</h2>
          ${insights.length ? insights.map((x, i) => html`<div key=${i} className="insight"><${Icon} name="ArrowRight" size=${15} />${x}</div>`) : html`<p className="small muted">Insights appear once there is something in this week to compare.</p>`}
        </section>
        <section className="panel panel-pad stack-sm"><h2 className="panel-title" style=${{ marginBottom: '6px' }}>Load by day</h2>
          <div className="dayload">${dayTotals.map((tot, i) => { const d = T.addDays(ws, i), e = T.addDays(d, 1); const cls = TS.sum(data.occ.filter((o) => o.source === 'class' && o.start >= d && o.start < e), (o) => (o.end - o.start) / T.MIN); const oth = TS.sum(data.occ.filter((o) => o.source !== 'class' && o.start >= d && o.start < e), (o) => (o.end - o.start) / T.MIN); const stu = tot - cls - oth;
            return html`<div key=${i} className="dayload-row"><span>${T.DOW[i]}</span><div className="bars" role="img" aria-label=${T.DOW_LONG[i] + ': ' + T.fmtHours(cls) + ' classes, ' + T.fmtHours(stu) + ' study, ' + T.fmtHours(oth) + ' other'}>
              <i style=${{ width: (cls / loadMax) * 100 + '%', background: 'var(--text-2)' }}></i><i style=${{ width: (stu / loadMax) * 100 + '%', background: 'var(--accent)' }}></i><i style=${{ width: (oth / loadMax) * 100 + '%', background: 'var(--cat-soc)' }}></i></div><span className="v">${T.fmtHours(tot)}</span></div>`; })}</div>
          <div className="row wrap xs faint" style=${{ gap: '14px', marginTop: '6px' }}><span><span className="cal-legend"><span className="sw" style=${{ background: 'var(--text-2)', borderColor: 'transparent' }}></span></span>Classes</span><span><span className="cal-legend"><span className="sw" style=${{ background: 'var(--accent)', borderColor: 'transparent' }}></span></span>Study</span><span><span className="cal-legend"><span className="sw" style=${{ background: 'var(--cat-soc)', borderColor: 'transparent' }}></span></span>Work & activities</span></div>
        </section>
        <section className="panel panel-pad stack-sm"><h2 className="panel-title" style=${{ marginBottom: '6px' }}>Estimates vs reality</h2>
          ${estRows.length === 0 ? html`<p className="small muted">Log a few sessions with the time they really took, and this compares them with the plan by type of work. It needs at least three of a kind before it says anything.</p>`
          : html`<table className="tbl"><thead><tr><th>Type</th><th>Logged</th><th>Planned</th><th>Actual</th><th>Diff.</th></tr></thead><tbody>
            ${estRows.map(([k, v]) => { const r = v.actual / v.planned - 1; return html`<tr key=${k}><td>${k}</td><td className="mono">${v.n}</td><td className="mono">${T.fmtHours(v.planned)}</td><td className="mono">${T.fmtHours(v.actual)}</td><td className="mono" style=${{ color: Math.abs(r) < 0.1 ? 'var(--text-2)' : r > 0 ? 'var(--warn)' : 'var(--ok)' }}>${r >= 0 ? '+' : '−'}${Math.round(Math.abs(r) * 100)}%${v.n < 3 ? '*' : ''}</td></tr>`; })}
          </tbody></table><span className="xs faint">* fewer than three sessions, so treat as a hint.</span>`}
        </section>
        <section className="panel panel-pad stack-sm"><h2 className="panel-title" style=${{ marginBottom: '6px' }}>Consistency, last 14 days</h2>
          <div className="streak" role="img" aria-label="Logged study per day for the last 14 days">${days14.map((x) => html`<span key=${x.d} title=${T.fmtDate(x.d) + ': ' + (x.min ? T.fmtDur(x.min) : 'nothing logged')} style=${x.min ? { background: `color-mix(in oklab, var(--accent) ${Math.round(25 + (x.min / maxDay) * 75)}%, var(--track))` } : null}></span>`)}</div>
          <p className="small muted">${logs.length ? 'Studied on ' + TS.plural(days14.filter((x) => x.min).length, 'day') + ' of the last 14, ' + T.fmtHours(TS.sum(days14, (x) => x.min)) + ' in total.' : 'Nothing logged yet. Each square fills in on days you check in study.'}</p>
        </section>
      </div>
    </div>`;
  }

  TS.InsightsView = InsightsView;
  TS.analytics = { allocate };
})();
