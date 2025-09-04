/**
 * Parsers opsi CLI sederhana, dengan default yang aman.
 */
export function parseArgs(argv) {
  const out = {
    json: false,
    verbose: false,
    noRedact: false,
    host: 'orchestrator.nexus.xyz',
    ports: [443, 8443],
    timeout: 7000,
    help: false,
  };

  for (const a of argv) {
    if (a === '--json') out.json = true;
    else if (a === '--verbose') out.verbose = true;
    else if (a === '--no-redact') out.noRedact = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a.startsWith('--host=')) out.host = a.slice(7).trim();
    else if (a.startsWith('--timeout=')) {
      const t = Number(a.slice(10));
      out.timeout = Number.isFinite(t) ? Math.max(1000, t) : 7000;
    } else if (a.startsWith('--ports=')) {
      const parts = a
        .slice(8)
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0 && n < 65536);
      if (parts.length) out.ports = parts;
    }
  }
  return out;
}

export function printHelp() {
  console.log(
`Nexus Doctor v0 (read-only)

Usage: node ./nexus-doctor.mjs [--json] [--verbose] [--no-redact] [--timeout=ms] [--host=H] [--ports=443,8443]

Checks:
  • nexus-network CLI version
  • TLS/TCP connectivity to orchestrator (ports 443,8443)
  • NTP offset via ntpdate -q pool.ntp.org
  • CPU/memory and nexus-network threads (if running)

Privacy:
  • Default redacts sensitive details (IPs/cmdline). Use --verbose to show details.
`
  );
}
