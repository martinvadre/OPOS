#!/bin/zsh
cd "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if [[ ! -f credentials.json && ! -f password.hash ]]; then
  read -s '?Create POS password (12+ characters): ' pos_password
  echo
  print -rn -- "$pos_password" | node server.js --set-password || exit 1
  unset pos_password
fi
if [[ ! -d node_modules ]]; then npm install || exit 1; fi
npm run build || exit 1
POS_HOST=0.0.0.0 node server.js
