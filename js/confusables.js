// Groups of NJ municipality names that are easy to mix up. Names match the
// short `n` field in data/nj.topo.json; a name that exists more than once
// (e.g. Clinton Town + Clinton Township) pulls in every match.
//
// `note` is an optional memory hook shown after a practice answer.
// Edit freely: add the pairs that trip *you* up.

export const GROUPS = [
  {
    names: ['Clifton', 'Rockaway'],
    note:
      'Clifton is the big city where the Parkway crosses Routes 3 and 46 in Passaic County, just west of the Meadowlands. ' +
      'Rockaway is way out west on I-80 in Morris County — "Rock-AWAY" is the one farther away.',
  },
  {
    names: ['Mahwah', 'Rahway'],
    note:
      'Mahwah is the very top of the state: northern tip of Bergen at the NY line, where Route 17 and I-287 cross. ' +
      'Rahway is down on Route 1 & 9 by the Turnpike in Union County, next to Linden. ' +
      'Mahwah = Max north. Rahway = Route 1.',
  },
  { names: ['Mahwah', 'Matawan'], note: 'Matawan is a small Monmouth County borough by the Raritan Bay shore — about 45 mi south of Mahwah.' },
  { names: ['Clifton', 'Clinton'], note: 'Clinton (Town and Township) is out in Hunterdon County on I-78, far west of Clifton.' },
  { names: ['Montclair', 'Montvale', 'Montville', 'Montgomery'] },
  { names: ['Fair Lawn', 'Fairfield', 'Fairview', 'Fair Haven'] },
  { names: ['Ridgewood', 'Ridgefield', 'Ridgefield Park'] },
  { names: ['Hackensack', 'Hackettstown'] },
  { names: ['Wayne', 'Wanaque', 'Wantage'] },
  { names: ['Morristown', 'Moorestown', 'Morris Plains'] },
  { names: ['Union', 'Union City', 'Union Beach'] },
  { names: ['Orange', 'East Orange', 'West Orange', 'South Orange Village'] },
  { names: ['Woodbridge', 'Woodbury', 'Woodbine', 'Woodland Park', 'Woodcliff Lake'] },
  { names: ['Teaneck', 'Tenafly'] },
  { names: ['Bloomfield', 'Bloomingdale', 'Bloomsbury'] },
  { names: ['Wyckoff', 'Waldwick'] },
  { names: ['Plainfield', 'Plainsboro', 'Pleasantville'] },
  { names: ['Glen Rock', 'Glen Ridge', 'Glen Gardner'] },
  { names: ['Edison', 'Emerson'] },
  { names: ['Cranford', 'Cranbury'] },
  { names: ['Millburn', 'Millville', 'Milltown', 'Millstone'] },
  { names: ['Maplewood', 'Maple Shade'] },
  { names: ['Hillsdale', 'Hillside', 'Hillsborough'] },
  { names: ['Lakewood', 'Lakehurst'] },
  { names: ['Long Branch', 'Long Beach', 'Long Hill'] },
  { names: ['Belleville', 'Belvidere', 'Bellmawr', 'Belmar'] },
  { names: ['Linden', 'Lyndhurst', 'Lindenwold'] },
  { names: ['Paramus', 'Passaic', 'Paterson', 'Parsippany-Troy Hills'] },
  { names: ['Englewood', 'Edgewater', 'Elmwood Park'] },
  { names: ['Rockaway', 'Rockleigh', 'Rocky Hill'] },
  { names: ['Kearny', 'Keansburg'] },
  { names: ['Summit', 'Somerville', 'Somerdale'] },
  { names: ['Westfield', 'Westwood', 'Westville'] },
  { names: ['Haddonfield', 'Haddon Heights', 'Haddon'] },
  { names: ['Mount Olive', 'Mount Laurel', 'Mountainside', 'Mountain Lakes'] },
  { names: ['Oakland', 'Oaklyn'] },
  { names: ['Ho-Ho-Kus', 'Hoboken'] },
  { names: ['Berkeley', 'Berkeley Heights'] },
  { names: ['Newark', 'Newton'] },
  { names: ['Bernards', 'Bernardsville'] },
  { names: ['Dover', 'Denville'] },
  { names: ['Harrison', 'Hamilton', 'Hampton'] },
];

/**
 * Resolves GROUPS against the loaded municipalities.
 * Returns { groups: [{members, note}], byId: Map<id, group[]> } and logs unknown names.
 */
export function resolveGroups(munis, groupsDef = GROUPS) {
  const byName = new Map();
  for (const m of munis) {
    if (!byName.has(m.n)) byName.set(m.n, []);
    byName.get(m.n).push(m);
  }
  const groups = [];
  const byId = new Map();
  const add = (g) => {
    groups.push(g);
    for (const m of g.members) {
      if (!byId.has(m.id)) byId.set(m.id, []);
      byId.get(m.id).push(g);
    }
  };
  for (const g of groupsDef) {
    const members = [];
    for (const n of g.names) {
      const hits = byName.get(n);
      if (hits) members.push(...hits);
      else console.warn('confusables: no municipality named', n);
    }
    if (members.length > 1) add({ members, note: g.note || '', curated: true });
  }
  // Same name, different place (6 Washingtons, Rockaway Boro vs Twp, …)
  for (const [, ms] of byName) if (ms.length > 1) add({ members: ms, note: '', curated: false });
  return { groups, byId };
}
