"""
make_icons.py
-----------------------------------------------------------------------------
Generates the app icons in /icons (a shaded basketball on a dark background).
Pure Python, no extra libraries needed. Run it from the project folder:

    python3 tools/make_icons.py

You only need to run this again if you change the icon design.
"""
import math
import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "icons")
SIZES = [180, 192, 512]
SUPERSAMPLE = 3  # samples per pixel edge, for smooth anti-aliased edges

BG_TOP = (28, 38, 86)
BG_BOTTOM = (7, 11, 24)
BALL = (242, 113, 28)
SEAM = (45, 20, 6)
BALL_RADIUS = 0.36  # fraction of icon size (fits inside Android's "maskable" safe zone)
SEAM_WIDTH = 0.045


def normalize(v):
    length = math.sqrt(sum(c * c for c in v))
    return tuple(c / length for c in v)


def rotate_x(v, a):
    x, y, z = v
    return (x, y * math.cos(a) - z * math.sin(a), y * math.sin(a) + z * math.cos(a))


def rotate_y(v, a):
    x, y, z = v
    return (x * math.cos(a) + z * math.sin(a), y, -x * math.sin(a) + z * math.cos(a))


# Seams in the ball's own coordinates (z points toward the viewer)
GREAT_CIRCLES = [(1, 0, 0), (0, 1, 0)]  # plane normals: vertical + horizontal seams
# Curved seams loop around the left/right "poles". Their distance from the pole
# changes around the loop, which gives the classic ( | ) basketball look.
CURVE_ANGLE = 0.95
CURVE_BEND = 0.3
LIGHT = normalize((-0.5, 0.6, 0.8))


def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def sample(u, v):
    """Color at a point; u, v are -1..1 across the icon (v points down)."""
    bg = mix(BG_TOP, BG_BOTTOM, (v + 1) / 2)
    # Warm glow behind the ball
    d = math.sqrt(u * u + v * v)
    glow = max(0.0, 1 - d / 1.1) ** 2 * 0.55
    bg = mix(bg, (255, 110, 40), glow)

    bu, bv = u / (BALL_RADIUS * 2), v / (BALL_RADIUS * 2)
    r2 = bu * bu + bv * bv
    if r2 > 1:
        return bg

    # Point on the sphere facing us
    n = (bu, -bv, math.sqrt(1 - r2))

    # Lighting: diffuse + a small shiny highlight
    diffuse = max(0.0, sum(n[i] * LIGHT[i] for i in range(3)))
    color = tuple(c * (0.38 + 0.75 * diffuse) for c in BALL)
    spec = max(0.0, diffuse) ** 24 * 70
    color = tuple(c + spec for c in color)

    # Rotate into the ball's own coordinates to test for seams
    q = rotate_x(rotate_y(n, -0.45), 0.35)
    on_seam = any(abs(sum(q[i] * c[i] for i in range(3))) < SEAM_WIDTH for c in GREAT_CIRCLES)
    for side in (1, -1):
        from_pole = math.acos(max(-1.0, min(1.0, side * q[0])))
        t = math.atan2(q[2], q[1])
        if abs(from_pole - (CURVE_ANGLE + CURVE_BEND * math.cos(2 * t))) < SEAM_WIDTH:
            on_seam = True
    if on_seam:
        color = mix(color, SEAM, 0.9)

    # Anti-aliased dark rim around the ball edge
    edge = math.sqrt(r2)
    if edge > 0.97:
        color = mix(color, (60, 25, 8), (edge - 0.97) / 0.03)
    return color


def render(size):
    rows = []
    step = 1 / SUPERSAMPLE
    for py in range(size):
        row = bytearray([0])  # PNG filter byte
        for px in range(size):
            acc = [0.0, 0.0, 0.0]
            for sy in range(SUPERSAMPLE):
                for sx in range(SUPERSAMPLE):
                    u = ((px + (sx + 0.5) * step) / size) * 2 - 1
                    v = ((py + (sy + 0.5) * step) / size) * 2 - 1
                    c = sample(u, v)
                    acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]
            n = SUPERSAMPLE * SUPERSAMPLE
            row += bytes(max(0, min(255, int(a / n))) for a in acc)
        rows.append(bytes(row))
    return b"".join(rows)


def write_png(path, size, raw):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit RGB
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", header))
        f.write(chunk(b"IDAT", zlib.compress(raw, 9)))
        f.write(chunk(b"IEND", b""))


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    for s in SIZES:
        path = os.path.join(OUT_DIR, f"icon-{s}.png")
        write_png(path, s, render(s))
        print("wrote", os.path.normpath(path))
