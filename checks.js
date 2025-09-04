// checks.js (ESM) — versi simpel
import { runCmd } from './utils.js';
import net from 'node:net';

const DEFAULT_NTP_SERVER = process.env.NEXUS_NTP_SERVER || 'pool.ntp.org';

// Cek versi CLI Nexus
export async function checkCliVersion({ timeout = 7000 } = {}) {
  const candidates = [
    ['nexus-network', ['--version']],
    ['nexus', ['--version']],
    ['nexus-cli', ['--version']],
    ['npx', ['-y', 'nexus-cli', '--version']],  // fallback via npx
  ];

  for (const [cmd, args] of candidates) {
    const r = await runCmd(cmd, args, { timeout });
    if (r.ok && (r.stdout?.trim() || r.stderr?.trim())) {
      const out = (r.stdout || r.stderr).trim();
      return { ok: true, version: out };
    }
    if (r.error?.code === 'ENOENT') continue; // kalau command tidak ada, coba yang lain
  }

  return { ok: false, error: 'No known Nexus CLI found (tried nexus-network, nexus, nexus-cli, npx nexus-cli)' };
}


/**
 * Cek konektivitas ke host/port (TCP connect)
 */
export async function checkConnectivity({ host = 'orchestrator.nexus.xyz', ports = [443, 8443], timeout = 5000 } = {}) {
  const results = await Promise.all(
    ports.map((port) => new Promise((resolve) => {
      const socket = net.connect({ host, port, timeout }, () => {
        socket.destroy();
        resolve({ host, port, ok: true, error: null });
      });
      socket.on('error', (err) => {
        resolve({ host, port, ok: false, error: err.message });
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ host, port, ok: false, error: 'timeout' });
      });
    }))
  );
  return results;
}

/**
 * Cek offset NTP dengan `ntpdate -q`
 */
export async function checkNtp({ timeout = 5000, server = DEFAULT_NTP_SERVER } = {}) {
  const res = await runCmd('ntpdate', ['-q', server], { timeout });
  if (!res.ok) {
    return { available: false, status: 'not_available', offset_s: null, error: res.error };
  }

  const match = res.stdout.match(/offset ([+-]?\d+\.\d+) sec/);
  if (match) {
    const offset = parseFloat(match[1]);
    return { available: true, status: 'ok', offset_s: offset };
  }

  return { available: true, status: 'unknown', offset_s: null };
}

/**
 * Cek proses nexus-network sedang jalan/tidak (stub sederhana)
 */
export async function checkProcessThreads() {
  const res = await runCmd('pgrep', ['-fl', 'nexus-network']);
  if (res.ok && res.stdout) {
    const lines = res.stdout.trim().split('\n').filter(Boolean);
    return { running: true, count: lines.length, summary: `${lines.length} process(es)` };
  }
  return { running: false, count: 0, summary: 'not running' };
}

