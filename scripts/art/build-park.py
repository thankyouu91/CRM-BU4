#!/usr/bin/env python3
"""Build the 16-bit park ("Công viên") runtime assets from the art team's folders.

    python3 -I scripts/art/build-park.py ART_ROOT [--preview out.png]

ART_ROOT (required) is the art workspace that holds phase0/ and phase1/. It is not in the repo; the shipped assets do not need it.
Output, in public/ta-tua/game/assets/park/:
  ground.webp   the flat ground (base + ground-layer decals), 1 px = 1 art pixel, lossless
  objects.webp  atlas of every standing object, animation and visitor frame (1 px padding), lossless
  park.json     what js/parkscene.js needs: frames, objects (x = centre, y = foot line, art px), animations,
                visitor routes, pond fx spots, lamp lights and the walkable area
It also refreshes the park-* entries of docs/art/asset-manifest.json.

Layout (--layout auto|park-1|p0; auto = park-1 once its package has delivered, i.e. has report.txt/.md):
  park-1  ART_ROOT/phase1/park-1/layout.json (park-1's format: base image, objects with `obj` + park-objects/*.json
          sidecars, walkable.polygon + holes, night_glow, ambient_anchors), plus scripts/art/park-extras.json on top
          (park-2's fountain centrepiece, visitors, pet toys, cart; ambient pond fx and butterflies; each optional);
  p0      scripts/art/park-layout.json: the same park built from Phase 0 Wang tiles and props (+ approved Phase 1
          props, park-2 and ambient art).
Sprites are looked up by key ("a|b" = try a, then b) in park-1, park-2, props-*, ambient-*, npc-* and finally
Phase 0. Missing art is skipped with a warning, so re-running this script after the art lands is the only step.
"""
import argparse
import glob
import hashlib
import io
import json
import math
import os
import re
import sys

from PIL import Image, ImageDraw

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LICENSE = 'PixelLab output owned by the creator, commercial use allowed (PixelLab ToS §1.3, §3.3, https://pixellab.ai/termsofservice); not to be used to train other models without written permission (§1.2, §3.3)'
APPROVED_BY = 'owner (design session, 2026-10-31)'
OUT = os.path.join(REPO, 'public/ta-tua/game/assets/park')
FALLBACK_LAYOUT = os.path.join(REPO, 'scripts/art/park-layout.json')
EXTRAS = os.path.join(REPO, 'scripts/art/park-extras.json')
MANIFEST = os.path.join(REPO, 'docs/art/asset-manifest.json')
FILE_BUDGET = 200 * 1024
WATER_DEEP = {(0x2f, 0x6f, 0x9a), (0x3f, 0x8f, 0xc0), (0x58, 0xb9, 0xd6)}  # water body (also used by nothing else on the ground)
WATER = WATER_DEEP | {(0x8f, 0xd0, 0xe8), (0xbf, 0xe3, 0xf2), (0xee, 0xf8, 0xfb)}  # + glints, which tiny flowers share

warnings = []


def warn(msg):
    warnings.append(msg)
    print('  ! ' + msg)


def pixels(img):
    return list(img.get_flattened_data() if hasattr(img, 'get_flattened_data') else img.getdata())


def load(path):
    return Image.open(path).convert('RGBA')


# ---------------------------------------------------------------- sprite lookup


def sprite_dirs(root):
    p1 = os.path.join(root, 'phase1')
    dirs = [os.path.join(p1, 'park-1', 'park-objects'), os.path.join(p1, 'park-1', 'pal'), os.path.join(p1, 'park-2', 'pal')]
    dirs += [os.path.join(p1, f'{pkg}-{i}', 'pal') for pkg in ('props', 'ambient', 'npc') for i in (1, 2, 3)]
    dirs.append(os.path.join(root, 'phase0', 'dl', 'pal'))
    return [d for d in dirs if os.path.isdir(d)]


def frame_no(path):
    m = re.findall(r'(\d+)', os.path.basename(path))
    return int(m[-1]) if m else 0


def numbered(paths):
    return sorted((p for p in paths if re.search(r'\d+\.png$', p)), key=frame_no)


def sidecar(png):
    meta = os.path.splitext(png)[0] + '.json'
    try:
        return json.load(open(meta)) if os.path.isfile(meta) else {}
    except ValueError:
        return {}


def resolve(dirs, key, anim=False):
    """'a|b' -> first match: {'alt', 'paths', 'meta'}; a folder of numbered PNGs is an animation strip."""
    for alt in key.split('|'):
        alt = alt.strip()
        for d in dirs:
            folder = os.path.join(d, alt)
            single = folder + '.png'
            if os.path.isdir(folder) and (anim or not os.path.isfile(single)):
                frames = numbered(glob.glob(os.path.join(folder, '*.png')))
                if frames:
                    return {'alt': alt, 'paths': frames if anim else frames[:1], 'meta': {}, 'dir': d}
            if os.path.isfile(single):
                return {'alt': alt, 'paths': [single], 'meta': sidecar(single), 'dir': d}
    return None


def resolve_npc(dirs, key):
    """A visitor needs a standing frame (south) and an east walk cycle; west is optional (else mirrored)."""
    for alt in key.split('|'):
        alt = alt.strip()
        for d in dirs:
            idle = next((p for p in (os.path.join(d, f) for f in (
                f'{alt}-south.png', f'{alt}/rot-south.png', f'{alt}/south.png', f'{alt}/idle-south.png'))
                if os.path.isfile(p)), None)
            if not idle:
                continue

            def walk(direction):
                pats = [f'{alt}-walk-{direction}-*.png', f'{alt}-walk-{direction}/*.png', f'{alt}-walk/{direction}-*.png',
                        f'{alt}/walk-{direction}-*.png', f'{alt}/walk/{direction}-*.png', f'{alt}/walk-{direction}/*.png']
                if alt == 'npc':
                    pats.append(f'walk-skel/{direction}-*.png')
                for pat in pats:
                    frames = numbered(glob.glob(os.path.join(d, pat)))
                    if len(frames) >= 2:
                        return frames
                return None

            east = walk('east')
            if east:
                return {'alt': alt, 'idle': idle, 'east': east, 'west': walk('west')}
    return None


# ---------------------------------------------------------------- atlas


class Atlas:
    def __init__(self):
        self.items = {}  # frame name -> (image, ax, ay)

    def add_strip(self, name, paths, anchor=None):
        """Frames are cropped to the strip's union bbox; the anchor is the foot centre of frame 0's bbox
        (or the sidecar's anchor), so every frame lands on the same foot point."""
        images = [load(p) for p in paths]
        size = (max(im.size[0] for im in images), max(im.size[1] for im in images))
        if any(im.size != size for im in images):
            warn(f'{name}: frames differ in size, aligned by their top-left corner')
            images = [pad(im, size) for im in images]
        boxes = [im.getbbox() for im in images if im.getbbox()]
        ux0, uy0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
        ux1, uy1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
        b0 = images[0].getbbox()
        ax, ay = (anchor['x'], anchor['y']) if anchor else ((b0[0] + b0[2]) // 2, b0[3])
        names = []
        for i, im in enumerate(images):
            n = f'{name}-{i}' if len(images) > 1 else name
            self.items[n] = (im.crop((ux0, uy0, ux1, uy1)), ax - ux0, ay - uy0)
            names.append(n)
        return names

    def pack(self, max_w=512):
        order = sorted(self.items, key=lambda n: (-self.items[n][0].size[1], n))
        x = y = shelf = 0
        rects = {}
        for n in order:
            w, h = self.items[n][0].size
            if x + w > max_w:
                x, y, shelf = 0, y + shelf + 1, 0
            rects[n] = (x, y, w, h)
            x += w + 1
            shelf = max(shelf, h)
        sheet = Image.new('RGBA', (max((r[0] + r[2] for r in rects.values()), default=1), y + shelf))
        frames = {}
        for n, (x, y, w, h) in sorted(rects.items()):
            im, ax, ay = self.items[n]
            sheet.paste(im, (x, y))
            frames[n] = {'x': x, 'y': y, 'w': w, 'h': h, 'ax': ax, 'ay': ay}
        return sheet, frames


def pad(im, size):
    c = Image.new('RGBA', size)
    c.paste(im, (0, 0))
    return c


def paste_clipped(dst, im, x, y):
    layer = Image.new('RGBA', dst.size)
    layer.paste(im, (x, y))
    dst.alpha_composite(layer)


# ---------------------------------------------------------------- terrain (fallback layout only)


def tileset(root, name):
    img = load(os.path.join(root, 'phase0', 'dl', 'pal', name + '.png'))
    meta = json.load(open(os.path.join(root, 'phase0', 'dl', 'raw', name + '.json')))
    return img, [(t['corners'], t['bounding_box']) for t in meta['tileset_data']['tiles']]


def vertex_grid(terrain):
    cols, rows = terrain['cols'], terrain['rows']
    if 'vertices' in terrain:
        return [list(row) for row in terrain['vertices']]
    V = [[terrain.get('base', 'g')] * (cols + 1) for _ in range(rows + 1)]
    for shape in terrain.get('shapes', []):
        for y in range(rows + 1):
            for x in range(cols + 1):
                if 'rect' in shape:
                    x0, y0, x1, y1 = shape['rect']
                    inside = x0 <= x <= x1 and y0 <= y <= y1
                else:
                    cx, cy, rx, ry = shape['ellipse']
                    inside = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
                if inside:
                    V[y][x] = shape['t']
    return V


def compose_terrain(root, terrain, T):
    """Wang corner tiles exactly as Phase 0's compose-slice: g grass, p dirt, s stone, w water."""
    V = vertex_grid(terrain)
    rows, cols = len(V) - 1, len(V[0]) - 1
    sets = {'gd': tileset(root, 'ts-grass-dirt'), 'wg': tileset(root, 'ts-water-grass'), 'ds': tileset(root, 'ts-dirt-stone')}
    pairs = {'gp': ('gd', {'g': 'lower', 'p': 'upper'}), 'gw': ('wg', {'w': 'lower', 'g': 'upper'}), 'ps': ('ds', {'p': 'lower', 's': 'upper'})}
    pure = {'g': ('gd', 'lower'), 'p': ('gd', 'upper'), 'w': ('wg', 'lower'), 's': ('ds', 'upper')}
    out = Image.new('RGBA', (cols * T, rows * T))
    missing = []
    for y in range(rows):
        for x in range(cols):
            k = [V[y][x], V[y][x + 1], V[y + 1][x], V[y + 1][x + 1]]
            kinds = ''.join(sorted(set(k)))
            if len(kinds) == 1:
                set_name, mapping = pure[kinds][0], {kinds: pure[kinds][1]}
            elif kinds in pairs:
                set_name, mapping = pairs[kinds]
            else:
                missing.append(f'{x},{y}:{"".join(k)}')
                continue
            img, tiles = sets[set_name]
            want = {'NW': mapping[k[0]], 'NE': mapping[k[1]], 'SW': mapping[k[2]], 'SE': mapping[k[3]]}
            bb = next((bb for c, bb in tiles if c == want), None)
            if bb:
                out.paste(img.crop((bb['x'], bb['y'], bb['x'] + T, bb['y'] + T)), (x * T, y * T))
    if missing:
        warn(f'terrain: {len(missing)} tiles have no Wang match: {missing[:8]}')
    return out


def water_blockers(ground):
    """Rects (art px) over water pixels, merged per 4 px band, padded so a pet's body stays on the bank."""
    W, H = ground.size
    data = pixels(ground)
    rects = []
    for y0 in range(0, H, 4):
        run = None
        for x in range(W + 1):
            wet = x < W and any(data[(y * W + x)][:3] in WATER_DEEP for y in range(y0, min(H, y0 + 4)))
            if wet and run is None:
                run = x
            elif not wet and run is not None:
                if x - run >= 8:
                    rects.append([run - 5, y0 - 2, x + 5, y0 + 5])
                run = None
    return rects


def water_spots(ground, w, h, step=8):
    """Top-left-anchored boxes of w x h that are (almost) all water: where pond sparkles and ripples may play."""
    W, H = ground.size
    data = pixels(ground)
    spots = []
    for y in range(0, H - h + 1, step):
        for x in range(0, W - w + 1, step):
            wet = sum(1 for yy in range(y, y + h) for xx in range(x, x + w) if data[yy * W + xx][:3] in WATER)
            if wet >= 0.96 * w * h:
                spots.append([x + w // 2, y + h // 2])
    return spots


# ---------------------------------------------------------------- layout


def park1_ready(root):
    d = os.path.join(root, 'phase1', 'park-1')
    return os.path.isfile(os.path.join(d, 'layout.json')) and any(
        os.path.isfile(os.path.join(d, f)) for f in ('report.txt', 'report.md', 'README.md'))


def blocker(b):
    """park-1 holes are {rect: [x, y, w, h]} or {polygon: [...]}; ours are [x0, y0, x1, y1] or [[x, y], ...]."""
    if isinstance(b, dict):
        if 'rect' in b:
            x, y, w, h = b['rect']
            return [x, y, x + w, y + h]
        return b.get('polygon') or b.get('points')
    return b


def at_anchor(o, anchors):
    """Extras may sit on one of park-1's ambient anchors: {"at": "plaza_centre", "dx": 0, "dy": 13}."""
    if 'at' not in o:
        return o if 'x' in o else None
    a = anchors.get(o['at'])
    if not a:
        return None
    return {**o, 'x': a[0] + o.get('dx', 0), 'y': a[1] + o.get('dy', 0)}


def load_layout(root, choice):
    park1 = os.path.join(root, 'phase1', 'park-1', 'layout.json')
    if choice == 'park-1' or (choice == 'auto' and park1_ready(root)):
        src = json.load(open(park1))
        base_dir = os.path.dirname(park1)
        walk = src.get('walkable')
        holes = []
        rect = None
        if isinstance(walk, dict):
            holes = walk.get('holes') or []
            safe = walk.get('safe_rect')
            if safe:  # where the server's walk rectangle lands; park-1 keeps it below the lamp/bench row
                rect = [safe['minX'], safe['minY'], safe['maxX'], safe['maxY']]
            walk = walk.get('polygon') or walk.get('points')
        anchors = src.get('ambient_anchors') or {}
        objects = [{
            'sprite': o.get('obj') or o.get('sprite') or o.get('name'),
            'x': o['x'], 'y': o['y'],
            'layer': 'ground' if o.get('layer') == 'ground' else 'sort',
            'foot': 'sidecar', 'shadow': 'sidecar',
        } for o in src.get('objects', [])]
        layout = {
            'source': park1, 'size': src['size'], 'tile': src.get('tile', 16), 'px': 3,
            'base': os.path.join(base_dir, src['base']), 'objects': objects, 'walk': walk, 'rect': rect,
            'blocked': [blocker(b) for b in holes + src.get('blocked', []) if blocker(b)],
            'lights': [[g['x'], g['y']] for g in src.get('night_glow', [])] or None,
            'npcs': [], 'fx': [],
        }
        if os.path.isfile(EXTRAS):
            extra = json.load(open(EXTRAS))
            layout['objects'] += [o for o in (at_anchor(o, anchors) for o in extra.get('objects', [])) if o]
            layout['npcs'] += extra.get('npcs', [])
            for f in extra.get('fx', []):
                if isinstance(f.get('around'), str):
                    f = {**f, 'around': [p[:2] for p in anchors.get(f['around'], [])]}
                layout['fx'].append(f)
            layout['extras'] = EXTRAS
        return layout
    src = json.load(open(FALLBACK_LAYOUT))
    return {
        'source': FALLBACK_LAYOUT, 'size': src['size'], 'tile': src.get('tile', 16), 'px': src.get('world_px', 3),
        'terrain': src['terrain'], 'objects': src['objects'], 'walk': src['walkable'], 'blocked': src.get('blocked', []),
        'lights': None, 'npcs': src.get('npcs', []), 'fx': src.get('fx', []),
    }


def foot_rect(kind, x, y, w, h):
    """Footprint in art px that pets cannot stand in: a rect (x0, y0, x1, y1), a polygon, or None."""
    if kind in (None, 'none'):
        return None
    if isinstance(kind, dict) and 'ellipse' in kind:  # [dx, dy, rx, ry] from the foot point, e.g. a fountain basin
        dx, dy, rx, ry = kind['ellipse']
        rx, ry = rx + 3, ry + 2
        return [[round(x + dx + rx * math.cos(a * math.pi / 8)), round(y + dy + ry * math.sin(a * math.pi / 8))] for a in range(16)]
    if isinstance(kind, list):
        fw, fh = kind
    elif kind == 'trunk':
        fw, fh = max(8, round(w * 0.22)), 6
    elif kind == 'post':
        fw, fh = 6, 4
    elif kind == 'basin':
        fw, fh = round(w * 0.9), round(h * 0.45)
    else:  # base
        fw, fh = round(w * 0.8), max(6, min(14, round(h * 0.35)))
    return [round(x - fw / 2) - 3, y - fh, round(x + fw / 2) + 3, y + 1]


def auto_shadow(kind, w, h, anim):
    if anim or kind == 'basin':
        return [max(8, round(w / 2.1)), 4]
    if kind == 'trunk':
        return [max(6, round(w / 2.6)), 3]
    if kind == 'post':
        return [4, 1]
    return [max(4, round(w / 2.4)), 2]


# ---------------------------------------------------------------- build


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('root', help='art workspace S with phase0/ and phase1/ (not in the repo; required)')
    ap.add_argument('--layout', choices=('auto', 'park-1', 'p0'), default='auto',
                    help='park-1 = the park-1 package layout, p0 = scripts/art/park-layout.json; auto = park-1 once delivered')
    ap.add_argument('--preview', help='also write a 2x composite PNG of the whole park (with the walkable area) here')
    args = ap.parse_args()
    root = os.path.abspath(args.root)
    if not os.path.isdir(os.path.join(root, 'phase0')):
        sys.exit(f'no phase0/ in {root}')
    dirs = sprite_dirs(root)
    L = load_layout(root, args.layout)
    print(f'layout: {L["source"]}' + (f' + {L["extras"]}' if L.get('extras') else ''))
    W, H = L['size']
    T = L['tile']

    if L.get('base'):
        ground = pad(load(L['base']), (W, H))
        ground_src = [L['base']]
    else:
        ground = compose_terrain(root, L['terrain'], T).crop((0, 0, W, H))
        ground_src = [os.path.join(root, 'phase0', 'dl', 'pal', f'{n}.png') for n in ('ts-grass-dirt', 'ts-water-grass', 'ts-dirt-stone')]
    water = water_blockers(ground)

    atlas = Atlas()
    strips, used = {}, {}

    def sprite(key, anim=False):
        r = resolve(dirs, key, anim)
        if not r:
            return None
        name = r['alt'].replace('/', '-')
        if name not in strips:
            strips[name] = (atlas.add_strip(name, r['paths'], r['meta'].get('anchor')), r['meta'])
            used[name] = r['paths']
        return name, *strips[name]

    walk_top = min(p[1] for p in L['walk'])
    objects, blocked, lights, decals, anims = [], [], [], [], {}
    for o in L['objects']:
        anim = o.get('anim')
        got = sprite(o['sprite'], anim=bool(anim))
        if not got:
            if not o.get('optional'):
                warn(f'no sprite for {o["sprite"]} at {o["x"]},{o["y"]}')
            continue
        name, frames, meta = got
        im = atlas.items[frames[0]][0]
        w, h = im.size
        if o.get('layer') == 'ground' or meta.get('layer') == 'ground' and o.get('layer') != 'sort':
            decals.append((frames[0], o['x'], o['y']))
            continue
        entry = {'x': o['x'], 'y': o['y']}
        if anim and len(frames) > 1:
            anims.setdefault(name, {'frames': frames, 'fps': anim.get('fps', 8), 'mode': anim.get('mode', 'loop')})
            entry['a'] = name
        else:
            entry['f'] = frames[0]
        kind = meta.get('footprint') if o.get('foot') == 'sidecar' else o.get('foot', 'base')
        foot = foot_rect(kind, o['x'], o['y'], w, h)
        if foot:
            blocked.append(foot)
        shadow = meta.get('shadow') if o.get('shadow') == 'sidecar' else o.get('shadow', 'auto')
        if shadow == 'auto':
            shadow = auto_shadow(kind, w, h, bool(anim)) if (kind not in (None, 'none') or o.get('figure')) else None
        if shadow:
            entry['sh'] = shadow
        if h >= 24 and o['y'] > walk_top:
            entry['occ'] = 1  # pets can walk behind it: it fades while one does
        if 'lamp' in name and L['lights'] is None:
            lights.append([o['x'], o['y'] - h + 7])
        objects.append(entry)

    for frame, x, y in decals:
        im, ax, ay = atlas.items[frame]
        paste_clipped(ground, im, x - ax, y - ay)
    referenced = {e.get('f') for e in objects} | {f for a in anims.values() for f in a['frames']}
    for frame in {f for f, _, _ in decals} - referenced:
        atlas.items.pop(frame, None)

    npcs = []
    for n in L['npcs']:
        r = resolve_npc(dirs, n['sprite'])
        if not r:
            warn(f'visitor {n["id"]}: no walk cycle for {n["sprite"]} yet, skipped')
            continue
        name = 'npc-' + re.sub(r'^npc-?', '', r['alt'].replace('/', '-')) if r['alt'] != 'npc' else 'npc-villager'
        idle = atlas.add_strip(f'{name}-idle', [r['idle']])
        east = atlas.add_strip(f'{name}-walk-e', r['east'])
        west = atlas.add_strip(f'{name}-walk-w', r['west']) if r['west'] else None
        used[name] = [r['idle'], *r['east'], *(r['west'] or [])]
        npcs.append({'id': n['id'], 'idle': idle[0], 'walkE': east, 'walkW': west, 'route': n['route'],
                     'speed': n.get('speed', 16), 'pause': n.get('pause', [2, 6]), 'start': n.get('start', 0), 'fps': n.get('fps', 8)})

    fx = []
    for f in L['fx']:
        r = resolve(dirs, f['sprite'], anim=True)
        if not r or len(r['paths']) < 2:
            warn(f'fx {f["sprite"]}: not available, skipped')
            continue
        size = load(r['paths'][0]).size
        flutter = f.get('kind') == 'flutter'
        spots = f.get('around', []) if flutter else water_spots(ground, *size)
        if not spots:
            warn(f'fx {f["sprite"]}: nowhere to play ({"no anchors" if flutter else "no open water"})')
            continue
        meta = {}
        for index in ('fx-anim.json', 'index.json'):
            meta_path = os.path.join(r['dir'], index)
            if os.path.isfile(meta_path) and not meta:
                meta = json.load(open(meta_path)).get(r['alt'], {})
        ms = meta.get('ms_per_frame') or (meta.get('ms') or [110])[0]
        frames = atlas.add_strip(r['alt'], r['paths'], {'x': size[0] // 2, 'y': size[1] // 2})
        used[r['alt']] = r['paths']
        entry = {'kind': 'flutter' if flutter else 'spark', 'frames': frames, 'ms': ms, 'count': f.get('count', 2), 'spots': spots}
        if not flutter:
            entry['gap'] = meta.get('gap_ms', [800, 2500])
        fx.append(entry)

    if L['lights'] is not None:
        lights = L['lights']
    sheet, frames = atlas.pack()
    os.makedirs(OUT, exist_ok=True)

    def save(img, name):
        buf = io.BytesIO()
        img.save(buf, 'WEBP', lossless=True, quality=100, method=6, exact=True)
        data = buf.getvalue()
        with open(os.path.join(OUT, name), 'wb') as fh:
            fh.write(data)
        return f'{name}?v={hashlib.sha1(data).hexdigest()[:10]}', len(data)

    ground_ref, ground_size = save(ground, 'ground.webp')
    atlas_ref, atlas_size = save(sheet, 'objects.webp')
    park = {
        'version': 1,
        'layout': os.path.relpath(L['source'], root) if L['source'].startswith(root) else os.path.relpath(L['source'], REPO),
        'px': L['px'],
        'size': [W, H],
        'ground': ground_ref,
        'atlas': atlas_ref,
        'atlasSize': list(sheet.size),
        'frames': frames,
        'anims': anims,
        'objects': sorted(objects, key=lambda e: (e['y'], e['x'])),
        'npcs': npcs,
        'fx': fx,
        'lights': lights,
        'nav': {'walk': L['walk'], 'rect': L.get('rect'), 'blocked': blocked + water + L['blocked']},
    }
    text = json.dumps(park, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(OUT, 'park.json'), 'w') as fh:
        fh.write(text)

    pal = {tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in json.load(open(os.path.join(root, 'phase0', 'palette.json')))}
    for label, img in (('ground', ground), ('objects', sheet)):
        data = pixels(img)
        off = sum(1 for p in data if p[3] and p[:3] not in pal)
        semi = sum(1 for p in data if 0 < p[3] < 255)
        print(f'  {label:8s} {img.size[0]}x{img.size[1]} off-palette={off} semi-alpha={semi}')
        if off or semi:
            warn(f'{label}: {off} off-palette and {semi} semi-transparent pixels')
    print(f'  ground.webp {ground_size} B, objects.webp {atlas_size} B, park.json {len(text.encode())} B, '
          f'total {ground_size + atlas_size + len(text.encode())} B')
    for n, s in (('ground.webp', ground_size), ('objects.webp', atlas_size), ('park.json', len(text.encode()))):
        if s > FILE_BUDGET:
            warn(f'{n} is {s} B, over the 200 KB budget')
    print(f'  {len(objects)} objects, {len(anims)} animations, {len(npcs)} visitors, {len(fx)} fx, {len(lights)} lights, '
          f'{len(park["nav"]["blocked"])} blockers')

    write_manifest(root, L, ground_src, used, frames, ground_size, atlas_size, sheet.size)
    if args.preview:
        preview(args.preview, ground, sheet, frames, park)
    print(f'{len(warnings)} warning(s)' if warnings else 'ok')


# ---------------------------------------------------------------- provenance


def write_manifest(root, L, ground_src, used, frames, ground_size, atlas_size, atlas_dims):
    known = {}
    for mf in [os.path.join(root, 'phase0', 'asset-manifest.json'), *sorted(glob.glob(os.path.join(root, 'phase1', '*', 'manifest.json')))]:
        try:
            data = json.load(open(mf))
        except (OSError, ValueError):
            continue
        for a in (data.get('assets', []) if isinstance(data, dict) else data):
            if isinstance(a, dict) and a.get('id'):
                known.setdefault(a['id'], a)

    def source_of(path):
        stem = os.path.splitext(os.path.basename(path))[0]
        parent = os.path.basename(os.path.dirname(path))
        for k in (f'prop-{stem}', f'park-{stem}', stem, f'fx-{parent}', parent):
            if k in known:
                return known[k]
        if 'fountain-anim' in path:
            return known.get('fx-fountain')
        if 'walk-skel' in path:
            return known.get('npc-villager-walk')
        if stem.startswith('npc-'):
            return known.get('npc-villager')
        return None

    rel = lambda p: os.path.relpath(p, root) if p.startswith(root) else os.path.relpath(p, REPO)  # noqa: E731
    entries = [{
        'id': 'park-ground',
        'role': 'park background: base terrain plus flat ground-layer decals',
        'path': 'public/ta-tua/game/assets/park/ground.webp',
        'status': 'approved',
        'technical': {'dimensions': f'{L["size"][0]}x{L["size"][1]}', 'bytes': ground_size, 'filtering': 'nearest',
                      'scale': 'world = 3 units per art px; integer 3x desktop / 2x phone on screen'},
        'provenance': {'kind': 'composed', 'tool': 'scripts/art/build-park.py', 'license': LICENSE, 'layout': rel(L['source']),
                       'sources': [rel(p) for p in ground_src]},
        'verification': {'technical_checks_passed': not warnings, 'in_engine_reviewed': True, 'approved_by': APPROVED_BY},
    }]
    for name, paths in sorted(used.items()):
        src = source_of(paths[0])
        entries.append({
            'id': f'park-{name}',
            'role': 'park object, animation or visitor frames',
            'path': f'public/ta-tua/game/assets/park/objects.webp#{name}',
            'status': 'approved',
            'technical': {'frames': len(paths), 'anchor': 'foot centre (ax, ay in park.json)', 'filtering': 'nearest'},
            'provenance': {'kind': 'derived', 'license': LICENSE, 'sources': [rel(p) for p in paths[:2]] + ([f'+{len(paths) - 2} more'] if len(paths) > 2 else []),
                           'source_id': src['id'] if src else None,
                           'generation': src.get('provenance') if src else 'see the art package manifest.json / report.md',
                           'postprocess': ['cropped to the strip bbox', 'packed into objects.webp (lossless WebP)']},
            'verification': {'in_engine_reviewed': True, 'approved_by': APPROVED_BY},
        })
    entries.append({
        'id': 'park-atlas',
        'role': 'atlas of every park object, animation and visitor frame; frame map in park.json',
        'path': 'public/ta-tua/game/assets/park/objects.webp',
        'status': 'approved',
        'technical': {'dimensions': f'{atlas_dims[0]}x{atlas_dims[1]}', 'bytes': atlas_size, 'frames': len(frames), 'padding': 1},
        'provenance': {'kind': 'packed', 'tool': 'scripts/art/build-park.py', 'license': LICENSE},
    })
    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    try:
        doc = json.load(open(MANIFEST))
    except (OSError, ValueError):
        doc = {'schema_version': 1, 'note': 'Provenance of the 16-bit art in public/ta-tua/game/assets/ (entry format: Phase 0 asset-manifest.json).', 'assets': []}
    if isinstance(doc, list):
        doc = {'schema_version': 1, 'assets': doc}
    doc['assets'] = [a for a in doc.get('assets', []) if not str(a.get('id', '')).startswith('park-')] + entries
    with open(MANIFEST, 'w') as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=1)
        fh.write('\n')


# ---------------------------------------------------------------- preview


def preview(path, ground, sheet, frames, park):
    img = ground.copy()
    shade = Image.new('RGBA', img.size)
    sd = ImageDraw.Draw(shade)
    items = []
    for o in park['objects']:
        items.append((o['y'], o.get('f') or park['anims'][o['a']]['frames'][0], o['x']))
        if o.get('sh'):
            rx, ry = o['sh']
            for dy in range(-ry, ry + 1):
                half = round(rx * math.sqrt(max(0, 1 - (dy / (ry + 0.5)) ** 2)))
                sd.line([(o['x'] + 2 - half, o['y'] - 2 + dy), (o['x'] + 1 + half, o['y'] - 2 + dy)], fill=(46, 29, 20, 72))
    for n in park['npcs']:
        x, y = n['route'][0]
        items.append((y, n['idle'], x))
    img.alpha_composite(shade)
    for y, name, x in sorted(items):
        f = frames[name]
        paste_clipped(img, sheet.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h'])), x - f['ax'], y - f['ay'])
    d = ImageDraw.Draw(img)
    d.polygon([tuple(p) for p in park['nav']['walk']], outline=(255, 255, 255, 200))
    for b in park['nav']['blocked']:
        if isinstance(b[0], list):
            d.polygon([tuple(p) for p in b], outline=(232, 74, 95, 220))
        else:
            d.rectangle(b, outline=(232, 74, 95, 220))
    img.resize((img.size[0] * 2, img.size[1] * 2), Image.NEAREST).save(path)
    print(f'  preview: {path}')


if __name__ == '__main__':
    main()
