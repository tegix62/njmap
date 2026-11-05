// Left/right and compass, held at the same time.
//
// Left and right are tied to your body; north and east to the world.
// Converting between them is a mental rotation, and it costs more the further
// you're turned from north: facing south everything mirrors (left is east).
// It's trainable with practice and quick feedback. Three pieces share one
// record of how well you know each heading:
//   - the drill below ("Left, right & compass"), which serves more of your
//     weak headings;
//   - Drive Manhattan's turn buttons, which show the compass word for left and
//     right and fade it as that heading becomes solid;
//   - check-ins during a Drive Manhattan round ("Which side is the Hudson?").

const KEY = 'frames';
const WINDOW = 10; // recent answers kept per heading
const H4 = ['N', 'E', 'S', 'W'];
const DEG = { N: 0, E: 90, S: 180, W: 270 };
/** Manhattan's grid words count as the same headings: uptown ≈ north, downtown ≈ south. */
export const headingClass = (h) => ({ U: 'N', D: 'S' })[h] || h;

/** Per-heading record of recent answers, shared by every piece of the app. */
export function framesStats(store) {
  const load = () => ({ N: [], E: [], S: [], W: [], ...store.get(KEY, {}) });
  return {
    record(h, ok) {
      const d = load();
      const k = headingClass(h);
      d[k] = [...(d[k] || []), ok ? 1 : 0].slice(-WINDOW);
      store.set(KEY, d);
    },
    /** Share right of the recent answers for a heading, or null with fewer than 4. */
    accuracy(h) {
      const a = load()[headingClass(h)] || [];
      return a.length < 4 ? null : a.reduce((s, x) => s + x, 0) / a.length;
    },
    /** How much help the turn buttons give for this heading: 'show', 'faint' or 'hide'. */
    hint(h) {
      const a = load()[headingClass(h)] || [];
      if (!a.length || a[a.length - 1] === 0) return 'show'; // just missed one: full help again
      const acc = this.accuracy(h);
      return acc == null || acc < 0.75 ? 'show' : acc < 0.92 ? 'faint' : 'hide';
    },
    all() {
      return Object.fromEntries(H4.map((k) => [k, this.accuracy(k)]));
    },
  };
}

// ---- the drill ------------------------------------------------------------------------
const NAMES = {
  compass: { N: 'north', E: 'east', S: 'south', W: 'west' },
  grid: { N: 'uptown', E: 'east', S: 'downtown', W: 'west' },
};
const turn = (h, by) => H4[(H4.indexOf(h) + by + 4) % 4]; // by: +1 right, -1 left, 2 around
const TIP = {
  N: (W) => `Facing ${W.N} it lines up with a map: left is ${W.W}, right is ${W.E}.`,
  E: (W) => `Facing ${W.E}: left is ${W.N}, right is ${W.S}.`,
  S: (W) => `Facing ${W.S} everything flips: left is ${W.E}, right is ${W.W}.`,
  W: (W) => `Facing ${W.W}: left is ${W.S}, right is ${W.N}.`,
};
const REL = ['ahead', 'right', 'behind', 'left']; // by clockwise steps

export function initFrames(ctx) {
  const stats = framesStats(ctx.store);
  const { map } = ctx;
  let q = null; // current question
  let run = null; // the running session
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const rand = (a) => a[Math.floor(Math.random() * a.length)];
  const words = () => (ctx.region.gridAngle ? NAMES.grid : NAMES.compass);
  const base = () => (ctx.region.gridAngle ? ctx.region.gridAngle : 0); // map bearing that means "north" here

  /** Pick a heading, more often the ones you get wrong. */
  function pickHeading() {
    const w = H4.map((h) => {
      const a = stats.accuracy(h);
      return a == null ? 2 : 1 + 4 * (1 - a);
    });
    let x = Math.random() * w.reduce((s, v) => s + v, 0);
    for (let i = 0; i < 4; i++) if ((x -= w[i]) <= 0) return H4[i];
    return 'S';
  }
  function make() {
    const h = pickHeading();
    const W = words();
    const kind = rand(['side', 'side', 'where', 'turn']);
    if (kind === 'side') {
      // "Facing south. Your left is…?"
      const side = rand(['left', 'right']);
      return { h, kind, ask: `Facing <b>${W[h]}</b>. Your <b>${side}</b> is…?`, answer: turn(h, side === 'left' ? -1 : 1), pad: 'compass', side };
    }
    if (kind === 'where') {
      // "Facing east. Which way is north?"
      const target = rand(H4.filter((d) => d !== h));
      const steps = (H4.indexOf(target) - H4.indexOf(h) + 4) % 4;
      return { h, kind, ask: `Facing <b>${W[h]}</b>. Where is <b>${W[target]}</b>?`, answer: REL[steps], pad: 'body', target };
    }
    // "Facing west, you turn right. Now you're facing…?"
    const by = rand([-1, 1, 1, -1, 2]);
    const what = by === 2 ? 'turn around' : `turn ${by < 0 ? 'left' : 'right'}`;
    return { h, kind, ask: `Facing <b>${W[h]}</b>, you <b>${what}</b>. Now you're facing…?`, answer: turn(h, by), pad: 'compass' };
  }

  function start(opts) {
    stop();
    run = { opts, right: 0, total: 0, streak: 0 };
    document.body.classList.add('framing');
    ctx.clearHighlights();
    ctx.reveal([]);
    ctx.line(null);
    next();
  }
  function stop() {
    if (!run) return;
    run = null;
    q = null;
    document.body.classList.remove('framing');
  }
  function next() {
    if (!run) return;
    q = make();
    q.t0 = performance.now();
    // the map faces "north" while you think, so it doesn't give the answer away
    map.easeTo({ bearing: base(), duration: ctx.dur(500) });
    render();
  }
  function answer(v) {
    if (!q || q.done) return;
    q.done = true;
    const ok = v === q.answer;
    const secs = (performance.now() - q.t0) / 1000;
    stats.record(q.h, ok);
    run.total++;
    if (ok) {
      run.right++;
      run.streak++;
    } else run.streak = 0;
    const W = words();
    const said = q.pad === 'compass' ? W[q.answer] : q.answer;
    q.fb = `${ok ? '✓' : '✗'} ${ok ? '' : `It's <b>${esc(said)}</b>. `}${esc(TIP[q.h](W))}${ok ? ` <span class="muted">${secs.toFixed(1)} s</span>` : ''}`;
    q.ok = ok;
    q.picked = v;
    // turn the map to face that heading: the N/E/S/W letters on its edges now show the answer
    map.easeTo({ bearing: base() + DEG[q.h], duration: ctx.dur(700) });
    render();
  }

  function pad() {
    const W = words();
    const cls = (v) => `fpad-b${q.done ? (v === q.answer ? ' right' : v === q.picked ? ' wrong' : '') : ''}`;
    if (q.pad === 'compass')
      return `<div class="fpad">
        <button class="${cls('N')} n" data-v="N">${W.N}</button>
        <button class="${cls('W')} w" data-v="W">${W.W}</button>
        <button class="${cls('E')} e" data-v="E">${W.E}</button>
        <button class="${cls('S')} s" data-v="S">${W.S}</button>
      </div>`;
    return `<div class="fpad">
      <button class="${cls('ahead')} n" data-v="ahead">▲ Ahead</button>
      <button class="${cls('left')} w" data-v="left">◀ Left</button>
      <button class="${cls('right')} e" data-v="right">Right ▶</button>
      <button class="${cls('behind')} s" data-v="behind">▼ Behind</button>
    </div>`;
  }
  function render() {
    if (!run || !q) return;
    const acc = stats.all();
    const W = words();
    const bars = ['N', 'E', 'S', 'W']
      .map((h) => `<span class="fh${acc[h] != null && acc[h] < 0.75 ? ' weak' : ''}">${W[h]} ${acc[h] == null ? '–' : Math.round(acc[h] * 100) + '%'}</span>`)
      .join('');
    ctx.hud(`<div class="qkind">🧭 Left, right &amp; compass</div><div class="q">${q.ask}</div>`);
    ctx.sheet(
      `${run.opts.header()}<div id="qbody">
        <div class="score">${run.right}/${run.total}${run.streak >= 3 ? ` · 🔥 ${run.streak}` : ''}</div>
        ${pad()}
        ${q.done ? `<div class="fb ${q.ok ? 'ok' : 'no'}">${q.fb}</div><button class="primary" id="nextQ">Next</button>` : ''}
        <div class="fstats">${bars}</div>
      </div>`
    );
    run.opts.bindHeader();
    for (const b of document.querySelectorAll('.fpad button')) b.addEventListener('click', () => answer(b.dataset.v));
    document.getElementById('nextQ')?.addEventListener('click', next);
  }
  // keyboard: arrows answer, Enter goes on
  window.addEventListener('keydown', (e) => {
    if (!run || !q) return;
    if (q.done && (e.key === 'Enter' || e.key === ' ')) return next();
    if (q.done) return;
    const map4 = q.pad === 'compass' ? { ArrowUp: 'N', ArrowDown: 'S', ArrowLeft: 'W', ArrowRight: 'E' } : { ArrowUp: 'ahead', ArrowDown: 'behind', ArrowLeft: 'left', ArrowRight: 'right' };
    if (map4[e.key]) answer(map4[e.key]);
  });

  return {
    start,
    stop,
    get running() {
      return !!run;
    },
    stats,
  };
}
