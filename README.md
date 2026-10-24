# MEK-AI Mobile v0.6.3 — Launcher responsiveness update

**Experimental Android beta.** This release targets sluggish folder opening, app-library access, icon movement, and third-party Android widget page transitions. It preserves your existing layout data, native AppWidget IDs, and the v0.6.2 visibility/undo safeguards.

## Performance improvements

- **Home pages are reconciled instead of rebuilt:** Only changed pages are repopulated; neighboring pages stay mounted as you swipe.
- **Faster app library:** Reopening the drawer reuses its existing page elements if the app list, folders, view mode, and grid settings are unchanged; custom-order sorting uses indexed lookup.
- **Folder view reuse:** Opening the same unchanged folder reuses its icons and pages rather than recreating them.
- **App dragging:** Removes an unnecessary full render after a successful drag and avoids repeatedly clearing the same highlighted target. Layout changes still persist and remain undoable.
- **Native Android widgets:** A dedicated Android host animation now matches the 240 ms WebView page-slide easing and travel distance on adjacent-page transitions. Existing atomic visibility synchronization is retained for modal overlays, edit mode, long page jumps and recovery.
- **Native host placement:** Avoids redundant Android view layout passes when native widget size and position have not changed.

## Verification and limits

CI runs launcher/browser regression tests, integrity checks, and builds the Android SDK 36 debug APK. **The third-party widget animation still requires a real-phone test**, especially for different providers, rapid repeated swipes, transparent widgets, and switching pages while providers update. No improvement in frame rate is claimed without on-device profiling.

**Signing warning:** Unless your existing persistent `MEK_DEBUG_KEYSTORE_B64` GitHub secret is configured, the workflow produces a temporary-key test APK that cannot upgrade a previously installed differently signed build. Export your layout before uninstalling another build. Keep Samsung One UI Home available as a fallback.

---

# MEK-AI Mobile v0.6.2 — Third-party widget visibility repair

**Experimental Android beta.** Addresses the Galaxy S10+ regression reported after v0.6.1: third-party widgets could be added and resized in Home edit mode but left behind an invisible space after tapping Done.

## Fix

- **Atomic native widget updates:** The same JSON layout packet now carries both `allow` (whether native widgets should be visible) and the widget rects, with a strictly increasing revision number. The Android host rejects stale operations. A delayed "hide" from opening a sheet/edit mode can no longer override a newer Home "show" update.
- **Visibility retries:** The Home screen resends an authoritative widget layout shortly after exiting edit mode, then again as Android/WebView sizing settles. Returning to MEK-AI from another Android activity triggers another sync.
- **Provider failure feedback:** If a third-party provider is missing, cannot create its native view, or never acknowledges attachment after several seconds, the previously blank area now shows a widget unavailable notice with a tap-to-retry action.
- **Folder/menu safety preserved:** Native Android host views still disappear behind folders, customization sheets, or the editing toolbar; they return when the Home screen is ready. Transparent/outline/minimal/panel styles remain supported.
- **Layout and widget bindings retained:** v0.6.2 does not reset your Home pages or intentionally allocate replacement Android widget IDs.

## Verification

GitHub Actions runs all Node/jsdom launcher tests and source integration checks, verifies bundled artwork and synchronized version metadata, then compiles Android SDK 36 debug APK. New regression tests cover the add → edit → Done → visible widget cycle, modal layering, resume, ordered revisions, and recovery notice.

**On-device testing is still necessary.** Actual AppWidgetHostView rendering is part of Android and cannot be validated in browser simulations or GitHub Actions. The system provider can still supply its own opaque background, which the launcher cannot override.

**Signing warning:** Without the owner-configured `MEK_DEBUG_KEYSTORE_B64` GitHub secret, this APK uses a fresh temporary debug key and is **not installable in-place over a differently signed previous version**. Export your current layout before uninstalling an older build, and retain Samsung One UI Home as the fallback.

---

# MEK-AI Mobile v0.6.1 — Native widget overlay, transparency and resizing fix

**Release class: Experimental Android beta.** This patch responds to screenshots from the Galaxy S10+ and retains existing layout data from v0.6.0.

## What changed

- **Folders and overlays always get priority over native Android widgets.** `AppWidgetHostView` instances render above the WebView at the Android view-tree level, so the launcher now explicitly hides and disables their touch surfaces when a folder, customization sheet, Home editing mode, or another Home view is active. Closing the overlay requests fresh native widget placement.
- **No imposed dark green panel behind transparent Android widgets.** The placeholder is transparent outside editing mode. An Android host view also starts with a transparent background. Provider-authored `RemoteViews` backgrounds remain under the provider's control and cannot always be removed by a launcher.
- **Four optional surfaces:** Transparent, Outline, Subtle Glass, and Dark Industrial Panel. Use a widget's **Appearance** menu to change its launcher frame. Built-in MEK-AI widgets really become transparent; native widget backgrounds drawn by Android widget provider apps may remain.
- **Three resize handles** after entering Home editing and tapping a widget: ↔ changes only width, ↕ changes only height, and ⤡ changes both. These controls now appear for **native third-party widgets and built-in widget stacks**, not just regular built-in widgets.
- **Exact cell sizes and no forced aspect ratio:** The Resize screen separately controls width (1 to configured Home columns) and height (1 to configured Home rows), offers wide/tall presets, and explains native provider min/max constraints. Native widgets may prohibit a dimension, so the launcher honors their Android metadata. Nearby icons relocate when possible.
- **Stack layout bug fixed:** Saved built-in stacks retain their height, width, and surface style correctly after reopening the launcher.

## Quick instructions

1. Long-press an empty Home area to enter edit mode.
2. Tap the weather, clock, smart-home, or MEK-AI widget you want to change.
3. Drag ↔, ↕ or ⤡, or tap a handle for exact sizes.
4. Open **WIDGET APPEARANCE** and choose **TRANSPARENT / NO BACKGROUND** to eliminate the launcher-added frame.
5. Exit edit mode. Opening a folder or menu should hide native Android widget views so the folder stays clickable.

## Validation

CI runs the launcher model, UI, widget layer, frame and resize regression tests, full Android SDK 36 debug APK build, artifact upload and artwork/release checks. Source and browser simulation cannot prove real Galaxy widget provider behavior, so physical testing remains important.

**APK signing:** Unless `MEK_DEBUG_KEYSTORE_B64` is configured, this is a temporary-key test build, and Android may require uninstalling older builds signed with a different key. **Export your launcher layout before uninstalling.** Samsung One UI Home remains a fallback.

---

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
