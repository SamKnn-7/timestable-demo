/* Tasks & deadlines: deadlines, the sessions that serve them, and completed work are separate things. */
(() => {
  const TS = window.TS;
  const { html, Icon, useState, cx } = TS;
  const T = TS.time;
  const A = TS.actions;

  function TaskSheet({ id }) {
    const st = TS.useStore();
    const now = Date.now();
    const t = TS.sel.task(st, id);
    const [est, setEst] = useState(t ? TS.model.taskEstimate(t) : 60);
    const [newSub, setNewSub] = useState('');
    if (!t) return html`<${TS.Sheet} title="Task not found" onClose=${TS.closeOverlay}><p className="muted">It may have been removed.</p><//>`;
    const m = TS.sel.module(st, t.moduleId);
    const p = TS.sel.taskProgress(st, t);
    const sessions = st.sessions.filter((s) => s.taskId === id).sort((a, b) => a.start - b.start);
    const planned = sessions.filter((s) => s.status === 'planned' && s.end > now);
    const unfit = st.planReport && st.planReport.unscheduled.find((u) => u.taskId === id);
    const deps = (t.dependsOn || []).map((d) => TS.sel.task(st, d)).filter(Boolean);
    const estChanged = est !== TS.model.taskEstimate(t);
    const done = t.status === 'done';
    const close = TS.closeOverlay;
    const statusText = { done: 'Done', partial: 'Partly', missed: 'Missed', planned: 'Planned' };
    return html`<${TS.Sheet} onClose=${close} hue=${m ? m.hue : null}
      eyebrow=${html`<${TS.ModTag} module=${m} short /><span>${TS.typeLabel(t.type)}${t.source === 'auto' ? ' · from your timetable' : ' · added by you'}</span>`}
      title=${t.title}
      headExtra=${html`<div className="row wrap" style=${{ gap: '8px' }}>
        <span className="mono small muted">${t.type === 'examprep' ? 'Exam period starts ' + T.fmtDate(t.due) : t.due ? 'Due ' + T.fmtWhen(t.due, now) + ' · ' + T.fmtRel(t.due, now) : 'No deadline'}</span>
        ${t.weight != null && html`<span className="badge">${t.weight}% of ${m ? m.code : 'module'}</span>`}
        ${done && html`<span className="badge badge-ok">Complete</span>`}
      </div>`}
      footer=${html`${done
        ? html`<button className="btn btn-secondary" onClick=${() => A.reopenTask(id)}><${Icon} name="Undo2" />Reopen</button>`
        : html`<button className="btn btn-primary" onClick=${() => { close(); A.completeTask(id); }}><${Icon} name="CircleCheck" />Mark whole task complete</button>`}
        ${t.source === 'user' && html`<button className="btn btn-ghost" onClick=${() => { close(); A.deleteTask(id); }}><${Icon} name="Trash2" />Delete</button>`}`}>
      ${unfit && !done && html`<div className="notice notice-warn"><${Icon} name="TriangleAlert" /><div><strong>${T.fmtDur(unfit.minutes)} of this doesn’t fit before the deadline.</strong> ${unfit.reason.text}</div></div>`}
      ${t.description && html`<p className="small muted">${t.description}</p>`}
      <section className="stack-sm">
        <div className="eyebrow">Progress</div>
        <${TS.Meter} value=${p.pct} hue=${m && m.hue} label="Progress" />
        <div className="row-between small"><span className="muted">${T.fmtDur(p.done)} of work logged</span><span className="mono xs faint">${planned.length ? TS.plural(planned.length, 'session') + ' still planned' : 'No sessions planned'}</span></div>
        <p className="xs faint">Logging a session adds to progress. The task only counts as complete when you say so.</p>
      </section>
      ${!done && html`<section className="stack-sm">
        <div className="eyebrow">Estimate</div>
        <div className="row wrap"><${TS.Stepper} label="Estimate" value=${est} min=${15} max=${2400} step=${est >= 240 ? 30 : 15} format=${(v) => T.fmtDur(v)} onChange=${setEst} />
          ${estChanged && html`<button className="btn btn-primary btn-sm" onClick=${() => A.updateTask(id, { userEstimate: est }, { replan: true })}>Save and replan</button>`}</div>
        ${t.source === 'auto' && html`<span className="xs faint">Suggested ${T.fmtDur(t.estimate)} from the module’s typical workload and your ratings.</span>`}
      </section>`}
      ${(t.subtasks && t.subtasks.length > 0) || !done ? html`<section className="stack-sm">
        <div className="eyebrow">Milestones</div>
        <div className="subtasks">${(t.subtasks || []).map((x) => html`<label key=${x.id} className=${cx('subtask', x.done && 'done')}><input type="checkbox" checked=${x.done} onChange=${() => A.toggleSubtask(id, x.id)} /><span>${x.title}</span></label>`)}</div>
        ${!done && html`<form className="row" onSubmit=${(e) => { e.preventDefault(); if (newSub.trim()) { A.addSubtask(id, newSub.trim()); setNewSub(''); } }}>
          <input className="input" style=${{ height: '32px' }} aria-label="New milestone" placeholder="Add a milestone" value=${newSub} onChange=${(e) => setNewSub(e.target.value)} />
          <button className="btn btn-secondary btn-sm" type="submit">Add</button></form>`}
      </section>` : null}
      ${deps.length > 0 && html`<section className="stack-sm"><div className="eyebrow">Comes after</div>${deps.map((d) => html`<div key=${d.id} className="small">${d.title} ${d.status === 'done' ? html`<span className="badge badge-ok">Done</span>` : ''}</div>`)}</section>`}
      <section className="stack-sm">
        <div className="eyebrow">Sessions</div>
        ${sessions.length === 0 ? html`<p className="small muted">None yet.</p>` : html`<div className="sess-list">${sessions.map((s) => html`<button key=${s.id} type="button" className="sess" style=${{ border: 0, textAlign: 'left', cursor: 'pointer' }} onClick=${() => TS.openOverlay('session', { id: s.id })}>
          <span className="mono">${T.fmtDate(s.start)} ${T.fmtRange(s.start, s.end)}</span>
          <span className=${'badge ' + (s.status === 'done' ? 'badge-ok' : s.status === 'missed' ? 'badge-danger' : s.status === 'partial' ? 'badge-warn' : s.end <= now ? 'badge-warn' : '')}>${s.status === 'planned' && s.end <= now ? 'Check in' : statusText[s.status]}</span>
        </button>`)}</div>`}
      </section>
    <//>`;
  }
  TS.TaskSheet = TaskSheet;

  function TaskRow({ t, st, now }) {
    const m = TS.sel.module(st, t.moduleId);
    const p = TS.sel.taskProgress(st, t);
    const planned = st.sessions.filter((s) => s.taskId === t.id && s.status === 'planned' && s.end > now).length;
    const unfit = st.planReport && st.planReport.unscheduled.find((u) => u.taskId === t.id && !u.flexible);
    const done = t.status === 'done';
    const dueCls = t.due && !done ? (t.due < now ? 'overdue' : t.due - now < 2 * T.DAY ? 'soon' : '') : '';
    return html`<div className=${cx('task', done && 'is-done')}>
      <button type="button" className="task-check" role="checkbox" aria-checked=${done} aria-label=${(done ? 'Reopen ' : 'Complete ') + t.title}
        onClick=${() => (done ? A.reopenTask(t.id) : A.completeTask(t.id))}><${Icon} name="Check" size=${13} stroke=${3} /></button>
      <div className="task-main" role="button" tabIndex="0" onClick=${() => TS.openOverlay('task', { id: t.id })} onKeyDown=${(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), TS.openOverlay('task', { id: t.id }))}>
        <span className="task-title">${t.title}</span>
        <span className="task-sub">
          ${m && html`<span className="row m" style=${{ gap: '5px', '--h': m.hue }}><span className="pip"></span><span className="mono">${m.code}</span></span>`}
          <span>${TS.typeLabel(t.type)}</span>
          ${t.weight != null && html`<span>${t.weight}%</span>`}
          ${!done && html`<span>${planned ? TS.plural(planned, 'session') + ' planned' : 'No sessions planned'}</span>`}
          ${unfit && !done && html`<span style=${{ color: 'var(--warn)' }}><${Icon} name="TriangleAlert" size=${11} /> ${T.fmtDur(unfit.minutes)} won’t fit</span>`}
        </span>
      </div>
      <span className=${cx('task-due task-due-col', dueCls)}>${t.type === 'examprep' ? 'From ' + T.fmtDate(t.due) : t.due ? T.fmtWhen(t.due, now) : '—'}</span>
      <div className="task-progress"><${TS.Meter} value=${p.pct} hue=${m ? m.hue : null} thin label="Progress" /><span>${T.fmtDur(p.done)} / ${T.fmtDur(p.est)}</span></div>
      <button className="btn btn-ghost btn-icon btn-sm" aria-label=${'Open ' + t.title} onClick=${() => TS.openOverlay('task', { id: t.id })}><${Icon} name="ChevronRight" /></button>
    </div>`;
  }

  function TasksView() {
    const st = TS.useStore();
    const now = TS.useNow(60000);
    const [status, setStatus] = useState('open');
    const [mod, setMod] = useState('all');
    const [kind, setKind] = useState('deadlines');
    const ws = T.weekStart(now);
    let list = st.tasks.filter((t) => (status === 'all' || (status === 'open' ? t.status !== 'done' : t.status === 'done')) && (mod === 'all' || t.moduleId === mod));
    if (kind === 'deadlines') list = list.filter((t) => t.assessmentId || t.source === 'user' || t.type === 'labreport' || t.type === 'prelab' || (t.type === 'problems' && t.anchorKey));
    list = list.filter((t) => !t.orphan || t.status === 'done');
    const groups = [
      ['Overdue', (t) => t.due && t.due < now && t.status !== 'done'],
      ['This week', (t) => t.due && t.due >= now && t.due < T.addDays(ws, 7)],
      ['Next week', (t) => t.due && t.due >= T.addDays(ws, 7) && t.due < T.addDays(ws, 14)],
      ['Later', (t) => t.due && t.due >= T.addDays(ws, 14)],
      ['No deadline', (t) => !t.due],
      ['Earlier', (t) => t.due && t.due < now && t.status === 'done'],
    ];
    const used = new Set();
    const exams = st.assessments.filter((a) => a.kind === 'exam');
    return html`<div className="page">
      <header className="page-head">
        <div><h1 className="h1">Tasks and deadlines</h1></div>
        <div className="page-actions"><button className="btn btn-primary btn-sm" onClick=${() => TS.openOverlay('addTask', mod !== 'all' ? { moduleId: mod } : {})}><${Icon} name="Plus" />Add task</button></div>
      </header>
      <${TS.ProposalBanner} />
      <div className="row wrap" style=${{ gap: '10px', marginBottom: '18px' }}>
        <${TS.Seg} label="Which tasks" value=${kind} onChange=${setKind} options=${[{ value: 'deadlines', label: 'Deadlines' }, { value: 'all', label: 'Everything' }]} />
        <${TS.Seg} label="Status" value=${status} onChange=${setStatus} options=${[{ value: 'open', label: 'Open' }, { value: 'done', label: 'Done' }, { value: 'all', label: 'All' }]} />
        <select className="select" style=${{ width: 'auto', height: '36px' }} aria-label="Module" value=${mod} onChange=${(e) => setMod(e.target.value)}>
          <option value="all">All modules</option>${st.modules.map((m) => html`<option key=${m.id} value=${m.id}>${m.code} ${m.name}</option>`)}
        </select>
        <span className="small faint" style=${{ marginLeft: 'auto' }}>${kind === 'deadlines' ? 'Weekly reviews and recall are under Everything.' : ''}</span>
      </div>
      <div className="tasks-layout">
        ${groups.map(([label, fn]) => {
          const items = list.filter((t) => !used.has(t.id) && fn(t)).sort((a, b) => (a.due || Infinity) - (b.due || Infinity));
          items.forEach((t) => used.add(t.id));
          if (!items.length) return null;
          return html`<section key=${label} className="task-group" aria-label=${label}>
            <div className="task-group-head"><h2 className="h3">${label}</h2><span className="small faint">${items.length}</span></div>
            ${items.map((t) => html`<${TaskRow} key=${t.id} t=${t} st=${st} now=${now} />`)}
          </section>`;
        })}
        ${list.length === 0 && html`<${TS.Empty} icon="ListChecks" title=${status === 'done' ? 'Nothing completed yet' : 'No open tasks here'} action=${html`<button className="btn btn-secondary btn-sm" onClick=${() => TS.openOverlay('addTask')}><${Icon} name="Plus" />Add a task</button>`}>${status === 'done' ? 'Finished tasks show up here.' : 'Add a deadline and it gets planned into your week.'}<//>`}
        ${exams.length > 0 && kind === 'deadlines' && status !== 'done' && html`<section className="task-group"><div className="task-group-head"><h2 className="h3">Exams</h2><span className="small faint">${exams.length}</span></div>
          <div className="notice"><${Icon} name="CalendarClock" /><div>${exams.map((a) => a.moduleId + (a.weight != null ? ' (' + a.weight + '%)' : '')).join(', ')}: dates not published yet. Exam revision for each one is in your plan under Everything.</div></div></section>`}
      </div>
    </div>`;
  }

  TS.TasksView = TasksView;
})();
