#!/usr/bin/env python3
"""
Shalev Font Builder
====================
Converts SVG glyph files exported from Figma into OTF and WOFF2 font files.

Usage:
    pip install fonttools brotli
    python build_shalev_font.py <svg_input_dir> <output_dir>

Expected input structure:
    svg_input_dir/
        Thin/alef.svg, bet.svg, gimel.svg, ...
        Light/alef.svg, ...
        Regular/alef.svg, ...
        Medium/alef.svg, ...
        SemiBold/alef.svg, ...
        Bold/alef.svg, ...

Glyph SVG file names must match the glyph names exactly (e.g. alef.svg, bet.svg).
Each SVG should contain filled paths (not stroked). Use Figma's "Outline Stroke"
on any stroked paths before exporting.

Output:
    output_dir/
        Shalev-Thin.otf + .woff2
        Shalev-Light.otf + .woff2
        Shalev-Regular.otf + .woff2
        Shalev-Medium.otf + .woff2
        Shalev-SemiBold.otf + .woff2
        Shalev-Bold.otf + .woff2
"""

import os
import sys
import re
from pathlib import Path
from xml.etree import ElementTree as ET
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.misc.psCharStrings import T2CharString

# ============================================================
# Font Configuration
# ============================================================

FONT_FAMILY = "FuzionFirst"
FONT_VERSION = "Version 1.000"
UPM = 1000
ASCENDER = 1000   # lamed reaches ~970
DESCENDER = -300  # descending finals reach ~-270
LINE_GAP = 100

# Standard glyph height in Figma design (px)
DESIGN_HEIGHT = 130.0

# Target height in font units for standard glyphs
TARGET_HEIGHT = 700.0

# Default sidebearing (padding around glyph) in font units
SIDEBEARING = 50

# Uniform scale factor: all glyphs use this
SCALE = TARGET_HEIGHT / DESIGN_HEIGHT  # ~5.385

# Vertical positioning categories
# ---------------------------------------------------------------
# 1. BASELINE glyphs (default): bottom at y=0, top at ~700
#    Most Hebrew letters, numbers, finalmem, symbols
#
# 2. RAISED glyphs: top aligned with letter tops (700), floating above baseline
#    yod — small letter that hangs from the top
RAISED_GLYPHS = {'yod'}
RAISED_TOP_Y = 700.0  # top of glyph aligns here

# 3. DESCENDING glyphs: top at letter height (700), bottom extends below baseline
#    finalnun, finalpe, finalkaf, finaltsadi — design height 180px
#    Top 130px aligns with regular letters (700 units), bottom 50px descends
DESCENDING_GLYPHS = {'finalnun', 'finalpe', 'finalkaf', 'finaltsadi', 'qof'}
DESCENDER_DESIGN_TOP = 130.0  # the top portion that aligns with regular letters

# 4. ASCENDING glyphs: bottom at baseline, extends above 700
#    lamed — design height 180px, sits on baseline, top goes above
ASCENDING_GLYPHS = {'lamed'}

# 5. MID-HEIGHT symbols: centered vertically
MID_HEIGHT_GLYPHS = {
    'hyphen', 'equal', 'plus', 'asterisk', 'underscore2',
}
MID_HEIGHT_CENTER_Y = 300  # font units — roughly mid x-height

# ============================================================
# Glyph Name -> Unicode Codepoint Mapping
# ============================================================

GLYPH_TO_UNICODE = {
    # Hebrew letters
    'alef': 0x05D0, 'bet': 0x05D1, 'gimel': 0x05D2,
    'dalet': 0x05D3, 'he': 0x05D4, 'vav': 0x05D5,
    'zayin': 0x05D6, 'het': 0x05D7, 'tet': 0x05D8,
    'yod': 0x05D9, 'finalkaf': 0x05DA, 'kaf': 0x05DB,
    'lamed': 0x05DC, 'finalmem': 0x05DD, 'mem': 0x05DE,
    'finalnun': 0x05DF, 'nun': 0x05E0, 'samekh': 0x05E1,
    'ayin': 0x05E2, 'finalpe': 0x05E3, 'pe': 0x05E4,
    'finaltsadi': 0x05E5, 'tsadi': 0x05E6, 'qof': 0x05E7,
    'resh': 0x05E8, 'shin': 0x05E9, 'tav': 0x05EA,
    # Numbers
    'zero': 0x0030, 'one': 0x0031, 'two': 0x0032,
    'three': 0x0033, 'four': 0x0034, 'five': 0x0035,
    'six': 0x0036, 'seven': 0x0037, 'eight': 0x0038,
    'nine': 0x0039,
    # Punctuation & symbols
    'period': 0x002E, 'colon': 0x003A, 'semicolon': 0x003B,
    'question': 0x003F, 'exclam': 0x0021, 'hyphen': 0x002D,
    'equal': 0x003D, 'plus': 0x002B, 'asterisk': 0x002A,
    'dollar': 0x0024, 'percent': 0x0025, 'ampersand': 0x0026,
    'numbersign': 0x0023, 'quotesingle': 0x0027, 'quotedbl': 0x0022,
    'parenleft': 0x0028, 'parenright': 0x0029,
    'bracketleft': 0x005B, 'bracketright': 0x005D,
    'slash': 0x002F, 'backslash': 0x005C, 'underscore': 0x005F,
    'sheqel': 0x20AA, 'euro': 0x20AC,
    'space': 0x0020,
}

# Alternate file names that map to the same glyph
FILENAME_ALIASES = {
    'quotesingle-1': 'quotesingle_alt',  # will be skipped (duplicate)
    'underscore2': 'underscore2',         # em-dash or secondary underscore
}
# underscore2 -> map to emdash
GLYPH_TO_UNICODE['underscore2'] = 0x2014  # em-dash

# Weight configuration
WEIGHTS = {
    'Thin':     {'os2_weight': 100, 'mac_style': 0},
    'Light':    {'os2_weight': 300, 'mac_style': 0},
    'Regular':  {'os2_weight': 400, 'mac_style': 0},
    'Medium':   {'os2_weight': 500, 'mac_style': 0},
    'SemiBold': {'os2_weight': 600, 'mac_style': 0},
    'Bold':     {'os2_weight': 700, 'mac_style': 1},
}

# ============================================================
# SVG Path Tokenizer & Parser
# ============================================================

def tokenize_svg_path(d):
    """Tokenize SVG path d attribute into commands and numbers."""
    return re.findall(
        r'[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?',
        d
    )


def parse_svg_path(d):
    """
    Parse SVG path d attribute into normalized absolute commands.
    Returns list of ('M'|'L'|'C'|'Z', [args...]) tuples.
    All coordinates are absolute. Q/S/H/V/relative commands are resolved.
    """
    tokens = tokenize_svg_path(d)
    result = []

    x, y = 0.0, 0.0      # current point
    sx, sy = 0.0, 0.0     # subpath start
    last_cp = None         # last control point for S/s/T/t
    cmd = None
    i = 0

    # Number of numeric args per command
    ARG_COUNT = {
        'M': 2, 'm': 2, 'L': 2, 'l': 2,
        'H': 1, 'h': 1, 'V': 1, 'v': 1,
        'C': 6, 'c': 6, 'S': 4, 's': 4,
        'Q': 4, 'q': 4, 'T': 2, 't': 2,
        'A': 7, 'a': 7, 'Z': 0, 'z': 0,
    }

    while i < len(tokens):
        tok = tokens[i]

        # New command letter
        if tok.isalpha():
            cmd = tok
            i += 1
            if cmd in ('Z', 'z'):
                result.append(('Z', []))
                x, y = sx, sy
                last_cp = None
                continue
        elif cmd is None:
            i += 1
            continue

        # Implicit repeat: after M -> L, after m -> l
        repeat_cmd = cmd
        if cmd == 'M' and len(result) > 0 and result[-1][0] == 'M':
            repeat_cmd = 'L'
        elif cmd == 'm' and len(result) > 0:
            repeat_cmd = 'l'

        # Read arguments
        n = ARG_COUNT.get(repeat_cmd if repeat_cmd != cmd else cmd, 0)
        if n == 0:
            continue

        args = []
        for _ in range(n):
            if i < len(tokens) and not tokens[i].isalpha():
                args.append(float(tokens[i]))
                i += 1
            else:
                break

        if len(args) < n:
            break

        c = repeat_cmd if (repeat_cmd != cmd and repeat_cmd in ('L', 'l')) else cmd

        # Process command
        if c == 'M':
            x, y = args[0], args[1]
            sx, sy = x, y
            result.append(('M', [x, y]))
            last_cp = None
        elif c == 'm':
            x += args[0]; y += args[1]
            sx, sy = x, y
            result.append(('M', [x, y]))
            last_cp = None
        elif c == 'L':
            x, y = args[0], args[1]
            result.append(('L', [x, y]))
            last_cp = None
        elif c == 'l':
            x += args[0]; y += args[1]
            result.append(('L', [x, y]))
            last_cp = None
        elif c == 'H':
            x = args[0]
            result.append(('L', [x, y]))
            last_cp = None
        elif c == 'h':
            x += args[0]
            result.append(('L', [x, y]))
            last_cp = None
        elif c == 'V':
            y = args[0]
            result.append(('L', [x, y]))
            last_cp = None
        elif c == 'v':
            y += args[0]
            result.append(('L', [x, y]))
            last_cp = None
        elif c == 'C':
            result.append(('C', list(args)))
            last_cp = (args[2], args[3])
            x, y = args[4], args[5]
        elif c == 'c':
            x1 = x + args[0]; y1 = y + args[1]
            x2 = x + args[2]; y2 = y + args[3]
            nx = x + args[4]; ny = y + args[5]
            result.append(('C', [x1, y1, x2, y2, nx, ny]))
            last_cp = (x2, y2)
            x, y = nx, ny
        elif c == 'S':
            if last_cp:
                x1 = 2 * x - last_cp[0]; y1 = 2 * y - last_cp[1]
            else:
                x1, y1 = x, y
            x2, y2 = args[0], args[1]
            nx, ny = args[2], args[3]
            result.append(('C', [x1, y1, x2, y2, nx, ny]))
            last_cp = (x2, y2)
            x, y = nx, ny
        elif c == 's':
            if last_cp:
                x1 = 2 * x - last_cp[0]; y1 = 2 * y - last_cp[1]
            else:
                x1, y1 = x, y
            x2 = x + args[0]; y2 = y + args[1]
            nx = x + args[2]; ny = y + args[3]
            result.append(('C', [x1, y1, x2, y2, nx, ny]))
            last_cp = (x2, y2)
            x, y = nx, ny
        elif c == 'Q':
            # Convert quadratic bezier to cubic
            qx, qy = args[0], args[1]
            ex, ey = args[2], args[3]
            cx1 = x + 2.0/3.0 * (qx - x)
            cy1 = y + 2.0/3.0 * (qy - y)
            cx2 = ex + 2.0/3.0 * (qx - ex)
            cy2 = ey + 2.0/3.0 * (qy - ey)
            result.append(('C', [cx1, cy1, cx2, cy2, ex, ey]))
            last_cp = (qx, qy)
            x, y = ex, ey
        elif c == 'q':
            qx = x + args[0]; qy = y + args[1]
            ex = x + args[2]; ey = y + args[3]
            cx1 = x + 2.0/3.0 * (qx - x)
            cy1 = y + 2.0/3.0 * (qy - y)
            cx2 = ex + 2.0/3.0 * (qx - ex)
            cy2 = ey + 2.0/3.0 * (qy - ey)
            result.append(('C', [cx1, cy1, cx2, cy2, ex, ey]))
            last_cp = (qx, qy)
            x, y = ex, ey
        elif c == 'T':
            if last_cp:
                qx = 2 * x - last_cp[0]; qy = 2 * y - last_cp[1]
            else:
                qx, qy = x, y
            ex, ey = args[0], args[1]
            cx1 = x + 2.0/3.0 * (qx - x)
            cy1 = y + 2.0/3.0 * (qy - y)
            cx2 = ex + 2.0/3.0 * (qx - ex)
            cy2 = ey + 2.0/3.0 * (qy - ey)
            result.append(('C', [cx1, cy1, cx2, cy2, ex, ey]))
            last_cp = (qx, qy)
            x, y = ex, ey
        elif c == 't':
            if last_cp:
                qx = 2 * x - last_cp[0]; qy = 2 * y - last_cp[1]
            else:
                qx, qy = x, y
            ex = x + args[0]; ey = y + args[1]
            cx1 = x + 2.0/3.0 * (qx - x)
            cy1 = y + 2.0/3.0 * (qy - y)
            cx2 = ex + 2.0/3.0 * (qx - ex)
            cy2 = ey + 2.0/3.0 * (qy - ey)
            result.append(('C', [cx1, cy1, cx2, cy2, ex, ey]))
            last_cp = (qx, qy)
            x, y = ex, ey
        elif c in ('A', 'a'):
            # Arc: approximate with line (arcs are rare in font glyphs)
            if c == 'A':
                x, y = args[5], args[6]
            else:
                x += args[5]; y += args[6]
            result.append(('L', [x, y]))
            last_cp = None

    return result


# ============================================================
# SVG File Reader
# ============================================================

def get_svg_dimensions(root):
    """Extract width and height from SVG element."""
    ns = 'http://www.w3.org/2000/svg'

    # Try viewBox first
    vb = root.get('viewBox')
    if vb:
        parts = vb.replace(',', ' ').split()
        if len(parts) == 4:
            return float(parts[2]), float(parts[3])

    # Fall back to width/height attributes
    w = root.get('width', '100')
    h = root.get('height', '100')
    # Strip units (px, pt, etc.)
    w = re.sub(r'[^0-9.]', '', w) or '100'
    h = re.sub(r'[^0-9.]', '', h) or '100'
    return float(w), float(h)


def collect_svg_paths(element, ns='http://www.w3.org/2000/svg'):
    """Recursively collect all path 'd' attributes from SVG element."""
    paths = []
    tag = element.tag.replace(f'{{{ns}}}', '') if ns in element.tag else element.tag

    if tag == 'path':
        d = element.get('d', '')
        fill = element.get('fill', '')
        stroke = element.get('stroke', '')
        if d and (fill or not stroke):
            # Only collect filled paths (not stroke-only)
            paths.append(d)
        elif d and stroke and not fill:
            print(f"  [!] Skipping stroked path (convert to outline in Figma)")

    # Recurse into children
    for child in element:
        paths.extend(collect_svg_paths(child, ns))

    return paths


def read_svg_glyph(svg_file):
    """
    Read an SVG file and return:
    - list of normalized path commands
    - svg_width, svg_height
    """
    tree = ET.parse(svg_file)
    root = tree.getroot()

    # Handle namespace
    ns = ''
    if root.tag.startswith('{'):
        ns = root.tag.split('}')[0] + '}'

    svg_w, svg_h = get_svg_dimensions(root)
    d_strings = collect_svg_paths(root, ns.strip('{}'))

    all_commands = []
    for d in d_strings:
        cmds = parse_svg_path(d)
        all_commands.extend(cmds)

    return all_commands, svg_w, svg_h


# ============================================================
# Path to CFF CharString Converter
# ============================================================

def compute_path_bounds(commands):
    """Compute bounding box of normalized path commands."""
    xs, ys = [], []
    for cmd, args in commands:
        if cmd == 'M':
            xs.append(args[0]); ys.append(args[1])
        elif cmd == 'L':
            xs.append(args[0]); ys.append(args[1])
        elif cmd == 'C':
            # Include control points for rough bounds
            xs.extend([args[0], args[2], args[4]])
            ys.extend([args[1], args[3], args[5]])

    if not xs:
        return 0, 0, 0, 0
    return min(xs), min(ys), max(xs), max(ys)


def commands_to_t2_program(commands, scale, svg_h, offset_x=0, offset_y=0):
    """
    Convert normalized SVG path commands to T2 charstring program.

    Transforms: SVG space -> Font space
    - Scale by `scale`
    - Flip Y axis (SVG y-down -> font y-up)
    - Apply offsets
    """
    program = []
    cx, cy = 0.0, 0.0  # current point in font space (for computing deltas)
    in_path = False

    def to_font(svg_x, svg_y):
        fx = svg_x * scale + offset_x
        fy = (svg_h - svg_y) * scale + offset_y
        return fx, fy

    for cmd, args in commands:
        if cmd == 'M':
            if in_path:
                # Implicit close before new moveto
                pass
            fx, fy = to_font(args[0], args[1])
            dx = round(fx - cx)
            dy = round(fy - cy)
            program.extend([dx, dy, 'rmoveto'])
            cx, cy = cx + dx, cy + dy
            in_path = True

        elif cmd == 'L':
            fx, fy = to_font(args[0], args[1])
            dx = round(fx - cx)
            dy = round(fy - cy)
            if dx == 0 and dy == 0:
                continue
            program.extend([dx, dy, 'rlineto'])
            cx, cy = cx + dx, cy + dy

        elif cmd == 'C':
            fx1, fy1 = to_font(args[0], args[1])
            fx2, fy2 = to_font(args[2], args[3])
            fx3, fy3 = to_font(args[4], args[5])
            dx1 = round(fx1 - cx);    dy1 = round(fy1 - cy)
            dx2 = round(fx2 - (cx + dx1)); dy2 = round(fy2 - (cy + dy1))
            dx3 = round(fx3 - (cx + dx1 + dx2)); dy3 = round(fy3 - (cy + dy1 + dy2))
            program.extend([dx1, dy1, dx2, dy2, dx3, dy3, 'rrcurveto'])
            cx = cx + dx1 + dx2 + dx3
            cy = cy + dy1 + dy2 + dy3

        elif cmd == 'Z':
            # CFF paths are implicitly closed when next rmoveto or endchar
            in_path = False

    return program


def build_charstring(commands, svg_w, svg_h, advance_width, glyph_name=''):
    """
    Build a T2CharString from SVG path commands.
    Uses uniform SCALE for all glyphs (based on DESIGN_HEIGHT).
    """
    scale = SCALE

    # Compute bounds
    min_x, min_y, max_x, max_y = compute_path_bounds(commands)

    # Offset X: left sidebearing, shift so glyph min_x starts at SIDEBEARING
    offset_x = SIDEBEARING - min_x * scale

    # Offset Y: flip Y (SVG y-down → font y-up) and position
    # After flip: font_y = (svg_h - svg_y) * scale + offset_y
    #
    # Default (baseline): glyph bottom (max_y in SVG) at font y=0
    #   offset_y = -(svg_h - max_y) * scale
    offset_y = -(svg_h - max_y) * scale

    if glyph_name in DESCENDING_GLYPHS:
        # Top of glyph aligns with regular letter tops (TARGET_HEIGHT=700)
        # In SVG: min_y is the top. After flip: (svg_h - min_y) * scale + offset_y = TARGET_HEIGHT
        # offset_y = TARGET_HEIGHT - (svg_h - min_y) * scale
        offset_y = TARGET_HEIGHT - (svg_h - min_y) * scale

    elif glyph_name in RAISED_GLYPHS:
        # Top of glyph aligns with letter tops (700), bottom floats above baseline
        # (svg_h - min_y) * scale + offset_y = RAISED_TOP_Y
        offset_y = RAISED_TOP_Y - (svg_h - min_y) * scale

    elif glyph_name in ASCENDING_GLYPHS:
        # Bottom at baseline (y=0) — default offset is correct
        # Lamed naturally extends above 700 due to its 180px height
        pass

    elif glyph_name in MID_HEIGHT_GLYPHS:
        # Center vertically around MID_HEIGHT_CENTER_Y
        glyph_h_font = (max_y - min_y) * scale
        offset_y += MID_HEIGHT_CENTER_Y - glyph_h_font / 2

    program = commands_to_t2_program(commands, scale, svg_h, offset_x, offset_y)
    program.append('endchar')

    # Prepend width (delta from defaultWidthX=0)
    full_program = [advance_width] + program

    cs = T2CharString()
    cs.program = full_program
    return cs


# ============================================================
# Font Builder
# ============================================================

def build_font_for_weight(weight_name, svg_dir, output_dir):
    """Build OTF and WOFF2 for a single weight."""
    weight_dir = Path(svg_dir) / weight_name
    if not weight_dir.exists():
        print(f"  [!] Directory not found: {weight_dir}")
        return False

    print(f"\n--- Building {FONT_FAMILY}-{weight_name} ---")

    # Discover available glyph SVGs
    glyph_names = []
    cmap = {}
    charstrings = {}
    hmtx = {}

    # Always include .notdef and space
    notdef_cs = T2CharString()
    notdef_cs.program = [500, 'endchar']
    charstrings['.notdef'] = notdef_cs
    hmtx['.notdef'] = (500, 0)

    space_cs = T2CharString()
    space_cs.program = [250, 'endchar']
    charstrings['space'] = space_cs
    hmtx['space'] = (250, 0)
    cmap[0x0020] = 'space'

    # Process each SVG file
    svg_files = sorted(weight_dir.glob('*.svg'))
    for svg_file in svg_files:
        glyph_name = svg_file.stem.lower()

        if glyph_name not in GLYPH_TO_UNICODE:
            print(f"  [?] Unknown glyph name: {glyph_name} (skipping)")
            continue

        try:
            commands, svg_w, svg_h = read_svg_glyph(svg_file)
        except Exception as e:
            print(f"  [!] Error reading {svg_file}: {e}")
            continue

        if not commands:
            print(f"  [!] No paths found in {svg_file}")
            continue

        # Compute advance width using uniform scale
        min_x, _, max_x, _ = compute_path_bounds(commands)
        glyph_w = (max_x - min_x) * SCALE
        advance_width = int(round(glyph_w + SIDEBEARING * 2))

        # Build charstring
        try:
            cs = build_charstring(commands, svg_w, svg_h, advance_width, glyph_name)
            charstrings[glyph_name] = cs
            hmtx[glyph_name] = (advance_width, SIDEBEARING)
            cmap[GLYPH_TO_UNICODE[glyph_name]] = glyph_name
            glyph_names.append(glyph_name)
            print(f"  [+] {glyph_name} ({svg_file.name}) -> width={advance_width}")
        except Exception as e:
            print(f"  [!] Error building {glyph_name}: {e}")
            continue

    if not glyph_names:
        print(f"  [!] No glyphs found for {weight_name}")
        return False

    # Build glyph order
    glyph_order = ['.notdef', 'space'] + sorted(glyph_names)

    # Create font
    weight_cfg = WEIGHTS.get(weight_name, {'os2_weight': 400, 'mac_style': 0})
    full_name = f"{FONT_FAMILY}-{weight_name}"

    fb = FontBuilder(UPM, isTTF=False)
    fb.setupGlyphOrder(glyph_order)
    fb.setupCharacterMap(cmap)

    fb.setupCFF(
        psName=full_name,
        fontInfo={
            "version": FONT_VERSION,
        },
        charStringsDict=charstrings,
        privateDict={
            "defaultWidthX": 0,
            "nominalWidthX": 0,
        },
    )

    fb.setupHorizontalMetrics(hmtx)

    fb.setupHorizontalHeader(
        ascent=ASCENDER,
        descent=DESCENDER,
    )

    fb.setupNameTable({
        "familyName": FONT_FAMILY,
        "styleName": weight_name,
    })

    fb.setupOS2(
        sTypoAscender=ASCENDER,
        sTypoDescender=DESCENDER,
        sTypoLineGap=LINE_GAP,
        usWinAscent=ASCENDER,
        usWinDescent=abs(DESCENDER),
        usWeightClass=weight_cfg['os2_weight'],
        fsType=0,  # Installable embedding
    )

    fb.setupPost()

    # Save OTF
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    otf_path = output_dir / f"{full_name}.otf"
    fb.font.save(str(otf_path))
    print(f"  [OK] Saved: {otf_path}")

    return True


# ============================================================
# CSS @font-face Generator
# ============================================================

def generate_css(output_dir):
    """Generate CSS @font-face declarations."""
    output_dir = Path(output_dir)
    css_lines = []

    for weight_name, cfg in WEIGHTS.items():
        woff2_file = f"{FONT_FAMILY}-{weight_name}.woff2"
        otf_file = f"{FONT_FAMILY}-{weight_name}.otf"

        if (output_dir / woff2_file).exists() or (output_dir / otf_file).exists():
            css_lines.append(f"""@font-face {{
  font-family: '{FONT_FAMILY}';
  src: url('/fonts/{woff2_file}') format('woff2'),
       url('/fonts/{otf_file}') format('opentype');
  font-weight: {cfg['os2_weight']};
  font-style: normal;
  font-display: swap;
}}""")

    css_path = output_dir / f"{FONT_FAMILY.lower()}.css"
    css_path.write_text('\n\n'.join(css_lines))
    print(f"\n[OK] CSS saved: {css_path}")


# ============================================================
# Main
# ============================================================

def main():
    if len(sys.argv) < 3:
        print(__doc__)
        print("\nExample:")
        print(f"  python {sys.argv[0]} ./shalev-svg ./shalev-fonts")
        sys.exit(1)

    input_dir = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])

    if not input_dir.exists():
        print(f"Error: Input directory not found: {input_dir}")
        sys.exit(1)

    print(f"Input:  {input_dir}")
    print(f"Output: {output_dir}")

    built = 0
    for weight_name in WEIGHTS:
        if build_font_for_weight(weight_name, input_dir, output_dir):
            built += 1

    if built > 0:
        generate_css(output_dir)
        print(f"\n{'='*50}")
        print(f"Done! Built {built} font weights.")
        print(f"Files saved to: {output_dir}")
        print(f"\nNext steps:")
        print(f"  1. Copy .woff2 files to your website's /fonts/ directory")
        print(f"  2. Include {FONT_FAMILY.lower()}.css in your HTML")
        print(f"  3. Use: font-family: '{FONT_FAMILY}';")
    else:
        print("\n[!] No fonts were built. Check your directory structure.")
        print(f"Expected: {input_dir}/<WeightName>/<glyphname>.svg")


if __name__ == '__main__':
    main()
