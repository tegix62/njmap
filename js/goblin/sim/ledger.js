// The Ledger (spec section 10): turns the structured events `step` returns into readable lines. The wording comes from the content file's
// templates (placeholders until the user writes them, D68, D194). Every statement about a place is computed from the board, never written by hand (H42).
//
//   renderLedger(events, { board, state, content, clan })  -> markdown
//   placePhrase(board, from, to)                           -> "2.1 mi northwest of Paterson, over the Passaic"

import { K2 } from './constants.js';

const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
const toRad = (d) => (d * Math.PI) / 180;

export function bearingMiles(board, from, to) {
  const [lo1, la1] = board.town(from).at, [lo2, la2] = board.town(to).at;
  const dy = (la2 - la1) * 69.0, dx = (lo2 - lo1) * 69.0 * Math.cos(toRad((la1 + la2) / 2));
  const mi = Math.hypot(dx, dy);
  const deg = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
  return { mi, dir: COMPASS[Math.round(deg / 45) % 8] };
}

export function placePhrase(board, from, to) {
  const { mi, dir } = bearingMiles(board, from, to);
  const b = board.border(from, to) || {};
  const bits = [`${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi ${dir} of ${nameOf(board, from)}`];
  if (b.river) bits.push(`over the ${typeof b.river === 'string' ? b.river : 'river'}`);
  else if (b.ridge) bits.push('over a ridge');
  if (b.highways && b.highways.length) bits.push(`by ${b.highways[0]}`);
  return bits.join(', ');
}

const dupNames = new WeakMap();
function nameOf(board, id) {
  if (!dupNames.has(board)) { const seen = new Map(); for (const t of Object.values(board.towns)) seen.set(t.name, (seen.get(t.name) || 0) + 1); dupNames.set(board, seen); }
  const t = board.town(id);
  return dupNames.get(board).get(t.name) > 1 ? `${t.name} (${t.county})` : t.name;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const poss = (s) => (s.endsWith('s') ? s + "'" : s + "'s");
const fill = (tpl, v) => tpl.replace(/\{(\w+)\}/g, (_, k) => (k in v ? v[k] : `{${k}}`));
const factWord = (content, f) => { const [kind, ref] = f.split(':'); if (kind === 'trait') return content.traits.get(ref).word; if (kind === 'fear') return `a fear of ${ref}`; return f; };

export function renderLedger(events, ctx) {
  const lines = [];
  let day = -1;
  for (const en of entriesOf(events, ctx)) {
    if (en.day !== day) { day = en.day; lines.push('', `### Day ${en.day}`, ''); }
    lines.push(`- \`${en.hour}\` ${en.text}`);
  }
  return lines.join('\n') + '\n';
}

/** One entry per line the Ledger would print: { tick, day, hour, text, event }. The digest and the screens use these directly. */
export function entriesOf(events, { board, state, content, clan }) {
  const T = Object.fromEntries(content.json.templates.map((t) => [t.id, t.text]));
  const town = (id) => nameOf(board, id);
  const clanName = (id) => cap(id);
  const char = (id) => { const c = state.chars[id]; return c ? `${c.name} of ${clanName(c.clan)}` : id; };
  const trait = (id) => content.traits.get(id).word;
  const fronts = {};
  const entries = [];
  let cur = null;
  const heading = (tick) => {
    const abs = state.startHour + tick, d = Math.floor(abs / 24) + 1, hour = abs % 24;
    return { d, text: fill(T.heading, { day: d, hour: String(hour).padStart(2, '0') + ':00' }) };
  };
  const say = (tick, text) => {
    const h = heading(tick);
    entries.push({ tick, day: h.d, hour: String(h.text.match(/(\d\d:00)$/)[1]), text, event: cur });
  };
  const lead = (e) => (e.lead ? ` ${char(e.lead)} led them.` : '');
  const learned = (facts) => (facts && facts.length ? ` Learned: ${facts.map((f) => factWord(content, f)).join(', ')}.` : '');
  const exposed = (xs) => (xs && xs.length ? ` Exposed: ${xs.map(town).join(', ')} down to one.` : '');
  const mine = (id) => id === clan;
  for (const e of events) {
    cur = e;
    switch (e.type) {
      case 'skirmish_result': case 'raid_landed': {
        const raid = e.type === 'raid_landed';
        const v = { by: clanName(e.by), against: poss(clanName(e.against || 'nobody')).replace(/'s?$/, ''), n: e.n, from: town(e.from), to: town(e.to), where: placePhrase(board, e.from, e.to), left: e.left.a, lost_a: e.lost.attackers, lost_d: e.lost.defenders, lead: lead(e) };
        say(e.tick, cap(fill(T[e.won ? (raid ? 'raid_taken' : 'taken') : (raid ? 'raid_repulsed' : 'repulsed')], v)));
        break;
      }
      case 'raid_declared': say(e.tick, cap(fill(T.raid_declared, { dir_word: 'border', by: clanName(e.by), n: e.n, from: town(e.from), to: town(e.to), where: placePhrase(board, e.from, e.to), lands: heading(e.landsAt).text.replace(/^Day \d+, /, '') }))); break;
      case 'front_opened': {
        fronts[e.front] = { to: e.to, captain: e.captain, clan: e.clan };
        say(e.tick, cap(fill(T.front_opened, { clan: clanName(e.clan), n: e.n, from: town(e.from), to: town(e.to), where: placePhrase(board, e.from, e.to), captain: char(e.captain), standing: e.standing.toLowerCase() })));
        break;
      }
      case 'front_beat': {
        const f = fronts[e.front] || { to: e.to, captain: e.captain, clan: e.clan };
        if (e.maneuver === 'bridge') say(e.tick, cap(fill(T.beat_bridge, { clan: clanName(f.clan || ''), standing: e.standing })));
        else if (e.maneuver === 'decision') say(e.tick, cap(fill(T.beat_decision, { to: town(f.to), rounds: (e.rounds || []).length })) + ` ${e.won ? 'The attackers won.' : 'The attackers lost.'}`);
        else if (e.maneuver === 'disengage') { /* the closing line says it */ }
        else {
          const mods = e.mods.length ? e.mods.map((m) => `${m.v > 0 ? '+' : ''}${m.v} ${m.why}`).join(', ') : 'no modifiers';
          const ct = e.change >= 2 ? 'A strong move: up two.' : e.change === 1 ? 'It worked: up one.' : e.change === 0 ? 'No movement.' : 'It went badly: down one.';
          say(e.tick, cap(fill(T.beat_move, { clan: clanName(f.clan || ''), maneuver: e.maneuver, captain: char(f.captain), roll: e.roll, mods, change_text: ct, standing: e.standing.toLowerCase(), learned_text: learned(e.learned) })));
        }
        break;
      }
      case 'closeup': {
        const c = state.chars[e.char];
        const key = 'closeup_' + (e.what === 'fled' ? 'fled' : e.what);
        const f = fronts[e.front] || {};
        say(e.tick, cap(fill(T[key], { char: char(e.char), town: town(e.town), refuge: e.to ? town(e.to) : '', by: clanName(f.clan || '') })) + (e.roll ? ` (rolled ${e.roll})` : ''));
        break;
      }
      case 'front_closed': {
        const ch = (e.changed || []).map((x) => `${char(x.char)} ${x.what}`).join('; ');
        const f = fronts[e.front] || {};
        say(e.tick, cap(fill(T['closed_' + e.verdict], { clan: clanName(e.clan), to: town(e.town), lost_a: e.lost.a, lost_d: e.lost.d, captain: f.captain ? char(f.captain) : 'The captain', defender: 'the defenders',
          learned_text: learned(e.learned), changed_text: ch ? ` Changes: ${ch}.` : '', exposed_text: exposed(e.exposed) })));
        break;
      }
      case 'scouted': {
        const how = { sneak: 'sneaking in', ask: 'asking around', watch: 'watching from across the water' }[e.method];
        const mods = e.mods.length ? ` (${e.mods.map((m) => `${m.v > 0 ? '+' : ''}${m.v} ${m.why}`).join(', ')})` : '';
        const id = e.lost ? 'scout_lost' : e.learned.length ? 'scout_ok' : 'scout_nothing';
        say(e.tick, cap(fill(T[id], { clan: clanName(e.clan), town: town(e.town), how, roll: e.roll, mods, captain: char(e.char), learned: e.learned.map((f) => factWord(content, f)).join(', ') })));
        break;
      }
      case 'fortified': say(e.tick, cap(fill(T.fortified, { clan: clanName(e.clan), town: town(e.town) }))); break;
      case 'taunted': say(e.tick, cap(fill(T[e.ok ? 'taunt_ok' : 'taunt_fail'], { clan: clanName(e.clan), town: town(e.town), captain: char(e.char) }))); break;
      case 'promoted': say(e.tick, cap(fill(T.promoted, { clan: clanName(e.clan), char: char(e.char), town: town(e.town) }))); break;
      case 'succeeded': say(e.tick, cap(fill(T.succeeded, { char: char(e.char), town: town(e.town) }))); break;
      case 'captured': break;   // reported by the closing line or the skirmish line
      case 'player_absent': say(e.tick, cap(fill(T.absent, { clan: clanName(e.clan) }))); break;
      case 'clan_out': say(e.tick, cap(fill(T.clan_out, { clan: clanName(e.clan) }))); break;
      case 'director_word': if (e.changed && mine(e.clan)) say(e.tick, cap(fill(T.director, { clan: poss(clanName(e.clan)).replace(/'s?$/, ''), word: e.word.toLowerCase() }))); break;
      case 'units_moved': case 'units_arrived': say(e.tick, cap(fill(T.arrived, { clan: clanName(e.clan || e.by), n: e.n, from: town(e.from), to: town(e.to) }))); break;
      case 'settled': say(e.tick, cap(fill(T.settled, { n: e.skipped }))); break;
      default: break;   // recruits, dug_in and the Director's quiet events are for the metrics, not the story
    }
  }
  return entries;
}
