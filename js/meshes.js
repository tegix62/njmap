// The famous towers as the survey's own triangles (data/tower-meshes.json, from tools/extract_meshes.py), drawn by a small custom
// WebGL layer inside the map: the same depth buffer as the map's buildings, so they stand behind and in front of them properly.
// The slab model (stacked extruded outlines, js/city3d.js) is what the map's own building layer can draw; this is the real shape.
//
// Needs WebGL2 (flat shading from screen-space derivatives, no normals stored). Without it `ok` stays false and the callers
// keep the slab model.

const VS = `#version 300 es
in vec3 a_pos;
in vec3 a_col;
uniform mat4 u_matrix;
uniform float u_sq;
out vec3 v_col;
out vec3 v_pos;
void main() {
  vec3 p = a_pos;
  if (u_sq > 0.0 && p.z > 60.0) p.z = 60.0 + (p.z - 60.0) * (1.0 - 0.6 * u_sq); // the drive games' squash of tall towers at the driving angle
  v_pos = a_pos;
  v_col = a_col;
  gl_Position = u_matrix * vec4(p, 1.0);
}`;
const FS = `#version 300 es
precision mediump float;
in vec3 v_col;
in vec3 v_pos;
uniform float u_alpha;
uniform float u_mute;
uniform vec3 u_pat; // wall pattern: x kind (0 none, 1 diagrid), y metres across, z metres up
out vec4 o;
void main() {
  vec3 n = normalize(cross(dFdx(v_pos), dFdy(v_pos)));
  float l = 0.5 + 0.5 * abs(dot(n, normalize(vec3(-0.45, -0.55, 0.7)))); // flat shading, brighter on roofs and the sunny sides
  l *= 0.82 + 0.18 * clamp(v_pos.z / 300.0, 0.0, 1.0);                   // a little lighter towards the top
  vec3 c = v_col * l;
  bool roof6 = u_pat.x > 5.5 && n.z > 0.5;
  if (u_pat.x > 0.5 && ((abs(n.z) < 0.5 && v_pos.z > (u_pat.x > 5.5 ? 0.5 : 6.0)) || roof6)) {  // facade patterns, on walls (and on roofs for kind 6)
    vec2 t = normalize(vec2(-n.y, n.x));
    float s = dot(v_pos.xy, t);
    int k = int(u_pat.x + 0.5);
    if ((k == 1 && v_pos.z > 32.0) || k == 5) {                   // a diagonal frame (Hearst Tower; 5 = the bold braces of 53 West 53rd)
      float u = s / u_pat.y, v = v_pos.z / u_pat.z;
      float d = min(0.5 - abs(fract(u + v) - 0.5), 0.5 - abs(fract(u - v) - 0.5)); // distance to the nearest diagonal, 0 on it
      float w = (k == 5 ? 0.12 : 0.05) + 0.5 * fwidth(u + v);
      c = mix(c, (k == 5 ? vec3(0.86, 0.88, 0.90) : vec3(0.80, 0.84, 0.88)) * l, (k == 5 ? 0.85 : 0.6) * (1.0 - smoothstep(w, w + 0.04, d)));
    } else if (k == 2) {                                          // vertical piers with darker window strips (30 Rock, Empire State, Chanin)
      float u = s / u_pat.y;
      float aa = 1.0 - smoothstep(0.25, 0.6, fwidth(u));
      c *= 1.0 - u_pat.z * step(0.42, fract(u)) * aa;
    } else if (k == 3) {                                          // square windows in a concrete grid, open mechanical floors (432 Park)
      float u = s / u_pat.y, v = v_pos.z / u_pat.y;
      float aa = 1.0 - smoothstep(0.25, 0.6, fwidth(u));
      vec2 f = fract(vec2(u, v));
      float pane = step(0.14, f.x) * step(f.x, 0.86) * step(0.14, f.y) * step(f.y, 0.86);
      c *= 1.0 - 0.38 * pane * aa;
      float band = mod(v_pos.z - 55.0, 60.0);
      if (v_pos.z > 55.0 && band < 10.0) c = mix(c, vec3(0.12, 0.13, 0.15) * l, 0.92); // the open floors, a dark gap through the tower
    } else if (k == 6) {                                          // glass with a space-frame lattice: diagonals on the walls, a grid on the roof (Javits)
      if (roof6) {
        vec2 g = fract(v_pos.xy / (u_pat.y * 2.5));
        float d = min(min(g.x, 1.0 - g.x), min(g.y, 1.0 - g.y));
        float aa = 1.0 - smoothstep(0.15, 0.4, fwidth(v_pos.x / (u_pat.y * 2.5)));
        c = mix(c, vec3(0.90, 0.94, 0.96) * l, 0.32 * aa * (1.0 - smoothstep(0.02, 0.06, d)));
      } else {
        float u = s / u_pat.y, v = v_pos.z / u_pat.z;
        float d = min(0.5 - abs(fract(u + v) - 0.5), 0.5 - abs(fract(u - v) - 0.5));
        float w = 0.06 + 0.5 * fwidth(u + v);
        c = mix(c, vec3(0.90, 0.94, 0.96) * l, 0.5 * (1.0 - smoothstep(w, w + 0.04, d)));
      }
    } else if (k == 4) {                                          // mullions and spandrels (Seagram)
      float u = s / u_pat.y, v = v_pos.z / u_pat.z;
      float aa = 1.0 - smoothstep(0.25, 0.6, fwidth(u));
      c *= 1.0 - 0.45 * (1.0 - step(0.14, fract(u))) * aa;          // the bronze I-beam mullions
      c *= 1.0 - 0.35 * (1.0 - step(0.3, fract(v)));                 // the spandrel band at each floor
      c *= 1.0 + 0.12 * step(0.3, fract(v)) * step(0.14, fract(u)); // the glass a little lighter
    }
  }
  c = mix(c, vec3(0.66, 0.71, 0.76) * l, u_mute);
  o = vec4(c, u_alpha);
}`;

// facades drawn with a pattern in the shader (no geometry for it in the survey): name -> [kind, metres across, metres up]
const PATTERN = {
  'Hearst Tower': [1, 11, 16.5],
  '53 West 53rd': [5, 18, 34],
  '30 Rockefeller Plaza': [2, 2.6, 0.24],
  'Empire State Building': [2, 2.4, 0.2],
  'Chanin Building': [2, 2.2, 0.2],
  '432 Park Avenue': [3, 4.6, 0],
  'Seagram Building': [4, 1.7, 4.1],
  'Javits Center': [6, 4.5, 4.5],
};
const NOPAT = [0, 1, 1];
const b64 = (s) => {
  const bin = atob(s);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
};
const mul = (a, b) => {
  // 4x4 column-major a * b
  const o = new Float64Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
};

/** The meshes' places for city3d's applySurveyTowers: name, middle, height and footprint ring (lon/lat) where the data has it. */
export function meshInfo(md) {
  return md
    ? md.t.map(({ n, lon, lat, h, fp }) => ({ n, lon, lat, h, ring: fp && fp.length >= 6 ? Array.from({ length: fp.length / 2 }, (_, i) => [lon + fp[2 * i] / 10 / 84200, lat + fp[2 * i + 1] / 10 / 111000]) : null }))
    : [];
}

export function createMeshLayer(map) {
  const api = {
    ok: false, // set once the layer is in the map and WebGL2 is there
    id: 'tower-meshes',
    towers: [], // { n, lon, lat, h, alpha, mute, hidden, ... }
    visible: false,
    sq: 0,
    names: () => api.towers.map((t) => t.n),
    has: (n) => api.towers.some((t) => t.n === n),
    state(n, s) {
      const t = api.towers.find((x) => x.n === n);
      if (t) Object.assign(t, s);
      map.triggerRepaint();
    },
    all(s) {
      for (const t of api.towers) Object.assign(t, s);
      map.triggerRepaint();
    },
    show(v) {
      api.visible = v;
      map.triggerRepaint();
    },
  };
  let gl = null, prog = null, loc = null;

  const layer = {
    id: api.id,
    type: 'custom',
    renderingMode: '3d',
    onAdd(_map, ctx) {
      gl = ctx;
      if (!(typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext)) return;
      const sh = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      loc = {
        pos: gl.getAttribLocation(prog, 'a_pos'), col: gl.getAttribLocation(prog, 'a_col'),
        matrix: gl.getUniformLocation(prog, 'u_matrix'), sq: gl.getUniformLocation(prog, 'u_sq'),
        pat: gl.getUniformLocation(prog, 'u_pat'), alpha: gl.getUniformLocation(prog, 'u_alpha'), mute: gl.getUniformLocation(prog, 'u_mute'),
      };
      api.ok = true;
      for (const t of api.towers) upload(t);
    },
    render(_gl, args) {
      if (!api.ok || !api.visible || !api.towers.length) return;
      const main = args.defaultProjectionData.mainMatrix;
      gl.useProgram(prog);
      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1f(loc.sq, api.sq);
      // solid ones first (they write depth), the muted, see-through ones after (they only read it)
      const order = [...api.towers].sort((a, b) => (b.alpha >= 1) - (a.alpha >= 1));
      for (const t of order) {
        if (t.hidden || !t.vao || t.alpha <= 0) continue;
        const mc = t.merc;
        const s = mc.s;
        const model = new Float64Array([s, 0, 0, 0, 0, -s, 0, 0, 0, 0, s, 0, mc.x, mc.y, mc.z, 1]);
        gl.uniformMatrix4fv(loc.matrix, false, new Float32Array(mul(main, model)));
        gl.uniform3fv(loc.pat, PATTERN[t.n] || NOPAT);
        gl.uniform1f(loc.alpha, t.alpha);
        gl.uniform1f(loc.mute, t.mute);
        gl.depthMask(t.alpha >= 1);
        gl.bindVertexArray(t.vao);
        gl.drawElements(gl.TRIANGLES, t.count, gl.UNSIGNED_SHORT, 0);
      }
      gl.bindVertexArray(null);
      gl.depthMask(true);
    },
    onRemove() {
      api.ok = false;
    },
  };

  function upload(t) {
    const pos = new Int16Array(t.raw.p.buffer, t.raw.p.byteOffset, t.raw.p.byteLength / 2);
    const f = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i++) f[i] = pos[i] / 10; // decimetres to metres
    t.vao = gl.createVertexArray();
    gl.bindVertexArray(t.vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, f, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc.pos);
    gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 0, 0);
    const cb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cb);
    gl.bufferData(gl.ARRAY_BUFFER, t.raw.c, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc.col);
    gl.vertexAttribPointer(loc.col, 3, gl.UNSIGNED_BYTE, true, 0, 0);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    const idx = new Uint16Array(t.raw.i.buffer, t.raw.i.byteOffset, t.raw.i.byteLength / 2);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    t.count = idx.length;
    gl.bindVertexArray(null);
  }

  let dataPromise = null;
  /** The mesh file, once (null if it can't be had). */
  api.data = () => (dataPromise = dataPromise || Promise.all([
    fetch('data/tower-meshes.json').then((r) => r.json()).catch(() => null),
    fetch('data/landmark-meshes.json').then((r) => r.json()).catch(() => null), // the other landmark buildings (tools/extract_meshes.py, REGISTRY)
  ]).then(([a, b]) => (a ? { v: 2, t: [...a.t, ...(b ? b.t : [])] } : null)));
  /** Put the layer in the map (below `beforeId`). Resolves to the list of tower names that have a mesh. */
  api.load = async (beforeId) => {
    if (api.towers.length) return api.names();
    const data = await api.data();
    if (!data) return [];
    for (const t of data.t) {
      const mc = window.maplibregl.MercatorCoordinate.fromLngLat([t.lon, t.lat], 0);
      api.towers.push({ n: t.n, lon: t.lon, lat: t.lat, h: t.h, alpha: 1, mute: 0, hidden: false, merc: { x: mc.x, y: mc.y, z: mc.z, s: mc.meterInMercatorCoordinateUnits() }, raw: { p: b64(t.p), c: b64(t.c), i: b64(t.i) } });
    }
    if (!map.getLayer(api.id)) map.addLayer(layer, beforeId);
    return api.names();
  };
  return api;
}
