#!/bin/zsh
cd "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
read -s '?New POS password (12+ characters): ' pos_password
echo
print -rn -- "$pos_password" | node server.js --set-password
unset pos_password
