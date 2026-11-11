// Every color the map uses, in one place.
//
// The rule (after Imhof and Tufte): large areas stay quiet and near-neutral;
// saturated color is reserved for small things that carry meaning.
//   amber  = you / the town you're in
//   blue   = what you selected or are being asked about, and water
//   green / red = right / wrong in practice
//   one warm tan = highways (importance shown by width, not hue)
// To try a different scheme (e.g. 1–3 colors), change this file only.

export const THEME = {
  land: '#f4f2ee',
  // Near-neutral county tints. Bordering counties never share a letter.
  countyTint: {
    A: '#ede7dc',
    B: '#e3e8e3',
    C: '#ebe4e8',
    D: '#e2e6ec',
    E: '#eeeae0',
    F: '#e8e3dd',
    G: '#e4eae6',
  },
  countyKey: {
    Sussex: 'A', Warren: 'B', Passaic: 'C', Bergen: 'D', Morris: 'E', Essex: 'F', Hudson: 'A',
    Union: 'B', Hunterdon: 'C', Somerset: 'D', Middlesex: 'G', Mercer: 'F', Monmouth: 'E',
    Burlington: 'B', Ocean: 'C', Atlantic: 'D', Camden: 'A', Gloucester: 'E', Salem: 'C',
    Cumberland: 'B', 'Cape May': 'F',
  },

  // Ink: one warm gray family for every line and label
  ink: '#1c1917',
  ink2: '#44403c',
  ink3: '#78716c',
  ink4: '#a8a29e',
  halo: 'rgba(246,244,240,0.92)',

  water: '#cbd8e1',
  waterInk: '#4f6f87',

  road: {
    motorway: '#c79a6b',
    major: '#d9c2a3',
    mid: '#ffffff',
    minor: '#ffffff',
    ref: '#6f4e2c',
    refHalo: '#f7efe3',
  },

  // Feature highlights (fill + outline)
  hl: {
    cur: '#d97706', // you are here
    sel: '#2563eb', // selected
    q: '#2563eb', // the town a question is about
    good: '#16a34a',
    bad: '#dc2626',
    near: '#a8a29e', // neighbors of the selected town
    hole: '#ffffff', // Drop in: a town still to be placed
  },
  // Text colors for labels revealed in practice/explore
  label: {
    q: '#1e40af',
    good: '#166534',
    bad: '#991b1b',
    neutral: '#44403c',
    place: '#44403c', // villages, landmarks
  },
  you: '#d97706',
  anchor: '#1c1917',
  trip: '#d97706',
};

// Ink: three colors. Paper, ink, and one accent (you / what's selected).
// Towns darken in ink as you learn them in Practice, so the map becomes a
// picture of what you know.
export const INK = {
  ...THEME,
  inkMode: true,
  land: '#f3eee3',
  countyTint: Object.fromEntries(Object.keys(THEME.countyTint).map((k) => [k, '#f3eee3'])),
  ink: '#1f1b16',
  ink2: '#3a332b',
  ink3: '#6b6257',
  ink4: '#a39a8c',
  halo: 'rgba(243,238,227,0.92)',
  water: '#ddd8cd',
  waterInk: '#6b6257',
  road: {
    motorway: '#5a5145',
    major: '#9a9182',
    mid: '#d8d1c3',
    minor: '#e4ded1',
    ref: '#3a332b',
    refHalo: '#f3eee3',
  },
  // Colors with one job each: blue = you / selected / the question,
  // green = right, red = wrong.
  accent: '#2b4fb3',
  hl: {
    cur: '#2b4fb3',
    sel: '#2b4fb3',
    q: '#2b4fb3',
    good: '#15803d',
    bad: '#b91c1c',
    near: '#a39a8c',
    hole: '#ffffff',
  },
  label: {
    q: '#1e3a8a',
    good: '#166534',
    bad: '#991b1b',
    neutral: '#3a332b',
    place: '#3a332b',
  },
  // ink fill by how well you know a place (0 = not practiced yet)
  know: [0, 0.07, 0.15, 0.26],
  you: '#2b4fb3',
  anchor: '#1f1b16',
  trip: '#2b4fb3',
};

export const THEMES = { classic: THEME, ink: INK };
