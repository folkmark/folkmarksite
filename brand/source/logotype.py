"""Folkmark logotype generator.

Builds the "olkmark" lowercase to sit beside the painted F mark, in the
F's own sign-painter vocabulary:
  - reverse contrast: heavy horizontals (slab bars, bowl crowns) and
    hairline verticals, as if laid down with a flat brush held upright
  - slab bars like the F's crossbar, at the baseline, x-height and
    ascender
  - hairline stems at the F's stem weight
  - one swelling flourish ending in a ball (the r), echoing the F's wave
then slants everything ~17 deg to match the F.

Lowercase is drawn upright with baseline 0, x-height XH (= the top of
the F's crossbar) and ascender ASC, then sheared and placed after the F.

Usage:  python3 logotype.py            (needs: pip install shapely)
Writes: ../folkmark-logotype-{green,parchment}.svg, ../folkmark-mark-*.svg
"""
import json, math, os
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import unary_union
from shapely import affinity

HERE = os.path.dirname(os.path.abspath(__file__))
P = json.load(open(os.environ.get('LOGO_PARAMS') or os.path.join(HERE, 'params.json')))
XH, ASC = P['xh'], P['asc']
W, H = P['nib'], P['hair']           # heavy stroke weight, hairline width
SLANT = math.tan(math.radians(P['slant']))

def ball(x, y, r):
    return Point(x, y).buffer(r, 64)

def slab(x0, x1, y0, y1):
    return Polygon([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])

# ---- glyphs (upright; each returns (geometry, advance)) -------------
# Built from the F's own three parts: slab bars (like its crossbar),
# hairline stems (its stem), and swelling brush curves (its top wave).
SL = P['slab']                      # slab bar height

def stem(x, top, bot=0):
    """Hairline stem. Callers run stems right through their slabs (from
    0, or into the head) so every join is a clean overlap, not a butt."""
    return LineString([(x, bot), (x, top)]).buffer(H / 2, cap_style=2)

def bar(x0, x1, y0, h=None):
    h = SL if h is None else h
    return slab(x0, x1, y0, y0 + h)

def foot(x, l=None, r=None):        # baseline slab under a stem
    l = P['foot_l'] if l is None else l; r = P['foot_r'] if r is None else r
    return bar(x - l, x + r, 0)

def head(x, l=None, r=0, y=None):   # top slab (flag to the left, like a serif)
    l = P['head'] if l is None else l
    y = XH - SL if y is None else y
    return bar(x - l, x + r + H/2, y)

def arc(cx, cy, rx, ry, a0, a1, k=360):
    return [(cx + rx*math.cos(a0 + (a1-a0)*i/k), cy + ry*math.sin(a0 + (a1-a0)*i/k)) for i in range(k+1)]

def ring(cx, rx):
    """Reverse-contrast bowl: heavy top and bottom, hairline sides."""
    outer = arc(cx, XH/2, rx + H/2, XH/2, 0, 2*math.pi)
    inner = arc(cx, XH/2, rx - H/2, XH/2 - P['bowl'], 0, 2*math.pi)
    return Polygon(outer, [inner])

def arch(x0, x1, base):
    """Half-ring over two stems: heavy crown, hairline legs that land
    exactly on the stems below."""
    cx, rx = (x0 + x1)/2, (x1 - x0)/2
    ry_o, ry_i = XH - base, XH - base - P['bowl']
    outer = arc(cx, base, rx + H/2, ry_o, 0, math.pi, 240)
    inner = arc(cx, base, rx - H/2, ry_i, math.pi, 0, 240)
    return Polygon(outer + inner)

def g_o():
    rx = P['o_rx']; cx = rx + H
    return ring(cx, rx), 2*rx + 2*H

def g_l():
    x = P['head'] + H
    g = unary_union([stem(x, ASC), head(x, y=ASC - SL), foot(x)])
    return g, x + P['foot_r']

def g_k():
    x = P['head'] + H
    ax = x + P['k_arm']
    arm0, arm1 = (x, XH*0.30), (ax, XH - SL/2)
    t = 0.42                                     # where the leg leaves the arm
    j = (arm0[0] + (arm1[0]-arm0[0])*t, arm0[1] + (arm1[1]-arm0[1])*t)
    lx = ax + P.get('k_leg', 8)
    g = unary_union([
        stem(x, ASC), head(x, y=ASC - SL), foot(x, r=P['foot_r']*0.55),     # short right foot: room for the leg
        LineString([arm0, arm1]).buffer(H/2, cap_style=2),                    # arm, into its slab
        bar(ax - P['foot_l']*0.6, ax + P['foot_r']*1.2, XH - SL),            # arm slab
        LineString([j, (lx, SL/2)]).buffer(H/2, cap_style=2),                 # leg, off the arm
        bar(lx - P['foot_l']*0.45, lx + P['foot_r']*1.3, 0),                  # leg slab
    ])
    return g, lx + P['foot_r']*1.3

def g_m():
    s = P['m_step']; x0 = P['head'] + H
    b = XH*0.5
    g = unary_union([
        head(x0), stem(x0, XH), foot(x0),
        arch(x0, x0 + s, b), stem(x0 + s, b + 1), foot(x0 + s),
        arch(x0 + s, x0 + 2*s, b), stem(x0 + 2*s, b + 1), foot(x0 + 2*s),
    ])
    return g, x0 + 2*s + P['foot_r']

def g_a():
    rx = P['a_rx']; cx = rx + H; x = cx + rx
    g = unary_union([
        ring(cx, rx),
        stem(x, XH), foot(x),
        bar(x - P['head']*0.5, x + H/2, XH - SL),
    ])
    return g, x + P['foot_r']

def flag(x, f):
    """The r's flag: a quarter-ring that swells from a hairline at the
    stem to full weight at the crown, then eases off and finishes in a
    ball centred on the stroke — a small echo of the F's top wave."""
    cx, cy = x + f/2, XH*0.5
    rx, ry = f/2, XH*0.5
    n, end = 240, 0.86
    outer, inner = [], []
    for i in range(n+1):
        t = i/n
        th = math.pi*(1 - end*t)               # from the stem (left), over the crown
        swell = math.sin(min(t/0.5, 1)*math.pi/2)
        ease = 1 - 0.35*max(0, (t - 0.6)/0.4)  # lighten toward the ball
        w = H + (W - H)*swell*ease
        outer.append((cx + (rx + H/2)*math.cos(th), cy + ry*math.sin(th)))
        inner.append((cx + (rx - H/2)*math.cos(th), cy + (ry - w)*math.sin(th)))
    o, i_ = outer[-1], inner[-1]
    mid = ((o[0] + i_[0])/2, (o[1] + i_[1])/2)
    r = max(P['ball'], math.dist(o, i_)/2*1.35)
    # set the ball back into the stroke along its direction of travel, so
    # it finishes the stroke instead of sitting on its end
    po, pi_ = outer[-12], inner[-12]
    back = ((po[0] + pi_[0])/2 - mid[0], (po[1] + pi_[1])/2 - mid[1])
    k = r*0.45 / (math.hypot(*back) or 1)
    c = (mid[0] + back[0]*k, mid[1] + back[1]*k)
    return unary_union([Polygon(outer + inner[::-1]), ball(c[0], c[1], r)])

def g_r():
    x = P['head'] + H
    f = P['r_flag']
    g = unary_union([head(x), stem(x, XH), foot(x), flag(x, f)])
    # a softer closing on the flag alone, so it runs into its ball as one
    # brush stroke with no dents
    soft = P.get('flag_soft', 14)
    g = unary_union([g, flag(x, f).buffer(soft, 64).buffer(-soft, 64)])
    return g, x + f + P['ball']

GLYPHS = {'o': g_o, 'l': g_l, 'k': g_k, 'm': g_m, 'a': g_a, 'r': g_r}

def _edges(g, y, side):
    """Leftmost/rightmost x of geometry g along the row at height y."""
    row = g.intersection(LineString([(-1e5, y), (1e5, y)]))
    if row.is_empty:
        return None
    parts = row.geoms if hasattr(row, 'geoms') else [row]
    xs = [c[0] for part in parts for c in part.coords]
    return max(xs) if side == 'r' else min(xs)

def fit(prev, nxt, target, cap, min_gap):
    """Shift for nxt so that (a) the mean row gap to prev across the
    x-height band equals target (gaps capped so open shapes don't
    over-pull), and (b) nothing comes closer than min_gap anywhere."""
    rows = [XH*i/31 for i in range(1, 31)]
    pr = [_edges(prev, y, 'r') for y in rows]
    nl = [_edges(nxt, y, 'l') for y in rows]
    def mean_gap(s):
        gs = [min(n + s - p, cap) for p, n in zip(pr, nl) if p is not None and n is not None]
        return sum(gs) / len(gs)
    lo, hi = -2000.0, 2000.0
    for _ in range(60):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if mean_gap(mid) < target else (lo, mid)
    s = (lo + hi) / 2
    while affinity.translate(nxt, s, 0).distance(prev) < min_gap:
        s += 1.0
    return s

def word(text, track):
    """Set the word with optical spacing: each glyph is slanted, then
    shifted so its mean gap to the previous one equals `track`."""
    placed = []
    for ch in text:
        g, _ = GLYPHS[ch]()
        # Soft brackets where strokes meet, as a brush leaves them: a
        # closing (fills inside corners with radius br) done while the
        # letter is upright, so both sides of every join get the same
        # curve; the slant is applied after.
        br = P.get('bracket', 6)
        g = g.buffer(br, 64, join_style=1).buffer(-br, 64, join_style=1)
        g = affinity.skew(g, xs=P['slant'], origin=(0, 0))
        if placed:
            g = affinity.translate(g, fit(placed[-1], g, track, track * P.get('gap_cap', 2.2), P['min_gap']), 0)
        placed.append(g)
    return unary_union(placed), placed

def to_path(geom, flipy=True, dx=0, dy=0):
    polys = [geom] if geom.geom_type == 'Polygon' else list(geom.geoms)
    d = []
    for poly in polys:
        for ring in [poly.exterior] + list(poly.interiors):
            c = list(ring.coords)
            d.append('M' + ' L'.join(f'{x+dx:.1f} {(-y if flipy else y)+dy:.1f}' for x, y in c) + 'Z')
    return ' '.join(d)

GREEN, PARCHMENT = '#1D3C2E', '#F7F4EE'

def f_outline():
    """The F, exactly as drawn in the original scene: a closed cubic
    bezier outline (y up). Returns an SVG path (y flipped) and a sampled
    polygon for measuring."""
    pts = json.load(open(os.path.join(HERE, 'f-outline.json')))
    fy = lambda x, y: f'{x:.2f} {-y:.2f}'
    d = 'M' + fy(*pts[0][0])
    poly = []
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        d += ' C' + fy(*a[2]) + ' ' + fy(*b[1]) + ' ' + fy(*b[0])
        p0, p1, p2, p3 = a[0], a[2], b[1], b[0]
        for k in range(24):
            t = k / 24; u = 1 - t
            poly.append(tuple(u**3*p0[j] + 3*u*u*t*p1[j] + 3*u*t*t*p2[j] + t**3*p3[j] for j in (0, 1)))
    return d + 'Z', Polygon(poly)

def svg(paths, bounds, fill, pad=24, title='Folkmark'):
    x0, y0, x1, y1 = bounds
    vb = f'{x0 - pad:.0f} {-y1 - pad:.0f} {x1 - x0 + 2*pad:.0f} {y1 - y0 + 2*pad:.0f}'
    body = ''.join(f'<path d="{d}"/>' for d in paths)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="{title}">'
            f'<title>{title}</title><g fill="{fill}">{body}</g></svg>\n')

if __name__ == '__main__':
    f_path, f_poly = f_outline()
    lower, _ = word(P['text'], P['track'])
    lower = lower.simplify(0.08)
    # Space the word off the F the same optical way (sharing the F's
    # baseline), then make sure nothing touches the F anywhere — the
    # ascenders run up under its top wave.
    f_low = affinity.translate(f_poly, 0, -P['f_base'])
    lower = affinity.translate(lower, fit(f_low, lower, P['track'] * P.get('f_gap', 1.0), P['track'] * 2.2, P['min_gap']), 0)
    while lower.distance(f_low) < P.get('f_min_gap', P['min_gap'] * 1.5):
        lower = affinity.translate(lower, 1.0, 0)
    lower = affinity.translate(lower, 0, P['f_base'])
    l_path = to_path(lower)

    out = os.environ.get('LOGO_OUT') or os.path.dirname(HERE)
    full = unary_union([f_poly, lower]).bounds
    for name, fill in (('green', GREEN), ('parchment', PARCHMENT)):
        open(os.path.join(out, f'folkmark-logotype-{name}.svg'), 'w').write(svg([f_path, l_path], full, fill))
        open(os.path.join(out, f'folkmark-mark-{name}.svg'), 'w').write(svg([f_path], f_poly.bounds, fill, title='Folkmark F'))
    # paths for inlining (fill: currentColor) and the viewBox to use
    json.dump({'f': f_path, 'lower': l_path, 'bounds': full, 'f_bounds': f_poly.bounds},
              open(os.path.join(out if os.environ.get('LOGO_OUT') else HERE, 'build.json'), 'w'))
    print('logotype bounds', [round(v) for v in full], '| F bounds', [round(v) for v in f_poly.bounds])
