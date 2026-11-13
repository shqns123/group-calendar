"""Usage: uv run --no-project --with "pillow>=12" python scripts/make_icons.py assets

Rebuild the PWA calendar icon (public/icon-512.png) as crisp layers for the Expo app.

Geometry and colors were sampled from icon-512.png; everything below is in that 512 design space
and drawn 4x supersampled, then scaled down.
"""
import os, sys
from PIL import Image, ImageDraw

OUT = sys.argv[1]
SS = 4  # supersampling

BG_FROM = (0x2E, 0x5C, 0xEA)
BG_TO = (0x55, 0x86, 0xFA)
HEADER = (0xFF, 0x6B, 0x5E)
BODY_TOP = (0xF7, 0xF9, 0xFF)
BODY_BOT = (0xEA, 0xF0, 0xFF)
CELL = (0xD1, 0xDC, 0xFB)
SEL = (0x29, 0x57, 0xE8)
WHITE = (255, 255, 255)

# Design space (512): calendar body, header band, rings, 3x3 grid.
BODY = (92, 108, 420, 425)
# Top corners are wide ovals, bottom corners round (as in the PWA icon).
TOP_RX, TOP_RY = 72, 42
BOTTOM_R = 70
HEADER_BOTTOM = 190
RINGS = [(163, 86), (347, 86)]
RING_R = 22
STEM_W = 11
STEM_BOTTOM = 146
CELLS = [(x, y) for y in (236, 299, 362) for x in (144, 207, 270)]
CELL_SIZE = 46
CELL_R = 11
SEL_INDEX = 4


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def diagonal_gradient(size, c0, c1):
    """Top-left → bottom-right gradient."""
    w, h = size
    small = Image.new("RGB", (64, 64))
    px = small.load()
    for y in range(64):
        for x in range(64):
            px[x, y] = lerp(c0, c1, (x + y) / 126)
    return small.resize(size, Image.BICUBIC)


def vertical_gradient(size, c0, c1):
    w, h = size
    small = Image.new("RGB", (1, 64))
    for y in range(64):
        small.putpixel((0, y), lerp(c0, c1, y / 63))
    return small.resize(size, Image.BICUBIC)


def calendar(canvas, scale, ox, oy, mono=False):
    """Draw the calendar onto an RGBA canvas (already supersampled) at design→px `scale`, offset (ox, oy)."""
    S = lambda v: v * scale
    X = lambda v: ox + v * scale
    Y = lambda v: oy + v * scale
    W, H = canvas.size
    x0, y0, x1, y1 = X(BODY[0]), Y(BODY[1]), X(BODY[2]), Y(BODY[3])

    # Body (rounded) with the vertical wash; header band clipped to the body's rounded top.
    body_mask = Image.new("L", (W, H), 0)
    bm = ImageDraw.Draw(body_mask)
    rx, ry, rb = S(TOP_RX), S(TOP_RY), S(BOTTOM_R)
    bm.rectangle((x0 + rx, y0, x1 - rx, y0 + ry), fill=255)
    bm.rectangle((x0, y0 + ry, x1, y1 - rb), fill=255)
    bm.rectangle((x0 + rb, y1 - rb, x1 - rb, y1), fill=255)
    bm.ellipse((x0, y0, x0 + 2 * rx, y0 + 2 * ry), fill=255)
    bm.ellipse((x1 - 2 * rx, y0, x1, y0 + 2 * ry), fill=255)
    bm.ellipse((x0, y1 - 2 * rb, x0 + 2 * rb, y1), fill=255)
    bm.ellipse((x1 - 2 * rb, y1 - 2 * rb, x1, y1), fill=255)
    if mono:
        canvas.paste(WHITE + (255,), (0, 0), body_mask)
    else:
        fill = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        g = diagonal_gradient((int(x1 - x0), int(y1 - y0)), BODY_TOP, BODY_BOT)
        fill.paste(g, (int(x0), int(y0)))
        canvas.paste(fill, (0, 0), body_mask)
        head_mask = Image.new("L", (W, H), 0)
        ImageDraw.Draw(head_mask).rectangle((x0, y0, x1, Y(HEADER_BOTTOM)), fill=255)
        head_mask = Image.composite(head_mask, Image.new("L", (W, H), 0), body_mask)
        canvas.paste(HEADER + (255,), (0, 0), head_mask)

    d = ImageDraw.Draw(canvas)
    # Grid: cells (mono: punched out so the silhouette keeps its detail).
    for i, (cx, cy) in enumerate(CELLS):
        box = (X(cx), Y(cy), X(cx + CELL_SIZE), Y(cy + CELL_SIZE))
        if mono:
            d.rounded_rectangle(box, radius=S(CELL_R), fill=(0, 0, 0, 0))
        else:
            d.rounded_rectangle(box, radius=S(CELL_R), fill=(SEL if i == SEL_INDEX else CELL) + (255,))
    if mono:
        # Mono: header/body seam as a gap line.
        d.rectangle((x0, Y(HEADER_BOTTOM) - S(5), x1, Y(HEADER_BOTTOM) + S(5)), fill=(0, 0, 0, 0))

    # Rings: round head + stem.
    for rx, ry in RINGS:
        d.rounded_rectangle((X(rx) - S(STEM_W / 2), Y(ry), X(rx) + S(STEM_W / 2), Y(STEM_BOTTOM)), radius=S(STEM_W / 2), fill=WHITE + (255,))
        d.ellipse((X(rx) - S(RING_R), Y(ry) - S(RING_R), X(rx) + S(RING_R), Y(ry) + S(RING_R)), fill=WHITE + (255,))


def render(size, *, background=True, rounded=False, cal_scale=1.0, mono=False, foreground=True):
    big = size * SS
    canvas = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    if background:
        bg = diagonal_gradient((big, big), BG_FROM, BG_TO).convert("RGBA")
        if rounded:
            m = Image.new("L", (big, big), 0)
            ImageDraw.Draw(m).rounded_rectangle((0, 0, big - 1, big - 1), radius=big * 120 / 512, fill=255)
            canvas.paste(bg, (0, 0), m)
        else:
            canvas = bg
    if foreground:
        # The 512 design is centered; cal_scale shrinks it into the adaptive-icon safe area.
        scale = big / 512 * cal_scale
        off = (big - 512 * scale) / 2
        calendar(canvas, scale, off, off, mono=mono)
    return canvas.resize((size, size), Image.LANCZOS)


os.makedirs(OUT, exist_ok=True)
# iOS / legacy icon: full-bleed square (the OS applies its own mask).
render(1024).convert("RGB").save(os.path.join(OUT, "icon.png"))
# Android adaptive icon (108dp canvas; the visible part is the middle 72dp = 2/3).
render(1024, foreground=False).convert("RGB").save(os.path.join(OUT, "android-icon-background.png"))
render(1024, background=False, cal_scale=2 / 3).save(os.path.join(OUT, "android-icon-foreground.png"))
render(1024, background=False, cal_scale=2 / 3, mono=True).save(os.path.join(OUT, "android-icon-monochrome.png"))
# Web favicon: same rounded square as the PWA.
render(48, rounded=True).save(os.path.join(OUT, "favicon.png"))
# Side-by-side check against the PWA original.
# (preview of the full icon, not used by the app)
# render(512, rounded=True).save(os.path.join(OUT, "_check_512.png"))
print("ok")
