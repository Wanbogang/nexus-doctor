#!/usr/bin/env node
import { run } from './cmd.js';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { exec, execFile } from 'node:child_process';
import * as net from 'node:net';
import * as tls from 'node:tls';
import { parseArgs as _parseArgs, printHelp as _printHelp } from './cli.js';
import { checkNtp as _checkNtp, checkConnectivity as _checkConnectivity, checkResources as _checkResources, checkProcessThreads as _checkProcessThreads } from './checks.js';
import { fmtBytes as _fmtBytes, redactString as _redactString, redactDeep as _redactDeep } from './utils.js';

const HOST = process.env.NEXUS_ORCH_HOST || 'orchestrator.nexus.xyz';
const PORTS = (process.env.NEXUS_ORCH_PORTS || '443,8443')
  .split(',')
  .map((p) => parseInt(p.trim(), 10))
  .filter(Boolean);
const DEFAULT_TIMEOUT_MS = parseInt(process.env.NEXUS_TIMEOUT_MS || '5000', 10);
function parseArgs(argv) {
  const args = { json: false, verbose: false, redact: true, timeout: DEFAULT_TIMEOUT_MS };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = true;
    else if (a === '--verbose') args.verbose = true;
    else if (a === '--no-redact') args.redact = false;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a.startsWith('--timeout=')) args.timeout = parseInt(a.split('=')[1], 10) || DEFAULT_TIMEOUT_MS;
    else if (a.startsWith('--host=')) args.host = a.split('=')[1];
    else if (a.startsWith('--ports=')) args.ports = a.split('=')[1].split(',').map((p) => parseInt(p.trim(), 10)).filter(Boolean);
  }
  return args;
}
function printHelp() {
  console.log(`Nexus Doctor v0 (read-only)\n\n` +
    `Usage: nexus-doctor [--json] [--verbose] [--no-redact] [--timeout=ms] [--host=H] [--ports=443,8443]\n\n` +
    `Checks:\n` +
    `  • nexus-network CLI version\n` +
    `  • TLS/TCP connectivity to orchestrator (ports 443,8443)\n` +
    `  • NTP offset via ntpdate -q pool.ntp.org\n` +
    `  • CPU/memory and nexus-network threads (if running)\n\n` +
    `Privacy:\n` +
    `  • Default redacts sensitive details (IPs/cmdline). Use --verbose to show details.\n`);
function redactString(s) {
  if (!s) return s;
  s = s.replace(/\b(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}\b/g, '$1.x');                  // mask IPv4 last octet
  s = s.replace(/\b([0-9a-fA-F]{0,4}:){4}([0-9a-fA-F:]+)\b/g, (m) => m.split(':').slice(0, 4).join(':') + ':x:x'); // simple IPv6 mask
  return s.replace(/\s{2,}/g, ' ');
function redactDeep(obj) {
  if (obj == null) return obj;
  if (typeof obj === 'string') return redactString(obj);
  if (Array.isArray(obj)) return obj.map(redactDeep);
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = redactDeep(v);
    return out;
  return obj;
function sh(cmd, timeout = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    exec(cmd, { timeout }, (err, stdout, stderr) => {
      resolve({ ok: !err, code: err?.code ?? 0, stdout: stdout?.toString() ?? '', stderr: stderr?.toString() ?? '', error: err?.message || null });
    });
  });
function tryExecFile(cmd, args = [], timeout = DEFAULT_TIMEOUT_MS) {
    execFile(cmd, args, { timeout }, (err, stdout, stderr) => {
async function checkCliVersion() {
  const which = await sh('command -v nexus-network');
  if (!which.ok || !which.stdout.trim()) {
    return { found: false, message: 'nexus-network not found in PATH' };
  let out = await tryExecFile('nexus-network', ['--version']);
  if (!out.ok || !out.stdout.trim()) out = await tryExecFile('nexus-network', ['version']);
  const raw = (out.stdout || out.stderr || '').trim();
  const m = raw.match(/\d+\.\d+\.\d+[^\s]*/);
  return { found: true, version: m ? m[0] : raw || 'unknown', path: which.stdout.trim() };
function tcpCheck(host, port, useTls, timeout = DEFAULT_TIMEOUT_MS) {
    const started = Date.now();
    const result = { host, port, ok: false, ms: null, ip: null, tls: null, error: null };
    if (useTls) {
      const sock = tls.connect({ host, port, servername: host, rejectUnauthorized: true, timeout }, () => {
        result.ok = true;
        result.ms = Date.now() - started;
        result.ip = sock.remoteAddress;
        const cert = sock.getPeerCertificate();
        result.tls = {
          authorized: sock.authorized,
          authorizationError: sock.authorizationError || null,
          protocol: sock.getProtocol(),
          cipher: sock.getCipher()?.name || null,
          subjectCN: cert && cert.subject ? cert.subject.CN : null,
          issuerCN: cert && cert.issuer ? cert.issuer.CN : null,
          valid_to: cert?.valid_to || null
        };
        sock.end();
        resolve(result);
      });
      sock.on('error', (e) => {
        result.error = e.message;
      sock.on('timeout', () => {
        result.error = 'timeout';
        sock.destroy();
    } else {
      const sock = new net.Socket();
      sock.setTimeout(timeout);
      sock.connect(port, host, () => {
    }
async function checkConnectivity(host, ports, timeout) {
  const results = [];
  for (const p of ports) {
    const useTls = (p === 443 || p === 8443);
    const r = await tcpCheck(host, p, useTls, timeout);
    results.push(r);
  return results;
async function checkNtp(timeout) {
  const out = await tryExecFile('ntpdate', ['-q', 'pool.ntp.org'], timeout);
  if (!out.ok) return { available: false, error: out.error || out.stderr || 'ntpdate not available' };
  const lines = out.stdout.split(/\n/).filter(Boolean);
  let offsets = [];
  for (const ln of lines) {
    const m = ln.match(/offset\s+(-?\d+\.\d+)/);
    if (m) offsets.push(parseFloat(m[1]));
  if (offsets.length === 0) return { available: true, offset_s: null, status: 'unknown' };
  const avg = offsets.reduce((a, b) => a + b, 0) / offsets.length;
  const abs = Math.abs(avg);
  let status = 'ok';
  if (abs > 2) status = 'bad';
  else if (abs > 0.5) status = 'warn';
  return { available: true, offset_s: Number(avg.toFixed(3)), status };
function readProcStatus(pid) {
  try {
    const txt = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
    const tm = txt.match(/^Threads:\s*(\d+)/m);
    const name = txt.match(/^Name:\s*(.+)/m);
    return { threads: tm ? parseInt(tm[1], 10) : null, name: name ? name[1].trim() : null };
  } catch { return null; }
async function checkProcessThreads(verbose) {
  const procs = await sh('pgrep -fa nexus-network');
  if (!procs.ok || !procs.stdout.trim()) return { running: false };
  const lines = procs.stdout.trim().split('\n');
  const items = [];
    const m = ln.match(/^(\d+)\s+(.*)$/);
    if (!m) continue;
    const pid = parseInt(m[1], 10);
    const status = readProcStatus(pid) || {};
    items.push({ pid, threads: status.threads, cmd: ln.slice(m[1].length + 1) });
  const totalThreads = items.reduce((a, b) => a + (b.threads || 0), 0);
  return { running: true, count: items.length, totalThreads, items: verbose ? items : undefined };
function fmtBytes(n) {
  const g = 1024 ** 3, m = 1024 ** 2;
  if (n >= g) return (n / g).toFixed(1) + ' GiB';
  return (n / m).toFixed(0) + ' MiB';
function summarizeText(res, redact, verbose) {
  const parts = [];
  parts.push('Nexus Doctor v0 — summary');
  if (!res.cli.found) parts.push('• CLI: nexus-network ❌ (not found)');
  else parts.push(`• CLI: nexus-network ✅ v${res.cli.version}`);
  for (const c of res.connectivity) {
    const p = c.port;
    if (c.ok) {
      const tlsInfo = c.tls ? (c.tls.authorized ? 'TLS ok' : 'TLS unverified') : 'TCP ok';
      const extra = verbose && c.tls ? ` (CN=${c.tls.subjectCN || '-'}; issuer=${c.tls.issuerCN || '-'})` : '';
      let ip = c.ip || '';
      if (redact) ip = redactString(ip);
      parts.push(`• ${c.host}:${p} ✅ ${tlsInfo} ${c.ms}ms${extra}${ip ? ` [${ip}]` : ''}`);
      parts.push(`• ${c.host}:${p} ❌ ${c.error || 'connect failed'} (${c.ms}ms)`);
  if (!res.ntp.available) parts.push('• NTP: ntpdate not available');
  else if (res.ntp.offset_s == null) parts.push('• NTP: offset unknown');
  else parts.push(`• NTP offset: ${res.ntp.offset_s}s (${res.ntp.status})`);
  parts.push(`• CPU: ${res.resources.cpu.cores} cores; Load1: ${res.resources.cpu.load1}`);
  parts.push(`• Memory: ${fmtBytes(res.resources.mem.free)} free / ${fmtBytes(res.resources.mem.total)} total`);
  if (!res.process.running) parts.push('• nexus-network process: tidak berjalan');
  else {
    const basic = `• nexus-network process: ${res.process.count} proc; total threads: ${res.process.totalThreads}`;
    if (verbose && res.process.items) {
      for (const it of res.process.items) {
        const cmd = redact ? redactString(it.cmd) : it.cmd;
        parts.push(`${basic}`);
        parts.push(`  - pid=${it.pid} threads=${it.threads ?? '-'} cmd=${cmd}`);
      }
    } else parts.push(basic);
  return parts.join('\n');
async function main() {
  const args = parseArgs(process.argv);
  if (args.help) return printHelp();
  const host = args.host || HOST;
  const ports = args.ports || PORTS;
  const timeout = args.timeout || DEFAULT_TIMEOUT_MS;
  const [cli, connectivity, ntp, proc] = await Promise.all([
    checkCliVersion(),
    _checkConnectivity(host, ports, timeout),
    _checkNtp(timeout),
    _checkProcessThreads(!!args.verbose)
  ]);
  const resources = {
    cpu: { cores: os.cpus().length, load1: os.loadavg()[0].toFixed(2) },
    mem: { total: os.totalmem(), free: os.freemem() }
  };
  let result = { host, ports, cli, connectivity, ntp, resources, process: proc, ts: new Date().toISOString() };
  if (args.json) {
    const out = args.redact ? redactDeep(result) : result;
    console.log(JSON.stringify((args && args.redact !== false) ? _redactDeep(out) : out, null, 2));
  } else {
    const txt = summarizeText(result, args.redact, args.verbose);
    console.log(args.redact ? redactString(txt) : txt);
main().catch((e) => {
  console.error('Unexpected error:', e?.message || e);
  process.exitCode = 1;
});
/** --- Clean help text override (ESM-friendly) --- */
printHelp = function () {
  console.log(`Nexus Doctor v0 (read-only)
Usage:
  nexus-doctor [--json] [--verbose] [--no-redact] [--timeout=ms] [--host=H] [--ports=443,8443]
Checks:
  • nexus-network CLI version
  • TLS/TCP connectivity to orchestrator (ports 443,8443)
  • NTP offset via "ntpdate -q pool.ntp.org"
  • CPU/memory and nexus-network threads (if running)
Privacy:
  • Sensitive details (IPs/cmdline) are redacted by default. Use --verbose to show details.`);
};
// --- module overrides (phase-1 modularization) ---
try {
  // re-bind to modular versions if local ones exist
  // eslint-disable-next-line no-global-assign
  printHelp = _printHelp;
  parseArgs = _parseArgs;
} catch {}
// --- module overrides (phase-2 modularization) ---
  _checkNtp = _checkNtp;
// --- module overrides (phase-3 modularization) ---
  _checkConnectivity = _checkConnectivity;
  _checkResources = _checkResources;
  _checkProcessThreads = _checkProcessThreads;
  // utils wiring (only if main file uses these identifiers)
  fmtBytes = _fmtBytes;
  redactString = _redactString;
  redactDeep = _redactDeep;
// --- module overrides (re-wire to modular implementations) ---
/* --- rewire to modular implementations (idempotent) --- */
