# MEK-AI Mobile v0.5.3 — Galaxy-like app organization and performance update

This release responds to real Galaxy S10+ testing of the v0.5 launcher.

- **Five-slot dock** by default; migrates an existing v0.5 four-slot dock by appending an empty slot and preserving all four favorites.
- **Fast real app icons:** Android decodes 68px WebP icons off the UI thread and returns batches of up to 12 in one bridge call. JavaScript waits for tiles to be attached before requesting images, caches successfully decoded icons, prioritizes visible Home/drawer pages, and retries failures rather than caching missing icons forever. App discovery on resume is throttled.
- **App-library organization:** New Folder and Select controls inside the drawer. Select multiple installed apps and create a drawer folder, add them to an existing drawer folder, or pin them all to Home. Folders persist, open, rename, accept new apps and can be dissolved without uninstalling applications.
- **One-app drag behavior:** A stationary long-press opens app actions with Select Multiple and Android App Settings. A held icon only starts moving after your finger moves; drop inside the drawer to reorder one icon, drop onto another icon to make a folder, or drag upward toward Home to pin it there.
- **Widgets scale independently:** Drag the lower-right resize handle while editing, or choose width and height in grid cells in the Resize sheet. Neighboring Home icons relocate safely as a widget grows. Both built-in and native Android widgets can be resized, with responsive layouts for narrow/short widgets.
- All actions have Node model and jsdom simulated phone regression tests before the Android APK is compiled.

**Important:** This update is an experimental Android launcher, not replacement firmware. Real Galaxy S10+ touch and rendering performance still require validation. Keep Samsung One UI Home installed. Prior debug-signed builds may be incompatible for in-place updates unless the same signing keystore was used; export your v0.5 layout before uninstalling.

---

# MEK-AI Mobile v0.5.2 — Android launcher rebuild and default Home restoration

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
