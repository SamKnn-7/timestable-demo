/* Sheets and dialogs used across views. Opened through TS.openOverlay(kind, props). */
(() => {
  const TS = window.TS;
  const { html, Icon, useState, useMemo, cx } = TS;
  const T = TS.time;
  const A = TS.actions;

  const dateInputValue = (t) => T.dateKey(t);
  const parseDateInput = (v) => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };

  /* ---------------- Session ---------------- */
  function CheckInForm({ s, onDone, initial = 'done', elapsedMin }) {
    const planned = (s.end - s.start) / T.MIN;
    const [status, setStatus] = useState(initial);
    const [actual, setActual] = useState(Math.max(5, Math.round((elapsedMin || planned) / 5) * 5));
    const [fraction, setFraction] = useState(0.5);
    const save = () => { A.checkIn(s.id, status, { actualMin: status === 'missed' ? 0 : actual, fraction }); onDone && onDone(); };
    return html`<div className="stack" style=${{ gap: '12px' }}>
      <${TS.Seg} block label="How did it go?" value=${status} onChange=${setStatus} options=${[{ value: 'done', label: 'Done' }, { value: 'partial', label: 'Partly done' }, { value: 'missed', label: 'Didn’t happen' }]} />
      ${status === 'partial' && html`<div className="field"><span className="field-label">How much of the planned work got done?</span>
        <${TS.Seg} label="Share done" value=${fraction} onChange=${setFraction} options=${[{ value: 0.25, label: 'A quarter' }, { value: 0.5, label: 'About half' }, { value: 0.75, label: 'Most of it' }]} /></div>`}
      ${status !== 'missed' && html`<div className="field"><span className="field-label">Time actually spent</span>
        <div className="row"><${TS.Stepper} label="Minutes spent" value=${actual} min=${5} max=${300} step=${5} format=${(v) => T.fmtDur(v)} onChange=${setActual} />
        <span className="xs faint">Planned ${T.fmtDur(planned)}. This trains your estimates.</span></div></div>`}
      ${status === 'missed' && html`<p className="small muted">No problem. TimeStable will suggest a new slot for this work; you approve it before anything moves.</p>`}
      <div><button className="btn btn-primary" onClick=${save}>${status === 'missed' ? 'Find a new slot' : 'Save check-in'}</button></div>
    </div>`;
  }

  function MoveForm({ s, onDone }) {
    const st = TS.useStore();
    const now = Date.now();
    const [day, setDay] = useState(dateInputValue(s.start));
    const [time, setTime] = useState(T.hm(s.start));
    const dur = s.end - s.start;
    const start = T.at(parseDateInput(day), time);
    const check = TS.engine.checkMove(st, s, start, start + dur, now);
    return html`<div className="stack" style=${{ gap: '10px' }}>
      <div className="row wrap">
        <input className="input" type="date" aria-label="Day" style=${{ width: '170px' }} value=${day} min=${dateInputValue(now)} onChange=${(e) => e.target.value && setDay(e.target.value)} />
        <${TS.TimeInput} label="Start time" value=${time} onChange=${setTime} />
        <span className="small faint mono">to ${T.hm(start + dur)}</span>
      </div>
      ${!check.ok && html`<div className="field-error">${check.error}</div>`}
      ${check.ok && check.warnings.map((w) => html`<div key=${w} className="notice notice-warn" style=${{ padding: '8px 12px' }}><${Icon} name="TriangleAlert" /><div>${w}</div></div>`)}
      <div className="row"><button className="btn btn-primary btn-sm" disabled=${!check.ok} onClick=${() => { if (A.moveSession(s.id, start, start + dur)) onDone(); }}>Move and pin</button>
        <span className="xs faint">Pinned sessions stay put when the plan changes.</span></div>
    </div>`;
  }

  function SessionSheet({ id, mode: initialMode }) {
    const st = TS.useStore();
    const now = TS.useNow(15000);
    const [mode, setMode] = useState(initialMode || null);
    const s = TS.sel.session(st, id);
    if (!s) return html`<${TS.Sheet} title="Session not found" onClose=${TS.closeOverlay}><p className="muted">It may have been replanned. Close this and pick it again.</p><//>`;
    const t = TS.sel.task(st, s.taskId);
    const m = TS.sel.module(st, s.moduleId);
    const warnings = t ? TS.engine.sessionWarnings(st, s) : ['Its task no longer exists, so this session isn’t needed.'];
    const active = st.active && st.active.sessionId === id;
    const past = s.end <= now;
    const prog = t ? TS.sel.taskProgress(st, t) : null;
    const elapsed = active ? Math.round((now - st.active.startedAt) / T.MIN) : null;
    const statusBadge = { done: ['badge-ok', 'Done'], partial: ['badge-warn', 'Partly done'], missed: ['badge-danger', 'Missed'] }[s.status];
    const close = TS.closeOverlay;
    return html`<${TS.Sheet} onClose=${close} hue=${m ? m.hue : null}
      eyebrow=${html`<${TS.ModTag} module=${m} short /><span>${TS.typeLabel(s.type)}${s.parts > 1 ? ' · part ' + s.part + ' of ' + s.parts : ''}</span>`}
      title=${s.title}
      headExtra=${html`<div className="row wrap" style=${{ gap: '8px' }}>
        <span className="mono small muted">${T.fmtDate(s.start)} · ${T.fmtRange(s.start, s.end)} · ${T.fmtDur((s.end - s.start) / T.MIN)}</span>
        ${statusBadge && html`<span className=${'badge ' + statusBadge[0]}>${statusBadge[1]}${s.actualMin ? ' · ' + T.fmtDur(s.actualMin) : ''}</span>`}
        ${s.pinned && html`<span className="badge badge-accent"><${Icon} name="Pin" size=${11} />Pinned by you</span>`}
        ${s.usedFlex && html`<span className="badge">Uses flex time</span>`}
      </div>`}
      footer=${s.status === 'planned' ? html`
        ${!past && !active && s.start - now < 2 * T.HOUR && html`<button className="btn btn-primary" onClick=${() => A.startSession(id)}><${Icon} name="Play" />Start now</button>`}
        ${active && html`<button className="btn btn-primary" onClick=${() => setMode('checkin')}><${Icon} name="Square" />Finish (${T.fmtDur(Math.max(1, elapsed))})</button>`}
        <button className="btn btn-secondary" onClick=${() => setMode(mode === 'checkin' ? null : 'checkin')}><${Icon} name="Check" />${past ? 'Check in' : 'Log it'}</button>
        ${!past && html`<button className="btn btn-secondary" onClick=${() => setMode(mode === 'move' ? null : 'move')}><${Icon} name="CalendarClock" />Move</button>`}
        <${TS.Menu} label="More actions" items=${[
          { label: s.pinned ? 'Unpin (let replans move it)' : 'Pin to this time', icon: s.pinned ? 'PinOff' : 'Pin', run: () => A.togglePin(id) },
          ...(t ? [{ label: 'Needs 30 more minutes', icon: 'Hourglass', run: () => { close(); A.needsMoreTime(t.id, 30); } }, { label: 'Needs 1 more hour', icon: 'Hourglass', run: () => { close(); A.needsMoreTime(t.id, 60); } }] : []),
          ...(!past ? [{ label: 'Skip this session', icon: 'CircleX', run: () => { close(); A.checkIn(id, 'missed'); } }] : []),
        ]} />` : html`<button className="btn btn-secondary" onClick=${() => A.undoCheckIn(id)}><${Icon} name="Undo2" />Undo check-in</button>`}>
      ${warnings.length > 0 && html`<div className="notice notice-warn"><${Icon} name="TriangleAlert" /><div>${warnings.join('. ')}.</div></div>`}
      ${mode === 'checkin' && html`<section className="panel panel-pad"><${CheckInForm} s=${s} elapsedMin=${elapsed} onDone=${close} /></section>`}
      ${mode === 'move' && html`<section className="panel panel-pad"><${MoveForm} s=${s} onDone=${() => setMode(null)} /></section>`}
      ${s.why && html`<section className="why"><b>Why it’s here</b><span>${s.why}</span></section>`}
      ${t && html`<section className="stack-sm">
        <div className="eyebrow">Task</div>
        <div className="row-between"><span style=${{ fontWeight: 600 }}>${t.title}</span>${t.weight != null && html`<span className="badge">${t.weight}%</span>`}</div>
        <dl className="kv">
          <dt>${t.type === 'examprep' ? 'Exam period' : 'Deadline'}</dt><dd className="mono small">${t.type === 'examprep' ? 'Starts ' + T.fmtDate(t.due) : t.due ? T.fmtWhen(t.due, now) + ' (' + T.fmtRel(t.due, now) + ')' : 'No deadline'}</dd>
          <dt>Progress</dt><dd><div className="stack-sm" style=${{ gap: '6px' }}><${TS.Meter} value=${prog.pct} hue=${m && m.hue} label="Task progress" /><span className="xs faint">${T.fmtDur(prog.done)} of ${T.fmtDur(prog.est)} estimated</span></div></dd>
          ${t.description && html`<dt>Notes</dt><dd className="small muted">${t.description}</dd>`}
        </dl>
        ${t.subtasks && t.subtasks.length > 0 && html`<div className="subtasks">${t.subtasks.map((x) => html`<label key=${x.id} className=${cx('subtask', x.done && 'done')}><input type="checkbox" checked=${x.done} onChange=${() => A.toggleSubtask(t.id, x.id)} /><span>${x.title}</span></label>`)}</div>`}
        ${t.type === 'prelab' && m && m.labChecklist && html`<div className="aid"><div className="aid-head"><${Icon} name="ListChecks" /><span className="small" style=${{ fontWeight: 600 }}>Pre-lab checklist</span><span className="xs faint" style=${{ marginLeft: 'auto' }}>From the lab sheet</span></div><div className="aid-body"><ol>${m.labChecklist.map((c) => html`<li key=${c}>${c}</li>`)}</ol></div></div>`}
        <div><button className="link-btn small" onClick=${() => { close(); TS.go('tasks'); setTimeout(() => TS.openOverlay('task', { id: t.id }), 50); }}>Open task details</button></div>
      </section>`}
    <//>`;
  }

  /* ---------------- Fixed occurrence ---------------- */
  function OccurrenceSheet({ occKey, from }) {
    const st = TS.useStore();
    const now = Date.now();
    const [mode, setMode] = useState(null);
    const occ = useMemo(() => TS.model.expandFixed(st, T.addDays(from, -1), T.addDays(from, 3)).find((o) => o.key === occKey), [st, occKey, from]);
    const [day, setDay] = useState(occ ? dateInputValue(occ.start) : '');
    const [start, setStart] = useState(occ ? T.hm(occ.start) : '09:00');
    const [end, setEnd] = useState(occ ? T.hm(occ.end) : '10:00');
    const [note, setNote] = useState('');
    if (!occ) return html`<${TS.Sheet} title="Not found" onClose=${TS.closeOverlay}><p className="muted">This event no longer exists.</p><//>`;
    const close = TS.closeOverlay;
    const m = occ.moduleId ? TS.sel.module(st, occ.moduleId) : null;
    const related = st.tasks.filter((t) => t.anchorKey === occ.key);
    const hasEx = st.exceptions.some((e) => e.key === occ.key);
    const newStart = day ? T.at(parseDateInput(day), start) : 0;
    const newEnd = day ? T.at(parseDateInput(day), end) : 0;
    const isClass = occ.source === 'class';
    return html`<${TS.Sheet} onClose=${close} hue=${m ? m.hue : null}
      eyebrow=${html`${m && html`<${TS.ModTag} module=${m} short />`}<span>${isClass ? 'Fixed class' : occ.source === 'block' ? 'Unavailable' : 'Fixed commitment'}</span>`}
      title=${isClass ? m.name + ' · ' + TS.model.KIND_LABEL[occ.kind] : occ.title}
      headExtra=${html`<div className="row wrap" style=${{ gap: '8px' }}>
        <span className="mono small muted">${T.fmtDate(occ.start)} · ${T.fmtRange(occ.start, occ.end)}${occ.room ? ' · ' + occ.room : ''}</span>
        ${occ.cancelled && html`<span className="badge badge-danger">Cancelled</span>`}${occ.moved && html`<span className="badge badge-accent">Moved</span>`}
      </div>`}
      footer=${isClass ? html`
        ${hasEx ? html`<button className="btn btn-secondary" onClick=${() => { close(); A.restoreOccurrence(occ.key); }}><${Icon} name="Undo2" />Restore usual time</button>` : html`
          <button className="btn btn-secondary" onClick=${() => setMode(mode === 'cancel' ? null : 'cancel')}><${Icon} name="CalendarX" />It’s cancelled</button>
          <button className="btn btn-secondary" onClick=${() => setMode(mode === 'move' ? null : 'move')}><${Icon} name="CalendarClock" />It moved</button>`}`
        : occ.source === 'block' ? html`<button className="btn btn-danger" onClick=${() => { close(); A.removeBlock(occ.blockId); }}><${Icon} name="Trash2" />Remove</button>`
        : html`<button className="btn btn-secondary" onClick=${() => { close(); TS.go('preferences'); }}>Edit commitments</button>`}>
      <div className="notice"><${Icon} name="Lock" /><div>${isClass ? 'Classes are fixed. TimeStable never moves them; tell it when the university does.' : 'Fixed commitments are never moved by the planner.'}</div></div>
      ${occ.note && html`<div className="notice notice-accent"><${Icon} name="Info" /><div>${occ.note}</div></div>`}
      ${mode === 'cancel' && html`<section className="panel panel-pad stack" style=${{ gap: '10px' }}>
        <div className="field"><label className="field-label" htmlFor="oc-note">Note (optional)</label><input id="oc-note" className="input" value=${note} placeholder="e.g. Lecturer ill, recording on Loop" onChange=${(e) => setNote(e.target.value)} /></div>
        <div><button className="btn btn-primary btn-sm" onClick=${() => { close(); A.cancelOccurrence(occ, note); }}>Mark this one cancelled</button></div>
        <p className="xs faint">Only ${T.fmtDate(occ.start)} is affected. Work that depended on it gets re-checked.</p>
      </section>`}
      ${mode === 'move' && html`<section className="panel panel-pad stack" style=${{ gap: '10px' }}>
        <div className="row wrap"><input className="input" type="date" aria-label="New day" style=${{ width: '170px' }} value=${day} onChange=${(e) => e.target.value && setDay(e.target.value)} />
          <${TS.TimeInput} label="New start" value=${start} onChange=${setStart} /><span className="faint">–</span><${TS.TimeInput} label="New end" value=${end} onChange=${setEnd} invalid=${newEnd <= newStart} /></div>
        <div className="field"><label className="field-label" htmlFor="om-note">Note (optional)</label><input id="om-note" className="input" value=${note} placeholder="e.g. Lab swapped with Group B" onChange=${(e) => setNote(e.target.value)} /></div>
        <div><button className="btn btn-primary btn-sm" disabled=${newEnd <= newStart} onClick=${() => { close(); A.moveOccurrence(occ, newStart, newEnd, note); }}>Save the new time</button></div>
      </section>`}
      ${isClass && html`<dl className="kv">
        <dt>Module</dt><dd>${m.code} ${m.name}</dd>
        ${m.lecturer && html`<dt>Lecturer</dt><dd>${m.lecturer}</dd>`}
        <dt>Room</dt><dd>${occ.room || html`<span className="badge badge-warn">TBC</span>`}</dd>
        <dt>Teaching week</dt><dd className="mono small">Week ${occ.teachingWeek}</dd>
      </dl>`}
      ${related.length > 0 && html`<section className="stack-sm"><div className="eyebrow">Work tied to this ${occ.kind}</div>
        ${related.map((t) => { const ss = st.sessions.filter((x) => x.taskId === t.id && x.status === 'planned'); return html`<div key=${t.id} className="sess" style=${{ gridTemplateColumns: '1fr auto' }}>
          <span><${Icon} name=${TS.typeIcon(t.type)} size=${14} /> ${t.title}</span>
          <span className="mono">${ss.length ? ss.map((x) => T.fmtDate(x.start) + ' ' + T.hm(x.start)).join(', ') : t.status === 'done' ? 'Done' : 'Not placed'}</span></div>`; })}
      </section>`}
    <//>`;
  }

  /* ---------------- Replan proposal ---------------- */
  function ReplanSheet() {
    const st = TS.useStore();
    const p = st.proposal;
    if (!p) return null;
    const mod = (id) => TS.sel.module(st, id);
    const counts = { moved: 0, added: 0, removed: 0 };
    p.diff.changes.forEach((c) => counts[c.type]++);
    const label = { moved: 'Moved', added: 'Added', removed: 'Removed' };
    return html`<${TS.Sheet} onClose=${() => A.hideProposal()} eyebrow=${html`<${Icon} name="RefreshCw" size=${14} /><span>Proposed change to your plan</span>`} title=${p.reason}
      headExtra=${p.detail && html`<p className="small muted">${p.detail}</p>`}
      footer=${html`<button className="btn btn-primary" onClick=${() => { TS.closeOverlay(); A.acceptProposal(); }}><${Icon} name="Check" />Apply ${TS.plural(p.diff.changes.length, 'change')}</button>
        <button className="btn btn-secondary" onClick=${() => { TS.closeOverlay(); A.rejectProposal(); }}>Keep my current plan</button>`}>
      <div className="row wrap" style=${{ gap: '8px' }}>
        ${counts.moved > 0 && html`<span className="badge badge-accent">${counts.moved} moved</span>`}
        ${counts.added > 0 && html`<span className="badge badge-ok">${counts.added} added</span>`}
        ${counts.removed > 0 && html`<span className="badge badge-danger">${counts.removed} removed</span>`}
        <span className="badge">${p.diff.unchanged} unchanged</span>
      </div>
      ${p.warning && html`<div className="notice notice-warn"><${Icon} name="TriangleAlert" /><div>${p.warning}</div></div>`}
      <p className="small muted">Classes, shifts and anything you pinned stay where they are${p.plan.report.released.length ? ', except where a pinned session now clashes with a class (marked below)' : ''}. Nothing changes until you apply it.</p>
      <div className="diff-list">
        ${p.diff.changes.map((c, i) => { const m = mod(c.moduleId); return html`<div key=${i} className=${'diff ' + c.type}>
          <span className="tag">${label[c.type]}</span>
          <div className="stack-sm" style=${{ gap: '3px', minWidth: 0 }}>
            <div className="row" style=${{ gap: '8px' }}>${m && html`<${TS.Pip} hue=${m.hue} />`}<span className="truncate" style=${{ fontWeight: 600 }}>${c.title}</span></div>
            <span className="times">${c.type === 'moved' ? html`<s>${T.fmtDate(c.from.start)} ${T.hm(c.from.start)}</s> → ${T.fmtDate(c.to.start)} ${T.fmtRange(c.to.start, c.to.end)}` : c.type === 'added' ? html`${T.fmtDate(c.to.start)} ${T.fmtRange(c.to.start, c.to.end)}` : html`<s>${T.fmtDate(c.from.start)} ${T.fmtRange(c.from.start, c.from.end)}</s>${c.wasPinned ? '' : p.plan.tasks.some((t) => t.id === c.taskId && t.status !== 'done') ? ' · can’t stay at this time' : ' · no longer needed'}`}</span>
            ${c.wasPinned && html`<span className="xs" style=${{ color: 'var(--warn)' }}>You had pinned this. It clashes with a fixed class now.</span>`}
          </div></div>`; })}
        ${(p.unfit || []).map((u) => html`<div key=${u.taskId} className="diff unfit"><span className="tag">Won’t fit</span><div className="stack-sm" style=${{ gap: '3px' }}><span style=${{ fontWeight: 600 }}>${u.title}</span><span className="xs muted">${T.fmtDur(u.minutes)} short before ${T.fmtWhen(u.due)}. ${u.reason.text}</span></div></div>`)}
      </div>
    <//>`;
  }

  /* ---------------- Add task ---------------- */
  function AddTaskDialog({ moduleId }) {
    const st = TS.useStore();
    const mods = st.modules.filter((m) => m.include !== false);
    const now = Date.now();
    const [f, setF] = useState({ title: '', moduleId: moduleId || (mods[0] && mods[0].id), type: 'assignment', hasDue: true, dueDay: dateInputValue(T.addDays(now, 5)), dueTime: '17:00', estimate: 120, weight: '', dependsOn: '', description: '' });
    const [err, setErr] = useState(null);
    const set = (patch) => setF({ ...f, ...patch });
    const deps = st.tasks.filter((t) => t.status !== 'done' && t.moduleId === f.moduleId);
    const submit = (e) => {
      e && e.preventDefault();
      if (!f.title.trim()) { setErr('Give the task a name.'); return; }
      const due = f.hasDue ? T.at(parseDateInput(f.dueDay), f.dueTime) : null;
      if (due && due <= now) { setErr('The deadline is in the past.'); return; }
      if (f.weight !== '' && (isNaN(+f.weight) || +f.weight < 0 || +f.weight > 100)) { setErr('Weight must be between 0 and 100.'); return; }
      TS.closeOverlay();
      A.addTask({ ...f, due, dependsOn: f.dependsOn ? [f.dependsOn] : [] });
    };
    return html`<${TS.Dialog} title="Add a task or deadline" sub="It gets split into sessions and placed around your week. You’ll see the changes before they’re applied." onClose=${TS.closeOverlay} icon="ListTodo"
      footer=${html`<button className="btn btn-ghost" onClick=${TS.closeOverlay}>Cancel</button><button className="btn btn-primary" onClick=${submit}>Add and plan it</button>`}>
      <form className="form-grid" onSubmit=${submit}>
        <div className="field span-2"><label className="field-label" htmlFor="at-title">What is it?</label><input id="at-title" className="input" data-autofocus value=${f.title} placeholder="e.g. Problem set 4" onChange=${(e) => set({ title: e.target.value })} /></div>
        <div className="field"><label className="field-label" htmlFor="at-mod">Module</label><select id="at-mod" className="select" value=${f.moduleId} onChange=${(e) => set({ moduleId: e.target.value, dependsOn: '' })}>${mods.map((m) => html`<option key=${m.id} value=${m.id}>${m.code} ${m.name}</option>`)}</select></div>
        <div className="field"><label className="field-label" htmlFor="at-type">Type</label><select id="at-type" className="select" value=${f.type} onChange=${(e) => set({ type: e.target.value })}>${['assignment', 'programming', 'problems', 'labreport', 'reading', 'revision'].map((k) => html`<option key=${k} value=${k}>${TS.typeLabel(k)}</option>`)}</select></div>
        <div className="field span-2"><${TS.Switch} id="at-hasdue" checked=${f.hasDue} onChange=${(v) => set({ hasDue: v })} label="It has a deadline" /></div>
        ${f.hasDue && html`<div className="field"><span className="field-label">Deadline</span><div className="row"><input className="input" type="date" aria-label="Due date" value=${f.dueDay} min=${dateInputValue(now)} onChange=${(e) => e.target.value && set({ dueDay: e.target.value })} /><${TS.TimeInput} label="Due time" value=${f.dueTime} onChange=${(v) => set({ dueTime: v })} /></div></div>`}
        ${f.hasDue && html`<div className="field"><label className="field-label" htmlFor="at-w">Weight <span className="faint" style=${{ fontWeight: 400 }}>(% of module, optional)</span></label><input id="at-w" className="input mono" inputMode="numeric" value=${f.weight} onChange=${(e) => set({ weight: e.target.value.replace(/[^\d.]/g, '') })} /></div>`}
        <div className="field"><span className="field-label">Estimated effort</span><${TS.Stepper} label="Estimate" value=${f.estimate} min=${15} max=${1800} step=${f.estimate >= 240 ? 60 : 15} format=${(v) => T.fmtDur(v)} onChange=${(v) => set({ estimate: v })} /><span className="field-hint">Your ratings for this module adjust future suggestions, not this number.</span></div>
        <div className="field"><label className="field-label" htmlFor="at-dep">Must come after <span className="faint" style=${{ fontWeight: 400 }}>(optional)</span></label><select id="at-dep" className="select" value=${f.dependsOn} onChange=${(e) => set({ dependsOn: e.target.value })}><option value="">Nothing</option>${deps.map((t) => html`<option key=${t.id} value=${t.id}>${t.title}</option>`)}</select></div>
        <div className="field span-2"><label className="field-label" htmlFor="at-desc">Notes <span className="faint" style=${{ fontWeight: 400 }}>(optional)</span></label><textarea id="at-desc" className="textarea" style=${{ minHeight: '64px' }} value=${f.description} onChange=${(e) => set({ description: e.target.value })}></textarea></div>
        ${err && html`<div className="field-error span-2" role="alert">${err}</div>`}
        <button type="submit" hidden>Add</button>
      </form>
    <//>`;
  }

  /* ---------------- Unavailable ---------------- */
  function UnavailableDialog({ day }) {
    const now = Date.now();
    const [d, setD] = useState(dateInputValue(day || now));
    const [start, setStart] = useState('14:00');
    const [end, setEnd] = useState('18:00');
    const [note, setNote] = useState('');
    const s = T.at(parseDateInput(d), start), e = T.at(parseDateInput(d), end);
    const bad = e <= s;
    return html`<${TS.Dialog} title="Mark yourself unavailable" sub="Sessions in this time move elsewhere. Classes aren’t changed; cancel those separately if needed." icon="Ban" onClose=${TS.closeOverlay}
      footer=${html`<button className="btn btn-ghost" onClick=${TS.closeOverlay}>Cancel</button><button className="btn btn-primary" disabled=${bad} onClick=${() => { TS.closeOverlay(); A.addBlock(s, e, note.trim() || 'Unavailable'); }}>Block this time</button>`}>
      <div className="row wrap"><input className="input" type="date" aria-label="Day" style=${{ width: '170px' }} value=${d} min=${dateInputValue(now)} onChange=${(ev) => ev.target.value && setD(ev.target.value)} />
        <${TS.TimeInput} label="From" value=${start} onChange=${setStart} /><span className="faint">–</span><${TS.TimeInput} label="Until" value=${end} onChange=${setEnd} invalid=${bad} /></div>
      ${bad && html`<div className="field-error">The end must be after the start.</div>`}
      <div className="field"><label className="field-label" htmlFor="ua-note">Reason (only you see this)</label><input id="ua-note" className="input" value=${note} placeholder="e.g. Dentist, travelling home" onChange=${(ev) => setNote(ev.target.value)} /></div>
    <//>`;
  }

  function OverlayHost() {
    const ov = TS.useOverlay();
    const proposal = TS.useStore((s) => s.proposal);
    if (ov) {
      const P = ov.props;
      switch (ov.kind) {
        case 'session': return html`<${SessionSheet} key=${ov.key} ...${P} />`;
        case 'occurrence': return html`<${OccurrenceSheet} key=${ov.key} ...${P} />`;
        case 'addTask': return html`<${AddTaskDialog} key=${ov.key} ...${P} />`;
        case 'unavailable': return html`<${UnavailableDialog} key=${ov.key} ...${P} />`;
        case 'task': return TS.TaskSheet ? html`<${TS.TaskSheet} key=${ov.key} ...${P} />` : null;
        default: return null;
      }
    }
    if (proposal && proposal.open) return html`<${ReplanSheet} />`;
    return null;
  }

  Object.assign(TS, { OverlayHost, CheckInForm, parseDateInput, dateInputValue });
})();
