// Trees in 3D: a generated tree for each species (ez-tree, vendored in lib/ez-tree with branch arrangements added), with the tree's own traced
// leaf (img/trees/leaf/<id>.png) as its leaves, shown on a small stage you can turn. Each species' settings say only what tells it apart: how its
// branches sit (pairs, tiers, one at a time), their angles (droop low, rise high), and the crown's outline (cone or round). They are models of
// the habit, not portraits: every species here was checked against photos of whole trees before it was added (see README).
import * as THREE from '../lib/three/three.module.min.js';
import { Tree } from '../lib/ez-tree/tree.js';

const L = (o) => o;
/** Species settings, ez-tree options plus: leaf (traced leaf id), fall (four fall colours, dark to light, for recolouring the leaf). */
export const SPECIES = {
  'white-pine': L({
    type: 'evergreen', bark: { type: 'pine', tint: 0xb8aaa0, textureScale: { x: 1, y: 6 } },
    branch: { levels: 2, angle: { 1: 82, 2: 50 }, angleLow: { 1: 96 }, children: { 0: 30, 1: 9 }, arrangement: { 1: 'whorl', 2: 'alternate' }, whorl: { 1: 5 },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.02 }, gnarliness: { 0: 0.03, 1: 0.12, 2: 0.12 }, length: { 0: 46, 1: 24, 2: 5 }, radius: { 0: 1.4, 1: 0.3, 2: 0.5 },
      sections: { 0: 14, 1: 9, 2: 3 }, segments: { 0: 8, 1: 4, 2: 3 }, start: { 1: 0.22, 2: 0.25 }, taper: { 0: 0.9, 1: 0.8, 2: 0.7 }, twist: { 0: 0, 1: 0, 2: 0 } },
    leaves: { type: 'pine', billboard: 'double', angle: 25, count: 5, start: 0.3, size: 2.4, sizeVariance: 0.4, tint: 0xc8e6c8, alphaTest: 0.5 },
  }),
  'pin-oak': L({
    type: 'deciduous', leaf: 'pin-oak', fall: ['#3e1d0c', '#6e3216', '#9c4f22', '#c98247'], bark: { type: 'oak', tint: 0xcfc5b8, textureScale: { x: 1, y: 8 } },
    branch: { levels: 3, angle: { 1: 42, 2: 45, 3: 40 }, angleLow: { 1: 118 }, children: { 0: 26, 1: 5, 2: 3 }, arrangement: { 1: 'alternate', 2: 'alternate', 3: 'alternate' }, cone: { 1: 0.7 },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.0 }, gnarliness: { 0: 0, 1: 0.12, 2: 0.2, 3: 0.2 }, length: { 0: 42, 1: 15, 2: 6, 3: 2.2 }, radius: { 0: 1.4, 1: 0.32, 2: 0.6, 3: 0.6 },
      sections: { 0: 14, 1: 8, 2: 4, 3: 2 }, segments: { 0: 8, 1: 5, 2: 3, 3: 3 }, start: { 1: 0.12, 2: 0.3, 3: 0.3 }, taper: { 0: 0.85, 1: 0.7, 2: 0.7, 3: 0.7 }, twist: { 0: 0, 1: 0, 2: 0, 3: 0 } },
    leaves: { billboard: 'double', angle: 30, count: 6, start: 0.1, size: 1.8, sizeVariance: 0.4, tint: 0xffffff, alphaTest: 0.5 },
  }),
  sweetgum: L({
    type: 'deciduous', leaf: 'sweetgum', fall: ['#3d0f2e', '#7a1c3f', '#b8352f', '#e88a3c'], bark: { type: 'oak', tint: 0xbdb3a8, textureScale: { x: 1, y: 8 } },
    branch: { levels: 3, angle: { 1: 58, 2: 45, 3: 40 }, angleLow: { 1: 78 }, children: { 0: 22, 1: 5, 2: 3 }, arrangement: { 1: 'alternate', 2: 'alternate', 3: 'alternate' }, cone: { 1: 0.75 },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.005 }, gnarliness: { 0: 0.02, 1: 0.1, 2: 0.15, 3: 0.2 }, length: { 0: 40, 1: 14, 2: 5, 3: 2 }, radius: { 0: 1.3, 1: 0.32, 2: 0.6, 3: 0.6 },
      sections: { 0: 14, 1: 8, 2: 4, 3: 2 }, segments: { 0: 8, 1: 5, 2: 3, 3: 3 }, start: { 1: 0.22, 2: 0.3, 3: 0.3 }, taper: { 0: 0.85, 1: 0.7, 2: 0.7, 3: 0.7 }, twist: { 0: 0, 1: 0, 2: 0, 3: 0 } },
    leaves: { billboard: 'double', angle: 30, count: 6, start: 0.1, size: 1.9, sizeVariance: 0.4, tint: 0xffffff, alphaTest: 0.5 },
  }),
  'red-maple': L({
    type: 'deciduous', leaf: 'red-maple', fall: ['#5e0c0c', '#9e1b17', '#d63a24', '#f5884f'], bark: { type: 'birch', tint: 0x9a9a94, textureScale: { x: 1, y: 6 } },
    branch: { levels: 3, angle: { 1: 38, 2: 42, 3: 40 }, children: { 0: 8, 1: 6, 2: 4 }, arrangement: { 1: 'opposite', 2: 'opposite', 3: 'opposite' },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.01 }, gnarliness: { 0: 0.05, 1: 0.12, 2: 0.18, 3: 0.2 }, length: { 0: 24, 1: 17, 2: 8, 3: 3 }, radius: { 0: 1.2, 1: 0.55, 2: 0.6, 3: 0.6 },
      sections: { 0: 10, 1: 8, 2: 5, 3: 2 }, segments: { 0: 8, 1: 5, 2: 3, 3: 3 }, start: { 1: 0.42, 2: 0.25, 3: 0.3 }, taper: { 0: 0.75, 1: 0.7, 2: 0.7, 3: 0.7 }, twist: { 0: 0, 1: 0, 2: 0, 3: 0 } },
    leaves: { billboard: 'double', angle: 30, count: 5, start: 0.15, size: 2.0, sizeVariance: 0.4, tint: 0xffffff, alphaTest: 0.5 },
  }),
};
export const HAS_3D = (id) => id in SPECIES;

// the traced leaf, as a texture: as it is (summer) or recoloured into the species' fall colours by its four tones
const leafTex = {};
function leafTexture(id, season) {
  const k = id + season;
  if (leafTex[k]) return leafTex[k];
  const S = SPECIES[id], c = document.createElement('canvas'); c.width = 128; c.height = 154;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const im = new Image();
  im.onload = () => {
    const g = c.getContext('2d'); g.drawImage(im, 0, 0, c.width, c.height);
    if (season === 'fall' && S.fall) {
      const d = g.getImageData(0, 0, c.width, c.height), px = d.data, pal = S.fall.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
      for (let i = 0; i < px.length; i += 4) {
        if (!px[i + 3]) continue;
        const l = (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / 255, j = Math.min(3, Math.floor(l * 4.2));
        [px[i], px[i + 1], px[i + 2]] = pal[j];
      }
      g.putImageData(d, 0, 0);
    }
    t.needsUpdate = true;
  };
  im.src = `img/trees/leaf/${S.leaf}.png`;
  return (leafTex[k] = t);
}

/** Build a tree for a species and season ('spring' | 'summer' | 'fall' | 'winter'). Evergreens ignore the season. */
export function buildTree(id, season = 'summer', seed = 12345) {
  const S = SPECIES[id], tree = new Tree();
  const o = JSON.parse(JSON.stringify({ ...S, leaf: undefined, fall: undefined }));
  tree.options.copy({ seed, type: o.type, bark: o.bark, leaves: o.leaves });
  Object.assign(tree.options.branch, o.branch);
  tree.options.leaves.type = S.leaf ? leafTexture(id, season === 'fall' ? 'fall' : 'summer') : 'pine';
  if (S.type === 'deciduous' && season === 'winter') tree.options.leaves.count = 0;
  if (S.type === 'deciduous' && season === 'spring') tree.options.leaves.size *= 0.6;
  tree.generate();
  return tree;
}

/** A small turning stage in `el`: the tree, light, ground; drag to turn. Returns { set(id, season), dispose() }. */
export function stage(el, { auto = true } = {}) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  el.appendChild(r.domElement);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xeef6ff, 0x5a6b4a, 1.6));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.2); sun.position.set(40, 80, 30); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshLambertMaterial({ color: 0xc9d6b8 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const cam = new THREE.PerspectiveCamera(38, 1, 0.5, 2000);
  let tree = null, yaw = 0.6, drag = null, raf = 0, h = 60;
  function size() { const w = el.clientWidth || 300, hh = el.clientHeight || 300; r.setSize(w, hh, false); r.domElement.style.width = '100%'; r.domElement.style.height = '100%'; cam.aspect = w / hh; cam.updateProjectionMatrix(); }
  function frame() {
    if (auto && !drag) yaw += 0.004;
    const d = h * 1.55;
    cam.position.set(Math.sin(yaw) * d, h * 0.48, Math.cos(yaw) * d); cam.lookAt(0, h * 0.45, 0);
    r.render(scene, cam); raf = requestAnimationFrame(frame);
  }
  const down = (e) => { drag = { x: e.clientX, y0: yaw }; el.setPointerCapture?.(e.pointerId); };
  const move = (e) => { if (drag) yaw = drag.y0 - (e.clientX - drag.x) * 0.01; };
  const up = () => { drag = null; };
  el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  new ResizeObserver(size).observe(el); size(); frame();
  return {
    el: r.domElement,
    set(id, season) {
      if (tree) { scene.remove(tree); tree.traverse((m) => { m.geometry?.dispose?.(); }); }
      tree = buildTree(id, season); scene.add(tree);
      const box = new THREE.Box3().setFromObject(tree); h = Math.max(20, box.max.y - box.min.y);
      ground.scale.setScalar(Math.max(1, (box.max.x - box.min.x) / 40));
    },
    dispose() { cancelAnimationFrame(raf); r.dispose(); r.forceContextLoss?.(); r.domElement.remove(); },
  };
}

// ---- a life in years: the same tree, grown from a seed to old age and death, seasons turning each year ------------------------------------
// Growth curves: height H(age) = Hmax (1 - e^(-k age))^p (the Chapman-Richards form foresters use), fitted to the figures quoted in each
// species' Wikipedia article (November 2026): the `facts` lines are those figures, shown as milestones. Branch durations and old age are
// modelled, not measured.
export const LIFE = {
  'white-pine': { Hmax: 38, k: 0.045, p: 2.4, life: 230, decline: 190, dur: { 1: 35, 2: 10 }, evergreen: true,
    facts: [[7, 'About 2 m tall at 6 to 8 years.'], [15, 'From about 15 to 45 years it grows about 1 m taller a year.'], [45, 'Height growth slows after about 45.'], [200, 'Mature white pines are often 200 to 250 years old.']] },
  'pin-oak': { Hmax: 20, k: 0.07, p: 1.3, life: 120, decline: 95, dur: { 1: 28, 2: 10, 3: 4 },
    facts: [[10, 'About 8 m tall at 10 years in full sun.'], [40, 'By about 40: rougher bark and a looser, spreading crown.'], [60, 'Dead lower branches stay on the tree for many years.'], [120, 'A short-lived oak: about 120 years.']] },
  sweetgum: { Hmax: 25, k: 0.05, p: 1.4, life: 250, decline: 210, dur: { 1: 30, 2: 10, 3: 4 },
    facts: [[30, 'Grown in a yard it reaches about 15 to 21 m; in the wild up to 45 m.'], [200, 'Sweetgums can live to 400 years.']] },
  'red-maple': { Hmax: 20, k: 0.045, p: 1.5, life: 110, decline: 85, dur: { 1: 25, 2: 9, 3: 3.5 },
    facts: [[1, 'A seedling can grow 30 cm in its first year, then up to 60 cm a year.'], [8, 'First red flowers at about 8 years (some at 4).'], [90, 'Most red maples live less than 100 years; at most about 150.']] },
};
const H = (L, a) => L.Hmax * Math.pow(1 - Math.exp(-L.k * Math.max(0, a)), L.p);
const Hinv = (L, y) => -Math.log(1 - Math.pow(Math.min(0.995, y / L.Hmax), 1 / L.p)) / L.k;

function growMaterial(mat, kind, U) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    const head = kind === 'wood'
      ? 'uniform float uAge; uniform float uDie; uniform float uLife; uniform float uThick;\nattribute vec3 aBase; attribute vec3 aCenter; attribute float aAppear; attribute float aBirth; attribute float aRand; attribute float aLevel;\n'
      : 'uniform float uAge; uniform float uLeaf; uniform float uMix; uniform float uDrop; uniform float uDen; uniform float uFallSide;\nattribute vec3 aAnchor; attribute float aAppear; attribute float aRand;\n';
    const body = kind === 'wood'
      ? `vec3 transformed = position;
         float alive = step(aBirth, uAge);
         float r = clamp((uAge - aBirth) / max(aAppear - aBirth, 0.001), 0.0, 1.0);
         float wood = clamp(pow(max(uAge - aAppear, 0.0) / uThick, 0.6), 0.25, 1.15);
         float dieAt = aLevel < 0.5 ? 1e9 : (aLevel < 1.5 && aRand < 0.45) ? uLife + 3.0 : uDie + aRand * (uLife - uDie) - (aLevel - 1.0) * 6.0;
         float gone = 1.0 - smoothstep(dieAt, dieAt + 1.5, uAge);
         vec3 c = aBase + (aCenter - aBase) * r * gone;
         transformed = c + (position - aCenter) * wood * alive * gone;`
      : `vec3 transformed = position;
         float side = uFallSide > 0.5 ? (1.0 - step(uMix, aRand)) : step(uMix, aRand);
         float s = step(aAppear, uAge) * uLeaf * step(aRand, uDen) * side * step(uDrop, fract(aRand * 7.13));
         transformed = aAnchor + (position - aAnchor) * s;`;
    sh.vertexShader = head + sh.vertexShader.replace('#include <begin_vertex>', body);
  };
  mat.needsUpdate = true;
}

/** The life of one tree on a stage: { setAge(years), info(): {age, season, height}, dispose() }. Drag to turn. */
export function lifeStage(el, id) {
  const S = SPECIES[id], L = LIFE[id];
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); el.appendChild(r.domElement);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xeef6ff, 0x5a6b4a, 1.6));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.2); sun.position.set(40, 80, 30); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshLambertMaterial({ color: 0xc9d6b8 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  // a person for scale: 1.75 m
  const man = new THREE.Group(), mm = new THREE.MeshLambertMaterial({ color: 0x5b6470 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 1.45, 12), mm); body.position.y = 0.72;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), mm); head.position.y = 1.62; man.add(body, head); scene.add(man);
  const cam = new THREE.PerspectiveCamera(40, 1, 0.05, 3000);

  // the full-grown tree, with the age each part appears
  const tree = new Tree(), o = JSON.parse(JSON.stringify({ ...S, leaf: undefined, fall: undefined }));
  tree.options.copy({ seed: 12345, type: o.type, bark: o.bark, leaves: o.leaves });
  Object.assign(tree.options.branch, o.branch);
  const trunkTop = 0.82, s1 = S.branch.start[1] || 0, fillYears = Hinv(L, 0.6 * L.Hmax) * 0.6;   // the main branches fill in, bottom to top, over these years      // the trunk's tip reaches this share of the tree's final height (the rest is the crown above it)
  // the whole tree is drawn at its height for the age (holder scale, below); within it, main branches fill in from the bottom up over the
  // first decades and each grows out over a few years, so a young tree is sparse and slim and an old one full
  tree.options.growth = { trunkFull: true, tau: (f) => Math.min(1, Math.max(0, (f - s1) / (1 - s1))) * fillYears, dur: { 1: 1.5, 2: 0.8, 3: 0.4 }, delay: 0.2 };
  tree.options.leaves.type = S.leaf ? leafTexture(id, 'summer') : 'pine';
  tree.generate();
  const box = new THREE.Box3().setFromObject(tree), scale = L.Hmax / Math.max(1, box.max.y - box.min.y);
  const holder = new THREE.Group(); holder.add(tree); tree.scale.setScalar(scale); scene.add(holder);
  const U = { uAge: { value: 0 }, uDie: { value: L.decline }, uLife: { value: L.life }, uThick: { value: L.life * 0.35 }, uLeaf: { value: 1 }, uMix: { value: 0 }, uDrop: { value: 0 }, uDen: { value: 1 }, uFallSide: { value: 0 } };
  growMaterial(tree.branchesMesh.material, 'wood', U);
  growMaterial(tree.leavesMesh.material, 'leaf', U);
  let fallMesh = null;
  if (S.fall) {      // the same leaves in fall colours; each leaf switches over on its own
    const fm = tree.leavesMesh.material.clone(); fm.map = leafTexture(id, 'fall');
    const UF = { ...U, uFallSide: { value: 1 } };
    growMaterial(fm, 'leaf', UF);
    fallMesh = new THREE.Mesh(tree.leavesMesh.geometry, fm); tree.add(fallMesh);
  }
  const crownR = (box.max.x - box.min.x) * scale / 2;

  let age = 0, yaw = 0.5, drag = null, raf = 0;
  function seasonOf(y) { return y < 0.25 ? 'winter' : y < 0.42 ? 'spring' : y < 0.70 ? 'summer' : y < 0.88 ? 'fall' : 'winter'; }
  function apply() {
    const y = age - Math.floor(age), sm = (a, b, x) => Math.min(1, Math.max(0, (x - a) / (b - a)));
    U.uAge.value = age;
    if (L.evergreen) { U.uLeaf.value = 1; U.uMix.value = 0; U.uDrop.value = 0; }
    else {
      const out = sm(0.27, 0.38, y), mix = sm(0.70, 0.80, y), drop = sm(0.78, 0.88, y);
      U.uLeaf.value = y < 0.27 || y > 0.9 ? 0 : out; U.uMix.value = mix; U.uDrop.value = drop;
    }
    U.uDen.value = age < L.decline ? 1 : Math.max(0, 1 - (age - L.decline) / (L.life - L.decline));
    if (fallMesh) Object.assign(fallMesh.material.userData, {});
    // after death: a snag for a few years, then it falls and lies as a log
    // height for the age: the drawn tree is the grown one scaled to H(age); young trees slimmer than they are tall
    const sy = Math.max(0.02, H(L, Math.min(age, L.life)) / L.Hmax), sx = Math.pow(sy, 1.15);
    tree.scale.set(scale * sx, scale * sy, scale * sx);
    const fall = Math.min(1, Math.max(0, (age - L.life - 4) / 1.2));
    holder.rotation.z = -fall * Math.PI / 2; holder.position.y = fall * 0.45;
    holder.visible = age < L.life + 40;
  }
  function size() { const w = el.clientWidth || 300, hh = el.clientHeight || 300; r.setSize(w, hh, false); r.domElement.style.width = '100%'; r.domElement.style.height = '100%'; cam.aspect = w / hh; cam.updateProjectionMatrix(); }
  function frame() {
    if (!drag) yaw += 0.002;
    const fallen = age > L.life + 5.2;
    const h = Math.max(0.4, H(L, Math.min(age, L.life))), cr = Math.max(0.5, crownR * Math.min(1, h / L.Hmax));
    const side = Math.max(1.2, cr + 1.2); man.position.set(Math.cos(yaw) * side, 0, -Math.sin(yaw) * side);   // always beside the tree, never in front
    ground.scale.setScalar(Math.max(4, cr * 2.4, h * 0.9));
    if (fallen) {      // the log lies along +x from the stump: look at its middle, from a little above
      const cx = h * 0.45, d = h * 0.95;
      cam.position.set(cx + Math.sin(yaw) * d, h * 0.35, Math.cos(yaw) * d); cam.lookAt(cx, 0.5, 0);
    } else {
      const d = Math.max(3.2, h * 1.55 + cr * 0.6);
      cam.position.set(Math.sin(yaw) * d, Math.max(1.0, h * 0.45), Math.cos(yaw) * d); cam.lookAt(0, Math.max(0.6, h * 0.42), 0);
    }
    r.render(scene, cam); raf = requestAnimationFrame(frame);
  }
  const down = (e) => { drag = { x: e.clientX, y0: yaw }; el.setPointerCapture?.(e.pointerId); };
  const move = (e) => { if (drag) yaw = drag.y0 - (e.clientX - drag.x) * 0.01; };
  const up = () => { drag = null; };
  el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  new ResizeObserver(size).observe(el); size(); apply(); frame();
  return {
    el: r.domElement, L,
    setAge(a) { age = Math.max(0, a); apply(); },
    info() { return { age, season: seasonOf(age - Math.floor(age)), height: age > L.life + 4 ? 0 : H(L, Math.min(age, L.life)) }; },
    dispose() { cancelAnimationFrame(raf); r.dispose(); r.forceContextLoss?.(); r.domElement.remove(); },
  };
}
