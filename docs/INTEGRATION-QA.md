# MEK-AI v0.6.0 integration test and acceptance record

This document distinguishes code implementation, automated verification, and physical-device acceptance. Tests passed on CI do **not** imply that physical Samsung Galaxy behavior has been independently verified.

## Stage 1: Android desktop, dock, library, gestures
- Independent horizontal Home pages and five-slot dock retained
- Home edit lock, default page, separate grid preferences and wallpaper controls
- Separate app drawer with custom horizontal pages or optional vertical flow
- Folder creation, selection, shortcuts, color, and drag-to-reorder
- Atomic Home drag rollback on failed placement; grid overlap tests
- Page rendering virtualized around current page

**Automated acceptance:** Node model tests plus jsdom Home/drawer/dock/folder gesture tests; Android APK compilation.

## Stage 2: Native Android widgets
- Android provider enumeration and label/size metadata
- App-grouped native widget picker with lazy preview generation
- AppWidgetHostView and widget binding permission fallback
- Native provider configuration and reconfiguration
- Provider-defined min/max resize dimensions and resize directions
- AppWidgetHostView.updateAppWidgetSize for responsive RemoteViews
- Widget ID inventory, undo grace, orphan cleanup and process restart reconciliation

**Automated acceptance:** Java compilation, source invariants and simulated native bridge/size/backup callbacks.
**Physical validation still required:** different provider-specific widgets, complex scrolling/gesture regions, configuration permission flows, device orientation changes.

## Stage 3: MEK-AI identity and internal widgets
- Approved amber robot and workshop assets committed into the same repository
- Built-in widgets: AI companion, clock, battery, notes, local tasks and shortcut panels
- Per-widget expression/tint/opacity and minimal clock
- Built-in widget stacks, swipe-to-switch, reorder, remove and collapse
- Display tuning, dock appearance and reduced-motion mode

**Automated acceptance:** jsdom and model tests for stacks, configuration persistence, widget resize and interactions.
**Limitation:** Native third-party AppWidget stacks are not yet supported, pending dedicated native gesture hosting.

## Stage 4: Performance, Android compatibility, security and release
- Home page DOM virtualization, batched visible app icons, icon cache and deferred discovery
- Atomic action rollback and backup/restore normalization
- WebView restrictions, original localStorage origin and updated SDK target
- Source artwork self-contained; build version consistency checks
- GitHub Actions signed-test classification, avoiding false claims of upgrade compatibility

**Automated acceptance:** source and integration tests, Java/Android build and APK contents check.
**Physical validation still required:** sustained real device frame rate, cold/warm start duration, battery drain, widget lifecycle under repeated app/system restarts.

## Explicit deferred integrations
- Smart-home hardware widgets require access to connected MEK-AI controller and live state.
- Actual third-party widget stacks (native gesture forwarding).
- Music player controls and third-party weather live values require source permissions/integrations.
- Private signing credentials must be configured by the repository owner.
- Samsung Galaxy S10+ physical acceptance cannot occur through GitHub Actions alone.

The release must not be described as completely production-stable until the physical acceptance checklist is completed.
