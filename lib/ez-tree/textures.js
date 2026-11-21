// Textures for the vendored ez-tree: bark (CC0, from Poly Haven and TextureCan, via ez-tree) and leaves (a THREE.Texture made by the caller,
// or the pine needles that came with ez-tree).
import * as THREE from '../three/three.module.min.js';
const base = new URL('.', import.meta.url).href;
const loader = new THREE.TextureLoader();
const cache = {};
const load = (u) => cache[u] || (cache[u] = loader.load(u));
export function getBarkTexture(type, kind, scale = { x: 1, y: 1 }) {
  if (kind !== 'color' && kind !== 'normal') return null;
  const t = load(`${base}bark/${type}_${kind}.jpg`).clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(scale.x, scale.y);
  if (kind === 'color') t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
export function getLeafTexture(type) {
  if (type && type.isTexture) return type;
  const t = load(type && type.includes('/') ? type : `${base}leaves/pine.png`);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
