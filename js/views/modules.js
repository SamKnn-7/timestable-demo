/* Modules overview + per-module workspace. */
(() => {
  const TS = window.TS;
  const { html, Icon, useState, cx } = TS;
  const T = TS.time;
  const A = TS.actions;

  function moduleStats(st, m, now) {
    const ws = T.weekStart(now), we = T.addDays(ws, 7);
    const week = st.sessions.filter((s) => s.moduleId === m.id && s.start >= ws && s.start < we);
    const next = st.tasks.filter((t) => t.moduleId === m.id && t.status !== 'done' && t.due && t.due > now && (t.assessmentId || t.type === 'labreport' || t.type === 'prelab' || t.source === 'user')).sort((a, b) => a.due - b.due)[0];
    return {
      contact: TS.model.contactMinutesPerWeek(st, m.id),
      planned: TS.sum(week, (s) => (s.end - s.start) / T.MIN),
      logged: TS.sum(st.log.filter((l) => l.moduleId === m.id), (l) => l.actualMin || 0),
      guide: TS.model.independentTargetPerWeek(st, m),
      next,
    };
  }

  function ModulesView() {
    const st = TS.useStore();
    const now = Date.now();
    const mods = st.modules;
    return html`<div className="page">
      <header className="page-head">
        <div><h1 className="h1">Modules</h1><p className="page-sub">${st.profile ? st.profile.programmeName + ', Year ' + st.profile.year : 'Modules'}</p></div>
        <div className="page-actions"><a className="btn btn-secondary btn-sm" href="#explore"><${Icon} name="Compass" />${st.semester && st.semester.official ? 'Module reviews' : 'Explore next year\u2019s modules'}</a></div>
      </header>
      <div className="mod-grid">
        ${mods.map((m) => { const s = moduleStats(st, m, now); return html`<a key=${m.id} href=${'#module-' + m.id.toLowerCase()} className="mod-card m" style=${{ '--h': m.hue, opacity: m.include === false ? 0.5 : 1 }}>
          <div className="row-between"><span className="row" style=${{ gap: '8px' }}><span className="pip pip-lg"></span><span className="mcode" style=${{ fontSize: '12.5px' }}>${m.code}</span></span><span className="xs faint">${m.ects} ECTS</span></div>
          <div><div className="mod-name">${m.name}</div><div className="xs faint" style=${{ marginTop: '3px' }}>${m.lecturer || 'Lecturer not listed'}</div></div>
          <div className="mod-stats"><div><b>${T.fmtHours(s.contact)}</b>classes / wk</div><div><b>${T.fmtHours(s.planned)}</b>study this wk</div><div><b>${['', 'Low', 'OK', 'High'][m.confidence]}</b>confidence</div></div>
          <div className="xs muted" style=${{ borderTop: '1px solid var(--line)', paddingTop: '10px' }}>${s.next ? html`Next: ${s.next.title} · <span className="mono">${T.fmtWhen(s.next.due, now)}</span>` : 'No upcoming deadlines'}</div>
        </a>`; })}
      </div>
    </div>`;
  }

  function Flashcards({ m }) {
    const [i, setI] = useState(0);
    const [flip, setFlip] = useState(false);
    const topics = m.topics || [];
    if (!topics.length) return null;
    const t = topics[i % topics.length];
    return html`<div className="stack-sm">
      <button type="button" className=${cx('flashcard', flip && 'flipped')} onClick=${() => setFlip(!flip)} aria-label=${flip ? 'Show prompt' : 'Show answer guide'}>
        <div className="flashcard-inner">
          <div className="flashcard-face"><span><span className="xs faint" style=${{ display: 'block', marginBottom: '6px' }}>Explain from memory</span><b>${t}</b></span></div>
          <div className="flashcard-face back m" style=${{ '--h': m.hue }}>Check yourself against your notes: the definition, one worked example, and one mistake people make. Mark what you missed.</div>
        </div>
      </button>
      <div className="row-between"><span className="xs faint mono">${(i % topics.length) + 1} / ${topics.length}</span>
        <div className="row" style=${{ gap: '4px' }}><button className="btn btn-ghost btn-sm" onClick=${() => { setI(i + topics.length - 1); setFlip(false); }}>Previous</button><button className="btn btn-secondary btn-sm" onClick=${() => { setI(i + 1); setFlip(false); }}>Next card</button></div></div>
    </div>`;
  }

  function Resources({ m }) {
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [err, setErr] = useState(null);
    const addLink = (e) => {
      e.preventDefault();
      setErr(null);
      let u;
      try { u = new URL(url.trim()); } catch (x) { setErr('That doesn’t look like a web address.'); return; }
      if (!/^https?:$/.test(u.protocol)) { setErr('Only http(s) links can be added.'); return; }
      const needsAuth = /loop\.dcu\.ie|moodle|brightspace|blackboard/i.test(u.hostname);
      A.addResource(m.id, { title: title.trim() || u.hostname + u.pathname, kind: 'link', url: u.href, status: needsAuth ? 'needs-auth' : 'linked', note: needsAuth ? 'Needs a university sign-in, so it can’t be read automatically.' : 'Saved as a link. Reading web pages needs the server-side fetcher, which isn’t connected in this demo.', source: 'you' });
      setTitle(''); setUrl('');
    };
    const onFile = (f) => {
      if (!f) return;
      A.addResource(m.id, { title: f.name, kind: 'file', size: f.size, status: 'stored', note: 'Attached by name in this browser. Summaries and flashcards from files need the extraction service.', source: 'you' });
      TS.toast('Attached ' + f.name + '.', { tone: 'ok' });
    };
    const icon = { read: ['CircleCheck', 'var(--ok)'], partial: ['TriangleAlert', 'var(--warn)'], 'needs-auth': ['Lock', 'var(--warn)'], linked: ['Link', 'var(--text-3)'], stored: ['FileText', 'var(--text-3)'] };
    return html`<section className="mod-section">
      <h2 className="h3">Resources</h2>
      <div className="panel" style=${{ padding: '6px 0' }}>
        ${m.resources.length === 0 && html`<p className="small muted" style=${{ padding: '10px 14px' }}>No resources yet.</p>`}
        ${m.resources.map((r) => { const [ic, col] = icon[r.status] || ['Info', 'var(--text-3)']; return html`<div key=${r.id || r.title} className="row" style=${{ padding: '8px 14px', alignItems: 'flex-start' }}>
          <span style=${{ color: col, marginTop: '2px' }}><${Icon} name=${ic} size=${15} /></span>
          <div className="grow stack-sm" style=${{ gap: '2px' }}><span className="small" style=${{ fontWeight: 560, overflowWrap: 'anywhere' }}>${r.url ? html`<a href=${r.url} target="_blank" rel="noopener noreferrer">${r.title}</a>` : r.title}</span>${r.note && html`<span className="xs faint">${r.note}</span>`}</div>
          ${r.source === 'you' && html`<button className="btn btn-ghost btn-icon btn-sm" aria-label=${'Remove ' + r.title} onClick=${() => A.removeResource(m.id, r.id)}><${Icon} name="X" size=${13} /></button>`}
        </div>`; })}
      </div>
      <form className="stack-sm" onSubmit=${addLink}>
        <div className="row wrap"><input className="input grow" style=${{ minWidth: '140px' }} aria-label="Link title" placeholder="Title (optional)" value=${title} onChange=${(e) => setTitle(e.target.value)} />
          <input className="input grow mono" style=${{ minWidth: '160px', fontSize: '12.5px' }} aria-label="Link URL" placeholder="https://" value=${url} onChange=${(e) => setUrl(e.target.value)} />
          <button className="btn btn-secondary btn-sm" type="submit" disabled=${!url.trim()}>Add link</button></div>
        ${err && html`<span className="field-error">${err}</span>`}
        <label className="small muted row" style=${{ gap: '8px', cursor: 'pointer' }}><${Icon} name="Upload" size=${14} /><span>Attach a file (notes, lab sheet, brief)</span><input type="file" className="sr-only" onChange=${(e) => onFile(e.target.files[0])} /></label>
      </form>
    </section>`;
  }

  function ModuleDetail({ id }) {
    const st = TS.useStore();
    const now = TS.useNow(60000);
    const m = TS.sel.module(st, id);
    if (!m) return html`<div className="page"><${TS.Empty} title="Module not found" action=${html`<a className="btn btn-secondary btn-sm" href="#modules">All modules</a>`}>It may have been removed from your timetable.<//></div>`;
    const s = moduleStats(st, m, now);
    const classes = st.classes.filter((c) => c.moduleId === m.id).sort((a, b) => a.day - b.day || T.toMin(a.start) - T.toMin(b.start));
    const assessments = st.assessments.filter((a) => a.moduleId === m.id);
    const tasks = st.tasks.filter((t) => t.moduleId === m.id && t.status !== 'done' && !t.orphan).sort((a, b) => (a.due || Infinity) - (b.due || Infinity));
    const upcoming = st.sessions.filter((x) => x.moduleId === m.id && x.status === 'planned' && x.end > now).sort((a, b) => a.start - b.start).slice(0, 5);
    const incomplete = m.pageStatus && m.pageStatus !== 'read';
    const blocked = (m.resources || []).filter((r) => r.status === 'needs-auth');
    const readSources = (m.resources || []).filter((r) => r.status === 'read').map((r) => r.title);
    const weightKnown = TS.sum(assessments.filter((a) => a.weight != null), (a) => a.weight);
    return html`<div className="page m" style=${{ '--h': m.hue }}>
      <a className="small" href="#modules"><${Icon} name="ChevronLeft" size=${14} />Modules</a>
      <header className="mod-head" style=${{ marginTop: '12px' }}>
        <div className="mod-badge">${m.code}</div>
        <div className="stack-sm" style=${{ gap: '4px' }}><h1 className="h1">${m.name}</h1><span className="small muted">${m.ects} ECTS · ${m.lecturer || 'Lecturer not listed'} · ${st.semester ? st.semester.label : ''}</span></div>
        <div className="page-actions"><button className="btn btn-secondary btn-sm" onClick=${() => TS.openOverlay('addTask', { moduleId: m.id })}><${Icon} name="Plus" />Add task</button></div>
      </header>
      <div className="mod-layout">
        <div className="stack" style=${{ gap: '28px' }}>
          <section className="mod-section"><h2 className="h3">Weekly classes</h2>
            <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Type</th><th>Day</th><th>Time</th><th>Room</th><th>Runs</th></tr></thead>
              <tbody>${classes.map((c) => html`<tr key=${c.id} style=${{ opacity: c.include === false ? 0.5 : 1 }}><td>${TS.model.KIND_LABEL[c.kind]}</td><td>${T.DOW_LONG[c.day]}</td><td className="mono">${c.start}–${c.end}</td><td>${c.room || html`<span className="badge badge-warn">TBC</span>`}</td><td className="small muted">${TS.model.weeksLabel(c.weeks)}</td></tr>`)}</tbody></table></div>
          </section>
          <section className="mod-section"><div className="section-title"><h2 className="h3">Assessments</h2><span className="small faint">${weightKnown ? weightKnown + '% of weighting known' : 'Weighting unknown'}</span></div>
            ${assessments.length === 0 ? html`<${TS.Empty} icon="FileText" title="No assessments found" action=${html`<button className="btn btn-secondary btn-sm" onClick=${() => TS.openOverlay('addTask', { moduleId: m.id })}>Add a deadline</button>`}>${incomplete ? 'The module page couldn’t be fully read, so deadlines may be missing.' : 'Add deadlines as they’re announced.'}<//>` : html`
            <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Assessment</th><th>Due</th><th>Weight</th><th>Status</th></tr></thead>
              <tbody>${assessments.map((a) => html`<tr key=${a.id}><td><span style=${{ fontWeight: 560 }}>${a.title}</span>${a.note && html`<div className="xs faint">${a.note}</div>`}</td>
                <td className="mono">${a.week && a.due <= now ? html`<span className="faint">Week ${a.week}</span>` : a.due ? T.fmtWhen(a.due, now) : html`<span className="faint">${a.kind === 'lab-report' && !a.undated ? 'After each lab' : 'Not published'}</span>`}</td>
                <td><input className="input mono" style=${{ width: '70px', height: '30px', fontSize: '12px' }} aria-label=${'Weight of ' + a.title} inputMode="numeric" placeholder="?" value=${a.weight != null ? a.weight : ''} onChange=${(e) => { const v = e.target.value.replace(/[^\d.]/g, ''); A.updateAssessment(a.id, { weight: v === '' ? null : Math.min(100, +v) }); }} /></td>
                <td>${a.status === 'submitted' ? html`<span className="badge badge-ok">Submitted</span>` : a.kind === 'exam' ? html`<span className="badge">Exam</span>` : a.due && a.due < now ? html`<span className="badge">Date passed</span>` : html`<span className="badge badge-outline">Open</span>`}</td></tr>`)}</tbody></table></div>`}
          </section>
          <section className="mod-section"><div className="section-title"><h2 className="h3">Coming up</h2><a className="small" href="#tasks">All tasks</a></div>
            ${upcoming.length === 0 ? html`<p className="small muted">No sessions planned for this module in the next two weeks.</p>` : html`<div className="sess-list">${upcoming.map((x) => html`<button key=${x.id} type="button" className="sess" style=${{ border: 0, textAlign: 'left', cursor: 'pointer' }} onClick=${() => TS.openOverlay('session', { id: x.id })}>
              <span className="row" style=${{ gap: '8px', minWidth: 0 }}><${Icon} name=${TS.typeIcon(x.type)} size=${14} /><span className="truncate">${x.title}</span></span><span className="mono">${T.fmtWhen(x.start, now)}</span></button>`)}</div>`}
            ${tasks.length > 0 && html`<p className="xs faint">${TS.plural(tasks.length, 'open task')} for ${m.code}, ${T.fmtHours(TS.sum(tasks, (t) => Math.max(0, TS.model.taskEstimate(t) - (t.done || 0))))} of work left.</p>`}
          </section>
          <section className="mod-section"><div className="section-title"><h2 className="h3">Study aids</h2>${incomplete || blocked.length ? html`<span className="badge badge-warn">Based on incomplete information</span>` : null}</div>
            <div className="notice"><${Icon} name="Info" /><div>
              ${readSources.length ? html`Built from the pages TimeStable could read: ${readSources.join(', ')}.` : 'No module material could be read, so there is nothing to build study aids from yet.'}
              ${blocked.length ? html` Not used: ${blocked.map((b) => b.title).join(', ')} (needs sign-in).` : ''}
              ${' '}Summaries and practice questions from your own notes need the AI study-guide service, which isn’t connected in this demo.
            </div></div>
            ${m.labChecklist && html`<div className="aid"><div className="aid-head"><${Icon} name="FlaskConical" /><span className="small" style=${{ fontWeight: 600 }}>Lab preparation</span><span className="xs faint" style=${{ marginLeft: 'auto' }}>${m.lab && m.lab.title}</span></div><div className="aid-body"><ol>${m.labChecklist.map((c) => html`<li key=${c}>${c}</li>`)}</ol></div></div>`}
            ${m.topics && m.topics.length > 0 && html`<div className="aid"><div className="aid-head"><${Icon} name="ListChecks" /><span className="small" style=${{ fontWeight: 600 }}>Revision checklist</span><span className="xs faint" style=${{ marginLeft: 'auto' }}>Topics from the module page</span></div>
              <div className="aid-body">${m.topics.map((t) => { const done = (m.revised || []).includes(t); return html`<label key=${t} className=${cx('subtask', done && 'done')}><input type="checkbox" checked=${done} onChange=${() => A.updateModule(m.id, { revised: done ? (m.revised || []).filter((x) => x !== t) : [...(m.revised || []), t] })} /><span>${t}</span></label>`; })}</div></div>`}
            ${m.topics && m.topics.length > 0 && html`<div className="aid"><div className="aid-head"><${Icon} name="Brain" /><span className="small" style=${{ fontWeight: 600 }}>Recall prompts</span><span className="xs faint" style=${{ marginLeft: 'auto' }}>Tap to flip</span></div><div className="aid-body"><${Flashcards} m=${m} /></div></div>`}
            ${assessments.filter((a) => a.subtasks && a.subtasks.length).map((a) => html`<div key=${a.id} className="aid"><div className="aid-head"><${Icon} name="Layers" /><span className="small" style=${{ fontWeight: 600 }}>Breakdown: ${a.title}</span></div><div className="aid-body"><ol>${a.subtasks.map((x) => html`<li key=${x}>${x}</li>`)}</ol></div></div>`)}
          </section>
        </div>
        <aside className="stack" style=${{ gap: '24px' }}>
          <section className="panel panel-pad stack" aria-label="Your ratings">
            <h2 className="panel-title">How it’s going</h2>
            <div className="field"><span className="xs faint" style=${{ fontWeight: 500 }}>Difficulty</span><${TS.Seg} block label="Difficulty" value=${m.difficulty} onChange=${(v) => A.updateModule(m.id, { difficulty: v }, { replan: true })} options=${[{ value: 1, label: 'Easy' }, { value: 2, label: 'Medium' }, { value: 3, label: 'Hard' }]} /></div>
            <div className="field"><span className="xs faint" style=${{ fontWeight: 500 }}>Confidence</span><${TS.Seg} block label="Confidence" value=${m.confidence} onChange=${(v) => A.updateModule(m.id, { confidence: v }, { replan: true })} options=${[{ value: 1, label: 'Low' }, { value: 2, label: 'OK' }, { value: 3, label: 'High' }]} /></div>
            <p className="xs faint">Changing these resizes future study for ${m.code}. You’ll see any moves before they happen.</p>
          </section>
          <section className="panel panel-pad stack-sm" aria-label="Workload">
            <h2 className="panel-title" style=${{ marginBottom: '6px' }}>Workload</h2>
            <dl className="kv"><dt>Classes</dt><dd className="mono small">${T.fmtHours(s.contact)} / week</dd>
              <dt>Study this week</dt><dd className="mono small">${T.fmtHours(s.planned)} planned</dd>
              <dt>ECTS guide</dt><dd className="mono small">≈ ${T.fmtHours(s.guide, 0)} / week</dd>
              <dt>Logged so far</dt><dd className="mono small">${s.logged ? T.fmtHours(s.logged) : 'Nothing yet'}</dd></dl>
            <p className="xs faint">The ECTS guide assumes 25 hours of work per credit over 15 weeks. Most students do less; it’s a ceiling, not a target.</p>
          </section>
          <${Resources} m=${m} />
          <section className="mod-section"><label className="h3" htmlFor="mod-notes">Notes</label>
            <textarea id="mod-notes" className="textarea" placeholder=${'Anything to remember about ' + m.code} value=${m.notes || ''} onChange=${(e) => A.updateModule(m.id, { notes: e.target.value })}></textarea>
            <span className="xs faint">Private to you. Saved in this browser.</span></section>
        </aside>
      </div>
    </div>`;
  }

  TS.ModulesView = ModulesView;
  TS.ModuleDetail = ModuleDetail;
})();
