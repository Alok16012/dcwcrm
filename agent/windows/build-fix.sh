#!/bin/bash
# Build the one-click repair zip for an office PC that already has the agent.
# No .env inside (no passwords), so it is safe to send on WhatsApp or email.
#
# Usage: bash agent/windows/build-fix.sh [output.zip]
set -euo pipefail
WIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(dirname "$WIN_DIR")"
OUT="${1:-$HOME/Desktop/DCW-Attendance-Fix.zip}"

STAGE="$(mktemp -d)/DCW-Attendance-Fix"
mkdir -p "$STAGE"
cp "$AGENT_DIR"/{dahua-bridge.mjs,device.mjs,check-device.mjs,set-ntp.mjs} "$STAGE/"
for f in FIX-ATTENDANCE.bat fix.ps1; do
  sed 's/\r$//; s/$/\r/' "$WIN_DIR/$f" > "$STAGE/$f"
done
rm -f "$OUT"
(cd "$(dirname "$STAGE")" && zip -qr "$OUT" DCW-Attendance-Fix)
echo "Built $OUT"
