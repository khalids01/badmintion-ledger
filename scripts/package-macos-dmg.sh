#!/usr/bin/env bash
set -euo pipefail

# Package the signed app without mounting a writable image or using Finder.
# Tauri's mounted-image DMG layout step can fail to eject on hosted runners.
app=${1:?Usage: package-macos-dmg.sh APP_PATH OUTPUT_DMG}
output=${2:?Usage: package-macos-dmg.sh APP_PATH OUTPUT_DMG}
if [ ! -d "$app/Contents" ]; then
  echo "Missing application bundle: $app" >&2
  exit 1
fi

staging=$(mktemp -d "${TMPDIR:-/tmp}/badminton-dmg.XXXXXX")
trap 'rm -rf "$staging"' EXIT

ditto "$app" "$staging/Badminton Ledger.app"
ln -s /Applications "$staging/Applications"
mkdir -p "$(dirname "$output")"
hdiutil create -volname "Badminton Ledger" -srcfolder "$staging" \
  -fs HFS+ -format UDZO -ov "$output"
hdiutil verify "$output"
