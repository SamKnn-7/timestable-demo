/* App shell, navigation and routing. */
(() => {
  const TS = window.TS;
  const { html, Icon, useEffect, cx } = TS;
  const T = TS.time;

  const NAV = [
    { id: 'today', label: 'Today', icon: 'House' },
    { id: 'week', label: 'Week', icon: 'CalendarDays' },
    { id: 'tasks', label: 'Tasks', icon: 'ListChecks' },
    { id: 'modules', label: 'Modules', icon: 'Library' },
    { id: 'insights', label: 'Insights', icon: 'ChartPie' },
    { id: 'explore', label: 'Explore', icon: 'Compass' },
    { id: 'preferences', label: 'Preferences', icon: 'SlidersHorizontal' },
  ];

  function TermCard({ st }) {
    if (!st.semester) return null;
    const tw = TS.sel.teachingWeek(st, Date.now());
    const n = st.semester.teachingWeeks;
    return html`<div className="term" aria-label=${'Teaching week ' + tw + ' of ' + n}>
      <div className="row-between"><span className="small" style=${{ fontWeight: 600 }}>${st.semester.label}</span><span className="xs faint mono">Week ${Math.min(tw, n)}/${n}</span></div>
      <div className="term-weeks">${Array.from({ length: n }, (_, i) => html`<span key=${i} className=${i + 1 < tw ? 'past' : i + 1 === tw ? 'now' : ''}></span>`)}</div>
      <span className="xs faint">${tw <= n ? TS.plural(n - tw, 'teaching week') + ' after this one' : 'Teaching has finished'}</span>
    </div>`;
  }

  function Shell({ route, children }) {
    const st = TS.useStore();
    const now = Date.now();
    const active = route.name === 'module' ? 'modules' : route.name || 'today';
    const dueSoon = st.tasks.filter((t) => t.status !== 'done' && t.due && t.due > now && t.due < T.addDays(now, 7) && (t.assessmentId || t.source === 'user' || t.type === 'labreport')).length;
    return html`<div className="app">
      <nav className="rail" aria-label="Main">
        <${TS.Brand} />
        <div className="nav">
          ${NAV.map((n) => html`<a key=${n.id} className="nav-item" href=${'#' + n.id} aria-current=${active === n.id ? 'page' : null}>
            <${Icon} name=${n.icon} size=${17} /><span>${n.label}</span>${n.id === 'tasks' && dueSoon > 0 && html`<span className="nav-count" title="Deadlines in the next 7 days">${dueSoon}</span>`}</a>`)}
        </div>
        <div className="rail-foot">
          <${TermCard} st=${st} />
          <${TS.DemoFlag}>Simulated Loop connection<//>
        </div>
      </nav>
      <div className="main">
        <header className="topbar">
          <${TS.Brand} />
          <div className="row" style=${{ gap: '6px' }}>
            ${st.semester && html`<span className="xs faint mono">Wk ${TS.sel.teachingWeek(st, now)}</span>`}
            <${TS.Menu} label="More" items=${[{ label: 'Explore modules', icon: 'Compass', run: () => TS.go('explore') }, { label: 'Preferences', icon: 'SlidersHorizontal', run: () => TS.go('preferences') }]} />
          </div>
        </header>
        <main id="main">${children}</main>
      </div>
      <nav className="tabbar" aria-label="Main">
        ${NAV.slice(0, 5).map((n) => html`<a key=${n.id} href=${'#' + n.id} aria-current=${active === n.id ? 'page' : null}><${Icon} name=${n.icon} size=${20} /><span>${n.label}</span></a>`)}
      </nav>
    </div>`;
  }

  function App() {
    const onboarded = TS.useStore((s) => s.onboarded);
    const route = TS.useRoute();
    useEffect(() => {
      const names = { today: 'Today', week: 'Week', tasks: 'Tasks', modules: 'Modules', module: route.param, insights: 'Insights', explore: 'Explore', preferences: 'Preferences' };
      document.title = onboarded ? (names[route.name] || 'Today') + ' · ' + TS.brand.name : TS.brand.name + ' · Set up';
    }, [route, onboarded]);
    let view;
    if (!onboarded) view = html`<${TS.SetupView} />`;
    else {
      let page;
      switch (route.name) {
        case 'week': page = html`<${TS.WeekView} />`; break;
        case 'tasks': page = html`<${TS.TasksView} />`; break;
        case 'modules': page = html`<${TS.ModulesView} />`; break;
        case 'module': page = html`<${TS.ModuleDetail} id=${route.param} key=${route.param} />`; break;
        case 'insights': page = html`<${TS.InsightsView} />`; break;
        case 'explore': page = html`<${TS.ExploreView} />`; break;
        case 'preferences': page = html`<${TS.PrefsView} />`; break;
        default: page = html`<${TS.TodayView} />`;
      }
      view = html`<${Shell} route=${route}>${page}<//>`;
    }
    return html`<${TS.Fragment}><button className="skip-link" onClick=${() => { const m = document.querySelector('main'); if (m) { m.setAttribute('tabindex', '-1'); m.focus(); } }}>Skip to content</button>${view}<${TS.OverlayHost} /><${TS.Toasts} /><//>`;
  }

  /* Error boundary so one broken view never blanks the app. */
  class Boundary extends React.Component {
    constructor(p) { super(p); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(error, info) { console.error(error, info); }
    render() {
      if (this.state.error) {
        return html`<div className="page" style=${{ maxWidth: '640px' }}><div className="stack">
          <h1 className="h1">Something went wrong on this screen</h1>
          <p className="muted">${String(this.state.error && this.state.error.message)}</p>
          <div className="row"><button className="btn btn-primary" onClick=${() => { this.setState({ error: null }); TS.go('today'); }}>Back to Today</button>
          <button className="btn btn-ghost" onClick=${() => { TS.actions.resetAll(); this.setState({ error: null }); }}>Reset the demo</button></div>
        </div></div>`;
      }
      return this.props.children;
    }
  }

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(html`<${Boundary}><${App} /><//>`);
})();
