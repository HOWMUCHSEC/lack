#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd "$SCRIPT_DIR/.." && pwd)
cd "$REPO_ROOT"

printf '%s\n' "Start running the script..."
printf '%s\n' "Start building the app for macos amd64 platform..."
wails build --clean --platform darwin/amd64

printf '%s\n' "End running the script!"
