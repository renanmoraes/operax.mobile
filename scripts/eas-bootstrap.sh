#!/usr/bin/env bash
# Após: npx eas-cli login  (ou EXPO_TOKEN)
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ Conta Expo:"
npx eas-cli whoami

echo "→ Inicializando projeto EAS (liga app.json extra.eas.projectId)…"
npx eas-cli init --non-interactive

echo "→ projectId atual:"
node -e "const j=require('./app.json'); console.log(j.expo?.extra?.eas?.projectId || '(ainda vazio)')"

echo "Pronto. Próximo: npx eas-cli build --platform all --profile production"
