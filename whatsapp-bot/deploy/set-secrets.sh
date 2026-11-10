#!/usr/bin/env bash
# Asks for the bot's secrets and writes them into the server's .env.
# Run on the VPS (Hostinger → Web console):  bash /opt/dcw-whatsapp-bot/deploy/set-secrets.sh
# Nothing is shown on screen while you paste.
set -euo pipefail
ENV=/opt/dcw-whatsapp-bot/.env

setvar() {  # setvar NAME VALUE — replace the line, or add it
  local name=$1 value=$2
  if grep -q "^$name=" "$ENV"; then
    local tmp; tmp=$(mktemp)
    awk -v n="$name" -v v="$value" 'BEGIN{FS=OFS="="} $1==n{print n"="v; next} {print}' "$ENV" > "$tmp" && cat "$tmp" > "$ENV" && rm -f "$tmp"
  else
    echo "$name=$value" >> "$ENV"
  fi
}

ask() {  # ask NAME PROMPT — keeps the current value if you just press Enter
  local v
  read -r -s -p "$2: " v; echo
  [ -n "$v" ] && setvar "$1" "$v"
  return 0
}

setvar SUPABASE_URL "https://jeljuaozcpkjuevezvbu.supabase.co"
ask SUPABASE_SERVICE_ROLE_KEY "Paste SUPABASE_SERVICE_ROLE_KEY (Supabase → Settings → API → service_role)"
ask WHATSAPP_BOT_SECRET "Paste WHATSAPP_BOT_SECRET from Vercel — or just press Enter to create a new one"
# None on Vercel? Make one here; it must then be added to Vercel too.
if [ -z "$(grep -E '^WHATSAPP_BOT_SECRET=' "$ENV" | cut -d= -f2-)" ]; then
  NEW_SECRET=$(openssl rand -hex 32)
  setvar WHATSAPP_BOT_SECRET "$NEW_SECRET"
  echo
  echo "  A new WHATSAPP_BOT_SECRET was created. Add it in Vercel → crmrahul → Settings →"
  echo "  Environment Variables as  WHATSAPP_BOT_SECRET  (Production), then redeploy:"
  echo
  echo "      $NEW_SECRET"
  echo
fi
ask GEMINI_API_KEY "Paste GEMINI_API_KEY for AI answers, or just press Enter to skip"
chmod 600 "$ENV"; chown dcwbot:dcwbot "$ENV"

for k in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY WHATSAPP_BOT_SECRET GEMINI_API_KEY; do
  v=$(grep -E "^$k=" "$ENV" | head -1 | cut -d= -f2-)
  [ -n "$v" ] && echo "  $k: set" || echo "  $k: EMPTY"
done
echo "Saved. Tell Claude it's done — or start the bot now: systemctl restart dcw-whatsapp-bot"
