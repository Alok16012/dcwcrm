#!/usr/bin/env bash
# One-time setup of the WhatsApp bot on a fresh Ubuntu/Debian VPS (Hostinger).
# Run as root on the server:  bash setup-vps.sh
#
# Installs Node 22, creates a `dcwbot` user, the app and data folders, and a
# systemd service that starts the bot on boot and restarts it if it ever dies.
# The secrets file (/opt/dcw-whatsapp-bot/.env) is created empty for you to
# fill in by hand — they never go through this script or git.
set -euo pipefail

APP=/opt/dcw-whatsapp-bot
DATA=/var/lib/dcw-whatsapp-bot

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg rsync
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
command -v rsync >/dev/null || apt-get install -y rsync

id dcwbot >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin dcwbot
mkdir -p "$APP" "$DATA/wa-auth"
chown -R dcwbot:dcwbot "$DATA"

if [ ! -f "$APP/.env" ]; then
  cat > "$APP/.env" <<'ENV'
# Fill these in (copy the values from Vercel → Settings → Environment Variables,
# or from the old Railway whatsapp-bot service). Then: systemctl restart dcw-whatsapp-bot
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CRM_BASE_URL=https://distancecourseswala.com/crm
WHATSAPP_BOT_SECRET=
# Optional
AI_PROVIDER=
GEMINI_API_KEY=
COUNSELOR_PHONE=
TZ=Asia/Kolkata
WA_AUTH_DIR=/var/lib/dcw-whatsapp-bot/wa-auth
PORT=8080
HEALTH_HOST=127.0.0.1
ENV
  chmod 600 "$APP/.env"
fi

cat > /etc/systemd/system/dcw-whatsapp-bot.service <<UNIT
[Unit]
Description=DCW WhatsApp admission bot (all numbers)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=dcwbot
WorkingDirectory=$APP
EnvironmentFile=$APP/.env
ExecStart=/usr/bin/node src/manager.mjs
Restart=always
RestartSec=5
# Let the workers close their WhatsApp sockets cleanly on stop.
KillMode=mixed
TimeoutStopSec=15

[Install]
WantedBy=multi-user.target
UNIT

chown -R dcwbot:dcwbot "$APP"
systemctl daemon-reload
systemctl enable dcw-whatsapp-bot
echo
echo "Done. Next: fill in $APP/.env, then deploy the code from your Mac with deploy/deploy.sh"
