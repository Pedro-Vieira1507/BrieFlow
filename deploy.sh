#!/bin/bash
# =============================================================================
#  BrieFlow — Script de Deploy Completo
#  Servidor: Oracle Cloud Always Free — Ubuntu 22.04 LTS — 24GB RAM / 200GB
# =============================================================================
# USO:
#   chmod +x deploy.sh && ./deploy.sh
#
# Com domínio (HTTPS automático):
#   DOMAIN=briflow.meusite.com ./deploy.sh
#
# Repositório privado (passe URL com token ou use SSH antes):
#   REPO_URL="https://user:TOKEN@github.com/Pedro-Vieira1507/BrieFlow.git" ./deploy.sh
#
# Trocar modelo Ollama:
#   OLLAMA_MODEL=llama3:8b ./deploy.sh
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'
BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${BLUE}[→]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo -e "\n${BOLD}════════════════════════════════════════${NC}"
echo -e "${BOLD}   BrieFlow — Deploy no Oracle Ubuntu   ${NC}"
echo -e "${BOLD}════════════════════════════════════════${NC}\n"

# ─── Configurações ────────────────────────────────────────────────────────────
# REPO_URL pode ser sobrescrita via variável de ambiente (ex: com token)
REPO_URL="${REPO_URL:-https://github.com/Pedro-Vieira1507/BrieFlow.git}"
APP_DIR="$HOME/briflow"
OLLAMA_MODEL="${OLLAMA_MODEL:-qwen2.5:14b}"
DOMAIN="${DOMAIN:-}"
APP_PORT="3000"
NODE_VERSION="20"

# ─── 1. Atualizar sistema ─────────────────────────────────────────────────────
info "Atualizando pacotes do sistema..."
# Aguarda qualquer processo apt em andamento liberar o lock (até 60s)
for i in $(seq 1 12); do
  sudo apt-get update -qq 2>/dev/null && break
  warn "apt bloqueado por outro processo, aguardando 5s... ($i/12)"
  sleep 5
done
sudo apt-get install -y -qq curl git build-essential unzip netfilter-persistent iptables-persistent
log "Sistema atualizado"

# ─── 2. Node.js via NVM ───────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  info "Instalando Node.js $NODE_VERSION via NVM..."
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  source "$NVM_DIR/nvm.sh"
  nvm install "$NODE_VERSION"
  nvm use "$NODE_VERSION"
  nvm alias default "$NODE_VERSION"
  log "Node.js $(node -v) instalado"
else
  log "Node.js já instalado: $(node -v)"
fi
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

# ─── 3. Bun ───────────────────────────────────────────────────────────────────
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
if ! command -v bun &>/dev/null; then
  info "Instalando Bun..."
  curl -fsSL https://bun.sh/install | bash
  log "Bun $(bun -v) instalado"
else
  log "Bun já instalado: $(bun -v)"
fi

# ─── 4. PM2 ───────────────────────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  info "Instalando PM2..."
  npm install -g pm2 --quiet
  log "PM2 instalado"
else
  log "PM2 já instalado: $(pm2 -v)"
fi

# ─── 5. Ollama ────────────────────────────────────────────────────────────────
if ! command -v ollama &>/dev/null; then
  info "Instalando Ollama..."
  curl -fsSL https://ollama.com/install.sh | sh
  log "Ollama instalado"
else
  log "Ollama já instalado"
fi

# Configurar Ollama como serviço systemd (localhost apenas)
if ! systemctl is-active --quiet ollama 2>/dev/null; then
  info "Configurando Ollama como serviço systemd..."
  if ! id ollama &>/dev/null; then
    sudo useradd -r -s /bin/false -m -d /usr/share/ollama ollama
  fi
  sudo tee /etc/systemd/system/ollama.service > /dev/null <<'EOF_SERVICE'
[Unit]
Description=Ollama LLM Server
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/ollama serve
User=ollama
Group=ollama
Restart=always
RestartSec=3
Environment="OLLAMA_HOST=127.0.0.1:11434"
Environment="OLLAMA_MODELS=/usr/share/ollama/.ollama/models"

[Install]
WantedBy=default.target
EOF_SERVICE
  sudo systemctl daemon-reload
  sudo systemctl enable ollama
  sudo systemctl start ollama
  sleep 3
  log "Ollama rodando como serviço systemd"
else
  log "Ollama já está rodando"
fi

# Baixar modelo APENAS se ainda não estiver disponível
info "Verificando modelo $OLLAMA_MODEL..."
if ollama list 2>/dev/null | grep -q "$OLLAMA_MODEL"; then
  log "Modelo $OLLAMA_MODEL já disponível — pulando download"
else
  warn "Baixando $OLLAMA_MODEL (pode demorar 5–20 min)..."
  warn "Tamanhos: qwen2.5:14b ~9GB | llama3:8b ~5GB | mistral:7b ~4GB"
  ollama pull "$OLLAMA_MODEL" || warn "Tente manualmente: ollama pull $OLLAMA_MODEL"
  log "Modelo $OLLAMA_MODEL disponível"
fi

# ─── 6. Clonar / Atualizar repositório ───────────────────────────────────────
if [ -d "$APP_DIR/.git" ]; then
  info "Atualizando repositório existente..."
  cd "$APP_DIR"
  # Preservar REPO_URL com credenciais se fornecida
  if [[ "$REPO_URL" == *"@"* ]]; then
    git remote set-url origin "$REPO_URL"
  fi
  git pull origin main
else
  info "Clonando repositório..."
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi
log "Código em $APP_DIR"

# ─── 7. Criar .env ────────────────────────────────────────────────────────────
cat > "$APP_DIR/.env" <<EOF_ENV
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=$OLLAMA_MODEL
PORT=$APP_PORT
NODE_ENV=production
EOF_ENV
log ".env criado"

# ─── 8. Build ─────────────────────────────────────────────────────────────────
cd "$APP_DIR"
info "Instalando dependências..."
npm install --quiet
info "Build de produção..."
npm run build
log "Build concluído"

# ─── 9. PM2 ───────────────────────────────────────────────────────────────────
pm2 delete briflow 2>/dev/null || true

cat > "$APP_DIR/ecosystem.config.cjs" <<'EOF_PM2'
module.exports = {
  apps: [{
    name: 'briflow',
    script: 'npm',
    args: 'run start',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    env: {
      NODE_ENV: 'production',
      PORT: '3000',
      OLLAMA_URL: 'http://127.0.0.1:11434',
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
}
EOF_PM2

mkdir -p "$APP_DIR/logs"
pm2 start "$APP_DIR/ecosystem.config.cjs"
pm2 save
pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1 | bash 2>/dev/null || \
  warn "Execute manualmente: pm2 startup systemd"
log "PM2: BrieFlow rodando na porta $APP_PORT"

# ─── 10. Caddy ────────────────────────────────────────────────────────────────
info "Verificando Caddy..."
if ! command -v caddy &>/dev/null; then
  info "Instalando Caddy..."
  sudo apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | sudo tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
  sudo apt-get update -qq && sudo apt-get install caddy -y -qq
  log "Caddy instalado"
else
  log "Caddy já instalado"
fi

CADDY_SITE="${DOMAIN:-:80}"

sudo tee /etc/caddy/Caddyfile > /dev/null <<EOF_CADDY
$CADDY_SITE {
    reverse_proxy 127.0.0.1:$APP_PORT {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
    @sse path /api/*
    header @sse X-Accel-Buffering no
    encode gzip
    log {
        output file /var/log/caddy/briflow.log
    }
}
EOF_CADDY

sudo mkdir -p /var/log/caddy
sudo systemctl enable caddy
sudo systemctl restart caddy
log "Caddy configurado"

# ─── 11. Firewall ─────────────────────────────────────────────────────────────
info "Abrindo portas 80 e 443 no iptables..."
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80  -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
sudo netfilter-persistent save 2>/dev/null || true
log "Portas abertas"

# ─── Resumo Final ─────────────────────────────────────────────────────────────
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "SEU_IP")
echo ""
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo -e "${BOLD}      Deploy Concluído! 🚀              ${NC}"
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo ""
log "Ollama:        $(systemctl is-active ollama)"
log "PM2 (briflow): $(pm2 list 2>/dev/null | grep -c 'online') instância(s) online"
log "Caddy:         $(systemctl is-active caddy)"
echo ""
info "Acesso:"
if [ -n "$DOMAIN" ]; then
  echo -e "  • https://$DOMAIN  (HTTPS via Let's Encrypt ativo em ~1 min)"
else
  echo -e "  • http://$PUBLIC_IP"
  warn "Para HTTPS: DOMAIN=meu.dominio.com ./deploy.sh"
fi
echo ""
info "Comandos úteis:"
echo "  pm2 logs briflow              # Logs em tempo real"
echo "  pm2 restart briflow           # Reiniciar app"
echo "  pm2 monit                     # Monitor de recursos"
echo "  ollama list                   # Modelos disponíveis"
echo "  sudo systemctl status caddy  # Status do proxy"
echo "  sudo journalctl -u ollama -f  # Logs do Ollama"
echo ""
warn "OBRIGATÓRIO: Abra as portas 80 e 443 nas Security Lists da Oracle Cloud Console!"
warn "Caminho: Oracle Console → Networking → Virtual Cloud Networks → Security Lists → Add Ingress Rules"
