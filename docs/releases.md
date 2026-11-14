# Publishing updates

The updater uses a signed manifest from GitHub Releases. Mac builds verify and install signed app archives; Android downloads an APK for system-confirmed installation.

## One-time signing setup

Two private keys were generated in ignored `.tauri/`. Back them up securely. Add these repository Actions secrets:

| Secret | Local source |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | `.tauri/updater.key` |
| `ANDROID_SIGNING_KEY_BASE64` | `.tauri/android-signing-key-base64.txt` |

With GitHub CLI installed and authenticated, `./scripts/setup-update-secrets.sh` sets both without printing key contents. Never commit private signing keys. The public updater key is in `tauri.conf.json`; the public Android certificate is in `src-tauri/android-signing.crt`.

## Release

1. Update the version in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`. Refresh the lockfiles.
2. Write `RELEASE_NOTES.md` and commit the changes.
3. Push the matching tag, for example `git tag v1.1.0` then `git push origin v1.1.0`.

**Publish update release** builds both Mac architectures and Android. It publishes `latest.json` only after every required installer and signature is uploaded. Version tags are immutable; bump the version for another release. Branch and pull-request builds remain available as Actions artifacts. Pull-request builds never receive signing secrets.

Existing 1.0.0 installations need one manual upgrade to gain update support. The old Android debug build also needs uninstalling once because its signing key differs from the persistent key. Supabase records remain intact.

Mac builds are ad-hoc signed, not Apple-notarized. Developer ID signing and notarization require Apple credentials. Linux/Windows updater plugins are wired, but their installers are not included in this release workflow.
