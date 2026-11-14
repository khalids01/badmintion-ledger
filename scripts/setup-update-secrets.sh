#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v gh >/dev/null || { echo 'Install the GitHub CLI and run gh auth login first.'; exit 1; }
gh auth status
repo=khalids01/badmintion-ledger
gh secret set TAURI_SIGNING_PRIVATE_KEY --repo "$repo" < .tauri/updater.key
gh secret set ANDROID_SIGNING_KEY_BASE64 --repo "$repo" < .tauri/android-signing-key-base64.txt
echo 'Update signing secrets configured. Keep a secure backup of .tauri/.'
