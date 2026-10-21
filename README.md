# MEK-AI Mobile // The Overgrown Terminal

A **real, experimental Android 12+ home launcher** for the Galaxy S10+ (SM-G975U). It blends the MEK-AI Hideaway's existing character artwork and overgrown workshop aesthetic with a restrained dot-matrix interface.

**Android application ID:** `com.mekai.mobile`  
**First alpha:** `0.1.0`  
**Requires root:** No  
**Works offline:** Home screen, app drawer, clock, battery, saved tasks, preferences and Android shortcuts work without internet.

## What works now

- Selectable Android home launcher (or launch it as a normal app to test safely).
- Five native-hosted screens: Home, App Archive, MEK-AI companion, Control Room, Workshop Settings.
- Live dot-matrix clock, native battery reading and date.
- Searchable grid of the **real installed apps**, with their actual Android icons. Tapping launches the app.
- Shortcuts for phone dialer, messages, camera, music and system settings.
- Add, complete and remove local tasks. They persist in the app's private WebView storage.
- Turn atmospheric wallpaper and motion effects on/off.
- An on-device MEK-AI portrait built from the approved artwork in the original `mek-ai` repository.
- Launches the [existing web companion](https://26nwinters.github.io/mek-ai/) when you ask to speak with MEK-AI.

## What is deliberately **not** claimed yet

- This launcher does **not** replace the Samsung lock screen, status bar, notification shade or firmware.
- Voice recognition and Tapo switching are **not** native features in this first APK; the Companion button opens the existing web assistant.
- Control Room opens genuine Android settings screens; it does **not** falsely indicate that Wi-Fi, Bluetooth or Tapo devices have been switched.
- Weather is a shortcut to the forecast, not fake weather data.
- Tasks are local checklist items, not Android alarm/reminder notifications.

## Get the APK

1. Open the [latest Build MEK-AI Mobile APK workflow](https://github.com/26Nwinters/mek-ai-mobile-/actions/workflows/android.yml).
2. Open the newest **successful** workflow run.
3. Under **Artifacts**, download `MEK-AI-Mobile-v0.1.0-debug`.
4. Extract the ZIP and install `app-debug.apk` on your Galaxy S10+.
5. Grant your file manager/browser permission to install this APK if Android asks.
6. Open MEK-AI Mobile from your apps. **Keep One UI Home as your default until you approve this alpha.**

To try MEK-AI as the default later, open **Workshop Settings → Choose Default Launcher**, or Android Settings → Apps → Choose default apps → Home app. You can switch back to **One UI Home** at any time.

**Signing warning:** Automated alpha APKs currently use ephemeral GitHub-hosted debug keys. Updating to a *later workflow's build* may require uninstalling this alpha first (which clears locally saved tasks). Do not rely on seamless in-place updates until a persistent private release signing key has been configured. Never commit that private signing key to the public repository.

## Build details

- Native Android shell: Java / WebView.
- UI: local HTML, CSS and JavaScript packaged inside the APK, not loaded from a website.
- Android Gradle plugin 8.7.3, Gradle 8.9, Java 17, minSdk 31, targetSdk 32.
- GitHub Actions builds an APK remotely, so Android Studio and an emulator are not required on the Chromebook.
- The build downloads **only approved MEK-AI art from the owner's existing public asset repo** and converts it to optimized WebP. The art is bundled; it doesn't fetch at runtime.

## Security / privacy

No root, accessibility service, microphone permission, location permission, account credentials, or `QUERY_ALL_PACKAGES` permission is required. Android app discovery uses the scoped launcher intent query. The JavaScript bridge runs only against bundled local assets and opens pre-approved Android intents / URLs. All checklist items remain on-device.

## Source map

- `app/src/main/java/com/mekai/mobile/MainActivity.java` — Android launcher and permitted native interactions.
- `app/src/main/assets/index.html` — the five screens.
- `app/src/main/assets/mobile.css` — weathered/pixel visual identity.
- `app/src/main/assets/mobile.js` — navigation, checklist, actual app drawer and widgets.
- `tools/prepare_art.py` — reuses original approved robot/workshop illustrations.
- `.github/workflows/android.yml` — zero-local-Android-Studio APK build.
