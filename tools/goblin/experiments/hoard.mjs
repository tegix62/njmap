// Does spreading AI recruits stop the hoarding? node tools/goblin/experiments/hoard.mjs
import { runWar, metricsOf } from '../run.mjs';
const rows = [['mass (D208)', {}], ['spread', { aiRecruitSpread: 1 }]];
for (const [label, rules] of rows) for (const bot of ['careful', 'bold', 'passive']) {
  let end = 0, maxStack = 0, aiAttacks = 0, raids = 0, n = 10; const stacks = [];
  for (let s = 1; s <= n; s++) {
    const r = runWar({ seed: s, days: 21, bot, rules });
    const m = metricsOf(r, 21); end += m.endTowns;
    const forces = Object.values(r.state.towns).filter((t) => t.owner && t.owner !== 'goblins').map((t) => t.force);
    maxStack += Math.max(...forces); stacks.push(Math.max(...forces));
    aiAttacks += r.events.filter((e) => e.type === 'skirmish_result' && e.by !== 'goblins').length; raids += r.events.filter((e) => e.type === 'raid_declared').length;
  }
  console.log(`${label.padEnd(12)} ${bot.padEnd(8)} end ${(end / n).toFixed(1)}  biggest AI stack ${(maxStack / n).toFixed(0)}  AI-vs-AI fights ${(aiAttacks / n).toFixed(1)}  raids ${(raids / n).toFixed(1)}`);
}
