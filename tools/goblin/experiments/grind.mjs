// H29: can a lord who only does foothold runs out-conquer one who thinks? node tools/goblin/experiments/grind.mjs
import { runWar, metricsOf } from '../run.mjs';
for (const bot of ['footholder', 'careful', 'bold']) {
  let end = 0, start = 0, won = 0, days = 0, held = 0, runs = 0; const n = 12;
  for (let s = 1; s <= n; s++) {
    const r = runWar({ seed: s, days: 35, bot }); const m = metricsOf(r, 35);
    end += m.endTowns; start += m.startTowns; days += r.ranDays; if (r.state.war.over && r.state.war.over.winner === 'goblins') won++;
    held += r.events.filter((e) => e.type === 'foothold_held' && e.clan === 'goblins').length; runs += r.events.filter((e) => e.type === 'foothold_run' && e.clan === 'goblins').length;
  }
  console.log(`${bot.padEnd(10)} townships ${(end / n).toFixed(1)} of ${(start / n).toFixed(0)} at start, won ${won}/${n}, footholds run ${(runs / n).toFixed(1)} held ${(held / n).toFixed(1)}`);
}
