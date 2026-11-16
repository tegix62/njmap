// The home page: choose Goblin mode or Normal mode. It reuses the first-run welcome card, so it looks like the rest of the app.
// The choice is remembered for this session only (a reopened app asks again).
import { store } from '../../store.js';

const KEY = 'njtf.entry';
export const rememberedEntry = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
const remember = (v) => { try { sessionStorage.setItem(KEY, v); } catch { /* ignore */ } };

export function askHome({ force = false } = {}) {
  const seen = rememberedEntry();
  if (seen && !force) return Promise.resolve(seen);
  return new Promise((resolve) => {
    const w = document.getElementById('welcome');
    const keep = w.innerHTML;
    w.hidden = false;
    document.body.classList.add('welcoming');
    w.innerHTML = `<div class="wcard"><h1>Townfinder</h1><p class="wsub">What would you like to do?</p>
      <div class="wchoices">
        <button class="wopt wopt-main" data-entry="normal"><span class="wi" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 6.5l5-2 6 2 5-2v13l-5 2-6-2-5 2z M9 4.5v13 M15 6.5v13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></span><span class="wtx"><span class="wt">Learn the map</span><span class="wd">Quizzes, 3D map games, Drive and your progress.</span></span></button>
        <button class="wopt" data-entry="goblin"><span class="wi" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M6 20V4 M6 5h11l-2.5 3.5L17 12H6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg></span><span class="wtx"><span class="wt">Goblin Council</span><span class="wd">A small strategy game on real New Jersey townships. An early build.</span></span></button>
      </div></div>`;
    for (const b of w.querySelectorAll('[data-entry]')) b.addEventListener('click', () => {
      remember(b.dataset.entry);
      w.innerHTML = keep; w.hidden = true;
      document.body.classList.remove('welcoming');
      resolve(b.dataset.entry);
    });
  });
}
