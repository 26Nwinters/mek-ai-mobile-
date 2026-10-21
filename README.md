# MEK-AI Mobile v0.5.0 — Android launcher rebuild

**MEK-AI Mobile is a real Android HOME launcher, not a replacement ROM.** This experimental build targets Android 12+, including the Galaxy S10+. It uses original MEK-AI robot and overgrown workshop artwork.

## Normal phone behavior

- Swipe horizontally between **customizable Home pages**; no fixed assistant, Settings or House tabs mixed into them.
- **Permanent favorites dock**, independent of Home pages, with 3–5 adjustable slots, folder support, and draggable apps.
- **Swipe up** across Home to open the separate application drawer, **swipe down** to close it, swipe horizontally between app pages.
- Android-like grid defaults: **Home 4×6**, **Apps 5×6**, **Folders 4×4**, with separate configurable rows and columns.
- Long-press an icon to start editing; drag apps between Home, dock and folders. Long-press an installed app in the drawer to bring it onto Home.
- Long-press a blank Home area to enter **jiggle mode**. Add apps, widgets and pages, resize widgets, manage folders, choose default page, reorder and remove pages. Dragging near a page edge switches pages or creates a new one.
- MEK-AI companion, House Controls, and launcher Settings are regular app-drawer shortcuts and can be added wherever you prefer. The MEK-AI character is also a default large Home widget.

## Widgets and personalization

Built-in modules: MEK-AI, clock, live device battery, local checklist, notes, calendar, music shortcut, weather shortcut and house-control shortcut. These are not claims of real weather, music playback or Tapo hardware integration.

**Third-party Android App Widgets:** experimental native `AppWidgetHost` and Android provider picker support are included. Native widgets are positioned over the WebView grid. Compatibility depends on provider configuration and Android widget lifecycle, and still requires physical-device testing. Some widgets may not behave correctly.

Themes: Overgrown, Amber Industrial, Moss Night. Adjustable icon sizes, icon labels, wallpaper texture, motion, dock appearance and gestures. The app drawer supports alphabetical or personalized priority ordering and folders.

## Layout storage, backup and update signing

- Layouts, tasks and notes save locally and include a best-effort **migration from v0.4**.
- In **Settings → Backup & Restore**, export a JSON file with Android's document picker, or copy backup text; restore from an Android document or pasted JSON.
- **Back up BEFORE uninstalling an older development build.** The debug APK is signed using the GitHub Actions runner's temporary key unless you configure a stable key. Uninstalling the old build deletes its internal layout and tasks.
- Optional stable signing support is built into CI: generate a standard Android debug-style keystore locally and add its base64 contents to the GitHub Actions repository secret `MEK_DEBUG_KEYSTORE_B64`. Never commit keystores/passwords to the public repository. This helps only future builds signed with the *same* key; it cannot make a new signing key compatible with an older APK.
- Native third-party widget bindings generally **do not survive uninstall/reinstall**; they may need to be added again after restoring a layout.

## What remains experimental or external

- Actual Samsung/Android lock screen, status bar, notification shade and operating system settings aren't replaced.
- Connected MEK-AI voice mode, reminders, weather and Tapo hardware automation still depend on the separate existing companion/controller; the launcher isn't pretending they are connected.
- Android widget provider compatibility, custom drawer ordering, long-press drag gestures and full daily-use stability require a real Galaxy S10+ test.
- Importing external wallpaper/icon packs, system-level notification scheduling, and Android package uninstall UI remain future enhancements.

## Testing and build

The GitHub Actions workflow runs model and simulated phone tests with Node/jsdom before compiling the Android APK. These cover page/dock independence, settings, swipes, folders, app pinning, drag-to-Home, widget picker callbacks, migration, backup and native Home behavior. A successful workflow is **not** a guarantee of bug-free touch behavior on the actual phone.

Native integration: `app/src/main/java/com/mekai/mobile/MainActivity.java`

Web UI and data logic:
- `launcher-core.js` — persistent layout model with collision-safe grid placement
- `launcher-v5.js` — lifecycle, Android bridge, local backup, native widget position sync
- `launcher-v5-ui.js` — Home, dock, installed apps, folders, built-in widgets
- `launcher-v5-sheets.js` — customization and settings, grid previews
- `launcher-v5-gestures.js` — swipe, long-press, drag-and-drop
- `launcher-v5.css` — original workshop theme

Always keep **Samsung One UI Home installed** as a fallback. Change defaults at **Settings → Apps → Choose default apps → Home app**.
