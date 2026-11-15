// What makes each kind of clan play differently (D23, finish plan F5, P18). One rule each; the words are placeholders until the user writes them.
//   goblin  dig in faster      (a township digs in at 2 units, not 3)
//   rat     breed fast, eat badly   (one more recruit a tick; 1 Food feeds 12 units, not 14)
//   toad    swim                 (their attackers ignore a river border's penalty)
//   gnome   build cheaply        (digging in costs no Build; a bridge costs 2 less)
export const KINDS = Object.freeze({
  goblin: { name: 'Goblins', rule: 'They dig in quickly: a township digs in at 2 units.' },
  rat: { name: 'Rats', rule: 'They breed fast and eat badly: one more recruit a tick, but their units eat a little more.' },
  toad: { name: 'Toads', rule: 'They swim: rivers do not slow their attackers.' },
  gnome: { name: 'Gnomes', rule: 'They build cheaply: digging in costs no Build and a bridge costs 2 less.' },
});
export const digMinFor = (kind, base) => (kind === 'goblin' ? Math.min(base, 2) : base);
export const recruitBonusFor = (kind) => (kind === 'rat' ? 1 : 0);
export const unitsPerFoodFor = (kind, base) => (kind === 'rat' ? Math.max(1, base - 2) : base);
export const ignoresRiver = (kind) => kind === 'toad';
export const digCostFree = (kind) => kind === 'gnome';
export const bridgeDiscount = (kind) => (kind === 'gnome' ? 2 : 0);
