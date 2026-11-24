/* Preferences: profile, routine, commitments, notifications, connections, data. */
(() => {
  const TS = window.TS;
  const { html, Icon, useState, useMemo, cx } = TS;
  const T = TS.time;
  const A = TS.actions;

  function Section({ title, desc, children }) {
    return html`<section className="pref-section"><header><h2 className="h3">${title}</h2>${desc && html`<p className="small muted">${desc}</p>`}</header><div className="pref-rows">${children}</div></section>`;
  }

  function RoutineEditor({ st }) {
    const [p, setP] = useState(st.prefs);
    const set = (patch) => setP({ ...p, ...patch });
    const dirty = JSON.stringify(p) !== JSON.stringify(st.prefs);
    const bad = T.toMin(p.dayEnd) <= T.toMin(p.dayStart) + 60;
    return html`<${TS.Fragment}>
      <${TS.DayStrip} p=${p} />
      <div className="form-grid">
        <div className="field"><span className="field-label">Sleep</span><div className="row"><${TS.TimeInput} label="Bedtime" value=${p.sleep} onChange=${(v) => set({ sleep: v })} /><span className="faint small">to</span><${TS.TimeInput} label="Wake up" value=${p.wake} onChange=${(v) => set({ wake: v })} /></div></div>
        <div className="field"><span className="field-label">Study window</span><div className="row"><${TS.TimeInput} label="Earliest study" value=${p.dayStart} onChange=${(v) => set({ dayStart: v })} /><span className="faint small">to</span><${TS.TimeInput} label="Latest study" value=${p.dayEnd} invalid=${bad} onChange=${(v) => set({ dayEnd: v })} /></div></div>
        <div className="field span-2"><span className="field-label">Best focus</span><div className="chip-row">${[['morning', 'Mornings'], ['afternoon', 'Afternoons'], ['evening', 'Evenings']].map(([v, l]) => html`<button key=${v} type="button" className="chip" aria-pressed=${p.focus.includes(v)} onClick=${() => set({ focus: p.focus.includes(v) ? p.focus.filter((x) => x !== v) : [...p.focus, v] })}>${l}</button>`)}</div></div>
        <div className="field"><span className="field-label">Session length</span><${TS.Seg} label="Session length" value=${p.sessionLen} onChange=${(v) => set({ sessionLen: v })} options=${[{ value: 25, label: '25 min' }, { value: 50, label: '50 min' }, { value: 90, label: '90 min' }]} /></div>
        <div className="field"><span className="field-label">Most study in one day</span><${TS.Stepper} label="Daily limit" value=${p.maxStudyMin} min=${60} max=${480} step=${30} format=${(v) => T.fmtDur(v)} onChange=${(v) => set({ maxStudyMin: v })} /></div>
        <div className="field"><span className="field-label">Flex time</span><${TS.Seg} label="Flex time" value=${p.buffer} onChange=${(v) => set({ buffer: v })} options=${[{ value: 0.1, label: '10%' }, { value: 0.15, label: '15%' }, { value: 0.25, label: '25%' }]} /></div>
        <div className="field"><span className="field-label">Breaks</span><${TS.Seg} label="Break" value=${p.breakMin} onChange=${(v) => set({ breakMin: v })} options=${[{ value: 5, label: '5 min' }, { value: 10, label: '10 min' }, { value: 15, label: '15 min' }]} /></div>
        <div className="field span-2"><${TS.Switch} id="pf-we" checked=${p.lighterWeekends} onChange=${(v) => set({ lighterWeekends: v })} label="Keep weekends lighter" /></div>
      </div>
      <div className="row"><button className="btn btn-primary btn-sm" disabled=${!dirty || bad || !p.focus.length} onClick=${() => A.updatePrefs(p)}>Save and review changes</button>${dirty && html`<button className="btn btn-ghost btn-sm" onClick=${() => setP(st.prefs)}>Discard</button>`}</div>
    <//>`;
  }

  function CommitmentsEditor({ st }) {
    const [list, setList] = useState(st.commitments);
    const dirty = JSON.stringify(list) !== JSON.stringify(st.commitments);
    const upd = (id, patch) => setList(list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const invalid = list.some((c) => !c.title.trim() || !c.days.length || T.toMin(c.end) <= T.toMin(c.start));
    return html`<${TS.Fragment}>
      ${list.length === 0 && html`<p className="small muted">No commitments. Add work, sport or societies so study is never planned on top of them.</p>`}
      ${list.map((c) => html`<div key=${c.id} className="commit-row">
        <span className="kind"><${Icon} name=${TS.model.COMMIT_KINDS[c.kind].icon} size=${16} /></span>
        <input className="input" aria-label="Name" value=${c.title} onChange=${(e) => upd(c.id, { title: e.target.value })} />
        <${TS.DayPick} value=${c.days} onChange=${(v) => upd(c.id, { days: v })} />
        <div className="commit-times"><${TS.TimeInput} label="Start" value=${c.start} onChange=${(v) => upd(c.id, { start: v })} /><span className="faint">–</span><${TS.TimeInput} label="End" value=${c.end} invalid=${T.toMin(c.end) <= T.toMin(c.start)} onChange=${(v) => upd(c.id, { end: v })} /></div>
        <button className="btn btn-ghost btn-icon btn-sm" aria-label="Remove" onClick=${() => setList(list.filter((x) => x.id !== c.id))}><${Icon} name="Trash2" size=${15} /></button>
      </div>`)}
      <div className="row wrap">
        <${TS.Menu} label="Add commitment" icon="Plus" text="Add" buttonClass="btn btn-secondary btn-sm" align="left" items=${Object.entries(TS.model.COMMIT_KINDS).map(([k, v]) => ({ label: v.label, icon: v.icon, run: () => setList([...list, { id: TS.uid('cm'), title: k === 'personal' ? '' : v.label, kind: k, days: [], start: '18:00', end: '19:00', location: '' }]) }))} />
        <button className="btn btn-primary btn-sm" disabled=${!dirty || invalid} onClick=${() => A.saveCommitments(list)}>Save and review changes</button>
        ${invalid && html`<span className="xs" style=${{ color: 'var(--danger)' }}>Each needs a name, a day and an end after its start.</span>`}
      </div>
    <//>`;
  }

  function PrefsView() {
    const st = TS.useStore();
    const [showData, setShowData] = useState(false);
    const [confirmDel, setConfirmDel] = useState('');
    const json = useMemo(() => (showData ? JSON.stringify({ ...st, setup: undefined, proposal: undefined }, null, 2) : ''), [showData, st]);
    const copy = async () => {
      try { await navigator.clipboard.writeText(json); TS.toast('Copied your data as JSON.', { tone: 'ok' }); }
      catch (e) { const el = document.getElementById('data-box'); if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } TS.toast('Copy was blocked here. The text is selected; press Ctrl+C or ⌘C.', { tone: 'warn' }); }
    };
    const n = st.notifications;
    return html`<div className="page">
      <header className="page-head"><div><h1 className="h1">Preferences</h1></div></header>
      <div className="prefs">
        <${Section} title="Profile" desc="Only used inside the app.">
          <div className="field"><label className="field-label" htmlFor="pf-name">Name</label><input id="pf-name" className="input" style=${{ maxWidth: '320px' }} value=${st.profile ? st.profile.name : ''} onChange=${(e) => A.updateProfile({ name: e.target.value })} /></div>
          <dl className="kv"><dt>University</dt><dd>${st.profile && st.profile.universityName}</dd><dt>Course</dt><dd>${st.profile && st.profile.programmeName}, Year ${st.profile && st.profile.year}</dd><dt>Time zone</dt><dd className="mono small">${Intl.DateTimeFormat().resolvedOptions().timeZone}</dd></dl>
        <//>
        <${Section} title="Appearance">
          <div className="pref-row"><span>Theme</span><${TS.Seg} label="Theme" value=${st.ui.theme} onChange=${(v) => A.setTheme(v)} options=${[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} /></div>
        <//>
        <${Section} title="Study routine" desc="Changes are proposed as a revised plan you can accept or reject."><${RoutineEditor} st=${st} /><//>
        <${Section} title="Commitments" desc="Work, sport and societies. Treated as fixed, with 15 minutes of travel either side."><${CommitmentsEditor} st=${st} /><//>
        <${Section} title="Notifications" desc="Saved now. Delivery needs the mobile app or browser notifications, which aren’t part of this demo.">
          ${[['dayPlan', 'Morning summary of the day'], ['beforeSession', '10 minutes before each session'], ['deadlines', 'Deadlines 48 hours out'], ['replan', 'When a change needs your approval']].map(([k, l]) => html`<div key=${k} className="pref-row"><span>${l}</span><${TS.Switch} id=${'nt-' + k} checked=${n[k]} onChange=${(v) => A.updateNotifications({ [k]: v })} label=${html`<span className="sr-only">${l}</span>`} /></div>`)}
        <//>
        <${Section} title="Timetable source" desc="Where your classes come from.">
          <div className="panel panel-pad stack-sm">
            <div className="row-between wrap"><span className="row" style=${{ gap: '10px' }}><${Icon} name=${st.connection && st.connection.source === 'loop' ? 'Plug' : 'CalendarDays'} /><b>${st.connection ? st.connection.label : 'Not connected'}</b></span>
              ${st.connection && st.connection.source === 'loop' && html`<span className="badge badge-warn">Simulated</span>`}</div>
            <span className="small muted">${st.connection ? 'Connected ' + T.fmtDate(st.connection.at) + ' · ' + st.classes.length + ' weekly classes · ' + st.modules.length + ' modules' : ''}</span>
            <div className="row wrap" style=${{ marginTop: '6px' }}>
              ${st.connection && st.connection.source === 'loop' && html`<button className="btn btn-secondary btn-sm" onClick=${() => A.simulateLoopChange()}><${Icon} name="RefreshCw" />Simulate a change from Loop</button>`}
              <button className="btn btn-ghost btn-sm" onClick=${() => A.resetAll()}>Disconnect and set up again</button>
            </div>
          </div>
          ${st.exceptions.length > 0 && html`<div className="stack-sm"><span className="small" style=${{ fontWeight: 600 }}>One-off changes</span>${st.exceptions.map((e) => html`<div key=${e.key} className="row-between small"><span>${e.type === 'cancel' ? 'Cancelled' : 'Moved'}: <span className="mono">${e.key.split('@')[0].replace(/^c\d+-/, '').toUpperCase()}</span> on ${e.key.split('@')[1]}${e.type === 'move' ? ' → ' + T.fmtDate(e.start) + ' ' + T.fmtRange(e.start, e.end) : ''}</span><button className="btn btn-ghost btn-sm" onClick=${() => A.restoreOccurrence(e.key)}>Undo</button></div>`)}</div>`}
        <//>
        <${Section} title="Your data" desc="Stored only in this browser (local storage). Clearing site data removes it.">
          <div className="row wrap"><button className="btn btn-secondary btn-sm" onClick=${() => setShowData(!showData)}><${Icon} name="FileText" />${showData ? 'Hide' : 'Show'} my data as JSON</button>${showData && html`<button className="btn btn-secondary btn-sm" onClick=${copy}><${Icon} name="Copy" />Copy</button>`}</div>
          ${showData && html`<pre id="data-box" className="codebox">${json}</pre>`}
        <//>
        <${Section} title="Delete everything" desc="Removes your timetable, tasks, check-ins and preferences from this browser.">
          <div className="field" style=${{ maxWidth: '360px' }}><label className="field-label" htmlFor="del-confirm">Type DELETE to confirm</label><input id="del-confirm" className="input mono" value=${confirmDel} onChange=${(e) => setConfirmDel(e.target.value)} /></div>
          <div><button className="btn btn-danger btn-sm" disabled=${confirmDel !== 'DELETE'} onClick=${() => { A.resetAll(); TS.toast('Everything was deleted from this browser.'); }}><${Icon} name="Trash2" />Delete my data</button></div>
        <//>
      </div>
    </div>`;
  }

  TS.PrefsView = PrefsView;
})();
