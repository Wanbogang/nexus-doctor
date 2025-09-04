#!/usr/bin/env node
import { parseArgs, printHelp } from './cli.js';
import { checkNtp, checkConnectivity, checkResources, checkProcessThreads } from './checks.js';
import { redactDeep, redactString } from './utils.js';
import { run } from './cmd.js';

const HOST = process.env.NEXUS_ORCH_HOST || 'orchestrator.nexus.xyz';
const PORTS = (process.env.NEXUS_ORCH_PORTS || '443,8443')
  .split(',')
  .map(p => parseInt(p.trim(), 10))
  .filter(Boolean);
const DEFAULT_TIMEOUT_MS = parseInt(process.env.NEXUS_TIMEOUT_MS || '5000', 10);

// Lightweight CLI check (read-only)
async function checkCliVersion({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const which = await run('bash', ['-lc', 'command -v nexus-network'], { timeoutMs });
  const found = which.ok && which.stdout;
  if (!found) return { found: false, message: 'nexus-network not found in PATH' };

  let version = null;
  let ver = await run('nexus-network', ['--version'], { timeoutMs });
  if (!ver.ok) ver = await run('nexus-network', ['version'], { timeoutMs });
  if (ver.ok) {
    const m = ver.stdout.match(/(\d+\.\d+\.\d+)/);
    version = m ? m[1] : ver.stdout.trim();
  }

  return { found: true, version, path: which.stdout.trim() };
}

function printSummary(res, args) {
  const { cli, connectivity, ntp, resources, process } = res;
  const lines = [];
  lines.push('Nexus Doctor v0 — summary');

  lines.push(`• CLI: nexus-network ${cli.found ? `✅ ${cli.version || 'found'}` : '❌ (not found)'}`);

  for (const c of connectivity) {
    const base = `• ${c.host}:${c.port}`;
    if (c.ok) {
      const tls = c.tls
        ? `TLS ${c.tls.protocol || ''}${c.tls.cipher ? ` ${c.tls.cipher}` : ''}`.trim()
        : 'connected';
      lines.push(`${base} ✅ ${tls} (${c.ms}ms)`);
    } else {
      lines.push(`${base} ❌ ${c.error || 'error'} (${c.ms}ms)`);
    }
  }

  if (!ntp.available) {
    lines.push('• NTP: ntpdate not available');
  } else {
    const off = (ntp.offset_s === null || ntp.offset_s === undefined) ? '0s' : `${ntp.offset_s}s`;
    lines.push(`• NTP offset: ${off} (${ntp.status})`);
  }

  const mem = resources.mem || {};
  const freeH = mem.free_h || (Number.isFinite(mem.free) ? `${(mem.free/1024/1024/1024).toFixed(1)} GiB` : 'N/A');
  const totalH = mem.total_h || (Number.isFinite(mem.total) ? `${(mem.total/1024/1024/1024).toFixed(1)} GiB` : 'N/A');

  lines.push(`• CPU: ${resources.cpu?.cores ?? 0} cores; Load1: ${resources.cpu?.load1 ?? '0.00'}`);
  lines.push(`• Memory: ${freeH} free / ${totalH} total`);
  lines.push(`• nexus-network process: ${process.count} proc; total threads: ${process.totalThreads}`);

  const out = lines.join('\n');
  console.log(args.redact ? redactString(out, true) : out);
}

async function main() {
  const args = parseArgs(process.argv, {
    json: false,
    verbose: false,
    redact: true,
    timeout: DEFAULT_TIMEOUT_MS,
    host: HOST,
    ports: PORTS
  });

  if (args.help) { printHelp(); return; }

  const [cli, connectivity, ntp, resources, proc] = await Promise.all([
    checkCliVersion({ timeoutMs: args.timeout }),
    checkConnectivity({ host: args.host || HOST, ports: args.ports || PORTS, timeoutMs: args.timeout }),
    checkNtp({ timeoutMs: args.timeout }),
    checkResources(),
    checkProcessThreads()
  ]);

  const result = { cli, connectivity, ntp, resources, process: proc };

  if (args.json) {
    const payload = (args.redact !== false) ? redactDeep(result) : result;
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printSummary(result, args);
  }

  // v0: always exit 0; wrapper script handles non-zero mapping
  process.exitCode = 0;
}

main().catch(e => {
  console.error('Unexpected error:', e?.message || e);
  process.exitCode = 1;
});
