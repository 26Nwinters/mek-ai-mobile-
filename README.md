# MEK-AI Mobile v0.6.0 — One UI-inspired launcher preview

MEK-AI Mobile is a custom Android Home launcher built around the original MEK-AI robot and overgrown industrial workshop aesthetic. The repository includes self-contained approved artwork.

**Status: Public experimental beta (v0.6.0).** The Android APK is built and verified on CI, including 61 automated tests and a 1,300-operation layout stress test. Additional browser smoke tests passed at three mobile viewport sizes. Galaxy S10+ performance and provider-specific native widgets must still be checked on a real device before calling this production-stable. This is not a replacement Android operating system.

## Core Galaxy-style launcher

- Independent horizontal Home pages, default Home selection, edit mode, wallpaper and a configurable five-slot dock.
- Home layout lock to prevent accidental rearranging; persistent settings and JSON backup/restore.
- Separate 5×6 app drawer with search, manual/custom order, horizontal pages or optional vertical list.
- Folder creation in Home and the app library, including names, colors, folders in dock, multi-select, and moving individual apps between folders.
- Stationary long-press for actions versus hold-and-drag for individual icons, folder creation, dock rearrangement and edge page changes.
- Grids are configured independently: Home 4×6, Apps 5×6, Folders 4×4 by default. Native applications are launched by package name.

## Widgets

- Galaxy-style picker groups Android widget providers by application. Shows provider names, preliminary size labels and asynchronously loaded preview imagery where supported.
- The native AppWidgetHost binds to real Android widget providers; system permission and provider configuration dialogs are supported.
- Native widget sizing respects declared min/max limits and resize directions. The host calls `updateAppWidgetSize(Bundle,List<SizeF>)` after a size change so provider content can respond instead of being stretched.
- Native widget views are hosted over the WebView Home grid, hidden on non-current pages, and freed after deletion with a short undo grace window. Stored IDs on all pages are reconciled when the launcher starts.
- Built-in widgets include MEK-AI, dot-matrix or minimal clock, battery, local tasks, notes, and shortcuts for weather, calendar, music and house controls.
- MEK-AI built-in widgets have independent accent, opacity and expression settings. You can stack up to ten compatible **built-in widgets** in one grid position, then swipe within that stack, reorder children or remove individual ones.
- Provider-driven third-party widget stacking is **not complete**. Native widgets render as individual interactive Android views; a WebView overlay alone cannot reliably intercept their swipes without a dedicated native stack host.

## Optimization and native security

- Only the current Home page and adjacent pages are mounted, reducing HTML canvases, app icon requests and expensive DOM updates on large desktops.
- Installed app icons are processed off the Android UI thread, batched, cached and prioritized by visible page.
- Back, Home, system insets, app-install changes and Android package visibility are handled in native Android code.
- WebView file/content access is restricted, and remote navigation blocked while preserving the original packaged-asset storage origin to avoid losing older launcher layouts.
- Android target/compile SDK are 36 (Android 16); minimum SDK 31 (Android 12).
- Assets are vendored inside the launcher repo; there are no build-time downloads from the separate MEK-AI project.
- Versions are synchronized across Gradle, package.json, README and GitHub Actions, and checked in CI.

## Building and testing

From a checkout with JDK 17, Android SDK Platform 36, Gradle 8.13 and Node.js 22:

```bash
npm install --no-package-lock --ignore-scripts
npm test
python3 tools/prepare_art.py
python3 tools/check_release.py
gradle --no-daemon :app:assembleDebug
```

CI runs all validation steps and produces an APK artifact. Every stage of this integrated build is checked on an isolated development branch before merging.

### IMPORTANT: Android signing and in-place updates

A GitHub Actions runner generates a fresh debug signing key each time unless you provide the repository secret `MEK_DEBUG_KEYSTORE_B64`. Without that key, artifacts are explicitly marked **TEMPORARY-KEY-test-only** and cannot install over an older release with another signature. Back up the layout in launcher settings before uninstalling an earlier build.

To configure future stable development updates:
1. On a computer you control, create and back up a Java keystore with alias `androiddebugkey`, keystore password `android`, key password `android`, and an RSA key.
2. Base64-encode the keystore locally.
3. Add the encoded value in the GitHub repository's **Settings → Secrets and variables → Actions** as the secret `MEK_DEBUG_KEYSTORE_B64`. Never paste a private key in chat or commit it to Git.
4. Once the same keystore signs all future builds, in-place updates work. You cannot make this new key match an old APK signed with another key.

A production Play Store release requires separately secured production signing and policy review.

## Remaining real-device validation

The user's **Galaxy S10+ with Android 12** is required to confirm animation smoothness, icon timing, nested touch interactions and third-party widget/provider-specific behavior. CI and browser tests cannot guarantee identical Samsung One UI behavior. External weather, smart-home controls and AI services need the separate existing MEK-AI companion/controller connection; no fake live data is displayed.

Keep Samsung One UI Home installed as an emergency/default Home fallback.

## Release notes and QA record

See `docs/INTEGRATION-QA.md` for stage test outcomes and outstanding integration limitations.
