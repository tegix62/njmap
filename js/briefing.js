// The start of a drive round, shared by Drive Midtown (classic) and Drive Downtown:
// where you are, where you're going, and a guess at which way it is before you
// drive, so you place both in your head before any arrow does it for you.
// Also the guide setting: how much the game tells you about where the
// destination is while you drive.

const SIDES = ['ahead', 'right', 'behind', 'left'];
const EIGHT = [
  'straight ahead',
  'ahead and to your right',
  'to your right',
  'behind you, to the right',
  'straight behind you',
  'behind you, to the left',
  'to your left',
  'ahead and to your left',
];

// words: no arrow, how far and which way in words; arrow: the pointer too; off: nothing (Peek shows it for a moment)
export const GUIDES = { words: 'Guide: words', arrow: 'Guide: arrow', off: 'Guide: off (peek)' };
export const PEEK_MS = 3000;

const turn = (heading, toward) => (((toward - heading) % 360) + 360) % 360;

/** The sides that count as right for a guess: the quarter it's in, and the neighbour when it's near a diagonal. */
export function okSides(heading, toward) {
  const d = turn(heading, toward);
  return SIDES.filter((_, i) => {
    const off = Math.abs(((d - i * 90 + 540) % 360) - 180);
    return off <= 60;
  });
}
/** "ahead and to your right" */
export const sideWords = (heading, toward) => EIGHT[Math.round(turn(heading, toward) / 45) % 8];

/** Running record of start guesses (both games). */
export function guessRecord(store) {
  return {
    add(ok) {
      const r = store.get('orientGuesses', { n: 0, right: 0 });
      r.n++;
      if (ok) r.right++;
      store.set('orientGuesses', r);
    },
    get: () => store.get('orientGuesses', { n: 0, right: 0 }),
  };
}

/**
 * The briefing block. you / to: HTML lines. guess: null before answering, else
 * {pick, ok, said} (said: where it really is, in words).
 */
export function briefingHTML({ you, to, guess }) {
  const pad = `<div class="gpad">
      <button class="gbtn up" data-guess="ahead">▲ Ahead</button>
      <button class="gbtn lt" data-guess="left">◀ Left</button>
      <button class="gbtn rt" data-guess="right">Right ▶</button>
      <button class="gbtn dn" data-guess="behind">▼ Behind</button>
    </div>`;
  return `<div class="brief">
    <div class="bline"><span class="bic">📍</span><span>${you}</span></div>
    <div class="bline"><span class="bic">🏁</span><span>${to}</span></div>
    ${
      guess
        ? `<div class="bres ${guess.ok ? 'ok' : 'no'}">${guess.ok ? '✓' : '✗'} It's ${guess.said}</div>
           <button class="primary" id="ggGo">Go ▶</button>`
        : `<div class="bq">Which way is it?</div>${pad}<button class="linkish" id="ggGo">Go without guessing</button>`
    }
  </div>`;
}

/** Wire the briefing's buttons. onGuess(side), onGo(). */
export function bindBriefing(onGuess, onGo) {
  for (const b of document.querySelectorAll('.gbtn')) b.addEventListener('click', () => onGuess(b.dataset.guess));
  document.getElementById('ggGo')?.addEventListener('click', onGo);
}
