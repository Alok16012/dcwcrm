#!/bin/bash
# Install the Dahua bridge as a macOS LaunchAgent.
#
# A LaunchAgent (not a LaunchDaemon) on purpose: it installs without sudo and
# starts when this user logs in, which is what a reception/office Mac actually
# does. It restarts on crash, and survives reboots.
#
# The Mac sleeping still pauses it — nothing is lost, because the controller
# keeps its own log and the agent's catch-up poll replays the window on wake.
#
# Usage:  bash agent/install-service.sh
#         bash agent/install-service.sh --uninstall

set -euo pipefail

LABEL="com.dcw.biometric-bridge"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
AGENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$HOME/Library/Logs"

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Removed $LABEL"
  exit 0
fi

# launchd starts processes with a bare PATH, so the interpreter must be
# absolute — a bare "node" would simply not be found.
NODE="$(command -v node || true)"
if [[ -z "$NODE" ]]; then
  echo "node not found on PATH. Install Node 18+ and re-run." >&2
  exit 1
fi

if [[ ! -f "$AGENT_DIR/.env" ]]; then
  echo "Missing $AGENT_DIR/.env — copy .env.example and fill it in first." >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>

  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$AGENT_DIR/dahua-bridge.mjs</string>
  </array>

  <key>WorkingDirectory</key>
  <string>$AGENT_DIR</string>

  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <!-- Do not hammer the device or the CRM if something is wrong at startup. -->
  <key>ThrottleInterval</key>
  <integer>30</integer>

  <key>StandardOutPath</key>
  <string>$LOG_DIR/dcw-biometric.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/dcw-biometric.log</string>
</dict>
</plist>
PLIST_EOF

# bootout first so re-running this is an upgrade rather than an error.
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl enable "gui/$(id -u)/$LABEL"

echo "Installed $LABEL"
echo "  plist : $PLIST"
echo "  node  : $NODE"
echo "  log   : $LOG_DIR/dcw-biometric.log"
echo
echo "Check it:   tail -f $LOG_DIR/dcw-biometric.log"
echo "Stop it:    bash agent/install-service.sh --uninstall"
