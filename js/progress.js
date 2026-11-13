// Progress: what you know, what is due, what to do next. One screen for both regions; it reads the same spaced-review data Practice writes
// (store 'srs': { townKey: { b: box 0-5, due } } and 'stats': { townKey: [seen, right] }), so nothing new is tracked.
//
// A town is "learned" at box 3+ (right three times running, next review a week out), "getting there" at box 1-2, "missed lately" at box 0 (after a
// miss), "new" if never asked. The bar shows all four; the list underneath is where to put the next few minutes.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function initProgress(ctx) {
  const { store } = ctx;
  const panel = document.getElementById('progress');

  const state = (srs, m) => {
    const r = srs[m.key];
    if (!r) return 'new';
    return r.b >= 3 ? 'learned' : r.b >= 1 ? 'getting' : 'missed';
  };
  const streak = () => {
    const log = store.get('todayLog', {});
    const d2 = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let n = 0;
    for (let d = new Date(); log[d2(d)]; d.setDate(d.getDate() - 1)) n++;
    return n;
  };

  function render() {
    const R = ctx.region;
    const srs = store.get('srs', {});
    const stats = store.get('stats', {});
    const pool = ctx.munis.filter((m) => (R.wellKnown ? m.wellKnown : true));
    const now = Date.now();
    const counts = { learned: 0, getting: 0, missed: 0, new: 0 };
    for (const m of pool) counts[state(srs, m)]++;
    const due = pool.filter((m) => srs[m.key] && srs[m.key].due <= now).length;
    let seen = 0, right = 0;
    for (const m of ctx.munis) { const s = stats[m.key]; if (s) { seen += s[0]; right += s[1]; } }
    const pct = seen ? Math.round((100 * right) / seen) : 0;
    const tot = pool.length || 1;
    const seg = (k) => `<i class="pg-${k}" style="flex:${counts[k]}"></i>`;

    // by area: the share learned or getting there
    const byG = new Map();
    for (const m of pool) {
      const g = byG.get(m.c) || { n: 0, l: 0, g: 0 };
      g.n++;
      const s = state(srs, m);
      if (s === 'learned') g.l++;
      else if (s === 'getting') g.g++;
      byG.set(m.c, g);
    }
    const areas = [...byG.entries()]
      .map(([c, g]) => ({ c, ...g }))
      .sort((a, b) => (b.l + b.g) / b.n - (a.l + a.g) / a.n);

    // needs work: missed lately first, then the lowest accuracy among those asked at least twice
    const work = pool
      .map((m) => ({ m, s: stats[m.key] || [0, 0], st: state(srs, m) }))
      .filter((x) => x.st === 'missed' || (x.s[0] >= 2 && x.s[1] / x.s[0] < 0.6))
      .sort((a, b) => (a.st === 'missed' ? 0 : 1) - (b.st === 'missed' ? 0 : 1) || a.s[1] / (a.s[0] || 1) - b.s[1] / (b.s[0] || 1))
      .slice(0, 8);

    const first = !seen;
    panel.innerHTML = `
      <div class="pg-head"><h2>Your progress</h2><span class="muted">${esc(R.name)} · ${esc(R.wellKnown ? `${pool.length} well-known ${R.units}` : `${pool.length} ${R.units}`)}</span></div>
      ${first ? `<p class="pg-empty">Nothing here yet. Play a round and this fills in: what you know, what to review, and where to spend the next few minutes.</p>` : ''}
      <div class="pg-bar" role="img" aria-label="${counts.learned} learned, ${counts.getting} getting there, ${counts.missed} missed lately, ${counts.new} new">${seg('learned')}${seg('getting')}${seg('missed')}${seg('new')}</div>
      <div class="pg-key"><span><i class="pg-learned"></i>${counts.learned} learned</span><span><i class="pg-getting"></i>${counts.getting} getting there</span><span><i class="pg-missed"></i>${counts.missed} missed lately</span><span><i class="pg-new"></i>${counts.new} new</span></div>
      <div class="pg-stats">
        <div><b>${Math.round((100 * counts.learned) / tot)}%</b><span>learned</span></div>
        <div><b>${pct}%</b><span>right overall</span></div>
        <div><b>${streak()}</b><span>day streak</span></div>
        <div><b>${due}</b><span>due now</span></div>
      </div>
      <button class="primary" id="pgPlay">${due ? `Review ${due} due` : first ? 'Start playing' : 'Keep playing'}</button>
      ${work.length ? `<h3>Needs work</h3><div class="pg-work">${work.map((x) => `<span class="pg-chip">${esc(ctx.name(x.m))}<small>${x.s[0] ? `${x.s[1]}/${x.s[0]}` : 'missed'}</small></span>`).join('')}</div>` : ''}
      <h3>By ${esc((R.groupPlural || 'area').replace(/s$/, '').replace(/ie$/, 'y').toLowerCase())}</h3>
      <div class="pg-areas">${areas.map((a) => `<div class="pg-area"><span>${esc(ctx.groupName(a.c))}</span><div class="pg-mini"><i class="pg-learned" style="flex:${a.l}"></i><i class="pg-getting" style="flex:${a.g}"></i><i class="pg-new" style="flex:${a.n - a.l - a.g}"></i></div></div>`).join('')}</div>`;
    document.getElementById('pgPlay')?.addEventListener('click', () => ctx.setMode('practice'));
  }

  return {
    enter() {
      ctx.clearHighlights();
      ctx.hud('');
      ctx.sheet('');
      panel.hidden = false;
      render();
    },
    leave() {
      panel.hidden = true;
    },
  };
}
