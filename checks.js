// checks.js (ESM) — host/environment checks for Nexus Doctor
import { run } from './cmd.js';
import * as net from 'node:net';
import * as dns from 'node:dns/promises';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { fmtBytes } from './utils.js';

const DEFAULT_NTP_SERVER = process.env.NEXUS_NTP_SERVER || 'pool.ntp.org';

/**
 * NTP check via `ntpdate -q`.
 * Returns: { available: bool, status: "ok"|"warn"|"bad"|"unknown"|"not_available", offset_s?: number|null, error?: string }
 */
export async function checkNtp({ timeoutMs = 5000, server = DEFAULT_NTP_SERVER } = {}) {
  const res = await run('ntpdate', ['-q', server], { timeoutMs });
  if (!res.ok) {
    if ((res.error || '').includes('ENOENT') || res.code === 'ENOENT') {
      return { available: false, status: 'not_available' };
    }
    const err = (res.error || '').toLowerCase();
    if (err.includes('timeout')) {
      return { available: true, status: 'unknown', offset_s: null, error: 'timeout' };
    }
    return { available: true, status: 'unknown', offset_s: null, error: res.error };
  }

  const matches = Array.from(res.stdout.matchAll(/offset\s+([+-]?\d+(?:\.\d+)?)\s+sec/gi));
  if (!matches.length) return { available: true, status: 'unknown', offset_s: null };

  const offsets = matches.map(m => parseFloat(m[1])).filter(Number.isFinite);
  if (!offsets.length) return { available: true, status: 'unknown', offset_s: null };

  const avg = offsets.reduce((a, b) => a + b, 0) / offsets.length;
  const abs = Math.abs(avg);
  const status = abs < 0.5 ? 'ok' : abs < 5 ? 'warn' : 'bad';
  return { available: true, status, offset_s: Number(avg.toFixed(3)) };
}

/** Fallback raw TCP connect */
function tcpConnect(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = net.connect({ host, port });
    let done = false;
    const finish = (ok, error) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch {}
      const ms = Date.now() - start;
      resolve({ ok, ms, error: error || null });
    };
    const timer = setTimeout(() => finish(false, 'timeout'), timeoutMs);

    socket.once('connect', () => { clearTimeout(timer); finish(true, null); });
    socket.once('error', (e) => { clearTimeout(timer); finish(false, e?.code || e?.message || 'error'); });
  });
}

/** Parse minimal TLS info from `openssl s_client -brief` */
function parseOpenSslBrief(stdout) {
  const proto = /Protocol\s*:\s*([^\r\n]+)/i.exec(stdout)?.[1]?.trim() || null;
  const cipher = /Cipher\s*:\s*([^\r\n]+)/i.exec(stdout)?.[1]?.trim() || null;
  return (proto || cipher) ? { protocol: proto, cipher } : null;
}

/**
 * Connectivity check: TLS via openssl (when present), fallback to raw TCP.
 * Adds DNS A/AAAA (ip4/ip6) info; keeps `ip` for backward-compat.
 */
export async function checkConnectivity({ host, ports = [443, 8443], timeoutMs = 5000 } = {}) {
  let ip = null;
  let ip4 = [], ip6 = [];
  try {
    const v4 = await dns.resolve4(host);
    if (Array.isArray(v4)) ip4 = v4;
  } catch {}
  try {
    const v6 = await dns.resolve6(host);
    if (Array.isArray(v6)) ip6 = v6;
  } catch {}
  try { ip = (await dns.lookup(host)).address; } catch {}

  const out = [];
  for (const port of ports) {
    const start = Date.now();
    let ok = false, tls = null, error = null, ms;

    const tlsRes = await run('openssl', ['s_client', '-connect', `${host}:${port}`, '-servername', host, '-brief'], { timeoutMs });
    if (tlsRes.ok) {
      ok = true;
      tls = parseOpenSslBrief(tlsRes.stdout || '');
      ms = Date.now() - start;
    } else if ((tlsRes.error || '').includes('ENOENT') || tlsRes.code === 'ENOENT') {
      const tcp = await tcpConnect(host, port, timeoutMs);
      ok = tcp.ok; error = tcp.error; ms = tcp.ms;
    } else {
      const err = (tlsRes.error || '').toLowerCase();
      error = err.includes('timeout') ? 'timeout' : (tlsRes.error || 'error');
      ms = Date.now() - start;
    }

    out.push({ host, port, ok, ms, ip, ip4, ip6, tls, error });
  }
  return out;
}

/** Resources: CPU/mem snapshot + human-readable bytes */
export function checkResources() {
  const cores = os.cpus()?.length || 0;
  const load1 = (os.loadavg?.()[0] ?? 0).toFixed(2);
  const total = os.totalmem?.() ?? 0;
  const free = os.freemem?.() ?? 0;
  return {
    cpu: { cores, load1 },
    mem: {
      total,
      free,
      total_h: fmtBytes(total),
      free_h: fmtBytes(free)
    }
  };
}

/** Process: count `nexus-network` instances and sum their Threads from /proc */
export function checkProcessThreads({ name = 'nexus-network' } = {}) {
  let count = 0, totalThreads = 0;
  try {
    const entries = fs.readdirSync('/proc', { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      if (!/^\d+$/.test(ent.name)) continue;
      const pid = ent.name;

      let comm = '';
      try { comm = fs.readFileSync(`/proc/${pid}/comm`, 'utf8').trim(); } catch {}
      let cmdline = '';
      try { cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ').trim(); } catch {}

      if (comm.includes(name) || cmdline.includes(name)) {
        count++;
        try {
          const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
          const m = /Threads:\s+(\d+)/.exec(status);
          if (m) totalThreads += parseInt(m[1], 10);
        } catch {}
      }
    }
  } catch {}
  return { running: count > 0, count, totalThreads };
}
// === Tambahan alias/ekspor supaya konsisten dengan nexus-doctor.mjs ===

// Cek versi nexus CLI
export async function checkCliVersion({ timeout = 5000 } = {}) {
  const res = await run('nexus-network', ['--version'], { timeout });
  if (res.ok && res.stdout) {
    return { ok: true, version: res.stdout.trim() };
  }
  return { ok: false, error: res.error || 'nexus-network not found' };
}

// Placeholder: cek konektivitas TLS/port (nanti bisa diisi runCmd ke net/tls)
export async function checkConnectivity({ host = 'orchestrator.nexus.xyz', ports = [443,8443], timeout = 5000 } = {}) {
  return { ok: false, summary: 'connectivity check not implemented yet', host, ports, timeout };
}

// Placeholder: cek proses nexus-network jalan/tidak
export async function checkProcessThreads() {
  return { ok: false, summary: 'process check not implemented yet' };
}
