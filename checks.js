// checks.js — minimal, consistent, English-only
import { runCmd } from './utils.js';
import net from 'node:net';

const DEFAULT_NTP_SERVER = process.env.NEXUS_NTP_SERVER || 'pool.ntp.org';

/** Detect Nexus CLI version (multiple candidates, including npx). */
export async function checkCliVersion({ timeout = 7000 } = {}) {
  const candidates = [
    ['nexus-network', ['--version']],
    ['nexus', ['--version']],
    ['nexus-cli', ['--version']],
    ['npx', ['-y', 'nexus-cli', '--version']],
  ];
  for (const [cmd, args] of candidates) {
    const r = await runCmd(cmd, args, { timeout });
    const out = (r.stdout || r.stderr || '').trim();
    if (r.ok && out) return { ok: true, version: out };
    if (r.error?.code === 'ENOENT') continue;
  }
  return { ok: false, error: 'No known Nexus CLI found (tried nexus-network, nexus, nexus-cli, npx nexus-cli).' };
}

/** Connectivity check via raw TCP connect (per-port). */
export async function checkConnectivity({ host = 'orchestrator.nexus.xyz', ports = [443, 8443], timeout = 5000 } = {}) {
  return Promise.all(
    ports.map((port) => new Promise((resolve) => {
      const socket = net.connect({ host, port, timeout }, () => {
        socket.destroy();
        resolve({ host, port, ok: true, error: null });
      });
      socket.on('error', (err) => resolve({ host, port, ok: false, error: err?.message || 'error' }));
      socket.on('timeout', () => { socket.destroy(); resolve({ host, port, ok: false, error: 'timeout' }); });
    }))
  );
}

/** NTP offset via `ntpdate -q`. */
export async function checkNtp({ timeout = 5000, server = DEFAULT_NTP_SERVER } = {}) {
  const r = await runCmd('ntpdate', ['-q', server], { timeout });
  if (!r.ok) return { available: false, status: 'not_available', offset_s: null, error: r.error?.message || String(r.error || '') };

  // Typical line: "server X, stratum Y, offset -0.001234 sec, ..."
  const m = (r.stdout || '').match(/offset\s+([+-]?\d+(?:\.\d+)?)\s+sec/i);
  if (!m) return { available: true, status: 'unknown', offset_s: null };
  const offset = Number(m[1]);
  const abs = Math.abs(offset);
  const status = abs < 0.5 ? 'ok' : abs < 5 ? 'warn' : 'bad';
  return { available: true, status, offset_s: Number(offset.toFixed(3)) };
}

/** Process presence check (lightweight). */
export async function checkProcessThreads() {
  const r = await runCmd('pgrep', ['-fl', 'nexus-network']);
  if (r.ok && r.stdout?.trim()) {
    const lines = r.stdout.trim().split('\n').filter(Boolean);
    return { running: true, count: lines.length, totalThreads: 0, summary: `${lines.length} process(es)` };
  }
  return { running: false, count: 0, totalThreads: 0, summary: 'not running' };
}

