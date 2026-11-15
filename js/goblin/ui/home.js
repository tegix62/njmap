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
        <button class="wopt" data-entry="normal"><span class="wt">Normal mode</span><span class="wd">The quiz, Drive and Progress, as always.</span></button>
        <button class="wopt" data-entry="goblin"><span class="wt">Goblin mode</span><span class="wd">Clans of small creatures fight over real New Jersey townships. An early build.</span></button>
      </div></div>`;
    for (const b of w.querySelectorAll('[data-entry]')) b.addEventListener('click', () => {
      remember(b.dataset.entry);
      w.innerHTML = keep; w.hidden = true;
      document.body.classList.remove('welcoming');
      resolve(b.dataset.entry);
    });
  });
}
