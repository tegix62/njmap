// Lists every placeholder left in data/goblin-content.json (D194): anything Claude wrote as a stand-in that the user has not yet replaced.
//   node tools/goblin/check_placeholders.mjs            report
//   node tools/goblin/check_placeholders.mjs --strict   exit 1 if any remain (for a release build)
import fs from 'node:fs';
import { loadContent, placeholdersIn } from '../../js/goblin/sim/chars.js';

const content = loadContent(JSON.parse(fs.readFileSync(new URL('../../data/goblin-content.json', import.meta.url), 'utf8')));
const left = placeholdersIn(content);
const by = {};
for (const [sec, id] of left) (by[sec] ||= []).push(id);
console.log(`${left.length} placeholder entries remain in data/goblin-content.json:`);
for (const [sec, ids] of Object.entries(by)) console.log(`  ${sec}: ${ids.length} (${ids.slice(0, 6).join(', ')}${ids.length > 6 ? ', ...' : ''})`);
if (process.argv.includes('--strict') && left.length) process.exit(1);
