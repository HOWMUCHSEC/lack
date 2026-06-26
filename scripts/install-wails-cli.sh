#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd "$SCRIPT_DIR/.." && pwd)
cd "$REPO_ROOT"

WAILS_VERSION=$(awk '$1 == "github.com/wailsapp/wails/v2" { print $2; exit }' go.mod)
if [ -z "$WAILS_VERSION" ]; then
  printf '%s\n' "Error: could not find github.com/wailsapp/wails/v2 in go.mod" >&2
  exit 1
fi

printf '%s\n' "Start running the script..."
printf '%s' "Current Go version: "
go version

printf '%s\n' "Install the Wails command line tool ($WAILS_VERSION)..."
go install "github.com/wailsapp/wails/v2/cmd/wails@$WAILS_VERSION"

printf '%s\n' "Successful installation!"
printf '%s\n' "End running the script!"
