# Nexus Doctor v0 (read-only)

Quick, read-only health checks for a Nexus environment. It does not write files, change configs, or start/stop services.

## What it checks
- `nexus-network` CLI version
- Connectivity to `orchestrator.nexus.xyz` on 443 and 8443 (TCP + TLS handshake)
- Time sync via `ntpdate -q pool.ntp.org` (average offset)
- Host resources and `nexus-network` process threads (if running)

## Output
- Default: short, human-readable summary (sensitive details redacted)
- `--json`: structured JSON output (good for automation)
- `--verbose`: include detailed TLS and process command lines
- `--no-redact`: print full IPs and command lines

## Privacy
By default, IP addresses and long process arguments are redacted. Use `--verbose` for more details, and `--no-redact` to disable redaction.

## Requirements
- GitHub Codespaces with Node LTS devcontainer.
- The devcontainer installs: dnsutils, netcat-openbsd, openssl, jq, ntpdate.

## Usage
Summary (default, redacted):
  node ./nexus-doctor.mjs

JSON output:
  node ./nexus-doctor.mjs --json

Verbose details (TLS, process cmdlines):
  node ./nexus-doctor.mjs --verbose

Disable redaction (show full IP/cmdlines):
  node ./nexus-doctor.mjs --no-redact

Custom host/ports/timeout:
  node ./nexus-doctor.mjs --host=orchestrator.nexus.xyz --ports=443,8443 --timeout=7000

## Exit codes
v0 always exits with code 0; rely on `--json` to evaluate check status in automation.

## Limitations
- NTP check relies on ntpdate. If unavailable, it reports as not available.
- Thread counting uses /proc/<pid>/status (Linux only).

---

## Connectivity note
In some networks (e.g., cloud VPS or Codespaces), `orchestrator.nexus.xyz` on ports **443/8443** may time out due to server-side IP filtering.
If both ports time out while other 443 endpoints work, request allowlisting of your public IP or try from an allowed network.

---

<p align="left">
  <a href="https://github.com/Wanbogang/nexus-doctor/releases">
    <img alt="release" src="https://img.shields.io/github/v/release/Wanbogang/nexus-doctor?label=release">
  </a>
  <a href="https://github.com/Wanbogang/nexus-doctor/blob/main/LICENSE">
    <img alt="license" src="https://img.shields.io/badge/license-MIT-green">
  </a>
  <img alt="node" src="https://img.shields.io/badge/Node.js-LTS-blue">
  <img alt="mode" src="https://img.shields.io/badge/mode-read--only-informational">
</p>


### Quick example (summary)
```bash
node ./nexus-doctor.mjs
```

### JSON for automation
```bash
node ./nexus-doctor.mjs --json | jq '. | {cli, connectivity, ntp, resources, process}'
```

## Exit codes (wrapper)
The helper wrapper `nd-exit.sh` returns:
- `0`  — OK
- `10` — CONNECTIVITY_TIMEOUT (likely allowlist needed or endpoint down)
- `20` — NTP_WARN
- `21` — NTP_BAD

### Print exit code meaning
```bash
./nd-exit.sh --timeout=7000 > /tmp/nd.json; ec=$?
jq '. | {cli,connectivity,ntp}' /tmp/nd.json
case "$ec" in
  0)  echo "status=OK" ;;
  10) echo "status=CONNECTIVITY_TIMEOUT (likely allowlist needed or endpoint down)" ;;
  20) echo "status=NTP_WARN" ;;
  21) echo "status=NTP_BAD" ;;
  *)  echo "status=UNKNOWN($ec)" ;;
esac

