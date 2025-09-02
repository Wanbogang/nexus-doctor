# Basis Node LTS (Devcontainer)
FROM mcr.microsoft.com/devcontainers/javascript-node:22
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      dnsutils netcat-openbsd openssl jq ntpdate && \
    rm -rf /var/lib/apt/lists/*
