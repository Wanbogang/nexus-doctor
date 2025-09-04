import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const pexec = promisify(execFile);

/**
 * Jalankan perintah shell dengan execFile (aman; tanpa shell interpolasi).
 * Selalu mengembalikan objek normalisasi { ok, code, stdout, stderr, error }
 */
export async function runCmd(cmd, args = [], opts = {}) {
  const options = {
    timeout: 7000,
    maxBuffer: 1024 * 1024, // 1MB
    ...opts,
  };
  try {
    const { stdout, stderr } = await pexec(cmd, args, options);
    return { ok: true, code: 0, stdout, stderr };
  } catch (e) {
    return {
      ok: false,
      code: typeof e.code === 'number' ? e.code : -1,
      stdout: e.stdout || '',
      stderr: e.stderr || (e.message ?? String(e)),
      error: e,
    };
  }
}

/**
 * Sederhana: redact IP & arg sensitif; hormati flag noRedact
 */
export function redactString(s, { noRedact } = {}) {
  if (noRedact) return s;
  return String(s)
    // IPv4
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[REDACTED_IP]')
    // token/secret/key di cmdline: --token=xxxx, --secret xxxx, dll
    .replace(/(--(?:secret|token|key)(?:=|\s+))(\S+)/gi, (_, p1) => `${p1}[REDACTED]`);
}

/**
 * Format bytes jadi string human-friendly.
 */
export function fmtBytes(n) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let x = Number(n) || 0;
  let i = 0;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i++;
  }
  return `${x.toFixed(1)} ${units[i]}`;
}
