# MEK-AI Mobile v0.5.4

An experimental Android 12+ **Home launcher**, built around the original MEK-AI character and the overgrown industrial workshop aesthetic. This is not replacement Android firmware.

## Launcher capabilities

- Swipe between fully customizable Home pages with a persistent five-app dock.
- Swipe up for the 5×6 horizontal app drawer, swipe down to close it.
- Organize installed apps into drawer folders, select several at once, and move icons individually.
- Home grid defaults to 4×6. Folder grid defaults to 4×4. Each is independently adjustable.
- Hold and drag icons between pages and into the dock. Hold without moving for actions.
- Add, reposition, and freely scale MEK-AI widgets and experimental native third-party Android widgets.
- MEK-AI character and companion, smart-home link, clock, battery, notes and task widgets.
- Customize themes, icons, wallpaper, labels and dock appearance.
- Back up and restore the JSON Home layout from launcher settings.

## v0.5.4: Lifecycle, build, and security hardening

The previous build had several infrastructure defects. This release addresses them:

1. **Native AppWidgetHost cleanup:** The launcher now sends Android the complete set of widget IDs present across *all* Home pages. When a widget is removed, the host removes its `AppWidgetHostView` and calls `deleteAppWidgetId` after a 20-second undo grace window. Inventory reconciliation also catches orphaned IDs after a launcher restart. Widgets on other pages are hidden, not deleted.
2. **Widget permission handling:** When a chosen provider is not yet bound, MEK-AI calls `bindAppWidgetIdIfAllowed` and falls back to system `ACTION_APPWIDGET_BIND` consent. Configurable providers use Android's host configuration flow. Cancelling the picker, consent screen or configuration releases the provisional ID.
3. **Self-contained original artwork:** Both approved files, `app/src/main/assets/mek.webp` and `workshop.webp`, are committed to this repository. `tools/prepare_art.py` verifies the local files only. Building no longer reads the separate MEK-AI repository, needs Pillow, or depends on internet-hosted artwork.
4. **Synchronized versions:** Gradle, `package.json`, CI artifact names and this README agree on v0.5.4; `tools/check_release.py` rejects drift.
5. **WebView filesystem hardening:** Explicitly disables filesystem access, content provider access, universal file access, mixed HTTP content and external navigation. Only packaged `file:///android_asset/` resources load. **The existing origin is intentionally retained** so upgrading will not silently discard layouts stored by older MEK-AI builds. Android's own documentation confirms that `setAllowFileAccess(false)` does not block special packaged `android_asset` resources. A future transition to `WebViewAssetLoader` requires an explicit, tested storage migration.
6. **Play target API:** Upgraded Gradle/Android tooling to compile and target **Android 16 / API 36**, as required for new Google Play phone-app submissions from August 31, 2026. This does **not** mean Play Store approval or Android 16 device compatibility has been validated. The Activity includes modern system-bar inset handling and predictive-back callback handling.
7. **Signing honesty:** CI labels whether an APK was signed with a persistent key or a one-time key. A missing `MEK_DEBUG_KEYSTORE_B64` secret generates a **TEMPORARY-KEY-test-only** artifact, explicitly not an install-in-place upgrade. It must not be marketed as one.

### Configure persistent signing for future development APKs

GitHub Actions hosted runners do not retain `~/.android/debug.keystore` between runs. One private, persistent keystore is needed for future in-place updates.

Generate it **on a trusted computer you control** (requires Java/JDK installed):

```bash
mkdir -p ~/.android
keytool -genkeypair \
  -keystore ~/.android/mek-ai-debug.keystore \
  -alias androiddebugkey \
  -keyalg RSA -keysize 3072 -validity 10000 \
  -storepass android -keypass android \
  -dname "CN=MEK-AI Development,O=MarrowVeil Studios,C=US"
base64 -w 0 ~/.android/mek-ai-debug.keystore > ~/.android/mek-ai-debug.keystore.b64
```

Then open the repository's **Settings → Secrets and variables → Actions → New repository secret**. Create `MEK_DEBUG_KEYSTORE_B64` and paste the complete base64 text from the `.b64` file into the **GitHub secret field**, never into chat, an issue or a commit. Keep the original binary keystore backed up securely. CI will restore it as the standard Android debug keystore; the workflow validates it before building.

**Important:** Setting a *new* stable key cannot make it match old debug APKs already signed with temporary keys. You may need to uninstall the old build **once**, then every future APK built with this same key can upgrade it in-place as long as package ID and signatures match. Export your existing layout before that uninstall. These development keys are not production Play Store keys. For public Play releases, use Play App Signing with a separate protected release signing key.

### Source and running tests

```bash
npm install --no-package-lock --ignore-scripts
npm test
python3 tools/prepare_art.py
python3 tools/check_release.py
gradle :app:assembleDebug
```

Requires Gradle 8.13, JDK 17 and Android SDK platform 36 for Android compilation. GitHub Actions provisions these and runs the entire test/build workflow.

Native integration: `app/src/main/java/com/mekai/mobile/MainActivity.java`. Home state and native-widget inventory: `app/src/main/assets/launcher-v5.js`; grid operations: `launcher-core.js`; UI: `launcher-v5-ui.js`.

### Important limitations

This is an alpha Android launcher. Third-party widget providers, gestures and performance still require on-device testing, especially on Android 15/16. Widget bindings use the Android system and cannot generally be transferred to a new installation by restoring a JSON backup; widgets may need to be added again. Voice activation, hardware lighting control, weather and music integration remain separate from this launcher. Keep Samsung One UI Home installed as a fallback. The user can switch Home apps through Android Settings.

## Policies and reference links

- [Android AppWidgetHost](https://developer.android.com/reference/android/appwidget/AppWidgetHost)
- [Android AppWidgetManager binding](https://developer.android.com/reference/android/appwidget/AppWidgetManager)
- [Android WebSettings file access](https://developer.android.com/reference/android/webkit/WebSettings)
- [Google Play API target policy](https://support.google.com/googleplay/android-developer/answer/11926878)
