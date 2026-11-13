"""Status-bar notification icon: the monochrome launcher glyph, cropped to its shape.

Android draws notification icons from the alpha channel only (white on transparent), and the
adaptive monochrome icon carries a wide safe-zone margin that would make it tiny in the status
bar, so this trims the margin and re-pads it lightly.

    uv run --no-project --with "pillow>=12" python -I scripts/make_notification_icon.py
"""

from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / "assets"
SIZE = 96

src = Image.open(ASSETS / "android-icon-monochrome.png").convert("RGBA")
alpha = src.getchannel("A")
box = alpha.getbbox()
if box is None:
    raise SystemExit("monochrome icon is empty")
shape = alpha.crop(box)
side = round(max(shape.size) * 1.12)
canvas = Image.new("L", (side, side), 0)
canvas.paste(shape, ((side - shape.width) // 2, (side - shape.height) // 2))
canvas = canvas.resize((SIZE, SIZE), Image.LANCZOS)

white = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 255))
white.putalpha(canvas)
white.save(ASSETS / "notification-icon.png")
print("wrote", ASSETS / "notification-icon.png", box)
