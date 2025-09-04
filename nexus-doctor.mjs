import { parseArgs, printHelp } from './cli.js';
import { redactString } from './utils.js';
import * as checks from './checks.js';

// pilih fungsi yang tersedia; jika tidak ada, sediakan stub
const pick = (...cands) => {
  for (const f of cands) if (typeof f === 'function') return f;
  return async () => ({ ok: false, error: 'check not implemented/exported' });
};

const checkCliVersion = pick(
  checks.checkCliVersion, checks.cliVersion, checks.cli, checks.default?.checkCliVersion
);
const checkConnectivity = pick(
  checks.checkConnectivity, checks.connectivity, checks.testConnectivity, checks.default?.checkConnectivity
);
const checkNtp = pick(
  checks.checkNtp, checks.ntp, checks.ntpCheck, checks.default?.checkNtp
);
const checkProcessThreads = pick(
  checks.checkProcessThreads, checks.processThreads, checks.procThreads, checks.default?.checkProcessThreads
);

const args = parseArgs(process.argv.slice(2));
if (args.help) { printHelp(); process.exit(0); }

const settled = await Promise.allSettled([
  checkCliVersion(args),
  checkConnectivity(args),
  checkNtp(args),
  checkProcessThreads(args),
]);
const unwrap = (p) => (p.status === 'fulfilled' ? p.value : { ok: false, error: String(p.reason) });

const result = {
  cli: unwrap(settled[0]),
  connectivity: unwrap(settled[1]),
  ntp: unwrap(settled[2]),
  process: unwrap(settled[3]),
};

if (args.json) { console.log(JSON.stringify(result, null, 2)); process.exit(0); }

const lines = [
  `CLI     : ${result.cli?.ok ? result.cli.version : 'ERROR'}`,
  `Connect : ${result.connectivity?.ok ? result.connectivity.summary : 'ERROR'}`,
  `NTP     : ${result.ntp?.ok ? result.ntp.summary : 'N/A'}`,
  `Process : ${result.process?.ok ? result.process.summary : 'N/A'}`,
];
console.log(lines.map(l => redactString(l, { noRedact: args.noRedact })).join('\n'));

