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
        <button class="wopt wopt-main" data-entry="normal"><span class="wi" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 6.5l5-2 6 2 5-2v13l-5 2-6-2-5 2z M9 4.5v13 M15 6.5v13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></span><span class="wtx"><span class="wt">Normal mode</span><span class="wd">The quiz, Drive and Progress, as always.</span></span></button>
        <button class="wopt wopt-trees" data-entry="trees"><span class="wi" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 21v-6 M12 3c3.2 0 5.5 2.3 5.5 5 1.6.6 2.5 2 2.5 3.5 0 2.2-1.800 3.800-4 3.800H8c-2.200 0-4-1.600-4-3.800C4 10 4.900 8.600 6.500 8 6.500 5.300 8.800 3 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg></span><span class="wtx"><span class="wt">Trees of New Jersey</span><span class="wd">Learn the trees round you, a few minutes a day.</span></span></button>
      </div>
      <button class="wsmall" data-entry="goblin">Goblin mode (shelved experiment)</button>
      </div>`;
    for (const b of w.querySelectorAll('[data-entry]')) b.addEventListener('click', () => {
      remember(b.dataset.entry);
      w.innerHTML = keep; w.hidden = true;
      document.body.classList.remove('welcoming');
      resolve(b.dataset.entry);
    });
  });
}
