// Deep Jersey stories: the thread logic and the validator, and (once the data exists) the real stories. No browser.
// Run: node tools/checks/deep-stories.cjs  → prints "deep-stories ok", or the failures and exit code 1.
const assert = require('assert');
const fails = [];
const check = (name, f) => { try { f(); } catch (e) { fails.push(`${name}: ${e.message}`); } };

(async () => {
  const T = await import('../../js/deepthreads.js');
  const beat = (t) => ({ text: [t], scene: {}, cam: [-74.4, 40.8, 9] });
  const mk = (id, threads, extra = {}) => ({ id, title: id.toUpperCase(), hook: `hook ${id}`, domain: 'earth', when: 'then',
    beats: { big: beat('big'), thread: beat('thread'), here: beat('here') }, places: ['p1'], threads, src: ['s1'], ...extra });
  const fx = [mk('a', [{ to: 'b', why: 'a to b' }, { to: 'c', why: 'a to c' }]), mk('b', [{ to: 'c', why: 'b to c' }, { to: 'a', why: 'b to a' }]),
    mk('c', [{ to: 'a', why: 'c to a' }, { to: 'b', why: 'c to b' }])];
  const refs = { places: new Set(['p1']), src: new Set(['s1']), explain: new Set(['rift']) };

  check('valid fixture has no problems', () => assert.deepStrictEqual(T.checkStories(fx, refs), []));
  check('dead thread is reported', () => { const bad = fx.map((s) => (s.id === 'a' ? { ...s, threads: [{ to: 'zz', why: 'nowhere' }, s.threads[1]] } : s));
    assert.ok(T.checkStories(bad, refs).some((p) => p.includes('zz'))); });
  check('two beats is reported', () => { const bad = fx.map((s) => (s.id === 'b' ? { ...s, beats: { big: s.beats.big, thread: s.beats.thread } } : s));
    assert.ok(T.checkStories(bad, refs).some((p) => p.includes('three beats'))); });
  check('unknown source is reported', () => { const bad = fx.map((s) => (s.id === 'c' ? { ...s, src: ['nope'] } : s)); assert.ok(T.checkStories(bad, refs).length > 0); });
  check('unknown place is reported', () => { const bad = fx.map((s) => (s.id === 'c' ? { ...s, places: ['nowhere'] } : s)); assert.ok(T.checkStories(bad, refs).length > 0); });
  check('unknown domain is reported', () => { const bad = fx.map((s) => (s.id === 'c' ? { ...s, domain: 'astrology' } : s)); assert.ok(T.checkStories(bad, refs).length > 0); });
  check('one thread is too few', () => { const bad = fx.map((s) => (s.id === 'a' ? { ...s, threads: [s.threads[0]] } : s)); assert.ok(T.checkStories(bad, refs).length > 0); });
  check('here beat needs a cam', () => { const bad = fx.map((s) => (s.id === 'a' ? { ...s, beats: { ...s.beats, here: { text: ['x'], scene: {} } } } : s)); assert.ok(T.checkStories(bad, refs).length > 0); });
  check('unknown explainer is reported', () => { const bad = fx.map((s) => (s.id === 'a' ? { ...s, explain: ['nope'] } : s)); assert.ok(T.checkStories(bad, refs).length > 0); });
  // scene scripts: timed moves on a beat
  const sref = { ...refs, water: new Set(['Pompton River', 'Pompton Lake']), counties: new Set(['Passaic']), regions: new Set(['highlands']) };
  const withScript = (script) => fx.map((s) => (s.id === 'a' ? { ...s, beats: { ...s.beats, thread: { ...s.beats.thread, script } } } : s));
  check('a good script passes', () => assert.deepStrictEqual(T.checkStories(withScript([{ at: 0, do: 'cap', text: 'x' }, { at: 500, do: 'trace', name: 'Pompton River' }, { at: 900, do: 'pop', county: 'Passaic' }, { at: 1200, do: 'pop', region: 'highlands' }, { at: 1500, do: 'pulse', to: 2 }]), sref), []));
  check('an unknown move is reported', () => assert.ok(T.checkStories(withScript([{ at: 0, do: 'explode' }]), sref).some((p) => p.includes('explode'))));
  check('an unknown river is reported', () => assert.ok(T.checkStories(withScript([{ at: 0, do: 'trace', name: 'Hudson River' }]), sref).some((p) => p.includes('Hudson River'))));
  check('an unknown county is reported', () => assert.ok(T.checkStories(withScript([{ at: 0, do: 'pop', county: 'Atlantis' }]), sref).some((p) => p.includes('Atlantis'))));
  check('steps out of time order are reported', () => assert.ok(T.checkStories(withScript([{ at: 900, do: 'cap', text: 'b' }, { at: 100, do: 'cap', text: 'a' }]), sref).some((p) => p.includes('order'))));
  check('domains are exactly the ten', () => assert.deepStrictEqual(Object.keys(T.DOMAINS).sort(), ['earth', 'gone', 'ice', 'industry', 'life', 'people', 'sea', 'sky', 'water', 'weather']));

  check('pick up a thread from what was read', () => assert.deepStrictEqual(T.pickUp(fx, ['a']), ['b', 'c']));
  check('nothing to pick up when all read', () => assert.deepStrictEqual(T.pickUp(fx, ['a', 'b', 'c']), []));
  check('pick up respects max', () => assert.strictEqual(T.pickUp(fx, ['a'], 1).length, 1));
  check('hooks still offered when all read', () => assert.strictEqual(T.hooks(fx, ['a', 'b', 'c'], 2).length, 2));
  check('hooks prefer unread', () => assert.deepStrictEqual(T.hooks(fx, ['a', 'b'], 1), ['c']));
  const six = 'abcdef'.split('').map((id) => mk(id, [{ to: 'a', why: 'x' }, { to: 'b', why: 'y' }]));
  check('hooks rotate by day', () => { const orders = new Set(Array.from({ length: 7 }, (_, d) => T.hooks(six, [], 6, d).join(''))); assert.ok(orders.size > 1); });

  check('blocked storage reads as nothing read', () => assert.deepStrictEqual(T.readIds({ get() { throw new Error('blocked'); } }), []));
  check('blocked storage does not throw on mark', () => T.markRead({ get() { throw 1; }, set() { throw 1; } }, 'a'));
  check('mark read records once', () => { const m = {}; const st = { get: (k, d) => (k in m ? m[k] : d), set: (k, v) => { m[k] = v; } };
    T.markRead(st, 'a'); T.markRead(st, 'a'); assert.deepStrictEqual(T.readIds(st), ['a']); });

  // the real stories, once they exist
  let real = null; try { real = await import('../../js/deepstories.js'); } catch (e) { if (!/Cannot find module|ERR_MODULE_NOT_FOUND/.test(String(e.code || e.message))) fails.push(`deepstories.js: ${e.message}`); }
  if (real) {
    const C = await import('../../js/deepcards.js'), X = await import('../../js/deepexplain.js');
    const fs = require('fs'), W = JSON.parse(fs.readFileSync(require('path').join(__dirname, '../../data/deep/water.json'))), topo = JSON.parse(fs.readFileSync(require('path').join(__dirname, '../../data/nj.topo.json'))), prov = JSON.parse(fs.readFileSync(require('path').join(__dirname, '../../data/deep/provinces.json')));
    const rr = { places: new Set(Object.keys(C.CARD)), src: new Set(Object.keys(C.SRC)), explain: new Set(Object.keys(X.EXPLAIN)),
      water: new Set(W.features.map((f) => f.properties.name)), counties: new Set(topo.objects.counties.geometries.map((g) => g.properties.c)), regions: new Set(prov.features.map((f) => f.properties.region)) };
    check('real stories are valid', () => assert.deepStrictEqual(T.checkStories(real.STORIES, rr), []));
    check('sequence ids exist', () => { for (const id of real.SEQUENCE) assert.ok(real.STORY_BY[id], id); });
    const P = await import('../../js/deepplaces.js');
    check('every story has a town and county (run tools/build_story_places.cjs)', () => { for (const S of real.STORIES) assert.ok(P.PLACE_OF[S.id] && P.PLACE_OF[S.id].county, S.id); });
    console.log(`stories: ${real.STORIES.length}`);
  }

  if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
  console.log('deep-stories ok');
})().catch((e) => { console.log('ERROR', e.message); process.exit(1); });
