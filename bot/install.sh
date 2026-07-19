#!/usr/bin/env bash
# Instala o bot em modo 24/7 com PM2 (autorestart + boot da máquina)
# Uso:
#   cd bot
#   export BOT_BRIDGE_URL="https://newerashinobirevolution.lovable.app"
#   export BOT_WEBHOOK_SECRET="<mesmo-secret-do-Lovable>"
#   bash install.sh

set -euo pipefail

cd "$(dirname "$0")"

if [[ -z "${BOT_BRIDGE_URL:-}" || -z "${BOT_WEBHOOK_SECRET:-}" ]]; then
  echo "❌ Defina BOT_BRIDGE_URL e BOT_WEBHOOK_SECRET antes de rodar."
  echo "   BOT_BRIDGE_URL é a URL publicada do RPG (ex: https://newerashinobirevolution.lovable.app)"
  echo "   BOT_WEBHOOK_SECRET deve ser o mesmo valor salvo em Lovable Secrets → BOT_WEBHOOK_SECRET."
  exit 1
fi

# 1) Dependências
echo "▶ Instalando dependências..."
npm install --no-audit --no-fund

# 2) Persiste envs em .env (o pm2 herda do shell, mas o .env ajuda em reinícios manuais)
cat > .env <<EOF
BOT_BRIDGE_URL=${BOT_BRIDGE_URL}
BOT_WEBHOOK_SECRET=${BOT_WEBHOOK_SECRET}
EOF
chmod 600 .env

# 3) PM2 global (só se ainda não tiver)
if ! command -v pm2 >/dev/null 2>&1; then
  echo "▶ Instalando PM2 global..."
  npm install -g pm2
fi

# 4) Sobe (ou re-sobe) o bot
echo "▶ Iniciando com PM2..."
pm2 delete new-era-shinobi-bot >/dev/null 2>&1 || true
pm2 start ecosystem.config.cjs --update-env

# 5) Salva o processo e configura auto-start no boot da máquina (Linux/systemd)
pm2 save
if [[ "$(uname)" == "Linux" ]]; then
  echo "▶ Configurando auto-start no boot (systemd)..."
  STARTUP_CMD=$(pm2 startup systemd -u "$USER" --hp "$HOME" | tail -n 1)
  if [[ "$STARTUP_CMD" == sudo* ]]; then
    echo "  Executando: $STARTUP_CMD"
    eval "$STARTUP_CMD" || echo "  ⚠ rode manualmente como root: $STARTUP_CMD"
  fi
  pm2 save
fi

echo ""
echo "✅ Bot rodando 24/7 sob PM2 no seu PC."
echo "   Logs:      pm2 logs new-era-shinobi-bot"
echo "   Status:    pm2 status"
echo "   Restart:   pm2 restart new-era-shinobi-bot"
echo ""
echo "Agora abra o painel Admin → WhatsApp → 'Gerar QR agora'."
echo "O QR aparece em ~2 segundos."
