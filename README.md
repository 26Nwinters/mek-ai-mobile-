# MEK-AI Mobile v0.4.0 — swipeable home pages and Samsung-style grids

This is a genuine Android Home launcher (not a firmware replacement), designed for the Galaxy S10+ and Android 12.

## Phone behavior

- **No permanent bottom navigation buttons.** A small page-dot indicator shows MEK-AI, your Home pages, House, and Setup.
- **Swipe right** from the first Home page to MEK-AI, or **swipe left** for the next customizable Home page; swiping left beyond your last Home page leads to House and Setup.
- **Swipe up from the Home screen** for the app drawer, then **swipe left or right** to switch app pages. Swipe down to close it. This uses real touch events on Android, instead of only a small edge hotspot.
- Hold the Home screen to enable jiggle/edit mode, then add widgets, apps, folders or another home page.
- App shortcuts added from the edit-mode picker are saved, displayed on the correct Home page, and show a confirmation.
- **Separate grid settings:** default Home **4×6**, Apps **5×6**, and Folders **4×4**, with independent adjustable rows and columns. Widgets occupy multiple grid cells.
- Folders can be created, renamed, filled with real installed apps and opened. Long-press an app in a folder to remove it.
- Your existing v0.3 home tiles, tasks, wallpaper setting, and theme are migrated where possible. The old redundant “All apps” home tile is removed.

## Installation

Download the v0.4.0 APK from [GitHub Actions](https://github.com/26Nwinters/mek-ai-mobile-/actions/workflows/android.yml) or the attachment in ChatGPT. This remains an alpha: test on your S10+ while keeping Samsung One UI Home available under **Settings → Apps → Choose default apps → Home app**.

**Caution:** APKs built on the GitHub-hosted debug signing key may require uninstalling the previous alpha before installing a new one. This deletes the older alpha's locally stored data. Do not uninstall One UI Home. Persistently signing future builds requires a private key stored securely, not inside this public repository.

## Verification

GitHub Actions runs the Node tests for physical grid packing, page swipes, folders, pinning apps, settings, and tab switching, then compiles the native APK. That does not substitute for touch testing on a physical Samsung device.

---

# MEK-AI Mobile v0.3.0 — gesture-based app archive

The editable overgrown industrial launcher now follows the Android/Samsung-style interaction shown in the user's October 21 screen recording.

## What changed

- **Swipe up from the small handle just above the bottom dock** (or tap it) to open the installed-app drawer. You can also swipe upward from the bottom portion of the home screen.
- **Swipe horizontally in the drawer** to move through full-screen icon pages, five columns and up to five rows per page (four rows on short screens). Dots display your current page; tap a dot to jump.
- **Swipe down in the drawer or tap the down chevron** to return home. Android's Back navigation also returns home.
- The Apps **navigation tab is removed**; Home, MEK-AI, Control, and Setup remain accessible.
- The searchable drawer and home-grid **pin app** workflow continue to work. Enter edit mode → Apps → choose an installed app; it becomes a home tile.
- App icons now load asynchronously via a worker-side Android bridge, in addition to the earlier asynchronous app enumeration. Only the current and adjacent app pages are rendered, limiting memory pressure.

## Status and installation

**This is still an experimental launcher, not an Android ROM.** Build and UI smoke tests can pass without guaranteeing it is stable on a physical Galaxy S10+. Test app launching, horizontal page swipes, and returning Home while keeping Samsung One UI Home installed.

Install the APK from [GitHub Actions](https://github.com/26Nwinters/mek-ai-mobile-/actions/workflows/android.yml). Android's Home app selection is under **Settings → Apps → Choose default apps → Home app**.

**Development-build signing warning:** GitHub Action debug APKs are signed with ephemeral debug keys. If Android refuses to update v0.2.1, uninstall the older version, then install v0.3.0. Uninstalling clears MEK-AI's locally stored tiles, notes, tasks, and settings. Please don't remove Samsung's stock launcher.

---

# MEK-AI Mobile // Your Overgrown Android Home

**v0.2.1: editable launcher alpha, designed for the Galaxy S10+ (Android 12).**

A real, non-root Android **home launcher** that keeps MEK-AI's forest-green, weathered workshop personality while providing a phone-like customizable tile grid. It replaces your **home screen**, not Android firmware, notification shade, or lock screen.

## Installation

1. Download the [tested v0.2.1 APK from the successful GitHub Actions build](https://github.com/26Nwinters/mek-ai-mobile-/actions/runs/39629821014), under Artifacts, or use the direct APK provided in the ChatGPT conversation.
2. Install it on Android 12+, allowing *Install unknown apps* for your browser or file manager only when prompted.
3. If Android reports **App not installed** when updating v0.1.1, first uninstall the previous MEK-AI development build. **Warning: this clears its saved local tasks, notes, and preferences.** The CI debug signing key is not stable between workflow runs.
4. Choose **MEK-AI Mobile** under **Settings → Apps → Choose default apps → Home app**.
5. **One UI Home** stays installed. You can return to it using the same Android Home app setting whenever you wish.

## Rearrange your home screen

- **Long-press** an empty space or any tile (~0.6 seconds): widgets enter jiggle/edit mode.
- Tap **+ WIDGETS** to insert clock, battery, weather shortcut, MEK-AI companion, tasks, music shortcut, or workshop note.
- Tap **APPS** to select an installed Android app to pin to the grid.
- Tap **GRID** to change between **3 and 6 columns**, or use **Workshop Settings → Home Screen Grid**.
- Grab the **⠿ handle** at the top-right of a tile and drag over another tile to reorder. Use **×** to remove a tile. Press **DONE** to leave edit mode.
- Choose **Overgrown**, **Amber Industrial**, or **Moss Night** as a color theme. Toggle textured wallpaper and animations in Workshop Settings.

Your layout, column count, tasks, workshop note, and theme are saved locally to the launcher.

## Stability improvements in v0.2.1

Previously the App Archive requested and converted every installed app icon in **one synchronous JavaScript-to-Android call**. This could block the WebView when switching tabs.

Now:

- Android discovers apps on a background thread.
- The App Archive paints in small batches rather than creating every app item in one frame.
- App icons are fetched lazily when visible and cached in memory.
- Navigation does not repeatedly rescan installed apps when switching screens.
- The five-tab launcher interface, duplicate live widgets, and layout operations are covered by automated tests.

**These changes passed simulated UI smoke tests and the GitHub Android APK build. Actual stability on your Galaxy S10+ still needs real-device verification.**

## What's functional

- Android Home role and native installed-app launching.
- Five pages: customizable Home, searchable App Archive, MEK-AI Companion, Control Room, and Workshop Settings.
- Live dot-matrix clock, actual Android battery status, local tasks, personal note.
- Persisted customizable home grid, themes, reduce-motion setting.
- Android settings shortcuts and access to existing MEK-AI web companion.

## Not yet implemented

- Third-party **Android App Widgets** (the + Widgets chooser currently adds the launcher’s **built-in modules**).
- Multi-home-screen swiping, custom Samsung lock screen/notification shade, or replacing Android system settings.
- Integrated on-device voice wake-word, live weather API, Android alarm notifications, or direct Tapo device control.
- App data migration between CI debug-signed APKs.

The Tapo controller in the original MEK-AI app runs on a separate machine. This mobile launcher does not claim to control lights unless a secure reachable controller connection is configured.

## Development

Tech: Java activity / Android WebView + local HTML/CSS/JS, Android 12+, AGP 8.7.3, Java 17, Gradle 8.9.

- `app/src/main/java/com/mekai/mobile/MainActivity.java` — Home role, native shortcuts, background app discovery, lazy icon bridge.
- `app/src/main/assets/index.html` — five launcher screens, editor overlay, app picker.
- `app/src/main/assets/mobile.css` — responsive grid, editing, jiggle animation, industrial theme.
- `app/src/main/assets/mobile.js` — app lifecycle, editing gestures, app list, tasks, saved preferences.
- `app/src/main/assets/layout-core.js` — validated tile model, reordering, column/span rules.
- `tests/` — unit tests plus jsdom smoke tests of tabs, editing and app pinning.
- `tools/prepare_art.py` — optimizes the approved original MEK-AI artwork into WebP at build time.
- `.github/workflows/android.yml` — remote tests, Android compilation and APK artifact.

From a dev environment: `npm install && npm test`. GitHub Actions runs those checks and compiles the APK, so an Android Studio install on the Chromebook isn't necessary.
