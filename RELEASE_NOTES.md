# Nexus Doctor v0.1.0 (read-only)

**Checks**
- `nexus-network` CLI version
- Connectivity to `orchestrator.nexus.xyz` on 443/8443 (TCP + TLS)
- NTP offset via `ntpdate -q`
- Host resources & `nexus-network` process threads

**Output**
- Default summary (redacted)
- `--json` for automation
- `--verbose` for details
- `--no-redact` to disable redaction

**Privacy**
- IPs and long cmdlines are redacted by default

**Dev**
- GitHub Codespaces devcontainer (Node LTS + curl/dig/nc/openssl/jq/ntpdate)
