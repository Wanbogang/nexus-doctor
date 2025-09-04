// cli.js (ESM) — CLI helpers for Nexus Doctor
export function parseArgs(argv, defaults = { json:false, verbose:false, redact:true, timeout:5000, host:'orchestrator.nexus.xyz', ports:[443,8443] }) {
  const args = { ...defaults };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = true;
    else if (a === '--verbose') args.verbose = true;
    else if (a === '--no-redact') args.redact = false;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a.startsWith('--timeout=')) args.timeout = parseInt(a.split('=')[1], 10) || defaults.timeout;
    else if (a.startsWith('--host=')) args.host = a.split('=')[1];
    else if (a.startsWith('--ports=')) {
      args.ports = a.split('=')[1]
        .split(',')
        .map(p => parseInt(p.trim(), 10))
        .filter(Boolean);
    }
  }
  return args;
}

export function printHelp() {
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
}
