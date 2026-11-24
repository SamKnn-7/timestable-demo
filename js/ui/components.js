/* Shared UI primitives. */
(() => {
  const TS = window.TS;
  const { html, Icon, useEffect, useRef, useState, cx } = TS;
  const T = TS.time;

  /* ---------- Overlay manager (one sheet/dialog at a time) ---------- */
  const overlayStore = TS.createStore(null);
  TS.openOverlay = (kind, props = {}) => overlayStore.set(() => ({ kind, props, key: TS.uid('ov') }));
  TS.closeOverlay = () => overlayStore.set(() => null);
  TS.useOverlay = () => TS.useSyncExternalStore(overlayStore.subscribe, overlayStore.get);

  function useDismiss(onClose) {
    const ref = useRef(null);
    useEffect(() => {
      const prev = document.activeElement;
      const node = ref.current;
      const first = node && node.querySelector('[data-autofocus], input, select, textarea, button:not([data-skipfocus])');
      if (first) setTimeout(() => first.focus(), 30);
      const onKey = (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
        if (e.key === 'Tab' && node) {
          const f = [...node.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
          if (!f.length) return;
          const a = f[0], b = f[f.length - 1];
          if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
          else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
        }
      };
      document.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
      return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; if (prev && prev.focus) prev.focus(); };
    }, []);
    return ref;
  }

  function Dialog({ title, sub, onClose, children, footer, wide, icon }) {
    const ref = useDismiss(onClose);
    return html`
      <div className="overlay" onMouseDown=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className=${cx('dialog', wide && 'dialog-wide')} role="dialog" aria-modal="true" aria-label=${title} ref=${ref}>
          <div className="dialog-head">
            ${icon && html`<div className="choice-icon"><${Icon} name=${icon} size=${17} /></div>`}
            <div className="grow"><h2 className="h2">${title}</h2>${sub && html`<p className="small muted">${sub}</p>`}</div>
            <button className="btn btn-ghost btn-icon btn-sm" onClick=${onClose} aria-label="Close" data-skipfocus><${Icon} name="X" /></button>
          </div>
          <div className="dialog-body">${children}</div>
          ${footer && html`<div className="dialog-foot">${footer}</div>`}
        </div>
      </div>`;
  }

  function Sheet({ title, eyebrow, onClose, children, footer, headExtra, hue }) {
    const ref = useDismiss(onClose);
    return html`
      <div className="overlay sheet-overlay" onMouseDown=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <aside className=${cx('sheet', hue != null && 'm')} style=${hue != null ? { '--h': hue } : null} role="dialog" aria-modal="true" aria-label=${title} ref=${ref}>
          <div className="sheet-head">
            <div className="grow stack-sm" style=${{ gap: '6px' }}>
              ${eyebrow && html`<div className="row small muted">${eyebrow}</div>`}
              <h2 className="h2">${title}</h2>
              ${headExtra}
            </div>
            <button className="btn btn-ghost btn-icon btn-sm" onClick=${onClose} aria-label="Close" data-skipfocus><${Icon} name="X" /></button>
          </div>
          <div className="sheet-body">${children}</div>
          ${footer && html`<div className="sheet-foot">${footer}</div>`}
        </aside>
      </div>`;
  }

  function Toasts() {
    const list = TS.useToasts();
    const icons = { ok: 'CircleCheck', warn: 'TriangleAlert', danger: 'CircleX', info: 'Info' };
    return html`<div className="toasts" role="status" aria-live="polite">
      ${list.map((t) => html`
        <div key=${t.id} className=${cx('toast', t.tone)}>
          <${Icon} name=${icons[t.tone] || 'Info'} />
          <div className="grow">${t.message}</div>
          ${t.action && html`<button className="btn btn-secondary btn-sm" onClick=${() => { t.action.run(); TS.dismissToast(t.id); }}>${t.action.label}</button>`}
          <button className="btn btn-ghost btn-icon btn-sm" aria-label="Dismiss" onClick=${() => TS.dismissToast(t.id)}><${Icon} name="X" size=${14} /></button>
        </div>`)}
    </div>`;
  }

  function Seg({ value, options, onChange, block, label, size }) {
    return html`<div className=${cx('seg', block && 'seg-block')} role="group" aria-label=${label}>
      ${options.map((o) => html`<button type="button" key=${String(o.value)} className="seg-opt" aria-pressed=${value === o.value} onClick=${() => onChange(o.value)} title=${o.title || null}>${o.label}</button>`)}
    </div>`;
  }

  function Switch({ checked, onChange, label, id }) {
    return html`<label className="switch" htmlFor=${id}>
      <input id=${id} type="checkbox" checked=${!!checked} onChange=${(e) => onChange(e.target.checked)} />
      <span className="switch-track" aria-hidden="true"></span>
      ${label && html`<span>${label}</span>`}
    </label>`;
  }

  function DayPick({ value, onChange, label = 'Days' }) {
    const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    return html`<div className="daypick" role="group" aria-label=${label}>
      ${letters.map((l, i) => html`<button type="button" key=${i} aria-pressed=${value.includes(i)} aria-label=${T.DOW_LONG[i]}
        onClick=${() => onChange(value.includes(i) ? value.filter((d) => d !== i) : [...value, i].sort())}>${l}</button>`)}
    </div>`;
  }

  function Stepper({ value, onChange, min, max, step, format, label }) {
    return html`<div className="stepper" role="group" aria-label=${label}>
      <button type="button" aria-label="Decrease" disabled=${value <= min} onClick=${() => onChange(Math.max(min, value - step))}><${Icon} name="Minus" size=${14} /></button>
      <output aria-live="polite">${format ? format(value) : value}</output>
      <button type="button" aria-label="Increase" disabled=${value >= max} onClick=${() => onChange(Math.min(max, value + step))}><${Icon} name="Plus" size=${14} /></button>
    </div>`;
  }

  function TimeInput({ value, onChange, id, label, invalid }) {
    return html`<input id=${id} className="input input-time" type="time" step="900" value=${value} aria-label=${label} aria-invalid=${invalid ? 'true' : 'false'}
      onChange=${(e) => e.target.value && onChange(e.target.value)} />`;
  }

  function ModTag({ module, short }) {
    if (!module) return null;
    return html`<span className="badge m" style=${{ '--h': module.hue }}><span className="pip"></span><span className="mono">${module.code}</span>${!short && html`<span style=${{ fontWeight: 500 }}>${module.name}</span>`}</span>`;
  }

  function Pip({ hue, lg }) { return html`<span className=${cx('pip m', lg && 'pip-lg')} style=${{ '--h': hue }}></span>`; }

  function Meter({ value, hue, thin, label }) {
    return html`<div className=${cx('meter', hue != null && 'm', thin && 'meter-thin')} style=${hue != null ? { '--h': hue } : null} role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(value * 100)} aria-label=${label}>
      <div className="meter-fill" style=${{ width: Math.round(TS.clamp(value, 0, 1) * 100) + '%' }}></div>
    </div>`;
  }

  function Menu({ label, icon = 'Ellipsis', items, align = 'right', buttonClass = 'btn btn-ghost btn-icon btn-sm', text }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
      if (!open) return;
      const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
      const key = (e) => { if (e.key === 'Escape') setOpen(false); };
      document.addEventListener('mousedown', close);
      document.addEventListener('keydown', key);
      const first = ref.current && ref.current.querySelector('.menu button');
      if (first) first.focus();
      return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key); };
    }, [open]);
    return html`<div className="menu-wrap" ref=${ref}>
      <button type="button" className=${buttonClass} aria-haspopup="menu" aria-expanded=${open} aria-label=${label} onClick=${() => setOpen(!open)}>
        <${Icon} name=${icon} />${text && html`<span>${text}</span>`}
      </button>
      ${open && html`<div className="menu" role="menu" style=${align === 'right' ? { right: 0, top: 'calc(100% + 6px)' } : { left: 0, top: 'calc(100% + 6px)' }}>
        ${items.map((it, i) => it.section
          ? html`<div key=${i} className="menu-label">${it.section}</div>`
          : html`<button key=${i} role="menuitem" type="button" onClick=${() => { setOpen(false); it.run(); }}>${it.icon && html`<${Icon} name=${it.icon} />`}<span>${it.label}</span></button>`)}
      </div>`}
    </div>`;
  }

  function BrandMark({ size = 40 }) {
    return html`<img className="brand-mark" src="assets/logo-mark.svg" height=${size} alt="" />`;
  }

  function Brand() {
    return html`<a className="brand" href="#today" aria-label=${TS.brand.name + ' home'}><${BrandMark} /><span className="brand-name">${TS.brand.name}</span></a>`;
  }

  function Empty({ icon = 'Inbox', title, children, action }) {
    return html`<div className="empty"><${Icon} name=${icon} size=${20} className="faint" /><div className="h3">${title}</div><div>${children}</div>${action}</div>`;
  }

  function DemoFlag({ children = 'Demo data' }) { return html`<span className="demo-flag" title="Sample content for demonstration"><${Icon} name="FlaskConical" size=${12} />${children}</span>`; }

  /* Task-type icon helper */
  TS.typeIcon = (type) => (TS.model.TASK_TYPES[type] || { icon: 'Circle' }).icon;
  TS.typeLabel = (type) => (TS.model.TASK_TYPES[type] || { label: type }).label;
  TS.kindIcon = (o) => {
    if (o.source === 'class') return o.kind === 'lab' ? 'FlaskConical' : o.kind === 'tutorial' ? 'Users' : 'GraduationCap';
    if (o.source === 'block') return 'Ban';
    return (TS.model.COMMIT_KINDS[o.kind] || { icon: 'Coffee' }).icon;
  };

  Object.assign(TS, { Dialog, Sheet, Toasts, Seg, Switch, DayPick, Stepper, TimeInput, ModTag, Pip, Meter, Menu, BrandMark, Brand, Empty, DemoFlag });
})();
