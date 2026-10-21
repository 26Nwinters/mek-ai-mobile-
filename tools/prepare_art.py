"""Verify the approved MEK-AI artwork vendored in this repository.

The source checkout must contain its own real assets. No GitHub downloads,
image conversion, Pillow dependency, or network access is used at build time.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app" / "src" / "main" / "assets"

def verify(filename: str) -> None:
    path = ASSETS / filename
    if not path.is_file():
        raise SystemExit(f"Missing committed artwork: {path}. Restore it from Git history.")
    data = path.read_bytes()
    if len(data) < 10_000 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise SystemExit(f"Invalid WEBP artwork: {path}")
    print(f"Verified bundled artwork: {filename} ({len(data)} bytes)")

if __name__ == "__main__":
    verify("mek.webp")
    verify("workshop.webp")
