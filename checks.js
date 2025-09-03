// checks.js (ESM) — host/environment checks for Nexus Doctor
import { run } from './cmd.js';

const DEFAULT_NTP_SERVER = process.env.NEXUS_NTP_SERVER || 'pool.ntp.org';

/**
 * NTP check via `ntpdate -q`.
 * Returns: { available: bool, status: "ok"|"warn"|"bad"|"unknown"|"not_available", offset_s?: number|null, error?: string }
 */
export async function checkNtp({ timeoutMs = 5000, server = DEFAULT_NTP_SERVER } = {}) {
  const res = await run('ntpdate', ['-q', server], { timeoutMs });
  if (!res.ok) {
    // ntpdate not installed
    if ((res.error || '').includes('ENOENT') || res.code === 'ENOENT') {
      return { available: false, status: 'not_available' };
    }
    // command ran but failed/timeout — keep available=true but unknown offset
    const err = (res.error || '').toLowerCase();
    if (err.includes('timeout')) {
      return { available: true, status: 'unknown', offset_s: null, error: 'timeout' };
    }
    return { available: true, status: 'unknown', offset_s: null, error: res.error };
  }

  // Parse all "offset X sec" lines then average
  const matches = Array.from(res.stdout.matchAll(/offset\s+([+-]?\d+(?:\.\d+)?)\s+sec/gi));
  if (!matches.length) return { available: true, status: 'unknown', offset_s: null };

  const offsets = matches
    .map(m => parseFloat(m[1]))
    .filter(Number.isFinite);
  if (!offsets.length) return { available: true, status: 'unknown', offset_s: null };

  const avg = offsets.reduce((a, b) => a + b, 0) / offsets.length;
  const abs = Math.abs(avg);
  const status = abs < 0.5 ? 'ok' : abs < 5 ? 'warn' : 'bad';
  return { available: true, status, offset_s: Number(avg.toFixed(3)) };
}

// (Next phases will move connectivity/process/resources checks here too)
