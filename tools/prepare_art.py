"""Build-time conversion of the artwork already approved in the main MEK-AI repository.
Only the public repo is used. No image-generation step or user secrets required.
"""
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen, Request
from PIL import Image, ImageOps
from io import BytesIO

DEST = Path("app/src/main/assets")
DEST.mkdir(parents=True, exist_ok=True)
BASE = "https://raw.githubusercontent.com/26Nwinters/mek-ai/main/ASSETS/"

def convert(source, output, width, height=None):
    url = BASE + quote(source)
    request = Request(url, headers={"User-Agent":"MEK-AI-Mobile-build/0.1"})
    with urlopen(request, timeout=45) as response:
        image = Image.open(BytesIO(response.read())).convert("RGBA")
    if height is None:
        image.thumbnail((width, width), Image.Resampling.LANCZOS)
    else:
        image = ImageOps.fit(image, (width, height), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    image.save(DEST / output, "WEBP", quality=83, method=5)
    print("Prepared", output)

convert("Sunlit Overgrown Industrial Workshop.png", "workshop.webp", 1080, 1920)
convert("Curious Amber-Eyed Hooded Android.png", "mek.webp", 640)
