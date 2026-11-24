/* Explore: structured module reviews for next-year planning.
   All reviews shipped with the demo are SAMPLE CONTENT written for the demo and labelled as such. */
(() => {
  const TS = window.TS;
  const { html, Icon, useState, useMemo, cx } = TS;
  const A = TS.actions;

  const CATS = [['clarity', 'Teaching clarity'], ['workload', 'Workload (5 = heavy)'], ['difficulty', 'Assessment difficulty'], ['organisation', 'Organisation'], ['usefulness', 'Practical usefulness'], ['overall', 'Overall']];
  const TAGS = ['Helpful tutorials', 'Heavy weekly workload', 'Exam-focused', 'Great labs', 'Clear notes', 'Recordings available', 'Steep start', 'Project-based', 'Fair marking', 'Fast-paced'];

  const CATALOGUE = [
    { code: 'EE317', name: 'Embedded Systems', ects: 5, year: 3, option: true, hue: 345 },
    { code: 'EE324', name: 'Control Engineering', ects: 5, year: 3, option: false, hue: 115 },
    { code: 'EE345', name: 'Communication Systems', ects: 5, year: 3, option: true, hue: 180 },
    { code: 'CA326', name: 'Software Engineering Project', ects: 10, year: 3, option: true, hue: 15 },
    { code: 'CA218', name: 'Object-Oriented Programming', ects: 5, year: 2, hue: 250 },
    { code: 'CA216', name: 'Operating Systems', ects: 5, year: 2, hue: 205 },
  ];
  const r = (clarity, workload, difficulty, organisation, usefulness, overall) => ({ clarity, workload, difficulty, organisation, usefulness, overall });
  const SAMPLE = [
    { id: 'sr1', code: 'EE317', year: '2024/25', verified: true, ratings: r(4, 4, 3, 4, 5, 5), tags: ['Great labs', 'Project-based'], helpful: 14, text: 'The best module of third year if you like hands-on work. The weekly labs on the microcontroller boards build up to the final project, so nothing comes out of nowhere. Start the project early; the last two weeks get busy.' },
    { id: 'sr2', code: 'EE317', year: '2024/25', verified: false, ratings: r(3, 4, 3, 3, 5, 4), tags: ['Steep start'], helpful: 4, text: 'The first three weeks assume you remember a lot of C from second year. Worth revising pointers and bit manipulation over the summer.' },
    { id: 'sr3', code: 'EE317', year: '2023/24', verified: true, ratings: r(4, 3, 3, 4, 4, 4), tags: ['Clear notes', 'Fair marking'], helpful: 7, text: 'Well organised with clear lab sheets. Marking rubric was shared at the start which helped a lot with the reports.' },
    { id: 'sr4', code: 'EE324', year: '2024/25', verified: true, ratings: r(3, 3, 4, 3, 4, 3), tags: ['Exam-focused', 'Helpful tutorials'], helpful: 11, text: 'Mostly exam-weighted. The tutorial problem sets are close to the exam style, so doing them every week is the real study plan. Root locus took me a while.' },
    { id: 'sr5', code: 'EE324', year: '2023/24', verified: true, ratings: r(4, 3, 4, 4, 4, 4), tags: ['Recordings available'], helpful: 3, text: 'Lectures were recorded, which was useful for the Laplace parts. MATLAB labs were short but relevant.' },
    { id: 'sr6', code: 'EE345', year: '2024/25', verified: true, ratings: r(4, 2, 3, 4, 3, 4), tags: ['Clear notes', 'Fair marking'], helpful: 6, text: 'Moderate workload compared to the rest of third year. Heavy on maths at the start, more applied later. Good option if you want breathing room for the project.' },
    { id: 'sr7', code: 'CA326', year: '2024/25', verified: true, ratings: r(3, 5, 3, 3, 5, 4), tags: ['Project-based', 'Heavy weekly workload'], helpful: 19, text: 'A full team project across the year. Very useful for interviews, but the weekly time it takes is real. Pick your team carefully and agree on meeting times early.' },
    { id: 'sr8', code: 'CA326', year: '2023/24', verified: false, ratings: r(2, 5, 2, 2, 4, 3), tags: ['Heavy weekly workload'], helpful: 2, text: 'Milestones were not always clear until close to the deadline. Ask questions in the first labs.' },
    { id: 'sr11', code: 'CA218', year: '2024/25', verified: true, ratings: r(5, 4, 3, 4, 5, 5), tags: ['Clear notes', 'Fast-paced'], helpful: 12, text: 'Very clear lectures and the assignments are fair. They ramp up quickly, so start each one the week it’s released.' },
  ];

  const avg = (list, k) => (list.length ? TS.sum(list, (x) => x.ratings[k]) / list.length : 0);

  function Dots({ v }) { return html`<span className="dots" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => html`<i key=${i} className=${i <= Math.round(v) ? 'on' : ''}></i>`)}</span>`; }

  function moderate(text) {
    const issues = [];
    if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text)) issues.push('Remove email addresses.');
    if (/(\+?\d[\d\s-]{7,}\d)/.test(text)) issues.push('Remove phone numbers.');
    if (/\b(idiot|stupid|useless|hate|lazy|incompetent|clueless)\b/i.test(text)) issues.push('Keep it about the teaching and coursework. Reviews that attack someone personally are removed.');
    if (text.trim().length < 40) issues.push('Write at least 40 characters so it’s useful to someone choosing modules.');
    return issues;
  }

  function WriteReview({ mod, onDone }) {
    const [ratings, setRatings] = useState({});
    const [tags, setTags] = useState([]);
    const [text, setText] = useState('');
    const [tried, setTried] = useState(false);
    const issues = moderate(text);
    const missing = CATS.filter(([k]) => !ratings[k]).length;
    const submit = () => {
      setTried(true);
      if (issues.length || missing) return;
      A.addReview({ code: mod.code, ratings, tags, text: text.trim(), year: '2026/27', verified: true });
      TS.toast('Review sent for moderation. It appears publicly once approved.', { tone: 'ok' });
      onDone();
    };
    return html`<section className="panel panel-pad stack" aria-label="Write a review">
      <div className="row-between"><h3 className="h3">Review ${mod.code}</h3><span className="badge badge-ok"><${Icon} name="BadgeCheck" size=${12} />Verified enrolment</span></div>
      <p className="xs faint">Verified because ${mod.code} is in your imported timetable. Reviews are anonymous to other students and checked by a moderator before they appear.</p>
      <div className="stack-sm">${CATS.map(([k, l]) => html`<div key=${k} className="row-between wrap"><span className="small">${l}</span>
        <div className="rate-input" role="group" aria-label=${l}>${[1, 2, 3, 4, 5].map((n) => html`<button key=${n} type="button" aria-pressed=${ratings[k] === n} onClick=${() => setRatings({ ...ratings, [k]: n })}>${n}</button>`)}</div></div>`)}</div>
      <div className="field"><span className="field-label">Tags <span className="faint" style=${{ fontWeight: 400 }}>(up to 3)</span></span>
        <div className="chip-row">${TAGS.map((t) => html`<button key=${t} type="button" className="chip" aria-pressed=${tags.includes(t)} onClick=${() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : tags.length < 3 ? [...tags, t] : tags)}>${t}</button>`)}</div></div>
      <div className="field"><label className="field-label" htmlFor="rv-text">Your review</label>
        <textarea id="rv-text" className="textarea" maxLength="1200" placeholder="What would you tell someone choosing this module? Workload, how it’s assessed, what helped." value=${text} onChange=${(e) => setText(e.target.value)}></textarea>
        <span className="field-hint">${text.length}/1200 · Don’t include names of other students or anyone’s contact details.</span></div>
      ${tried && (issues.length > 0 || missing > 0) && html`<div className="notice notice-danger"><${Icon} name="CircleX" /><div>${missing ? html`<div>Rate all ${CATS.length} categories (${missing} left).</div>` : ''}${issues.map((i) => html`<div key=${i}>${i}</div>`)}</div></div>`}
      <div className="row"><button className="btn btn-primary" onClick=${submit}>Submit for moderation</button><button className="btn btn-ghost" onClick=${onDone}>Cancel</button></div>
    </section>`;
  }

  function ExploreView() {
    const st = TS.useStore();
    const mine = new Set(st.modules.map((m) => m.code));
    // A course on DCU's published timetable shows only its real modules, never the sample catalogue or sample reviews.
    const official = !!(st.semester && st.semester.official);
    const catalogue = useMemo(() => {
      const own = st.modules.map((m) => ({ code: m.code, name: m.name, ects: m.ects, year: st.profile ? st.profile.year : 2, hue: m.hue }));
      if (official) return own;
      return [...CATALOGUE, ...own.filter((m) => !CATALOGUE.some((c) => c.code === m.code))];
    }, [st.modules, official]);
    const [filter, setFilter] = useState(official ? 'mine' : 'next');
    const [q, setQ] = useState('');
    const [sel, setSel] = useState(official && st.modules[0] ? st.modules[0].code : CATALOGUE[0].code);
    const [writing, setWriting] = useState(false);
    const [sort, setSort] = useState('helpful');
    const [reporting, setReporting] = useState(null);
    const list = catalogue.filter((c) => (filter === 'all' || (filter === 'next' ? c.year === (st.profile ? st.profile.year + 1 : 3) : mine.has(c.code))) && (c.code + ' ' + c.name).toLowerCase().includes(q.toLowerCase()));
    const mod = catalogue.find((c) => c.code === sel) || list[0];
    const reviewsFor = (code) => (official ? [] : SAMPLE).filter((x) => x.code === code && !st.reviews.reported.includes(x.id));
    const reviews = mod ? reviewsFor(mod.code).slice().sort((a, b) => (sort === 'helpful' ? b.helpful - a.helpful : b.year.localeCompare(a.year))) : [];
    const myReviews = mod ? st.reviews.mine.filter((x) => x.code === mod.code) : [];
    const tagCount = new Map();
    reviews.forEach((x) => x.tags.forEach((t) => tagCount.set(t, (tagCount.get(t) || 0) + 1)));
    return html`<div className="page">
      <header className="page-head">
        <div><h1 className="h1">${official ? 'Module reviews' : 'Module reviews for next year'}</h1></div>
        ${!official && html`<${TS.DemoFlag}>Sample reviews<//>`}
      </header>
      ${!official && html`<div className="notice" style=${{ marginBottom: '20px' }}><${Icon} name="Info" /><div>The reviews here are sample content written for this demo. In the product they come from students, are checked by moderators, and describe <strong>past years</strong>: lecturers, content and assessment change, so check the current module descriptor too.</div></div>`}
      <div className="explore">
        <aside className="stack-sm">
          ${!official && html`<${TS.Seg} block label="Which modules" value=${filter} onChange=${setFilter} options=${[{ value: 'next', label: 'Next year' }, { value: 'mine', label: 'My modules' }, { value: 'all', label: 'All' }]} />`}
          <input className="input" type="search" aria-label="Search modules" placeholder="Search by code or name" value=${q} onChange=${(e) => setQ(e.target.value)} />
          <div className="mod-list">
            ${list.map((c) => { const rv = reviewsFor(c.code); return html`<button key=${c.code} type="button" aria-current=${mod && mod.code === c.code} onClick=${() => { setSel(c.code); setWriting(false); }}>
              <span className="row" style=${{ gap: '8px', minWidth: 0 }}><${TS.Pip} hue=${c.hue} /><span className="mono small" style=${{ fontWeight: 600 }}>${c.code}</span><span className="truncate small">${c.name}</span></span>
              <span className="xs faint mono">${rv.length ? avg(rv, 'overall').toFixed(1) : '—'}</span>
              <span className="xs faint" style=${{ gridColumn: '1 / -1' }}>${c.ects} ECTS · Year ${c.year}${c.option ? ' · Option' : ''} · ${TS.plural(rv.length, 'review')}</span>
            </button>`; })}
            ${list.length === 0 && html`<p className="small muted" style=${{ padding: '8px' }}>No modules match.</p>`}
          </div>
        </aside>
        ${mod && html`<section className="stack" style=${{ minWidth: 0 }}>
          <div className="row-between wrap"><div><div className="row" style=${{ gap: '10px' }}><${TS.Pip} hue=${mod.hue} lg /><span className="mono" style=${{ fontWeight: 600 }}>${mod.code}</span><h2 className="h2">${mod.name}</h2></div>
            <p className="small muted" style=${{ marginTop: '4px' }}>${mod.ects} ECTS · Year ${mod.year}${mod.option ? ' option' : ''} · ${TS.plural(reviews.length, 'review')}, ${reviews.filter((x) => x.verified).length} verified</p></div>
            ${mine.has(mod.code) && !writing && html`<button className="btn btn-secondary btn-sm" onClick=${() => setWriting(true)}><${Icon} name="Pencil" />Write a review</button>`}</div>
          ${writing && html`<${WriteReview} mod=${mod} onDone=${() => setWriting(false)} />`}
          ${reviews.length > 0 ? html`<div className="panel panel-pad stack">
            <div className="ratings">${CATS.map(([k, l]) => { const v = avg(reviews, k); return html`<div key=${k} className="rating"><div className="rating-top"><span>${l}</span><b>${v.toFixed(1)}</b></div><${TS.Meter} value=${v / 5} thin label=${l} /></div>`; })}</div>
            ${tagCount.size > 0 && html`<div className="chip-row">${[...tagCount.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => html`<span key=${t} className="badge badge-outline">${t} · ${n}</span>`)}</div>`}
          </div>` : html`<${TS.Empty} icon="MessageSquare" title="No reviews yet">${mine.has(mod.code) ? 'You’re enrolled, so you could write the first one.' : 'Nobody has reviewed this module yet.'}<//>`}
          ${myReviews.map((x) => html`<div key=${x.id} className="review"><div className="row" style=${{ gap: '8px' }}><span className="badge badge-warn">Pending moderation</span><span className="xs faint">Your review · only you can see it</span></div><p className="review-body">${x.text}</p></div>`)}
          ${reviews.length > 0 && html`<div><div className="row-between"><h3 className="h3">Reviews</h3><${TS.Seg} label="Sort" value=${sort} onChange=${setSort} options=${[{ value: 'helpful', label: 'Most helpful' }, { value: 'recent', label: 'Most recent' }]} /></div>
            ${reviews.map((x) => html`<article key=${x.id} className="review">
              <div className="row wrap" style=${{ gap: '10px' }}><span className="xs faint mono">${x.year}</span>${x.verified ? html`<span className="badge badge-ok"><${Icon} name="BadgeCheck" size=${11} />Verified enrolment</span>` : html`<span className="badge badge-outline">Unverified</span>`}
                <span className="row xs faint" style=${{ gap: '6px' }}>Overall <${Dots} v=${x.ratings.overall} /></span><span className="row xs faint" style=${{ gap: '6px' }}>Workload <${Dots} v=${x.ratings.workload} /></span></div>
              <p className="review-body">${x.text}</p>
              <div className="review-foot">${x.tags.map((t) => html`<span key=${t} className="badge">${t}</span>`)}<span>${x.helpful} found this helpful</span>
                ${reporting === x.id ? html`<span className="row wrap" style=${{ gap: '6px' }}>${['Personal attack', 'Private information', 'Not about the module', 'Spam'].map((reason) => html`<button key=${reason} className="btn btn-secondary btn-sm" onClick=${() => { A.reportReview(x.id); setReporting(null); TS.toast('Reported as “' + reason + '”. It’s hidden for you while a moderator looks at it.', { tone: 'ok' }); }}>${reason}</button>`)}<button className="btn btn-ghost btn-sm" onClick=${() => setReporting(null)}>Cancel</button></span>`
                  : html`<button className="link-btn xs" style=${{ color: 'var(--text-3)' }} onClick=${() => setReporting(x.id)}><${Icon} name="Flag" size=${11} /> Report</button>`}
              </div>
            </article>`)}
          </div>`}
        </section>`}
      </div>
    </div>`;
  }

  TS.ExploreView = ExploreView;
})();
