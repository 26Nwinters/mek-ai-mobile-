# MEK-AI Mobile v0.7.4 — Home Icon Performance Repair

This is an in-place update to the existing permanently signed MEK-AI Home, preserving `com.mekai.mobile`, the `mek_launcher_v5` layout/storage origin, Android widget bindings, Home/dock organization, and the v0.7.2+ pinned release-signing certificate. Android `versionCode 21` upgrades v0.7.3 without uninstalling.

## Why Home icon loading felt slower

The app discovery, widget catalog and icon-decoding requests previously shared one Android single-thread executor. Loading the full installed-app list could block the first 12-item icon batch. In v0.7.3, backgrounding Home also tore down the Android widget host listener, making every return require another synchronous widget-host start.

- **Independent icon worker:** The Android icon requests now run on a dedicated worker and do not wait behind the full PackageManager app-discovery query. App listing and provider catalog remain on the existing worker.
- **Home/dock icon warm-start cache:** Successful icon responses for pinned Home apps, Home folders and dock apps are saved as a small bounded WebP/PNG cache in existing WebView localStorage (at most 48 entries, 36-hour expiry). Returning after launcher process recreation can display familiar icons without waiting for Android to decode the images again. Only Home/dock icons are persisted, not the entire installed-app archive. Android package-change broadcasts invalidate the disk cache.
- **Warm widget listener:** Keep AppWidgetHost listening while the Home Activity is temporarily backgrounded, avoiding expensive stop/start cycles and potentially late provider redraws. WebView timers still pause while the launcher is backgrounded. Widget IDs and layout are untouched.
- **Regression tests:** Icon disk cache fast path, invalidation, expiry, cache bounds, split Android work queues, and lifecycle/warm widget host behavior are validated in CI alongside the existing Home, third-party widget, and gesture tests.

This repairs a probable source-code bottleneck. Real pixel-display timing, animation fluidity, and power consumption on a Galaxy phone still require an on-device check, and no automatic/sustained FPS or millisecond improvement is claimed by CI.

---

# MEK-AI Mobile v0.7.3 — Stability & Recovery

**In-place permanent-key update** to the existing Galaxy launcher, using the same package `com.mekai.mobile`, the same pinned release signing certificate and Android `versionCode 20`. This release keeps the current artwork, WebView origin, Home layout, app drawer and personalization choices. It does not require uninstalling a previously installed **permanently signed v0.7.2** APK.

## Backup and Android widget recovery

- **Safe restore:** A backup retains pages, dock, folders, tasks, notes, widget provider references, and native widget sizes and grid placements. Because Android widget IDs belong to the original app installation, every third-party widget in an imported backup becomes an explicit **Reconnect Widget** placeholder. It never accidentally assumes a stale ID is bound to the new installation.
- **Reconnect in place:** Tap the placeholder and approve the Android widget binding/configuration. If that provider no longer exists, the Android system picker is offered. A successful connection gives the existing tile a **new** Android host ID while preserving its location and size. Canceling leaves the tile available for later retry, rather than deleting it.
- **Blank bound widget repair:** Select the affected third-party widget, open Resize, and choose **Refresh Blank Android Widget**. The native view is recreated **without deleting or reallocating its host ID**. Removal of the provider can now be detected even if a host view was already cached. Provider-specific rendering remains subject to Android/One UI and requires real-device verification.
- **Important:** A third-party app may require configuration again and may not accept its old dimensions. Android does not provide a general backup/restore guarantee for provider-owned widget content through this custom layout importer.

## Background work and display

- The activity pauses WebView timers and stops the AppWidgetHost listener when it goes offscreen; both resume when the launcher returns. Visible widget views get a fresh layout request on foreground return, and the custom notification inbox no longer loses its scroll position on Activity resume.
- MEK-AI defaults to **following the phone's brightness**, including for users who previously saved a custom numeric slider value but never explicitly enabled an override. Moving the brightness slider opts into window-only brightness control; **Follow Phone Brightness** resets the override.
- UI tests now exercise imported widget IDs, successful reconnect, canceled reconnect, view refresh, rapid swipes, brightness opt-in/reset, and notification scroll on resume. Android-source checks cover lifecycle, signed update identity, and view refresh safety.

**Device QA still required:** GitHub Actions can compile the APK and simulate gestures in jsdom, but it cannot reproduce a Galaxy's provider RemoteViews pixels, real ambient battery usage, or every third-party widget configuration screen.

---

# MEK-AI Mobile v0.7.2 — Permanent APK Signing

MEK-AI Home now builds its personal installable releases using one **pinned, permanent APK signing certificate** rather than generating a new Android debug key each time. The Android package remains `com.mekai.mobile` and the localStorage origin is unchanged. A successful upgrade keeps launcher pages, folders, permissions, settings and third-party widget bindings.

## First-time private key setup

The owner must put two secrets in **Repository Settings > Secrets and variables > Actions > New repository secret** for `26Nwinters/mek-ai-mobile-`. Never commit the key, post the encoded secret in an issue, or include it in a PR. The owner has an accompanying secure backup bundle generated outside this repository.

1. `MEK_SIGNING_KEYSTORE_B64` is the complete **single-line** base64 encoding of the permanent `MEK-AI-Home-Permanent-Signing-Key.p12` file (no quotes or file path).
2. `MEK_SIGNING_PASSWORD` is the keystore password (the `mekai-home` key uses the same password).

Back up the original `.p12` and password securely in two locations, outside GitHub code and outside this chat. Do not replace the key later. The public certificate SHA-256 fingerprint, pinned in Actions, is:

`E44DBA69D602BD2AC79411B2D0828CF5E7A5B16B5525B72D33681B520CC71914`

When both secrets are configured, open **Actions > Build MEK-AI Mobile APK > Run workflow** on `main` to create `MEK-AI-Mobile-v0.7.2-PERMANENT-SIGNED-UPGRADE`. The ZIP artifact contains `app-release.apk`. The build verifies the original keystore fingerprint and the finished APK's signing certificate before publishing it. If either secret is absent, the wrong password is entered, or a different keystore is used, the workflow **fails without distributing a different-key upgrade**. Pull requests continue to run tests using disposable debug APKs explicitly labeled **TEST ONLY**.

## One last migration from temporary debug APKs

Existing v0.7.1 test builds used ephemeral debug signing. Android will reject an attempt to install v0.7.2 over a differently signed app. **Export the existing launcher layout and save your notes/settings if needed before uninstalling**, and retain Samsung One UI Home as the fallback. Uninstall v0.7.1 and install the new permanently signed release one time. Android uninstall removes app-local data, and some third-party widgets may need to be added/configured again.

For all later updates, keep `com.mekai.mobile`, use this same `.p12` key, and increase `versionCode`. New releases then install in place with no change to the chosen Home launcher; users may need to accept the Android installer prompt. This is not an automatic update delivery service, just stable signing for APK upgrades.

---

# MEK-AI Mobile v0.7.1 — Notification Swipe and Performance Repair

**Patch release for the v0.7.0 prototype.** Swiping upward over notifications in the quick shade opens the full inbox instead of unexpectedly returning Home. Vertical scrolling within the inbox is not intercepted; only dragging the shade handle expands or collapses quick settings.

**Performance:** Live refreshes no longer reconstruct the entire overlay every 15 seconds. Notification DOM and scroll positions survive background updates. Home page swipes avoid unnecessary Android widget-inventory scans, battery bridge reads and clock canvas redraws. Third-party widget restoration retries remain for Home pages with native widgets.

**Validation:** Added jsdom gesture, scroll and refresh regression tests plus Android CI compilation. Smoothness and widget-provider rendering still require an actual Galaxy device test. This remains an Android launcher/in-app system preview, not an OS replacement. VersionCode 18. Existing APK signing/upgrade cautions below continue to apply.

---

# MEK-AI Mobile v0.7.0 — System Experience Prototype

**An interactive Android APK prototype, not a replacement operating system.** Builds on the existing Android Home launcher without changing its storage key, widget bindings, Home model or established MEK-AI art.

## New experience

- **Lock screen preview:** live clock, date, companion artwork, notification count, swipe/tap-to-enter interaction. It is explicitly NOT the secure Android lock screen and does not request, store or validate a PIN.
- **MEK-AI shade / Quick Settings preview:** swipe down from the launcher top edge or tap SYSTEM in the status header. Expand tiles, adjust **app-window-only brightness**, open Android Wi-Fi/Bluetooth/airplane/Focus/Display controls, and attempt the hardware flashlight. Actual OS status/notification shade still exists.
- **Notification inbox:** optional Android notification-listener permission, on-device listing of actual active notifications, opening content intents and requesting cancellation. No permission = explanatory empty state. Android maintains actual notification delivery, access and security.
- **MEK-AI Settings:** search, appearance, clock, privacy, reduced motion, prototype navigation, connectivity, launcher personalization links, access management, and explanations of OS restrictions. Settings saved under `mek_system_v7`, separate from existing `mek_launcher_v5` Home layout.
- **Prototype navigation:** configurable gesture-bar appearance / three-button controls, Back/Home/Recents screen demo, all scoped inside MEK-AI. Physical Android Back still navigates correctly.
- **MEK-AI visual system:** amber or moss accents, dark graphite, weathered industrial materials, original `mek.webp` and `workshop.webp` artwork, responsive panels.

## Try it on Appetize.io

Upload the GitHub Actions debug APK using Appetize's Android APK uploader. Choose Android 12+ with a supported device profile. Tap **◈ SYSTEM** in MEK-AI's top status header, or swipe down from the Home top edge. The panel's lock symbol opens the preview lock screen; the gear opens Settings. Grant Android notification access only if you want notifications in MEK-AI. For a real launcher test, choose MEK-AI as the Home app if the simulator supports Home role switching.

**Testing limits:** A cloud Android emulator may have no flashlight, installed third-party widget providers, or real incoming notifications. Quick Settings tiles which Android restricts intentionally open the platform settings screen. Do not mistake visual prototypes for security controls. Do not use the simulated lock screen to protect sensitive information.

## Validation

CI runs Node/jsdom tests including System Experience interactions, release metadata/security validation, and Android SDK 36 Gradle compilation. These do not verify real Samsung hardware behavior. v0.7.0 Android versionCode 17, minimum Android API 31, targeting API 36.

**Signing / upgrade caution:** Unless the repository owner supplies the same persistent debug keystore secret `MEK_DEBUG_KEYSTORE_B64`, Actions test APKs use ephemeral keys. An APK signed with another key cannot update your currently installed copy. Export your existing launcher layout before uninstalling or migrating. Reinstalling may require adding third-party Android widgets again. Keep Samsung One UI Home available as the fallback.

---

# MEK-AI Mobile v0.6.4 — Native widget rendering and folder labels

**Experimental Android beta.** This repair responds to native third-party widgets whose touch targets work but whose visual content sometimes remains blank on v0.6.3. All existing Home layout data and native widget IDs are retained.

## Fixes

- **Safe provider drawing:** Retires v0.6.3's direct native `AppWidgetHostView` translation animation, which could expose real Android provider surfaces to temporary off-screen coordinates or incomplete drawing states. The WebView pages still animate normally.
- **Stable restoration:** When an adjacent page contains native widgets, hide the host surfaces without destroying their measured `RemoteViews` layout, then restore the actual on-screen coordinates after the 240 ms CSS transition. Fast repeated swipes cancel stale pending restoration, and folders/sheets/edit mode remain above native touch surfaces.
- **Per-provider repaint:** Restored widgets reset their host alpha and request a new layout/draw without allocating new widget IDs or changing provider bindings.
- **Folder names:** Long app labels now stay within their own folder grid cell, wrap to at most two lines, and truncate rather than overlap the next app.

## Validation

CI runs Node/jsdom regression tests, Android API/release checks and an Android SDK 36 APK build. The tests include multiple native widgets on one page, rapid swipes and sheets opened mid-transition.

**Real-phone check required:** A browser simulator cannot validate actual third-party Android provider pixels or provider-specific rendering bugs. This version prioritizes visible/reliable widgets over animating the native widget surfaces themselves. Third-party widgets may appear after the page-slide completes, not travel with the icons.

**APK signing:** Without an owner-provisioned `MEK_DEBUG_KEYSTORE_B64` secret, GitHub builds a temporary-key APK that **cannot update** an already installed differently signed build. Export your layout and keep Samsung One UI Home as your fallback before changing installed versions.

---

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
