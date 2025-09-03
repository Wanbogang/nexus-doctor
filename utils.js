// utils.js (ESM) — formatting & redaction helpers

export function fmtBytes(n = 0) {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const k = 1024, units = ['B','KiB','MiB','GiB','TiB'];
  let i = Math.min(units.length - 1, Math.max(0, Math.floor(Math.log(n) / Math.log(k))));
  const val = n / Math.pow(k, i);
  return `${val >= 10 ? val.toFixed(1) : val.toFixed(2)} ${units[i]}`;
}

export function redactString(s, enabled = true) {
  if (!enabled || typeof s !== 'string') return s;
  let out = s.replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[ip]');
  if (out.length > 120) out = out.slice(0, 40) + '…[redacted]…' + out.slice(-20);
  return out;
}

export function redactDeep(v, enabled = true) {
  if (!enabled) return v;
  if (typeof v === 'string') return redactString(v, true);
  if (Array.isArray(v)) return v.map(x => redactDeep(x, true));
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = redactDeep(v[k], true);
    return o;
  }
  return v;
}
