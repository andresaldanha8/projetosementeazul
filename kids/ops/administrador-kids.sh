#!/usr/bin/env bash
# SSH only, private folder outside public_html. Password never enters argv/history.
set +x
set -euo pipefail
if [ "$#" -lt 4 ] || [ "$#" -gt 5 ]; then
  printf 'Uso: bash administrador-kids.sh RAIZ_DO_SITE BANCO create-first|reset-password LOGIN [NOME]\n'
  exit 1
fi
trap 'unset first second' EXIT
read -r -s -p 'Senha inicial KIDS (12 a 72 bytes): ' first; printf '\n'
read -r -s -p 'Repita a senha: ' second; printf '\n'
[ "$first" = "$second" ] || { printf 'Senhas diferentes\n'; exit 1; }
here="$(cd -- "$(dirname -- "$0")" && pwd)"
printf '%s' "$first" | php -r '$p=stream_get_contents(STDIN);echo json_encode(["password"=>$p],JSON_THROW_ON_ERROR);' | php "$here/admin-account.php" "$1" "$2" "$3" "$4" "${5-}"
