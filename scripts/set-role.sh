#!/usr/bin/env bash
#
# @author Javlon Khalimjonov <khalimjanov2000@gmail.com>

set -euo pipefail

cd "$(dirname "$0")/.."

ROLES=(CLIENT AGENT FREELANCER MANAGER ADMIN)

EMAIL=""
ROLE=""

for arg in "$@"; do
    case "$arg" in
        --email=*) EMAIL="${arg#*=}" ;;
        --role=*)  ROLE="${arg#*=}" ;;
        -h|--help) echo "usage: ./scripts/set-role.sh --email=<address> --role=${ROLES[*]// /|}"; exit 0 ;;
        *)         echo "unknown option: $arg" >&2; exit 1 ;;
    esac
done

ROLE="$(printf '%s' "$ROLE" | tr '[:lower:]' '[:upper:]')"

if [ -z "$EMAIL" ] || [ -z "$ROLE" ]; then
    echo "usage: ./scripts/set-role.sh --email=<address> --role=${ROLES[*]// /|}" >&2
    exit 1
fi

if ! printf '%s\n' "${ROLES[@]}" | grep -qx "$ROLE"; then
    echo "unknown role \"$ROLE\" — one of: ${ROLES[*]}" >&2
    exit 1
fi

if [ ! -f .env ]; then
    echo "no .env found — copy .env.example and fill in DATABASE_URL and JWT_SECRET" >&2
    exit 1
fi

if [ ! -f dist/modules/auth/cli/set-role.js ] \
   || [ src/modules/auth/cli/set-role.ts -nt dist/modules/auth/cli/set-role.js ]; then
    echo "building…"
    npm run build >/dev/null
fi

node dist/modules/auth/cli/set-role.js --email="$EMAIL" --role="$ROLE"
