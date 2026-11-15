// Region kits and their rules (D171, finish plan F5). The kits are data (data/goblin-regions.json, built by tools/goblin/build_regions.mjs from the board's own
// numbers); each gives its townships one small rule. Without kit data on the board every function here returns the neutral answer.
//   kitOf(board, town) -> kit id | null      ruleOf(board, town) -> 'roads' | 'rivers' | 'hills' | 'farm' | 'coast' | null      kitName(board, id)
export const kitOf = (board, town) => (board.regions && board.regions.townKit[town]) || null;
export const kitById = (board, id) => (board.regions ? board.regions.kits.find((k) => k.id === id) : null) || null;
export const ruleOf = (board, town) => { const k = kitById(board, kitOf(board, town)); return k ? k.rule : null; };
export const kitName = (board, id) => (kitById(board, id) || { name: id }).name;
