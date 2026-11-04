// localStorage wrapper. Everything stays on this device; failures (private
// mode, blocked storage) degrade to in-memory defaults.
const P = 'njtf.';
export const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(P + k);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(P + k, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  },
  del(k) {
    try {
      localStorage.removeItem(P + k);
    } catch {
      /* ignore */
    }
  },
};
