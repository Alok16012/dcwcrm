#!/bin/bash
# Build the Windows install zip for the office PC.
# It includes agent/.env (device password + webhook secret), so the zip is
# private: send it straight to the office PC, never post or commit it.
#
# Usage: bash agent/windows/build-package.sh [output.zip]
set -euo pipefail
WIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(dirname "$WIN_DIR")"
OUT="${1:-$HOME/Desktop/DCW-Biometric-Windows.zip}"
[[ -f "$AGENT_DIR/.env" ]] || { echo "Missing $AGENT_DIR/.env" >&2; exit 1; }

STAGE="$(mktemp -d)/DCW-Biometric"
mkdir -p "$STAGE"
cp "$AGENT_DIR"/{dahua-bridge.mjs,device.mjs,check-device.mjs,set-ntp.mjs,.env} "$STAGE/"
# Windows tools want CRLF.
for f in INSTALL.bat STATUS.bat UNINSTALL.bat install.ps1; do
  sed 's/\r$//; s/$/\r/' "$WIN_DIR/$f" > "$STAGE/$f"
done
rm -f "$OUT"
(cd "$(dirname "$STAGE")" && zip -qr "$OUT" DCW-Biometric)
echo "Built $OUT"
