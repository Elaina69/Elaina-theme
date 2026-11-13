#!/bin/sh
set -eu
cd "$(CDPATH= cd "$(dirname "$0")" && pwd)"
if ! command -v node >/dev/null 2>&1; then
    echo 'Elainatheme MCP requires Node.js 20 or newer. Install Node.js and reopen this script.' >&2
    exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
    echo 'npm was not found. Install Node.js with npm and reopen this script.' >&2
    exit 1
fi
exec node launcher.mjs
