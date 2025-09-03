// cmd.js (ESM) - small helper for running shell commands consistently
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);

/**
 * Run a command with arguments and timeout.
 * @param {string} cmd
 * @param {string[]} args
 * @param {{timeoutMs?: number, trim?: boolean}} opts
 * @returns {Promise<{ok: boolean, stdout?: string, stderr?: string, error?: string, code?: number|null}>}
 */
export async function run(cmd, args = [], { timeoutMs = 5000, trim = true } = {}) {
  const p = execFileAsync(cmd, args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  const t = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs));
  try {
    const { stdout, stderr } = await Promise.race([p, t]);
    return { ok: true, stdout: trim ? stdout.trim() : stdout, stderr };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || String(err),
      code: err?.code ?? null,
      stdout: err?.stdout ?? '',
      stderr: err?.stderr ?? ''
    };
  }
}
