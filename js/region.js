// The active region (New Jersey or Manhattan). Switching reloads the page.
import { store } from './store.js';
import nj from './places/nj.js';
import manhattan from './places/manhattan.js';

export const ALL_REGIONS = [nj, manhattan];

export function activeRegion() {
  const q = new URLSearchParams(location.search).get('region');
  const id = q || store.get('region', 'nj');
  return ALL_REGIONS.find((r) => r.id === id) || nj;
}

export function switchRegion(id) {
  store.set('region', id);
  const u = new URL(location.href);
  u.searchParams.delete('region');
  location.replace(u.toString());
}
