// Seasons from the real calendar (D172's "new rules"). The world stores the real start time (ms since 1970, UTC) so the sim stays pure: the month is plain
// integer arithmetic on that and the tick, never a clock. One small rule a season, each statable in a sentence:
//   winter (Dec to Feb)  units eat a quarter more         spring (Mar to May)  rivers run high: crossing one costs the attacker 2, not 1
//   summer (Jun to Aug)  one more recruit a tick          autumn (Sep to Nov)  harvest: Food towns yield 1 more Food
export const SEASONS = Object.freeze({
  winter: { name: 'Winter', text: 'Units eat a quarter more.' },
  spring: { name: 'Spring', text: 'The rivers run high: crossing one is harder.' },
  summer: { name: 'Summer', text: 'More hands about: one more recruit a tick.' },
  autumn: { name: 'Autumn', text: 'Harvest: Food towns yield 1 more Food.' },
});
const DAY_MS = 86400000;
/** Month 1 to 12 of a day count since 1970-01-01 (Howard Hinnant's civil-from-days, integers only). */
export function monthOfDays(days) {
  const z = days + 719468, era = Math.floor(z / 146097), doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  return mp < 10 ? mp + 3 : mp - 9;
}
export const seasonOfMonth = (m) => (m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn');
/** The season at the world's current tick, or null for a world with no calendar. */
export function seasonOf(w) {
  if (w.startMs === undefined || w.startMs === null) return null;
  return seasonOfMonth(monthOfDays(Math.floor((w.startMs + w.tick * 3600000) / DAY_MS)));
}
