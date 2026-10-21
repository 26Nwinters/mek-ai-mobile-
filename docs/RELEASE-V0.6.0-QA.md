# MEK-AI Mobile v0.6.0 — Independent release-candidate QA

**Reviewed:** October 21, 2026  
**Source:** `integrated-oneui-v0.6` (commit `aa7bb245dcc57cc8b62e53a52dba0c0190d9beec`)  
**Platform:** Android 12+, target SDK 36  
**Release class:** Experimental / beta. Native Galaxy S10+ acceptance is still needed before declaring production stability.

## Stage-by-stage checks

| Stage | Verification | Outcome |
| --- | --- | --- |
| 1. Home, app drawer, dock, folders, gestures | CI model/jsdom tests; 160-app mobile Chromium smoke; per-page hydration; vertical/horizontal mode; selection and folder creation; rollback and overlap checks | Passed in test environment |
| 2. Native widgets | Android SDK 36 compilation; source invariant tests; simulated widget catalog/selection, provider sizing, saved-ID reconciliation | Passed in test environment |
| 3. MEK-AI built-in widgets | Real approved artwork in APK; stack add/switch/restore; settings for tint/opacity/expression; widget customization sheet | Passed in test environment |
| 4. Performance and release infrastructure | 1300 seeded model operations; JS syntax; self-contained artwork; APK content integrity; Android CI build; version consistency | Passed in test environment |

## Automated results

- GitHub Actions `39678267263` on the development branch: **60 passed, 0 failed**, Android SDK 36 **BUILD SUCCESSFUL**.
- Headless Chromium at 390×844 with a simulated Android bridge: **16 independent scenarios passed, 0 failed**, no uncaught JavaScript exceptions.
- Deterministic 1300-operation stress loop: **passed** with no duplicate or overlapping Home items and no altered state after unsuccessful atomic movements.
- Source JavaScript syntax: **all asset scripts parse**.
- Candidate APK: **341,424 bytes**, `classes.dex`, Android manifest, 3 v0.6 modules, `mek.webp`, and `workshop.webp` verified.
- All checks were run on the integrated development branch before promoting it to `main`.

## What automation cannot verify

The following require a physical Android device and **are NOT considered passed or completed**:

- Galaxy S10+ system-level Home, Back, gesture navigation, status-bar/cutout behavior and keyboard.
- Third-party native `AppWidgetHostView` touch controls, cross-app binding consent, provider configuration flows, genuine size updates and real lifecycle cleanup.
- Real device frame rate, input latency, icon decode timing, memory footprint and battery usage under sustained usage.
- Landscape and display-density variations on real phones.
- Live third-party weather/music or hardware smart-home control (these remain shortcut surfaces, not claimed integrations).
- Native third-party widget stacks (only built-in MEK-AI stacks are implemented).
- In-place signed upgrades: `MEK_DEBUG_KEYSTORE_B64` is not configured. Test builds are signed with ephemeral debug keys and must not be presented as upgrades.

## Decision

Automated build and UI QA meets the criteria for **publishing an explicitly experimental v0.6.0 test/beta APK**. It does **not** meet the criteria for a production-stable release or Google Play distribution. Retain Samsung One UI Home as a fallback. Export saved layout before replacing versions signed with different keys.

Post-promotion verification: require another successful GitHub Actions run from the main branch and inspect the packaged APK contents again.
