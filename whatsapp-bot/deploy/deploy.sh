#!/usr/bin/env bash
# Ship the bot to the VPS and restart it. Run from whatsapp-bot/ on your Mac:
#   VPS=root@<server-ip> deploy/deploy.sh
# Uses the SSH key ~/.ssh/khelobaazi_vps (already on the Hostinger VPS) unless SSH_KEY says otherwise.
set -euo pipefail
: "${VPS:?set VPS=root@<server-ip>}"
KEY="${SSH_KEY:-$HOME/.ssh/khelobaazi_vps}"
APP=/opt/dcw-whatsapp-bot
SSH="ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

cd "$(dirname "$0")/.."
rsync -az --delete -e "$SSH" \
  --exclude node_modules --exclude .wa-auth --exclude .env --exclude supabase \
  ./ "$VPS:$APP/"
$SSH "$VPS" "cd $APP && chown -R dcwbot:dcwbot $APP && sudo -u dcwbot npm ci --omit=dev --no-audit --no-fund && systemctl restart dcw-whatsapp-bot && sleep 3 && systemctl --no-pager --lines=15 status dcw-whatsapp-bot; curl -s localhost:8080/health; echo"
