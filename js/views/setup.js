/* Onboarding: from "who are you" to a generated first plan. */
(() => {
  const TS = window.TS;
  const { html, Icon, useState, useEffect, useMemo, useRef, cx } = TS;
  const T = TS.time;
  const A = TS.actions;
  const loop = TS.loopDemo;

  const STEPS = [
    { id: 'uni', name: 'University & course', sub: 'Where you study' },
    { id: 'source', name: 'Timetable', sub: 'Connect or import' },
    { id: 'review', name: 'Check the import', sub: 'Confirm anything uncertain' },
    { id: 'routine', name: 'Your routine', sub: 'Sleep, study hours, sessions' },
    { id: 'commitments', name: 'Commitments', sub: 'Work, sport, societies' },
    { id: 'priorities', name: 'Priorities', sub: 'Difficulty and confidence' },
    { id: 'build', name: 'Your first plan', sub: 'Built around your week' },
  ];
  const DAYS = T.DOW;

  /* ---------------- Welcome ---------------- */
  function HeroFrame() {
    const E = TS.dcuEce2;
    const top = 9, bottom = 19;
    const pct = (h) => ((h - top) / (bottom - top)) * 100;
    const hueOf = (code) => (E.modules.find((m) => m.code === code) || {}).hue;
    const classes = E.classes.filter((c) => !c.optional && c.weeks.includes(12));
    const study = [
      [0, 17.25, 18.75, 'ENI1001', 'Business plan'], [1, 12.25, 13.75, 'ENI1001', 'Slides'], [2, 9.25, 11.25, 'EEG1009', 'Exam revision'],
      [3, 15.25, 16.75, 'EEN1023', 'Exam revision'], [4, 10, 11.75, 'EEN1022', 'Exam revision'], [4, 13, 14.75, 'EEN1091', 'Exam revision'], [4, 15.25, 16.75, 'EEN1018', 'Exam revision'],
    ];
    const h = (t) => T.toMin(t) / 60;
    const label = { lecture: 'Lecture', lab: 'Lab', tutorial: 'Tutorial' };
    const days = ['Mon 23', 'Tue 24', 'Wed 25', 'Thu 26', 'Fri 27'];
    return html`<div className="app-frame" role="img" aria-label="TimeStable week view of the ECE2 timetable for teaching week 12, with study sessions placed around classes">
      <div className="af-bar"><span>23–27 November</span><span>ECE2, teaching week 12</span></div>
      <div className="af-grid">
        <div className="af-corner"></div>
        ${days.map((d, i) => html`<div key=${d} className=${'af-head af-day-' + i}>${d}</div>`)}
        <div className="af-times">${[10, 12, 14, 16, 18].map((x) => html`<span key=${x} style=${{ top: pct(x) + '%' }}>${x}:00</span>`)}</div>
        ${days.map((_, d) => html`<div key=${d} className=${'af-col af-day-' + d}>
          ${classes.filter((c) => c.day === d).map((c) => html`<div key=${c.activity} className="af-ev m ev-class" style=${{ top: pct(h(c.start)) + '%', height: 'calc(' + (pct(h(c.end)) - pct(h(c.start))) + '% - 2px)', '--h': hueOf(c.module) }}><b>${c.module}</b>${label[c.kind]}</div>`)}
          ${study.filter((x) => x[0] === d).map((x) => html`<div key=${x[1]} className="af-ev m ev-study" style=${{ top: pct(x[1]) + '%', height: 'calc(' + (pct(x[2]) - pct(x[1])) + '% - 2px)', '--h': hueOf(x[3]) }}><b>${x[3]}</b>${x[4]}</div>`)}
        </div>`)}
      </div>
    </div>`;
  }

  function Welcome() {
    return html`<main className="welcome">
      <div className="welcome-copy">
        <div className="row-between"><${TS.Brand} /><${TS.DemoFlag}>Demo build<//></div>
        <div className="welcome-hero">
          <h1 className="welcome-title"><span>${TS.brand.name}:</span> <span>Plan <mark>WHAT</mark> to study,</span> <span><mark>WHEN</mark> and <mark>WHY</mark></span></h1>
          <p className="lead">Your DCU timetable, deadlines and commitments, turned into a weekly study plan.</p>
          <ul className="welcome-points">
            <li><${Icon} name="Lock" /><span>Classes and shifts stay put. Study fits around them.</span></li>
            <li><${Icon} name="FlaskConical" /><span>Pre-labs land before the lab, and revision spreads across the weeks.</span></li>
            <li><${Icon} name="RefreshCw" /><span>When a class moves, you approve every change to your plan.</span></li>
          </ul>
          <div className="row wrap" style=${{ gap: '12px' }}>
            <button className="btn btn-primary btn-lg" onClick=${() => A.setupGo('uni')} data-autofocus>Set up my semester <${Icon} name="ArrowRight" /></button>
            <span className="small faint">About 3 minutes</span>
          </div>
          <p className="welcome-fact">Includes DCU’s published 2026/27 ECE2 timetable: 6 modules and 21 classes.</p>
        </div>
        <div className="welcome-foot"><span>The Loop connection is simulated. Your data stays in this browser.</span></div>
      </div>
      <div className="welcome-art"><${HeroFrame} /></div>
    </main>`;
  }

  /* ---------------- Frame ---------------- */
  function Frame({ step, children, onBack, onNext, nextLabel = 'Continue', nextDisabled, note, hideFoot }) {
    const su = TS.useStore((s) => s.setup);
    const idx = STEPS.findIndex((s) => s.id === step);
    const meta = STEPS[idx];
    const canJump = (id) => su.visited.includes(id) && id !== 'build' && (id === 'uni' || id === 'source' || su.imported);
    return html`<div className="setup">
      <aside className="setup-rail">
        <${TS.Brand} />
        <ol className="steps" aria-label="Setup steps">
          ${STEPS.map((s, i) => {
            const state = i < idx ? 'is-done' : i === idx ? 'is-current' : '';
            const inner = html`<span className="step-num">${i < idx ? html`<${Icon} name="Check" size=${12} stroke=${2.4} />` : i + 1}</span>
              <span className="step-name">${s.name}<span className="step-sub">${s.sub}</span></span>`;
            return html`<li key=${s.id} className=${cx('step-item', state)} aria-current=${i === idx ? 'step' : null}>
              ${canJump(s.id) && i !== idx ? html`<button type="button" onClick=${() => A.setupGo(s.id)}>${inner}</button>` : inner}
            </li>`;
          })}
        </ol>
        <div className="setup-rail-foot">
          <${TS.DemoFlag}>Simulated Loop connection<//>
          <span>Progress is saved in this browser as you go.</span>
        </div>
      </aside>
      <main className="setup-main">
        <div className="setup-progress">
          <div className="row-between"><span className="small"><b>${meta.name}</b></span><span className="xs faint mono">${idx + 1} / ${STEPS.length}</span></div>
          <${TS.Meter} value=${(idx + 1) / STEPS.length} thin label="Setup progress" />
        </div>
        <div className="setup-body">${children}</div>
        ${!hideFoot && html`<div className="setup-foot"><div className="setup-foot-inner">
          ${onBack ? html`<button className="btn btn-ghost" onClick=${onBack}><${Icon} name="ArrowLeft" />Back</button>` : null}
          <span className="note">${note}</span>
          <button className="btn btn-primary" onClick=${onNext} disabled=${nextDisabled}>${nextLabel}<${Icon} name="ArrowRight" /></button>
        </div></div>`}
      </main>
    </div>`;
  }

  function Head({ eyebrow, title, children }) {
    return html`<header className="setup-head">
      ${eyebrow && html`<div className="eyebrow">${eyebrow}</div>`}
      <h1 className="h1">${title}</h1>
      ${children && html`<p className="lead">${children}</p>`}
    </header>`;
  }

  /* ---------------- Step 1: university ---------------- */
  function StepUni() {
    const su = TS.useStore((s) => s.setup);
    const uni = loop.universities.find((u) => u.id === su.universityId);
    const prog = loop.programmes.find((p) => p.id === su.programmeId);
    const hasData = uni && uni.connector && loop.hasDemoData(su.programmeId, su.year);
    return html`<${Frame} step="uni" onBack=${() => A.setupGo('welcome')} onNext=${() => { A.setup({ source: hasData ? 'loop' : su.source === 'loop' ? 'upload' : su.source }); A.setupGo('source'); }}>
      <${Head} title="Where do you study?">This decides which timetable sources are available. You can change it later.<//>
      <div className="form-grid">
        <div className="field span-2">
          <label className="field-label" htmlFor="su-name">What should we call you? <span className="faint" style=${{ fontWeight: 400 }}>(optional)</span></label>
          <input id="su-name" className="input" value=${su.name} maxLength="40" placeholder="First name" autoComplete="given-name" onChange=${(e) => A.setup({ name: e.target.value })} style=${{ maxWidth: '320px' }} />
        </div>
        <div className="field span-2">
          <label className="field-label" htmlFor="su-uni">University</label>
          <select id="su-uni" className="select" value=${su.universityId} onChange=${(e) => A.setup({ universityId: e.target.value })}>
            ${loop.universities.map((u) => html`<option key=${u.id} value=${u.id}>${u.name}${u.connector ? '' : ' (file or manual import)'}</option>`)}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="su-prog">Course</label>
          <select id="su-prog" className="select" value=${su.programmeId} onChange=${(e) => A.setup({ programmeId: e.target.value })}>
            ${loop.programmes.map((p) => html`<option key=${p.id} value=${p.id}>${p.award} ${p.name}</option>`)}
          </select>
        </div>
        <div className="field">
          <span className="field-label" id="su-year-l">Year</span>
          <${TS.Seg} label="Year" value=${su.year} onChange=${(v) => A.setup({ year: v })} options=${(prog ? prog.years : [1, 2, 3, 4]).map((y) => ({ value: y, label: 'Year ' + y }))} />
        </div>
      </div>
      ${uni && !uni.connector && html`<div className="notice"><${Icon} name="Info" /><div>${uni.name} isn’t connected to ${TS.brand.name} yet. You can import a calendar file or enter your classes by hand, and everything else works the same.</div></div>`}
      ${uni && uni.connector && !hasData && html`<div className="notice notice-warn"><${Icon} name="TriangleAlert" /><div><strong>No sample timetable for this course and year.</strong> The demo has data for <b>Electronic & Computer Engineering, Year 2</b> and <b>Computer Science, Year 2</b>. Pick one of those to try the Loop connector, or continue and import a file instead.</div></div>`}
      ${hasData && html`<div className="notice notice-accent"><${Icon} name="Plug" /><div><strong>DCU Loop is available.</strong> Next, ${TS.brand.name} can pull your modules, weekly timetable and module pages in one go. ${loop.isOfficial(su.programmeId, su.year) ? 'The connection is simulated, but the timetable and module details are DCU\u2019s published 2026/27 ones.' : 'In this demo the connection is simulated and this course uses sample data.'}</div></div>`}
    <//>`;
  }

  /* ---------------- Step 2: source ---------------- */
  function buildFromLoop(mods, tt, pages) {
    const pageBy = new Map(pages.map((p) => [p.code, p]));
    const modules = mods.map((m) => {
      const p = pageBy.get(m.code) || {};
      return { ...m, topics: p.topics || [], lab: p.lab || null, labChecklist: p.labChecklist || null, tutorialPrep: p.tutorialPrep || 0, pageStatus: p.status || 'none', pageNote: p.note || null, resources: (p.resources || []).map((r) => ({ ...r, source: 'loop' })) };
    });
    const assessments = [];
    for (const p of pages) for (const a of p.assessments || []) assessments.push({ ...a, moduleId: p.code });
    const flags = [...(tt.flags || [])];
    for (const p of pages) if (p.status !== 'read') flags.push({ type: 'info', id: 'page-' + p.code, message: p.code + ': ' + (p.note || 'the module page could not be read.') });
    for (const a of assessments) if (a.flag && a.kind !== 'exam') flags.push({ type: a.weight == null ? 'weight' : 'info', id: 'w-' + a.id, assessmentId: a.id, message: a.moduleId + ' · ' + a.title + ': ' + a.flag });
    const exams = assessments.filter((a) => a.kind === 'exam' && !a.due);
    if (exams.length) flags.push({ type: 'info', id: 'exams', message: tt.semester.examWindow ? 'Individual exam dates aren\u2019t on the ECE2 timetable yet. DCU\u2019s exam period is ' + T.fmtDayMonth(tt.semester.examWindow.start) + ' to ' + T.fmtDayMonth(tt.semester.examWindow.end) + ', so revision is planned for the time before it.' : 'No exam dates are published yet for ' + TS.plural(exams.length, 'module') + '. Revision is planned weekly until they are, then it ramps up before each exam.' });
    return { origin: 'loop', originDetail: tt.semester.official ? TS.dcuEce2.sourceLabel : 'Simulated Loop sample data', semester: tt.semester, modules, classes: tt.classes, assessments, flags };
  }

  function LoopPanel() {
    const su = TS.useStore((s) => s.setup);
    const [log, setLog] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const upsert = (id, patch) => setLog((l) => { const i = l.findIndex((x) => x.id === id); if (i < 0) return [...l, { id, ...patch }]; const n = l.slice(); n[i] = { ...n[i], ...patch }; return n; });
    const run = async () => {
      setBusy(true); setError(null); setLog([]);
      try {
        upsert('auth', { text: 'Authorising with DCU Loop', state: 'run' });
        const { token } = await loop.connect({ universityId: su.universityId, programmeId: su.programmeId, year: su.year });
        upsert('auth', { state: 'done', meta: 'simulated' });
        upsert('enrol', { text: 'Reading your module enrolments', state: 'run' });
        const mods = await loop.getEnrolments(token);
        upsert('enrol', { state: 'done', meta: TS.plural(mods.length, 'module') });
        upsert('tt', { text: 'Fetching your weekly timetable', state: 'run' });
        const tt = await loop.getTimetable(token, Date.now());
        upsert('tt', { state: 'done', meta: TS.plural(tt.classes.length, 'class', 'classes') });
        upsert('pages', { text: 'Reading module pages for deadlines and labs', state: 'run', meta: '0 / ' + mods.length });
        const pages = [];
        for (const m of mods) {
          pages.push(await loop.getModulePage(token, m.code, Date.now()));
          upsert('pages', { meta: pages.length + ' / ' + mods.length });
        }
        const unread = pages.filter((p) => p.status !== 'read').length;
        upsert('pages', { state: unread ? 'warn' : 'done', meta: (mods.length - unread) + ' of ' + mods.length + ' fully read' });
        const imported = buildFromLoop(mods, tt, pages);
        A.setup({ imported, resolutions: {}, excludedModules: [], excludedClasses: imported.classes.filter((c) => c.optional).map((c) => c.id) });
        TS.toast('Imported ' + TS.plural(mods.length, 'module') + ' from Loop (simulated).', { tone: 'ok' });
      } catch (e) {
        setLog((l) => l.map((x) => (x.state === 'run' ? { ...x, state: 'fail' } : x)));
        setError(e.message);
      } finally { setBusy(false); }
    };
    const icon = { run: 'LoaderCircle', done: 'CircleCheck', warn: 'TriangleAlert', fail: 'CircleX' };
    return html`<div className="connect">
      <div className="notice notice-accent"><${Icon} name="ShieldCheck" /><div>
        <strong>Simulated connection.</strong> ${TS.brand.name} has no access to Loop yet, so no sign-in happens here. ${loop.isOfficial(su.programmeId, su.year) ? 'This course loads DCU\u2019s published 2026/27 ECE2 timetable and module specifications.' : 'This course loads sample data shaped like Loop\u2019s.'} In the real product this step opens DCU\u2019s own sign-in page; ${TS.brand.name} never sees your password.
      </div></div>
      ${log.length > 0 && html`<ul className="log" aria-live="polite">
        ${log.map((l) => html`<li key=${l.id} className=${l.state}><${Icon} name=${l.state === 'run' ? 'RefreshCw' : icon[l.state]} /><span>${l.text}</span><span className="log-meta">${l.meta || ''}</span></li>`)}
      </ul>`}
      ${error && html`<div className="notice notice-danger"><${Icon} name="CircleX" /><div>${error}</div></div>`}
      <div className="row wrap">
        <button className=${cx('btn', su.imported && su.imported.origin === 'loop' ? 'btn-secondary' : 'btn-primary')} onClick=${run} disabled=${busy}>
          <${Icon} name=${busy ? 'RefreshCw' : 'Plug'} className=${busy ? 'spin' : ''} />${busy ? 'Connecting…' : su.imported && su.imported.origin === 'loop' ? 'Fetch again' : 'Connect to Loop (simulated)'}
        </button>
        ${su.imported && su.imported.origin === 'loop' && !busy && html`<span className="small muted"><${Icon} name="CircleCheck" className="ok" /> Imported ${TS.plural(su.imported.modules.length, 'module')} and ${su.imported.classes.length} weekly classes.</span>`}
      </div>
    </div>`;
  }

  function applyIcs(text, detail) {
    const events = TS.ics.parseICS(text);
    if (!events.length) throw new Error('No timed events were found in that calendar.');
    const imp = TS.ics.toImport(events, Date.now());
    A.setup({ imported: { origin: 'ics', originDetail: detail, semester: imp.semester, modules: imp.modules, classes: imp.classes, assessments: [], flags: [...imp.flags, { type: 'info', id: 'no-deadlines', message: 'Calendar files only contain classes. Add deadlines in Tasks after setup, or connect Loop to read them from module pages.' }], eventCount: imp.eventCount }, resolutions: {}, excludedModules: [], excludedClasses: [] });
    TS.toast('Read ' + TS.plural(imp.eventCount, 'event') + ' into ' + imp.classes.length + ' weekly classes.', { tone: 'ok' });
  }

  function FeedPanel() {
    const [url, setUrl] = useState('');
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);
    const read = async () => {
      setErr(null);
      const v = TS.ics.checkFeedUrl(url);
      if (!v.ok) { setErr(v.error); return; }
      setBusy(true);
      try { applyIcs(await TS.ics.fetchFeed(v.url), 'Calendar link'); }
      catch (e) { setErr(e.message); }
      finally { setBusy(false); }
    };
    const sample = new URL('samples/sample-timetable.ics', location.href).href;
    return html`<div className="connect">
      <div className="field">
        <label className="field-label" htmlFor="feed-url">Calendar link</label>
        <div className="row">
          <input id="feed-url" className="input grow mono" style=${{ fontSize: '12.5px' }} placeholder="https://… or webcal://…" value=${url} onChange=${(e) => setUrl(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && read()} aria-invalid=${err ? 'true' : 'false'} />
          <button className="btn btn-primary" onClick=${read} disabled=${busy}>${busy ? 'Reading…' : 'Read calendar'}</button>
        </div>
        <span className="field-hint">Links are checked before anything is read. Pages that need a sign-in can’t be read from a link. <button className="link-btn" type="button" onClick=${() => { setUrl(sample); setErr(null); }}>Use the sample feed</button></span>
      </div>
      ${err && html`<div className="notice notice-danger"><${Icon} name="CircleX" /><div>${err}</div></div>`}
    </div>`;
  }

  function UploadPanel() {
    const [err, setErr] = useState(null);
    const [info, setInfo] = useState(null);
    const onFile = (file) => {
      setErr(null); setInfo(null);
      if (!file) return;
      const name = file.name.toLowerCase();
      if (name.endsWith('.ics')) {
        if (file.size > 2e6) { setErr('That file is larger than 2 MB, which is unusual for a timetable. Check it is the right export.'); return; }
        const r = new FileReader();
        r.onload = () => { try { applyIcs(String(r.result), file.name); } catch (e) { setErr(e.message); } };
        r.onerror = () => setErr('The file couldn’t be read. Try exporting it again.');
        r.readAsText(file);
      } else if (/\.(pdf|png|jpe?g|heic)$/.test(name)) {
        setInfo(file.name + ' needs the document extraction service (PDF text and OCR for photos), which isn’t connected in this demo. Nothing was read from it. Upload an .ics export, or enter your classes by hand.');
      } else setErr('That file type isn’t supported. Use an .ics calendar file, a PDF, or a photo of your timetable.');
    };
    return html`<div className="connect">
      <div className="field">
        <label className="field-label" htmlFor="upload-file">Timetable file</label>
        <input id="upload-file" className="input" style=${{ height: 'auto', padding: '8px' }} type="file" accept=".ics,.pdf,.png,.jpg,.jpeg,.heic,text/calendar" onChange=${(e) => onFile(e.target.files[0])} />
        <span className="field-hint">.ics files are read here in your browser. The sample feed is at <span className="mono">samples/sample-timetable.ics</span>.</span>
      </div>
      ${info && html`<div className="notice notice-warn"><${Icon} name="TriangleAlert" /><div>${info}</div></div>`}
      ${err && html`<div className="notice notice-danger"><${Icon} name="CircleX" /><div>${err}</div></div>`}
    </div>`;
  }

  function ManualPanel() {
    const [rows, setRows] = useState([]);
    const [f, setF] = useState({ code: '', name: '', kind: 'lecture', day: 0, start: '10:00', end: '11:00', room: '' });
    const [err, setErr] = useState(null);
    const add = () => {
      const code = f.code.trim().toUpperCase().replace(/\s+/g, '');
      if (!/^[A-Z]{2,4}\d{3,4}[A-Z]?$/.test(code)) { setErr('Use a module code like EEN1022 or CA218.'); return; }
      if (T.toMin(f.end) <= T.toMin(f.start)) { setErr('The end time must be after the start time.'); return; }
      setErr(null);
      setRows([...rows, { ...f, code, id: 'man' + (rows.length + 1) + '-' + code.toLowerCase() }]);
      setF({ ...f, start: f.end, end: T.fromMin(T.toMin(f.end) + 60), room: '' });
    };
    const use = () => {
      const mods = new Map();
      for (const r of rows) if (!mods.has(r.code)) mods.set(r.code, { code: r.code, name: r.name.trim() || r.code, ects: 5, lecturer: null, hue: null, pageStatus: 'none' });
      A.setup({ imported: { origin: 'manual', originDetail: 'Entered by hand', semester: { label: 'Semester', week1Start: T.addDays(T.weekStart(Date.now()), -8 * 7), teachingWeeks: 12 }, modules: [...mods.values()], classes: rows.map((r) => ({ id: r.id, module: r.code, kind: r.kind, day: +r.day, start: r.start, end: r.end, room: r.room || null, weeks: 'all' })), assessments: [], flags: [{ type: 'info', id: 'no-deadlines', message: 'Manual entry has no deadlines yet. Add them in Tasks after setup.' }] }, resolutions: {}, excludedModules: [], excludedClasses: [] });
      TS.toast('Using ' + TS.plural(rows.length, 'class', 'classes') + '.', { tone: 'ok' });
    };
    return html`<div className="connect">
      <div className="form-grid">
        <div className="field"><label className="field-label" htmlFor="m-code">Module code</label><input id="m-code" className="input mono" value=${f.code} placeholder="EEN1022" onChange=${(e) => setF({ ...f, code: e.target.value })} /></div>
        <div className="field"><label className="field-label" htmlFor="m-name">Module name</label><input id="m-name" className="input" value=${f.name} placeholder="Digital & Analogue Electronics I" onChange=${(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="field"><label className="field-label" htmlFor="m-kind">Type</label><select id="m-kind" className="select" value=${f.kind} onChange=${(e) => setF({ ...f, kind: e.target.value })}><option value="lecture">Lecture</option><option value="lab">Lab</option><option value="tutorial">Tutorial</option></select></div>
        <div className="field"><label className="field-label" htmlFor="m-day">Day</label><select id="m-day" className="select" value=${f.day} onChange=${(e) => setF({ ...f, day: +e.target.value })}>${T.DOW_LONG.map((d, i) => html`<option key=${i} value=${i}>${d}</option>`)}</select></div>
        <div className="field"><span className="field-label">Time</span><div className="row"><${TS.TimeInput} label="Start" value=${f.start} onChange=${(v) => setF({ ...f, start: v })} /><span className="faint">to</span><${TS.TimeInput} label="End" value=${f.end} onChange=${(v) => setF({ ...f, end: v })} /></div></div>
        <div className="field"><label className="field-label" htmlFor="m-room">Room <span className="faint" style=${{ fontWeight: 400 }}>(optional)</span></label><input id="m-room" className="input" value=${f.room} onChange=${(e) => setF({ ...f, room: e.target.value })} /></div>
      </div>
      ${err && html`<div className="field-error" role="alert">${err}</div>`}
      <div className="row wrap"><button className="btn btn-secondary" onClick=${add}><${Icon} name="Plus" />Add class</button>
        ${rows.length > 0 && html`<button className="btn btn-primary" onClick=${use}>Use ${TS.plural(rows.length, 'class', 'classes')}</button>`}</div>
      ${rows.length > 0 && html`<div className="stack-sm">${rows.map((r, i) => html`<div key=${r.id} className="row-between small" style=${{ padding: '6px 0', borderTop: '1px solid var(--line)' }}>
        <span><b className="mono">${r.code}</b> ${TS.model.KIND_LABEL[r.kind]} · ${DAYS[r.day]} <span className="mono">${r.start}–${r.end}</span>${r.room ? ' · ' + r.room : ''}</span>
        <button className="btn btn-ghost btn-icon btn-sm" aria-label="Remove" onClick=${() => setRows(rows.filter((_, j) => j !== i))}><${Icon} name="Trash2" size=${14} /></button></div>`)}</div>`}
    </div>`;
  }

  function StepSource() {
    const su = TS.useStore((s) => s.setup);
    const uni = loop.universities.find((u) => u.id === su.universityId);
    const loopOk = uni && uni.connector;
    const choices = [
      { id: 'loop', icon: 'Plug', title: 'DCU Loop', badge: 'Simulated', desc: 'Modules, weekly timetable and module pages in one step. Recommended for DCU.', disabled: !loopOk },
      { id: 'feed', icon: 'Link', title: 'Calendar link', desc: 'An .ics or webcal link from Google, Outlook or a timetable site.' },
      { id: 'upload', icon: 'Upload', title: 'Upload a file', desc: '.ics files now. PDFs and photos need the extraction service.' },
      { id: 'manual', icon: 'Pencil', title: 'Enter by hand', desc: 'Add each class yourself. Fine for a small timetable.' },
    ];
    const imp = su.imported;
    return html`<${Frame} step="source" onBack=${() => A.setupGo('uni')} onNext=${() => A.setupGo('review')} nextDisabled=${!imp} note=${imp ? 'Ready: ' + TS.plural(imp.modules.length, 'module') + ', ' + imp.classes.length + ' classes' : 'Import a timetable to continue'}>
      <${Head} title="Import your timetable">Pick one source. You check everything on the next screen before it’s saved.<//>
      <div className="choice-grid" role="radiogroup" aria-label="Timetable source">
        ${choices.map((c) => html`<button key=${c.id} type="button" role="radio" className="choice" aria-checked=${su.source === c.id} disabled=${c.disabled}
          style=${c.disabled ? { opacity: 0.5, cursor: 'not-allowed' } : null} onClick=${() => !c.disabled && A.setup({ source: c.id })}>
          <span className="choice-icon"><${Icon} name=${c.icon} size=${17} /></span>
          <span><span className="choice-title">${c.title}${c.badge && html`<span className="badge badge-warn">${c.badge}</span>`}</span>
          <span className="choice-desc" style=${{ display: 'block' }}>${c.disabled ? 'Only available for DCU in this version.' : c.desc}</span></span>
        </button>`)}
      </div>
      ${su.source === 'loop' && loopOk && html`<${LoopPanel} />`}
      ${su.source === 'feed' && html`<${FeedPanel} />`}
      ${su.source === 'upload' && html`<${UploadPanel} />`}
      ${su.source === 'manual' && html`<${ManualPanel} />`}
      ${imp && imp.origin !== 'loop' && su.source !== 'manual' && su.source !== 'feed' && su.source !== 'upload' && null}
    <//>`;
  }

  /* ---------------- Step 3: review ---------------- */
  function StepReview() {
    const su = TS.useStore((s) => s.setup);
    const imp = su.imported;
    const [editing, setEditing] = useState(null);
    const [acks, setAcks] = useState({});
    if (!imp) return html`<${Frame} step="review" onBack=${() => A.setupGo('source')} nextDisabled=${true}><${TS.Empty} title="Nothing imported yet">Go back and connect or import a timetable.<//><//>`;
    const choiceFlags = imp.classes.filter((c) => c.flag && c.flag.type === 'choice').map((c) => ({ ...c.flag, classId: c.id, module: c.module }));
    const infoFlags = [...imp.classes.filter((c) => c.flag && c.flag.type === 'info').map((c) => c.flag), ...imp.flags];
    const unresolved = choiceFlags.filter((f) => !su.resolutions[f.id]).length;
    const totalChecks = choiceFlags.length + infoFlags.length;
    const done = choiceFlags.length - unresolved + infoFlags.filter((f) => acks[f.id]).length;
    const sem = imp.semester;
    const tw = TS.model.teachingWeek(sem, Date.now());
    const updClass = (id, patch) => A.setup((d) => ({ imported: { ...d.imported, classes: d.imported.classes.map((c) => (c.id === id ? { ...c, ...patch, userEdited: true } : c)) } }));
    const updAssess = (id, patch) => A.setup((d) => ({ imported: { ...d.imported, assessments: d.imported.assessments.map((a) => (a.id === id ? { ...a, ...patch } : a)) } }));
    const toggle = (key, id) => A.setup((d) => ({ [key]: d[key].includes(id) ? d[key].filter((x) => x !== id) : [...d[key], id] }));
    const deadlines = imp.assessments.filter((a) => a.due && a.due > Date.now() && a.status !== 'submitted');
    const resIcon = { read: ['CircleCheck', 'ok'], partial: ['TriangleAlert', 'warn'], 'needs-auth': ['Lock', 'warn'] };

    return html`<${Frame} step="review" onBack=${() => A.setupGo('source')} onNext=${() => A.setupGo('routine')} nextDisabled=${unresolved > 0}
      note=${unresolved ? TS.plural(unresolved, 'choice') + ' still needed above' : 'Looks right? You can edit any of this later.'}>
      <${Head} title="Check your imported timetable">Nothing is saved until you finish setup. Fix anything wrong and answer the questions below.<//>
      <p className="summary-line"><b>${TS.plural(imp.modules.length, 'module')}</b>, <b>${TS.plural(imp.classes.length, 'class', 'classes')}</b> and <b>${TS.plural(deadlines.length, 'upcoming deadline')}</b>, in teaching week ${tw} of ${sem.teachingWeeks}${imp.origin === 'loop' ? '' : ' (assumed)'}.</p>
      ${sem.official && html`<div className="notice notice-ok"><${Icon} name="BadgeCheck" /><div><strong>Published DCU timetable.</strong> ${TS.dcuEce2.sourceLabel}. ${sem.replay ? 'Teaching has finished, so this demo replays Week 9 to show a normal week.' : 'Check MyTimetable for any changes since then.'}</div></div>`}
      ${imp.origin !== 'loop' && html`<div className="field" style=${{ maxWidth: '360px' }}>
        <label className="field-label" htmlFor="tw-sel">Which teaching week is it now?</label>
        <select id="tw-sel" className="select" value=${tw} onChange=${(e) => A.setup((d) => ({ imported: { ...d.imported, semester: { ...d.imported.semester, week1Start: T.addDays(T.weekStart(Date.now()), -(+e.target.value - 1) * 7) } } }))}>
          ${Array.from({ length: 13 }, (_, i) => i + 1).map((w) => html`<option key=${w} value=${w}>Week ${w}${w > 12 ? ' (study week)' : ''}</option>`)}
        </select>
        <span className="field-hint">Calendar files don’t say this. It matters for classes that run on alternate weeks.</span>
      </div>`}

      ${totalChecks > 0 && html`<section className="stack-sm" aria-label="Things to check">
        <div className="section-title"><h2 className="h3">Items to check</h2><span className="small faint">${done} of ${totalChecks} done</span></div>
        <div className="checks">
          ${choiceFlags.map((f) => { const ok = !!su.resolutions[f.id]; return html`<div key=${f.id} className=${cx('check-item', ok && 'resolved')}>
            <${Icon} name=${ok ? 'CircleCheck' : 'CircleHelp'} />
            <div className="check-body"><span>${f.message}</span>
              <div className="chip-row">${f.options.map((o) => html`<button key=${o.value} type="button" className="chip" aria-pressed=${su.resolutions[f.id] === o.value} onClick=${() => A.setup((d) => ({ resolutions: { ...d.resolutions, [f.id]: o.value } }))}>${o.label}</button>`)}</div>
            </div></div>`; })}
          ${infoFlags.map((f) => { const ok = !!acks[f.id]; return html`<div key=${f.id} className=${cx('check-item', ok && 'resolved')}>
            <${Icon} name=${ok ? 'CircleCheck' : 'TriangleAlert'} />
            <div className="check-body"><span>${f.message}</span>
              ${f.type === 'weight' && html`<div className="row"><label className="small muted" htmlFor=${'w-' + f.id}>Weighting if you know it</label><input id=${'w-' + f.id} className="input mono" style=${{ width: '84px', height: '32px' }} inputMode="numeric" placeholder="%"
                onChange=${(e) => { const v = e.target.value.replace(/[^\d.]/g, ''); updAssess(f.assessmentId, { weight: v ? Math.min(100, +v) : null }); }} /></div>`}
              ${!ok && html`<div><button className="btn btn-secondary btn-sm" onClick=${() => setAcks({ ...acks, [f.id]: true })}>Got it</button></div>`}
            </div></div>`; })}
        </div>
      </section>`}

      <section className="stack" aria-label="Modules">
        <div className="section-title"><h2 className="h3">Modules and classes</h2><span className="small faint">Untick anything you don’t attend</span></div>
        ${imp.modules.map((m, mi) => {
          const off = su.excludedModules.includes(m.code);
          const cls = imp.classes.filter((c) => c.module === m.code).sort((a, b) => a.day - b.day || T.toMin(a.start) - T.toMin(b.start));
          const ass = imp.assessments.filter((a) => a.moduleId === m.code);
          const hue = m.hue != null ? m.hue : [28, 205, 250, 85, 150, 345][mi % 6];
          return html`<div key=${m.code} className=${cx('modgroup m', off && 'excluded')} style=${{ '--h': hue }}>
            <div className="modgroup-head">
              <span className="pip pip-lg"></span><span className="mono" style=${{ fontWeight: 600 }}>${m.code}</span><span className="name grow">${m.name}</span>
              <span className="xs faint">${m.ects} ECTS${m.lecturer ? ' · ' + m.lecturer : ''}</span>
              <${TS.Switch} id=${'inc-' + m.code} checked=${!off} onChange=${() => toggle('excludedModules', m.code)} label=${html`<span className="sr-only">Include ${m.code}</span>`} />
            </div>
            <div className="table-scroll"><table className="imp-table">
              <thead><tr><th style=${{ width: '28px' }}><span className="sr-only">Include</span></th><th>Type</th><th>Day</th><th>Time</th><th>Room</th><th>Weeks</th><th><span className="sr-only">Edit</span></th></tr></thead>
              <tbody>${cls.map((c) => {
                const ex = su.excludedClasses.includes(c.id);
                const resolved = c.flag && c.flag.type === 'choice' && su.resolutions[c.flag.id] ? c.flag.options.find((o) => o.value === su.resolutions[c.flag.id]).patch : {};
                const v = { ...c, ...resolved };
                if (editing === c.id) return html`<tr key=${c.id}><td colSpan="7"><div className="row wrap" style=${{ gap: '8px', padding: '4px 0' }}>
                  <select className="select" style=${{ width: '130px', height: '32px' }} aria-label="Day" value=${c.day} onChange=${(e) => updClass(c.id, { day: +e.target.value })}>${T.DOW_LONG.map((d, i) => html`<option key=${i} value=${i}>${d}</option>`)}</select>
                  <${TS.TimeInput} label="Start" value=${c.start} onChange=${(x) => updClass(c.id, { start: x })} /><${TS.TimeInput} label="End" value=${c.end} onChange=${(x) => updClass(c.id, { end: x })} invalid=${T.toMin(c.end) <= T.toMin(c.start)} />
                  <input className="input" style=${{ width: '110px', height: '32px' }} aria-label="Room" placeholder="Room" value=${c.room || ''} onChange=${(e) => updClass(c.id, { room: e.target.value || null })} />
                  <button className="btn btn-secondary btn-sm" disabled=${T.toMin(c.end) <= T.toMin(c.start)} onClick=${() => setEditing(null)}>Done</button></div></td></tr>`;
                return html`<tr key=${c.id} className=${ex || off ? 'off' : ''}>
                  <td><input type="checkbox" checked=${!ex} disabled=${off} aria-label=${'Include ' + m.code + ' ' + c.kind} onChange=${() => toggle('excludedClasses', c.id)} /></td>
                  <td>${TS.model.KIND_LABEL[c.kind]}${c.userEdited && html` <span className="badge badge-outline">Edited</span>`}</td>
                  <td>${DAYS[v.day]}</td><td className="time">${v.start}–${v.end}</td>
                  <td>${c.room || html`<span className="badge badge-warn">TBC</span>`}</td>
                  <td className="small">${v.weeks === 'all' && c.flag && c.flag.type === 'choice' ? html`<span className="badge badge-warn">Choose above</span>` : TS.model.weeksLabel(v.weeks)}</td>
                  <td style=${{ textAlign: 'right' }}><button className="btn btn-ghost btn-icon btn-sm" aria-label=${'Edit ' + m.code + ' ' + c.kind} onClick=${() => setEditing(c.id)}><${Icon} name="Pencil" size=${14} /></button></td>
                </tr>`;
              })}</tbody>
            </table></div>
            ${ass.length > 0 && html`<div className="imp-sub"><div className="imp-sub-title">Assessments</div>
              ${ass.map((a) => html`<div key=${a.id} className="row-between small"><span className="truncate">${a.title}</span>
                <span className="row" style=${{ gap: '8px', flex: 'none' }}>
                  <span className="mono xs muted">${a.status === 'submitted' ? 'Submitted' : a.week && a.due <= Date.now() ? 'Week ' + a.week + ', passed' : a.due ? T.fmtWhen(a.due) : a.undated ? 'Not published' : a.kind === 'lab-report' ? 'After each lab' : 'Date TBC'}</span>
                  ${a.weight != null ? html`<span className="badge">${a.weight}%</span>` : html`<span className="badge badge-warn">Weight ?</span>`}
                </span></div>`)}
            </div>`}
            ${m.resources && m.resources.length > 0 && html`<div className="imp-sub"><div className="imp-sub-title">Module resources</div>
              ${m.resources.map((r) => { const [ic, cl] = resIcon[r.status] || ['Info', '']; return html`<div key=${r.title} className="res-line small"><${Icon} name=${ic} className=${cl} /><span className="truncate">${r.title}</span>${r.status !== 'read' && html`<span className="xs faint" style=${{ marginLeft: 'auto', flex: 'none' }}>${r.status === 'needs-auth' ? 'Needs sign-in' : 'Partly read'}</span>`}</div>`; })}
            </div>`}
          </div>`;
        })}
      </section>
    <//>`;
  }

  /* ---------------- Step 4: routine ---------------- */
  function DayStrip({ p }) {
    const pct = (hhmm) => (T.toMin(hhmm) / 1440) * 100;
    const segs = [];
    const sleep = T.toMin(p.sleep), wake = T.toMin(p.wake);
    if (sleep > wake) { segs.push(['sleep', 0, wake / 14.4]); segs.push(['sleep', sleep / 14.4, 100]); } else segs.push(['sleep', sleep / 14.4, wake / 14.4]);
    const focusRanges = { morning: ['08:00', '12:00'], afternoon: ['12:00', '17:00'], evening: ['17:00', '22:00'] };
    const ws = Math.max(T.toMin(p.dayStart), wake), we = Math.min(T.toMin(p.dayEnd), sleep > 720 ? sleep - 30 : 1440);
    return html`<div className="daystrip" aria-label="Your study day at a glance">
      <div className="daystrip-bar">
        ${segs.map(([k, a, b], i) => html`<div key=${'s' + i} className="daystrip-seg sleep" style=${{ left: a + '%', width: b - a + '%' }}></div>`)}
        <div className="daystrip-seg window" style=${{ left: ws / 14.4 + '%', width: Math.max(0, we - ws) / 14.4 + '%' }}></div>
        ${p.focus.map((f) => { const [a, b] = focusRanges[f]; const s = Math.max(T.toMin(a), ws), e = Math.min(T.toMin(b), we); return e > s ? html`<div key=${f} className="daystrip-seg focus" style=${{ left: s / 14.4 + '%', width: (e - s) / 14.4 + '%' }}></div>` : null; })}
      </div>
      <div className="daystrip-ticks">${[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => html`<span key=${h} style=${{ left: (h / 24) * 100 + '%' }}>${String(h % 24).padStart(2, '0')}</span>`)}</div>
      <div className="row wrap xs faint" style=${{ gap: '16px' }}>
        <span><span className="cal-legend"><span className="sw" style=${{ background: 'repeating-linear-gradient(135deg, var(--surface-3) 0 3px, transparent 3px 6px)' }}></span></span>Asleep</span>
        <span><span className="cal-legend"><span className="sw" style=${{ background: 'var(--accent-soft)', borderColor: 'var(--accent-line)' }}></span></span>Study window (${T.fromMin(ws)}–${T.fromMin(we)})</span>
        <span><span className="cal-legend"><span className="sw" style=${{ background: 'var(--accent)', borderColor: 'transparent' }}></span></span>Best focus</span>
      </div>
    </div>`;
  }

  function StepRoutine() {
    const p = TS.useStore((s) => s.setup.prefs);
    const set = (patch) => A.setupPrefs(patch);
    const badWindow = T.toMin(p.dayEnd) <= T.toMin(p.dayStart) + 60;
    return html`<${Frame} step="routine" onBack=${() => A.setupGo('review')} onNext=${() => A.setupGo('commitments')} nextDisabled=${badWindow || !p.focus.length}
      note=${badWindow ? 'The study window needs at least an hour' : !p.focus.length ? 'Pick at least one focus time' : 'Sensible defaults are already filled in'}>
      <${Head} title="Set your study hours">Sessions stay inside your study window, and the hardest work goes in your best focus time.<//>
      <${DayStrip} p=${p} />
      <div className="form-grid">
        <div className="field"><span className="field-label">Sleep</span><div className="row"><${TS.TimeInput} label="Bedtime" value=${p.sleep} onChange=${(v) => set({ sleep: v })} /><span className="faint small">to</span><${TS.TimeInput} label="Wake up" value=${p.wake} onChange=${(v) => set({ wake: v })} /></div><span className="field-hint">Nothing is planned within 30 minutes of bedtime.</span></div>
        <div className="field"><span className="field-label">Study window</span><div className="row"><${TS.TimeInput} label="Earliest study" value=${p.dayStart} onChange=${(v) => set({ dayStart: v })} /><span className="faint small">to</span><${TS.TimeInput} label="Latest study" value=${p.dayEnd} onChange=${(v) => set({ dayEnd: v })} invalid=${badWindow} /></div>${badWindow && html`<span className="field-error">End the window at least an hour after it starts.</span>`}</div>
        <div className="field span-2"><span className="field-label">When do you focus best?</span>
          <div className="chip-row">${[['morning', 'Sunrise', 'Mornings'], ['afternoon', 'CloudSun', 'Afternoons'], ['evening', 'Sunset', 'Evenings']].map(([v, ic, l]) => html`<button key=${v} type="button" className="chip" aria-pressed=${p.focus.includes(v)} onClick=${() => set({ focus: p.focus.includes(v) ? p.focus.filter((x) => x !== v) : [...p.focus, v] })}><${Icon} name=${ic} size=${14} />${l}</button>`)}</div>
        </div>
        <div className="field"><span className="field-label">Session length</span>
          <${TS.Seg} label="Session length" value=${p.sessionLen} onChange=${(v) => set({ sessionLen: v })} options=${[{ value: 25, label: '25 min' }, { value: 50, label: '50 min' }, { value: 90, label: '90 min' }]} />
          <span className="field-hint">${p.sessionLen === 25 ? 'Short bursts. Long assignments still get at least 45 minutes.' : p.sessionLen === 50 ? 'A standard block with a 10-minute break.' : 'Deep work. Reviews and recall stay short.'}</span>
        </div>
        <div className="field"><span className="field-label">Most study in one day</span>
          <${TS.Stepper} label="Daily study limit" value=${p.maxStudyMin} min=${60} max=${480} step=${30} format=${(v) => T.fmtDur(v)} onChange=${(v) => set({ maxStudyMin: v })} />
          <span className="field-hint">Outside classes. ${p.lighterWeekends ? 'Weekends get half.' : ''}</span>
        </div>
        <div className="field"><span className="field-label">Breaks between sessions</span>
          <${TS.Seg} label="Break length" value=${p.breakMin} onChange=${(v) => set({ breakMin: v })} options=${[{ value: 5, label: '5 min' }, { value: 10, label: '10 min' }, { value: 15, label: '15 min' }]} />
        </div>
        <div className="field"><span className="field-label">Flex time held back</span>
          <${TS.Seg} label="Flex time" value=${p.buffer} onChange=${(v) => set({ buffer: v })} options=${[{ value: 0.1, label: '10%' }, { value: 0.15, label: '15%' }, { value: 0.25, label: '25%' }]} />
          <span className="field-hint">Kept free for things that come up, so one bad day doesn’t break the week.</span>
        </div>
        <div className="field span-2"><${TS.Switch} id="lighter-we" checked=${p.lighterWeekends} onChange=${(v) => set({ lighterWeekends: v })} label="Keep weekends lighter" /></div>
      </div>
    <//>`;
  }

  /* ---------------- Step 5: commitments ---------------- */
  const PRESETS = {
    work: { title: 'Part-time job', kind: 'work', days: [5], start: '10:00', end: '16:00', location: '' },
    gym: { title: 'Gym', kind: 'gym', days: [0, 2], start: '18:00', end: '19:00', location: 'DCU Sport' },
    sport: { title: 'Football training', kind: 'sport', days: [3], start: '19:30', end: '21:00', location: '' },
    society: { title: 'Robotics Society', kind: 'society', days: [1], start: '19:00', end: '21:00', location: '' },
    personal: { title: '', kind: 'personal', days: [], start: '12:00', end: '13:00', location: '' },
  };

  function StepCommitments() {
    const su = TS.useStore((s) => s.setup);
    const list = su.commitments;
    const setList = (next) => A.setup({ commitments: next });
    const upd = (id, patch) => setList(list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const classes = (su.imported ? su.imported.classes : []).filter((c) => !su.excludedClasses.includes(c.id) && !su.excludedModules.includes(c.module));
    const clashes = (c) => classes.filter((k) => c.days.includes(k.day) && T.toMin(c.start) < T.toMin(k.end) && T.toMin(k.start) < T.toMin(c.end));
    const weekly = TS.sum(list, (c) => Math.max(0, T.toMin(c.end) - T.toMin(c.start)) * c.days.length);
    const invalid = list.some((c) => !c.title.trim() || !c.days.length || T.toMin(c.end) <= T.toMin(c.start));
    return html`<${Frame} step="commitments" onBack=${() => A.setupGo('routine')} onNext=${() => A.setupGo('priorities')} nextDisabled=${invalid}
      note=${invalid ? 'Each commitment needs a name, a day and a valid time' : list.length ? TS.plural(list.length, 'commitment') + ', ' + T.fmtHours(weekly) + ' a week' : 'Optional: you can add these later'}>
      <${Head} title="Add work, sport and societies">These are fixed, like classes. Study is never planned on top of them, and there’s a 15-minute travel buffer either side.<//>
      <div className="chip-row">
        ${Object.entries({ work: 'Part-time job', gym: 'Gym', sport: 'Sport', society: 'Society', personal: 'Something else' }).map(([k, l]) => html`<button key=${k} type="button" className="chip" onClick=${() => setList([...list, { ...PRESETS[k], id: TS.uid('cm') }])}><${Icon} name=${TS.model.COMMIT_KINDS[k].icon} size=${14} />${l}<${Icon} name="Plus" size=${13} /></button>`)}
      </div>
      ${list.length === 0 && html`<${TS.Empty} icon="CalendarPlus" title="Nothing added yet">Add a job, training or society night with the buttons above. Each one comes with typical times you can change.<//>`}
      <div className="stack-sm">
        ${list.map((c) => { const cl = clashes(c); const bad = T.toMin(c.end) <= T.toMin(c.start); return html`<div key=${c.id} className="stack-sm">
          <div className="commit-row">
            <span className="kind"><${Icon} name=${TS.model.COMMIT_KINDS[c.kind].icon} size=${16} /></span>
            <input className="input" aria-label="Name" value=${c.title} placeholder="Name" onChange=${(e) => upd(c.id, { title: e.target.value })} />
            <${TS.DayPick} value=${c.days} onChange=${(v) => upd(c.id, { days: v })} />
            <div className="commit-times"><${TS.TimeInput} label="Start" value=${c.start} onChange=${(v) => upd(c.id, { start: v })} /><span className="faint">–</span><${TS.TimeInput} label="End" value=${c.end} invalid=${bad} onChange=${(v) => upd(c.id, { end: v })} /></div>
            <button className="btn btn-ghost btn-icon btn-sm" aria-label=${'Remove ' + (c.title || 'commitment')} onClick=${() => setList(list.filter((x) => x.id !== c.id))}><${Icon} name="Trash2" size=${15} /></button>
          </div>
          ${cl.length > 0 && html`<div className="notice notice-warn" style=${{ padding: '8px 12px' }}><${Icon} name="TriangleAlert" /><div>Overlaps ${cl.map((k) => k.module + ' ' + TS.model.KIND_LABEL[k.kind] + ' on ' + DAYS[k.day]).join(', ')}. Both will show; check which one you go to.</div></div>`}
          ${bad && html`<div className="field-error">The end time must be after the start time.</div>`}
        </div>`; })}
      </div>
    <//>`;
  }

  /* ---------------- Step 6: priorities ---------------- */
  function StepPriorities() {
    const su = TS.useStore((s) => s.setup);
    const imp = su.imported;
    if (!imp) return null;
    const mods = imp.modules.filter((m) => !su.excludedModules.includes(m.code));
    const rate = (code, patch) => A.setup((d) => ({ ratings: { ...d.ratings, [code]: { difficulty: 2, confidence: 2, ...(d.ratings[code] || {}), ...patch } } }));
    const fakeState = { classes: imp.classes.filter((c) => !su.excludedClasses.includes(c.id)).map((c) => {
      const pick = c.flag && c.flag.type === 'choice' && c.flag.options.find((o) => o.value === su.resolutions[c.flag.id]);
      return { ...c, ...(pick ? pick.patch : {}), moduleId: c.module };
    }) };
    return html`<${Frame} step="priorities" onBack=${() => A.setupGo('commitments')} onNext=${() => A.setupGo('build')} nextLabel="Build my plan" note="You can keep the defaults">
      <${Head} title="Rate your modules">Harder modules and lower confidence get more study time. You can change these later.<//>
      <div className="stack-sm">
        ${mods.map((m, i) => {
          const r = su.ratings[m.code] || { difficulty: 2, confidence: 2 };
          const hue = m.hue != null ? m.hue : [28, 205, 250, 85, 150, 345][imp.modules.indexOf(m) % 6];
          const contact = TS.model.contactMinutesPerWeek(fakeState, m.code);
          const guide = TS.model.independentTargetPerWeek(fakeState, { id: m.code, ects: m.ects || 5 });
          const next = imp.assessments.filter((a) => a.moduleId === m.code && a.due && a.due > Date.now() && a.status !== 'submitted').sort((a, b) => a.due - b.due)[0];
          return html`<div key=${m.code} className="prio-row m" style=${{ '--h': hue }}>
            <div className="prio-meta">
              <div className="row"><span className="pip pip-lg"></span><span className="mono small" style=${{ fontWeight: 600 }}>${m.code}</span><span className="truncate" style=${{ fontWeight: 600 }}>${m.name}</span></div>
              <span className="xs faint">${m.ects || 5} ECTS · ${T.fmtHours(contact)} of classes a week · ECTS guide ≈ ${T.fmtHours(guide, 0)} outside class</span>
              ${next && html`<span className="xs muted">Next: ${next.title}, <span className="mono">${T.fmtWhen(next.due)}</span>${next.weight ? ' · ' + next.weight + '%' : ''}</span>`}
            </div>
            <div className="prio-ctrl"><span className="xs">Difficulty</span><${TS.Seg} label=${'Difficulty of ' + m.code} value=${r.difficulty} onChange=${(v) => rate(m.code, { difficulty: v })} options=${[{ value: 1, label: 'Easy' }, { value: 2, label: 'Medium' }, { value: 3, label: 'Hard' }]} /></div>
            <div className="prio-ctrl"><span className="xs">Confidence</span><${TS.Seg} label=${'Confidence in ' + m.code} value=${r.confidence} onChange=${(v) => rate(m.code, { confidence: v })} options=${[{ value: 1, label: 'Low' }, { value: 2, label: 'OK' }, { value: 3, label: 'High' }]} /></div>
          </div>`;
        })}
      </div>
    <//>`;
  }

  /* ---------------- Step 7: build ---------------- */
  function PlanWeek({ st, now }) {
    const ws = T.weekStart(now);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = T.addDays(ws, i), e = T.addDays(d, 1);
      const fixed = TS.sum(TS.model.expandFixed(st, d, e).filter((o) => !o.cancelled && o.source !== 'block' && o.start >= d && o.start < e), (o) => (o.end - o.start) / T.MIN);
      const study = TS.sum(st.sessions.filter((x) => x.start >= d && x.start < e), (x) => (x.end - x.start) / T.MIN);
      return { i, fixed, study };
    });
    const max = Math.max(60, ...days.map((x) => x.fixed + x.study));
    return html`<div className="stack-sm">
      <div className="plan-week" role="img" aria-label=${'Hours per day: ' + days.map((x) => T.DOW[x.i] + ' ' + T.fmtHours(x.fixed) + ' fixed, ' + T.fmtHours(x.study) + ' study').join('; ')}>
        ${days.map((x) => html`<div key=${x.i} className="plan-day">
          <div className="bars"><i className="s" style=${{ height: (x.study / max) * 100 + '%' }}></i><i className="c" style=${{ height: (x.fixed / max) * 100 + '%' }}></i></div>
          <b>${T.fmtHours(x.fixed + x.study)}</b><span>${T.DOW[x.i]}</span>
        </div>`)}
      </div>
      <div className="row xs faint" style=${{ gap: '16px' }}><span><span className="key key-class"></span>Classes and commitments</span><span><span className="key key-done"></span>Study</span></div>
    </div>`;
  }

  function StepBuild() {
    const [phase, setPhase] = useState('running');
    const [shown, setShown] = useState(0);
    const [lines, setLines] = useState([]);
    const [error, setError] = useState(null);
    const st = TS.useStore();
    const run = () => {
      setPhase('running'); setShown(0); setError(null);
      try {
        const plan = A.finishSetup();
        const s = TS.store.get();
        const now = Date.now();
        const fixed = TS.model.expandFixed(s, T.weekStart(now), plan.horizonEnd);
        const classes = s.classes.filter((c) => c.include !== false && s.modules.find((m) => m.id === c.moduleId && m.include !== false));
        const commitMin = TS.sum(s.commitments, (c) => (T.toMin(c.end) - T.toMin(c.start)) * c.days.length);
        const tasks = plan.tasks.filter((t) => t.status !== 'done');
        const deadlines = tasks.filter((t) => t.assessmentId).length;
        const labTasks = tasks.filter((t) => t.type === 'prelab' || t.type === 'labreport').length;
        const r = plan.report;
        const hard = r.unscheduled.filter((u) => !u.flexible);
        const days = T.daysBetween(r.horizonStart, r.horizonEnd);
        const L = [
          { ok: true, html: html`Read <b>${classes.length}</b> timetabled classes across <b>${s.modules.filter((m) => m.include !== false).length}</b> modules` },
          { ok: true, html: s.commitments.length ? html`Blocked out <b>${TS.plural(s.commitments.length, 'commitment')}</b> (<b>${T.fmtHours(commitMin)}</b> a week) with travel time` : html`No other commitments to work around` },
          { ok: true, html: html`Found <b>${T.fmtHours(r.freeMin)}</b> of free time inside your study window over the next <b>${days}</b> days` },
          { ok: true, html: html`Turned <b>${deadlines}</b> upcoming ${deadlines === 1 ? 'deadline' : 'deadlines'}${labTasks ? html` and <b>${labTasks}</b> pre-lab and lab-report tasks` : ''} into <b>${tasks.length}</b> pieces of work` },
          { ok: true, html: html`Placed <b>${r.sessionsCount}</b> study sessions (<b>${T.fmtHours(r.plannedMin)}</b>) around your classes, with breaks` },
          { ok: true, html: html`Held back <b>${T.fmtHours(r.capacityMin * s.prefs.buffer)}</b> as flex time, <b>${T.fmtHours(r.bufferMin)}</b> of it marked on the calendar` },
          hard.length ? { ok: false, html: html`<b>${TS.plural(hard.length, 'piece')}</b> of deadline work won’t fully fit. You decide what happens next.` } : { ok: true, html: html`Everything with a deadline fits before it’s due` },
        ];
        setLines(L);
      } catch (e) { setError(e.message); setPhase('error'); }
    };
    useEffect(() => { run(); }, []);
    useEffect(() => {
      if (phase !== 'running' || !lines.length) return;
      if (shown >= lines.length) { const t = setTimeout(() => setPhase('done'), 350); return () => clearTimeout(t); }
      const t = setTimeout(() => setShown(shown + 1), shown === 0 ? 250 : 420);
      return () => clearTimeout(t);
    }, [phase, shown, lines]);

    const r = st.planReport;
    const now = Date.now();
    const weekEnd = T.addDays(T.weekStart(now), 7);
    const thisWeek = st.sessions.filter((x) => x.start < weekEnd);
    const fixedWeek = TS.model.expandFixed(st, T.weekStart(now), weekEnd).filter((o) => !o.cancelled);
    const classMin = TS.sum(fixedWeek.filter((o) => o.source === 'class'), (o) => (o.end - o.start) / T.MIN);
    const commitMinWeek = TS.sum(fixedWeek.filter((o) => o.source === 'commitment'), (o) => (o.end - o.start) / T.MIN);
    const hard = r ? r.unscheduled.filter((u) => !u.flexible) : [];
    const soft = r ? r.unscheduled.filter((u) => u.flexible) : [];
    const deferred = r ? r.unscheduled.filter((u) => u.deferred && u.type !== 'examprep' && u.minutes >= 60 && u.due) : [];
    const examTasks = st.tasks.filter((t) => t.type === 'examprep' && t.status !== 'done');
    const examTotal = TS.sum(examTasks, (t) => TS.model.taskEstimate(t) - (t.done || 0));
    const examShort = r ? TS.sum(r.unscheduled.filter((u) => u.type === 'examprep'), (u) => u.minutes) : 0;
    const fair = r ? r.partials.filter((p) => p.total >= 120 && !deferred.some((u) => u.taskId === p.taskId)) : [];
    const firstName = st.profile ? st.profile.name : '';
    const raiseCap = () => { A.setupPrefs({ maxStudyMin: Math.min(480, st.setup.prefs.maxStudyMin + 60) }); run(); };

    return html`<${Frame} step="build" hideFoot=${true}>
      <${Head} title=${phase === 'done' ? (firstName && firstName !== 'Student' ? firstName + ', your first plan is ready' : 'Your first plan is ready') : 'Building your plan…'}>
        ${phase === 'done' ? 'Open any session to see why it’s there.' : 'Working through your timetable, deadlines and routine.'}
      <//>
      ${error && html`<div className="notice notice-danger"><${Icon} name="CircleX" /><div>${error}</div></div>`}
      <ol className="gen-steps" aria-live="polite">
        ${lines.slice(0, shown).map((l, i) => html`<li key=${i} className=${l.ok ? '' : 'warn'}><${Icon} name=${l.ok ? 'CircleCheck' : 'TriangleAlert'} size=${18} /><span>${l.html}</span></li>`)}
      </ol>
      ${phase === 'done' && r && html`<div className="gen">
        <p className="summary-line">This week: <b>${T.fmtHours(classMin)}</b> of classes${commitMinWeek ? html`, <b>${T.fmtHours(commitMinWeek)}</b> of work and activities` : ''} and <b>${T.fmtHours(TS.sum(thisWeek, (x) => (x.end - x.start) / T.MIN))}</b> of study across ${TS.plural(thisWeek.length, 'session')}.</p>
        <${PlanWeek} st=${st} now=${now} />
        ${hard.map((u) => html`<div key=${u.taskId} className="notice notice-warn"><${Icon} name="TriangleAlert" /><div className="stack-sm" style=${{ gap: '8px' }}>
          <span><strong>${T.fmtDur(u.minutes)} of “${u.title}” won’t fit before ${T.fmtWhen(u.due)}.</strong> ${u.reason.text}</span>
          <div className="row wrap">
            ${u.reason.code === 'cap' && st.setup.prefs.maxStudyMin < 480 && html`<button className="btn btn-secondary btn-sm" onClick=${raiseCap}>Allow 1 more hour a day</button>`}
            <span className="xs muted">You can also lower the estimate, move a commitment, or ask for an extension. It stays on your Today page until it’s sorted.</span>
          </div></div></div>`)}
        ${soft.filter((u) => !u.deferred).length > 0 && html`<div className="notice"><${Icon} name="Info" /><div>${T.fmtHours(TS.sum(soft.filter((u) => !u.deferred), (u) => u.minutes))} of optional practice (lecture reviews, recall, tutorial prep) didn’t fit. It has no graded deadline, so it waits for spare time.</div></div>`}
        ${fair.length > 0 && html`<div className="notice"><${Icon} name="CalendarClock" /><div>Work due later is started now, a fair share at a time: ${fair.map((p) => p.title + ' (' + T.fmtHours(p.planned) + ' of ' + T.fmtHours(p.total) + ' in the next two weeks)').join('; ')}. The rest is planned as those weeks come up.</div></div>`}
        ${examTasks.length > 0 && st.semester && st.semester.examWindow && html`<div className=${cx('notice', examShort >= 30 && 'notice-warn')}><${Icon} name="GraduationCap" /><div>
          <strong>Exam revision: ${T.fmtHours(examTotal - examShort)} of a suggested ${T.fmtHours(examTotal)} is planned</strong> before the exam period starts on ${T.fmtDayMonth(st.semester.examWindow.start)}.${examShort >= 30 ? ' Your daily study limit leaves ' + T.fmtHours(examShort) + ' unplanned.' : ''}
          ${examShort >= 30 && st.setup.prefs.maxStudyMin < 480 && html`<div style=${{ marginTop: '8px' }}><button className="btn btn-secondary btn-sm" onClick=${raiseCap}>Allow 1 more hour a day</button></div>`}</div></div>`}
        ${deferred.length > 0 && html`<div className="notice notice-warn"><${Icon} name="Hourglass" /><div><strong>These two weeks are full.</strong> ${deferred.map((u) => T.fmtHours(u.minutes) + ' of “' + u.title + '”').join(' and ')} had to wait until after this plan, closer to ${deferred.length > 1 ? 'their deadlines' : 'its deadline'}. Raising your daily limit or dropping a commitment would let it start sooner.
          ${st.setup.prefs.maxStudyMin < 480 && html`<div style=${{ marginTop: '8px' }}><button className="btn btn-secondary btn-sm" onClick=${raiseCap}>Allow 1 more hour a day</button></div>`}</div></div>`}
        <div className="row wrap" style=${{ gap: '10px' }}>
          <button className="btn btn-primary btn-lg" onClick=${() => A.enterApp()} data-autofocus>Go to Today <${Icon} name="ArrowRight" /></button>
          <button className="btn btn-secondary btn-lg" onClick=${() => { A.enterApp(); setTimeout(() => TS.go('week'), 0); }}><${Icon} name="CalendarDays" />See my week</button>
          <button className="btn btn-ghost" onClick=${() => A.setupGo('priorities')}>Change my answers</button>
        </div>
      </div>`}
    <//>`;
  }

  function SetupView() {
    const step = TS.useStore((s) => s.setup.step);
    switch (step) {
      case 'uni': return html`<${StepUni} />`;
      case 'source': return html`<${StepSource} />`;
      case 'review': return html`<${StepReview} />`;
      case 'routine': return html`<${StepRoutine} />`;
      case 'commitments': return html`<${StepCommitments} />`;
      case 'priorities': return html`<${StepPriorities} />`;
      case 'build': return html`<${StepBuild} key="build" />`;
      default: return html`<${Welcome} />`;
    }
  }

  TS.SetupView = SetupView;
  TS.DayStrip = DayStrip;
})();
