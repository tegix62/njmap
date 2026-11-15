// The digest: the short form of the Ledger (a headline and at most five lines), for the screen you see when you open the game.
// Everything is picked from the same events the full Ledger prints; nothing here invents a fact.
//
//   digestOf(events, { board, state, content, clan, max })  -> { headline, incoming: [text], lines: [{ when, text }], hidden: n, mood }

import { entriesOf } from './ledger.js';

/** How much a line matters to the player (higher is shown first when there is not room for everything). */
function weight(e, clan) {
  switch (e.type) {
    case 'skirmish_result': case 'raid_landed':
      if (e.against === clan) return e.won ? 100 : 80;   // lost a township / held one
      if (e.by === clan) return e.won ? 70 : 45;          // took one / failed to
      return e.won ? 25 : 10;                              // the others fighting
    case 'raid_declared': return e.by !== clan ? 90 : 0;
    case 'front_closed': return e.clan === clan ? 75 : 20;
    case 'clan_out': return 60;
    case 'player_absent': return 5;
    case 'foothold_held': return e.clan === clan ? 72 : e.against === clan ? 100 : 20;
    case 'foothold_lost': return 30;
    case 'legend': return 60;
    case 'escaped': return 35;
    case 'hunger': return e.clan === clan ? 92 : 0;
    case 'deserted': return e.clan === clan ? 88 : 0;
    case 'bridge_built': return e.clan === clan ? 40 : 0;
    case 'ai_peace': return 50;
    case 'war_over': return 200;
    case 'war_hold': return 95;
    case 'milestone': return e.clan === clan ? 85 : 0;
    case 'promoted': case 'succeeded': return 30;
    default: return 0;
  }
}

export function digestOf(events, { board, state, content, clan, max = 5 }) {
  const entries = entriesOf(events, { board, state, content, clan });
  const ranked = entries.map((en, i) => ({ en, i, w: weight(en.event, clan) })).filter((x) => x.w > 0);
  const picked = ranked.slice().sort((a, b) => (b.w - a.w) || (b.i - a.i)).slice(0, max).sort((a, b) => a.i - b.i);
  const lost = events.filter((e) => (e.type === 'skirmish_result' || e.type === 'raid_landed') && e.against === clan && e.won).length;
  const took = events.filter((e) => (e.type === 'skirmish_result' || e.type === 'raid_landed') && e.by === clan && e.won).length;
  const raids = events.filter((e) => e.type === 'raid_declared' && e.by !== clan).length;
  const bits = [];
  if (took) bits.push(`took ${took} township${took === 1 ? '' : 's'}`);
  if (lost) bits.push(`lost ${lost}`);
  if (raids) bits.push(`${raids} raid${raids === 1 ? '' : 's'} warned of`);
  const mood = [...events].reverse().find((e) => e.type === 'director_word' && e.clan === clan);
  const headline = bits.length ? `Since you were last here: you ${bits.join(', ')}.` : ranked.length ? 'Since you were last here: skirmishes elsewhere.' : 'Since you were last here: quiet.';
  // raids still on their way to you (state, not events: these are the things you can still act on)
  const incoming = state.raids.filter((r) => state.towns[r.target] && state.towns[r.target].owner === clan)
    .sort((a, b) => a.landsAt - b.landsAt)
    .map((r) => {
      const abs = state.startHour + r.landsAt, hour = String(abs % 24).padStart(2, '0') + ':00', day = Math.floor(abs / 24) + 1;
      return { target: r.target, from: r.from, n: r.force, landsAt: r.landsAt, text: `${r.by[0].toUpperCase() + r.by.slice(1)} are coming for ${board.town(r.target).name}: ${r.force} from ${board.town(r.from).name}, arriving Day ${day} ${hour}.` };
    });
  return { headline, incoming, lines: picked.map((x) => ({ when: `Day ${x.en.day} ${x.en.hour}`, text: x.en.text })), hidden: Math.max(0, entries.length - picked.length), mood: mood ? mood.word.toLowerCase() : null };
}
