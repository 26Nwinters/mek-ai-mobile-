# MEK-AI Mobile v0.6.0 — Beta release notes

**Release class:** Experimental beta / test APK (not production-stable or a Google Play submission).  
**Release date:** 2026-10-21  
**Commit:** `e1923e80fe3a19e04c78f0fcfd531d25eaaba305` (fully tested feature commit)

## Shipped

- Galaxy-inspired Home, horizontally paged Apps library, customizable five-position dock, folders, lockable layout and user-editable grids.
- One-UI-inspired hold menu and drag gestures, app library multi-select, icon caching, robust backup/restore.
- Third-party Android widget provider browser, preview requests, binding/consent and configuration, provider-aware resizing, and lifecycle inventory cleanup.
- Native widgets remain true `AppWidgetHostView` instances. Built-in MEK-AI widgets support size changes, expression/tint/opacity options and internal widget stacks.
- Independent Home page mounting, improved responsive UI, original local artwork, Android 16 target and security/build hardening.

## Release checks

- GitHub Actions on development branch: 61 tests passed, 0 failed, APK built successfully.
- Deterministic stress test: 1,300 Home and widget-grid operations without duplicate IDs, overlapping items or failed-drop state corruption.
- Headless Chromium: 16 end-to-end scenarios repeated at 360×780, 390×844 and 412×915. 48 scenario executions passed, 0 failed. Native services were simulated.
- Direct APK inspection: both approved WebP files and all v0.6 scripts bundled; ZIP integrity passed.
- Separate GitHub Actions build required and verified on `main` after promotion.

## Not yet validated / deferred

- Real Galaxy S10+ install/launch, Android navigation, widget interaction, consent and configuration, system bars, display rotation, sustained performance.
- Full native third-party widget stacks and integrations for live Tapo lighting, real weather/music: not shipped as finished services.
- Stable APK signature: GitHub Actions uses a new temporary debug key unless `MEK_DEBUG_KEYSTORE_B64` is configured in repository secrets; temporary-key builds **cannot upgrade earlier differently signed APKs**.

Retain Samsung One UI Home as a fallback, export any existing MEK-AI layout before uninstalling the old development APK, and test a backup restore after installing. Do not interpret successful simulated tests as device certification.
