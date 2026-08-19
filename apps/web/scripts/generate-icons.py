#!/usr/bin/env python3
"""Generate the Akavish app icons.

Writes, into apps/web/src/app/ (where Next.js App Router picks them up
automatically and injects the matching <link> tags):

    favicon.ico     multi-resolution: 16/32/48/64/128/256
    icon.png        512x512, the generic app icon
    apple-icon.png  180x180, iOS home screen

Usage (from the repo root):

    python3 apps/web/scripts/generate-icons.py

Requires Pillow:  pip install Pillow

The mark is drawn from polygons rather than a font, so the shape doesn't depend
on which fonts a machine happens to have. (Encoded bytes can still differ across
Pillow versions — that's fine, the committed files are the reference.)

Colours mirror the site: zinc-950 background, near-white letter, emerald accent
(see apps/web/src/components/Wordmark.tsx and the OG image).
"""

from pathlib import Path

from PIL import Image, ImageDraw

BG = (9, 9, 11, 255)  # zinc-950, the site background
FG = (250, 250, 250, 255)  # near-white, the wordmark colour
ACCENT = (16, 185, 129, 255)  # emerald-500, the brand accent

# apps/web/src/app, resolved relative to this file so the script works from
# any working directory.
OUT_DIR = Path(__file__).resolve().parent.parent / "src" / "app"

SUPERSAMPLE = 8


def draw(size: int) -> Image.Image:
    """Render the icon at `size` px, antialiased via supersampling."""
    s = size * SUPERSAMPLE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=BG)

    thickness = int(s * 0.115)
    top, bottom = s * 0.20, s * 0.80
    cx, spread = s / 2, s * 0.21

    # The two legs of the "A".
    d.line([(cx - spread, bottom), (cx, top)], fill=FG, width=thickness)
    d.line([(cx, top), (cx + spread, bottom)], fill=FG, width=thickness)

    # Crossbar, in the accent colour.
    y = s * 0.60
    d.line(
        [(cx - spread * 0.52, y), (cx + spread * 0.52, y)],
        fill=ACCENT,
        width=int(thickness * 0.85),
    )

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Save the .ico from the LARGEST render and let Pillow downscale. Building it
    # from a small base upscales instead, and every size comes out blurry.
    draw(256).save(
        OUT_DIR / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    draw(512).save(OUT_DIR / "icon.png", format="PNG")
    draw(180).save(OUT_DIR / "apple-icon.png", format="PNG")

    print(f"Wrote favicon.ico, icon.png and apple-icon.png to {OUT_DIR}")


if __name__ == "__main__":
    main()
