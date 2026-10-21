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
print("Release metadata, Android API policy and widget contract verified:", VERSION)
