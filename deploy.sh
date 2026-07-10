#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/ubuntu/BrieFlow"

echo "===> Entrando no diretório do app"
cd "$APP_DIR"

echo "===> Atualizando código a partir da branch main"
git fetch origin main
git reset --hard origin/main

echo "===> Instalando dependências"
npm install --force

echo "===> Fazendo build de produção"
rm -rf dist .output
npm run build

echo "===> Garantindo que PM2 está instalado"
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

echo "===> Matando processos antigos (se existirem)"
pm2 delete briflow || true
pm2 delete briflow-api || true

echo "===> Iniciando frontend SSR em 3000"
PORT=3000 pm2 start .output/server/index.mjs --name briflow

echo "===> Iniciando API Express em 3001"
PORT=3001 pm2 start server-express.mjs --name briflow-api

echo "===> Salvando estado do PM2 para restart automático"
pm2 save

echo "===> Checando status PM2"
pm2 status

echo "===> Testando serviços localmente"
sleep 3
curl -I http://127.0.0.1:3000/ || echo "Falha ao acessar frontend em 3000"
curl -I http://127.0.0.1:3001/health || echo "Falha ao acessar API em 3001"

echo "===> Deploy concluído."