#!/usr/bin/env bash
#
# Create a TripMe user with a role.
#
# There is no sign-up screen — agents, managers and admins are provisioned by
# someone with database access, which is what this script is. Public signup, if
# it ever arrives, can only ever create a CLIENT.
#
#   ./scripts/create-user.sh --email=agent@tripme.uz --role=AGENT
#   ./scripts/create-user.sh --email=boss@tripme.uz --role=MANAGER \
#                            --first-name=Дилшод --last-name=Каримов
#
# Leave --password off and it is asked for without echoing, which keeps it out
# of your shell history and out of the process list. Pass it only in a script.
#
# @author Javlon Khalimjonov <khalimjanov2000@gmail.com>

set -euo pipefail

cd "$(dirname "$0")/.."

ROLES=(CLIENT AGENT FREELANCER MANAGER ADMIN)

EMAIL=""
PASSWORD=""
ROLE="AGENT"
FIRST_NAME=""
LAST_NAME=""
PHONE=""

usage() {
    cat <<'USAGE'
usage: ./scripts/create-user.sh --email=<address> [options]

  --email=…        required
  --role=…         CLIENT | AGENT | FREELANCER | MANAGER | ADMIN   (default: AGENT)
  --password=…     asked for interactively when omitted
  --first-name=…
  --last-name=…
  --phone=…

The account is created already verified — someone with database access has
vouched for it, and there is no mailbox to send a code to in this flow.
USAGE
}

for arg in "$@"; do
    case "$arg" in
        --email=*)      EMAIL="${arg#*=}" ;;
        --password=*)   PASSWORD="${arg#*=}" ;;
        --role=*)       ROLE="${arg#*=}" ;;
        --first-name=*) FIRST_NAME="${arg#*=}" ;;
        --last-name=*)  LAST_NAME="${arg#*=}" ;;
        --phone=*)      PHONE="${arg#*=}" ;;
        -h|--help)      usage; exit 0 ;;
        *)              echo "unknown option: $arg" >&2; usage >&2; exit 1 ;;
    esac
done

if [ -z "$EMAIL" ]; then
    echo "--email is required" >&2
    usage >&2
    exit 1
fi

# Roles are checked here as well as in the CLI, so a typo fails before anything
# connects to a database — and uppercased first, because ADMIN and admin are
# the same intention.
ROLE="$(printf '%s' "$ROLE" | tr '[:lower:]' '[:upper:]')"

if ! printf '%s\n' "${ROLES[@]}" | grep -qx "$ROLE"; then
    echo "unknown role \"$ROLE\" — one of: ${ROLES[*]}" >&2
    exit 1
fi

if [ ! -f .env ]; then
    echo "no .env found — copy .env.example and fill in DATABASE_URL and JWT_SECRET" >&2
    exit 1
fi

if [ -z "$PASSWORD" ]; then
    # -s so it is not echoed; asked twice because a typo here locks someone out
    # of an account that has no password-reset flow yet.
    read -rsp "password for $EMAIL: " PASSWORD; echo
    read -rsp "repeat: " CONFIRM; echo

    if [ "$PASSWORD" != "$CONFIRM" ]; then
        echo "passwords do not match" >&2
        exit 1
    fi
fi

if [ "${#PASSWORD}" -lt 8 ]; then
    echo "password must be at least 8 characters" >&2
    exit 1
fi

# The CLI runs from dist, so a source tree that has not been compiled would
# otherwise create the account from stale code — or fail with a missing file.
if [ ! -f dist/modules/auth/cli/create-user.js ] \
   || [ src/modules/auth/cli/create-user.ts -nt dist/modules/auth/cli/create-user.js ]; then
    echo "building…"
    npm run build >/dev/null
fi

node dist/modules/auth/cli/create-user.js \
    --email="$EMAIL" \
    --password="$PASSWORD" \
    --role="$ROLE" \
    --first-name="$FIRST_NAME" \
    --last-name="$LAST_NAME" \
    --phone="$PHONE"
