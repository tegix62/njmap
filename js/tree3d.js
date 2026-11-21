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
