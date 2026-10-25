"""Reject version drift and unsafe release metadata in CI."""
from pathlib import Path
import json
import re
import subprocess

ROOT=Path(__file__).resolve().parents[1]
VERSION=json.loads((ROOT/"package.json").read_text())["version"]
gradle=(ROOT/"app/build.gradle.kts").read_text()
workflow=(ROOT/".github/workflows/android.yml").read_text()
readme=(ROOT/"README.md").read_text()
manifest=(ROOT/"app/src/main/AndroidManifest.xml").read_text()
java=(ROOT/"app/src/main/java/com/mekai/mobile/MainActivity.java").read_text()
assert f'versionName = "{VERSION}"' in gradle, "Gradle/package.json version mismatch"
assert f'MEK-AI-Mobile-v{VERSION}' in workflow, "CI artifact version mismatch"
assert readme.startswith(f"# MEK-AI Mobile v{VERSION}"), "README version mismatch"
assert re.search(r'compileSdk\s*=\s*36\b',gradle), "Android SDK 36 required"
assert re.search(r'targetSdk\s*=\s*36\b',gradle), "Play-compatible API 36 target required"
assert 'setAllowFileAccess(false)' in java, "WebView filesystem access must be disabled"
assert 'bindAppWidgetIdIfAllowed' in java and 'ACTION_APPWIDGET_BIND' in java, "Widget bind fallback required"
assert 'widgetHost.deleteAppWidgetId' in java and 'stage.removeView' in java, "Widget lifecycle cleanup required"
assert 'syncWidgetInventory' in java, "Widget inventory reconciliation required"
assert 'file:///android_asset/index.html' in java, "Keep previous localStorage origin for existing users"
assert 'prepare_art.py' in workflow, "Bundled image integrity step required"
assert 'MEK_SIGNING_KEYSTORE_B64' in workflow and 'MEK_SIGNING_PASSWORD' in workflow, "Permanent signing secrets required"
assert 'assembleRelease' in workflow and 'PERMANENT-SIGNED-UPGRADE' in workflow, "Only signed release APKs may be distributed as updates"
assert 'apk-release.apk' not in workflow, "Use actual Android Gradle app-release.apk path"
assert 'MEK_SIGNING_KEYSTORE_PATH' in gradle and 'mekaiPermanent' in gradle, "Dedicated release key missing"
assert 'MEK_DEBUG_KEYSTORE_B64' not in workflow, "Do not fallback to disposable debug certificate on release"
assert 'E44DBA69D602BD2AC79411B2D0828CF5E7A5B16B5525B72D33681B520CC71914' in workflow, "Signing identity must be pinned"
assert 'versionCode = 20' in gradle, "v0.7.3 must increase Android versionCode for in-place upgrades"
print("Release metadata, Android API policy and widget contract verified:", VERSION)
