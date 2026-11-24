/* TimeStable core: rendering helpers, branding, time utilities, store, router, toasts.
   Every file is an IIFE that reads from and writes to the single `window.TS` namespace. */
(() => {
  const TS = (window.TS = window.TS || {});

  /* ---------- Branding (rename the product here) ---------- */
  TS.brand = {
    name: 'TimeStable',
    tagline: 'Plan what to study, when and why.',
    storageKey: 'timestable.demo.v2',
  };

  /* ---------- Rendering ---------- */
  const R = window.React;
  TS.h = R.createElement;
  TS.html = window.htm.bind(R.createElement);
  Object.assign(TS, {
    Fragment: R.Fragment,
    useState: R.useState, useEffect: R.useEffect, useRef: R.useRef, useMemo: R.useMemo,
    useCallback: R.useCallback, useLayoutEffect: R.useLayoutEffect, useSyncExternalStore: R.useSyncExternalStore,
  });
  TS.cx = (...a) => a.filter(Boolean).join(' ');

  /* Lucide icon nodes -> React SVG */
  const iconCache = {};
  TS.Icon = function Icon({ name, size = 16, stroke = 1.8, className = '', label }) {
    const lib = window.lucide && window.lucide.icons;
    const node = lib && (lib[name] || lib.Circle);
    if (!node) return null;
    const children = iconCache[name] || (iconCache[name] = node[2].map(([tag, attrs], i) => R.createElement(tag, { key: i, ...attrs })));
    return R.createElement('svg', {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round',
      className: 'icon ' + className, 'aria-hidden': label ? undefined : true, role: label ? 'img' : undefined, 'aria-label': label,
    }, children);
  };

  /* ---------- Time (local wall-clock; DST-safe via Date setters) ---------- */
  const MIN = 60000, HOUR = 3600000, DAY = 86400000;
  const pad2 = (n) => String(n).padStart(2, '0');
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const DOW_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const T = (TS.time = {
    MIN, HOUR, DAY, DOW, DOW_LONG,
    now: () => Date.now(),
    dayStart(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); },
    addDays(t, n) { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); },
    weekday(t) { return (new Date(t).getDay() + 6) % 7; }, // Monday = 0
    weekStart(t) { const s = T.dayStart(t); return T.addDays(s, -T.weekday(s)); },
    toMin(hhmm) { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); },
    fromMin(min) { const m = ((min % 1440) + 1440) % 1440; return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60); },
    at(day, hhmm) { const d = new Date(day); const mins = T.toMin(hhmm); d.setHours(Math.floor(mins / 60), mins % 60, 0, 0); return d.getTime(); },
    minOfDay(t) { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); },
    hm(t) { const d = new Date(t); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); },
    dateKey(t) { const d = new Date(t); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); },
    roundUp(t, stepMin) {
      const d = new Date(t);
      let m = d.getHours() * 60 + d.getMinutes() + (d.getSeconds() || d.getMilliseconds() ? 1 : 0);
      m = Math.ceil(m / stepMin) * stepMin;
      const day = T.dayStart(t);
      return m >= 1440 ? T.addDays(day, 1) : T.at(day, T.fromMin(m));
    },
    roundTo(t, stepMin) { const d = new Date(t); const m = d.getHours() * 60 + d.getMinutes(); const r = Math.round(m / stepMin) * stepMin; return T.at(T.dayStart(t), T.fromMin(Math.min(r, 1439))); },
    sameDay(a, b) { return T.dayStart(a) === T.dayStart(b); },
    daysBetween(a, b) { return Math.round((T.dayStart(b) - T.dayStart(a)) / DAY); },
    overlap(a0, a1, b0, b1) { return a0 < b1 && b0 < a1; },
    fmtTime(t) { return T.hm(t); },
    fmtRange(a, b) { return T.hm(a) + '–' + T.hm(b); },
    fmtDate(t) { const d = new Date(t); return DOW[T.weekday(t)] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]; },
    fmtDateLong(t) { const d = new Date(t); return DOW_LONG[T.weekday(t)] + ' ' + d.getDate() + ' ' + MON_LONG[d.getMonth()]; },
    fmtDayMonth(t) { const d = new Date(t); return d.getDate() + ' ' + MON[d.getMonth()]; },
    fmtWhen(t, now = Date.now()) {
      const diff = T.daysBetween(now, t);
      if (diff === 0) return 'Today ' + T.hm(t);
      if (diff === 1) return 'Tomorrow ' + T.hm(t);
      if (diff === -1) return 'Yesterday ' + T.hm(t);
      if (diff > 1 && diff < 7) return DOW[T.weekday(t)] + ' ' + T.hm(t);
      return T.fmtDate(t) + ', ' + T.hm(t);
    },
    fmtRel(t, now = Date.now()) {
      const ms = t - now;
      const abs = Math.abs(ms);
      const past = ms < 0;
      let s;
      if (abs < HOUR) s = Math.max(1, Math.round(abs / MIN)) + ' min';
      else if (abs < DAY) s = Math.round(abs / HOUR) + 'h';
      else s = Math.round(abs / DAY) + (Math.round(abs / DAY) === 1 ? ' day' : ' days');
      return past ? s + ' ago' : 'in ' + s;
    },
    fmtDur(min) {
      min = Math.round(min);
      if (min < 60) return min + 'm';
      const h = Math.floor(min / 60), m = min % 60;
      return m ? h + 'h ' + m + 'm' : h + 'h';
    },
    fmtHours(min, dp = 1) {
      const h = min / 60;
      const v = Math.round(h * 10 ** dp) / 10 ** dp;
      return (Number.isInteger(v) ? String(v) : v.toFixed(dp)) + 'h';
    },
    period(t) { const h = new Date(t).getHours(); return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'; },
  });

  /* Interval helpers: arrays of {start,end} (ms) */
  TS.iv = {
    subtract(free, busy) {
      let out = free.map((f) => ({ start: f.start, end: f.end }));
      for (const b of busy) {
        const next = [];
        for (const f of out) {
          if (b.end <= f.start || b.start >= f.end) { next.push(f); continue; }
          if (b.start > f.start) next.push({ start: f.start, end: b.start });
          if (b.end < f.end) next.push({ start: b.end, end: f.end });
        }
        out = next;
      }
      return out;
    },
    total(list) { return list.reduce((s, i) => s + (i.end - i.start), 0); },
  };

  /* ---------- Ids ---------- */
  let idSeq = 0;
  TS.uid = (p = 'id') => p + '_' + Date.now().toString(36) + (idSeq++).toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---------- Safe storage ---------- */
  TS.storage = {
    read(key) { try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } },
    write(key, value) { try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; } },
    remove(key) { try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ } },
  };

  /* ---------- Tiny external store ---------- */
  TS.createStore = function createStore(initial, { persistKey } = {}) {
    let state = initial;
    const listeners = new Set();
    let saveTimer = null;
    const store = {
      get: () => state,
      set(updater) {
        const draft = typeof structuredClone === 'function' ? structuredClone(state) : JSON.parse(JSON.stringify(state));
        const result = updater(draft);
        state = result === undefined ? draft : result;
        listeners.forEach((l) => l());
        if (persistKey) { clearTimeout(saveTimer); saveTimer = setTimeout(() => TS.storage.write(persistKey, state), 120); }
        return state;
      },
      replace(next) { state = next; listeners.forEach((l) => l()); if (persistKey) TS.storage.write(persistKey, state); },
      subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
    };
    return store;
  };

  /* ---------- Toasts (not persisted) ---------- */
  const toastStore = TS.createStore([]);
  TS.toast = (message, opts = {}) => {
    const id = TS.uid('t');
    toastStore.set((list) => [...list.slice(-2), { id, message, tone: opts.tone || 'info', action: opts.action || null }]);
    setTimeout(() => toastStore.set((list) => list.filter((t) => t.id !== id)), opts.duration || 4200);
  };
  TS.dismissToast = (id) => toastStore.set((list) => list.filter((t) => t.id !== id));
  TS.useToasts = () => TS.useSyncExternalStore(toastStore.subscribe, toastStore.get);

  /* ---------- Router (plain #name hashes only) ---------- */
  TS.parseRoute = (hash) => {
    const raw = String(hash || '').replace(/^#/, '');
    if (!raw) return { name: '', param: null };
    const m = raw.match(/^module-(.+)$/);
    if (m) return { name: 'module', param: m[1].toUpperCase() };
    return { name: raw, param: null };
  };
  TS.useRoute = () => {
    const [route, setRoute] = R.useState(() => TS.parseRoute(location.hash));
    R.useEffect(() => {
      const on = () => { setRoute(TS.parseRoute(location.hash)); window.scrollTo(0, 0); };
      window.addEventListener('hashchange', on);
      return () => window.removeEventListener('hashchange', on);
    }, []);
    return route;
  };
  TS.go = (name) => { if (location.hash !== '#' + name) location.hash = name; };

  /* ---------- Clock hook (re-render each minute) ---------- */
  TS.useNow = (intervalMs = 30000) => {
    const [now, setNow] = R.useState(Date.now());
    R.useEffect(() => { const id = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(id); }, [intervalMs]);
    return now;
  };

  TS.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  TS.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  TS.sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + f(x), 0);
  TS.plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');
})();
