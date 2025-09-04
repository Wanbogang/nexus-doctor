import { parseArgs, printHelp } from './cli.js';
import { redactString } from './utils.js';
import {
  checkCliVersion,
  checkConnectivity,
  checkNtp,
  checkProcessThreads,
} from './checks.js';

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

// Jalankan semua checks paralel; tangani error per-task
const [cli, connectivity, ntp, proc] = await Promise.allSettled([
  checkCliVersion(args),
  checkConnectivity(args),
  checkNtp(args),
  checkProcessThreads(args),
]);

const unwrap = (p) =>
  p.status === 'fulfilled'
    ? p.value
    : { ok: false, error: p.reason?.message || String(p.reason) };

const result = {
  cli: unwrap(cli),
  connectivity: unwrap(connectivity),
  ntp: unwrap(ntp),
  process: unwrap(proc),
};

if (args.json) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

// Ringkas human-friendly
const lines = [];
lines.push(`CLI     : ${result.cli?.ok ? result.cli.version : 'ERROR'}`);
lines.push(`Connect : ${result.connectivity?.ok ? result.connectivity.summary : 'ERROR'}`);
lines.push(`NTP     : ${result.ntp?.ok ? result.ntp.summary : 'N/A'}`);
lines.push(`Process : ${result.process?.ok ? result.process.summary : 'N/A'}`);

const output = lines
  .map((l) => redactString(l, { noRedact: args.noRedact }))
  .join('\n');

console.log(output);
