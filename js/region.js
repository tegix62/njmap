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

/** First launch: no map chosen yet (and none forced by ?region=). */
export function needsRegionChoice() {
  return !new URLSearchParams(location.search).get('region') && store.get('region', null) === null;
}
export function setRegion(id) {
  store.set('region', id);
}

// What each map is, in a line, for the chooser and the switcher
export const REGION_BLURB = {
  nj: { name: 'New Jersey', tag: 'NJ', line: '564 towns and 21 counties: which one you’re in, highways, lakes and mountains.' },
  manhattan: { name: 'New York City', tag: 'NYC', line: 'Manhattan’s neighborhoods, avenues and one-way streets, with driving games.' },
};
