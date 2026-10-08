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
P = json.load(open(os.path.join(HERE, 'params.json')))
XH, ASC = P['xh'], P['asc']
W, H = P['nib'], P['hair']           # heavy stroke weight, hairline width
SLANT = math.tan(math.radians(P['slant']))

def ball(x, y, r):
    return Point(x, y).buffer(r, 32)

def slab(x0, x1, y0, y1):
    return Polygon([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])

# ---- glyphs (upright; each returns (geometry, advance)) -------------
# Built from the F's own three parts: slab bars (like its crossbar),
# hairline stems (its stem), and swelling brush curves (its top wave).
SL = P['slab']                      # slab bar height

def stem(x, top, bot=0):
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

def arc(cx, cy, rx, ry, a0, a1, k=96):
    return [(cx + rx*math.cos(a0 + (a1-a0)*i/k), cy + ry*math.sin(a0 + (a1-a0)*i/k)) for i in range(k+1)]

def ring(cx, rx):
    """Reverse-contrast bowl: heavy top and bottom, hairline sides."""
    outer = arc(cx, XH/2, rx + H/2, XH/2, 0, 2*math.pi)
    inner = arc(cx, XH/2, rx - H/2, XH/2 - W, 0, 2*math.pi)
    return Polygon(outer, [inner])

def arch(x0, x1, base):
    """Half-ring over two stems: heavy crown, hairline legs."""
    cx, rx = (x0 + x1)/2, (x1 - x0)/2
    ry_o, ry_i = XH - base, XH - base - W
    outer = arc(cx, base, rx + H/2, ry_o, 0, math.pi)
    inner = arc(cx, base, rx - H/2, ry_i, math.pi, 0)
    return Polygon(outer + inner)

def g_o():
    rx = P['o_rx']; cx = rx + H
    return ring(cx, rx), 2*rx + 2*H

def g_l():
    x = P['head'] + H
    g = unary_union([stem(x, ASC, SL), head(x, y=ASC - SL), foot(x)])
    return g, x + P['foot_r']

def g_k():
    x = P['head'] + H
    ax = x + P['k_arm']
    g = unary_union([
        stem(x, ASC, SL), head(x, y=ASC - SL), foot(x),
        LineString([(x, XH*0.38), (ax, XH - SL)]).buffer(H/2, cap_style=2),   # arm
        bar(ax - P['foot_l']*0.6, ax + P['foot_r']*1.2, XH - SL),            # arm slab
        LineString([(x + P['k_arm']*0.38, XH*0.56), (ax + 6, SL)]).buffer(H/2, cap_style=2),  # leg
        bar(ax + 6 - P['foot_l']*0.7, ax + 6 + P['foot_r']*1.3, 0),          # leg slab
    ])
    return g, ax + 6 + P['foot_r']*1.3

def g_m():
    s = P['m_step']; x0 = P['head'] + H
    b = XH*0.5
    g = unary_union([
        head(x0), stem(x0, XH, SL), foot(x0),
        arch(x0, x0 + s, b), stem(x0 + s, b, SL), foot(x0 + s),
        arch(x0 + s, x0 + 2*s, b), stem(x0 + 2*s, b, SL), foot(x0 + 2*s),
    ])
    return g, x0 + 2*s + P['foot_r']

def g_a():
    rx = P['a_rx']; cx = rx + H; x = cx + rx
    g = unary_union([
        ring(cx, rx),
        stem(x, XH, SL), foot(x, P['foot_l']*0.6),
        bar(x - P['head']*0.5, x + H/2, XH - SL),
    ])
    return g, x + P['foot_r']

def flag(x, f):
    """The r's flag: a quarter-ring that swells from a hairline at the
    stem to full weight at the crown, then turns down into a ball —
    a small echo of the F's top wave."""
    cx, cy = x + f/2, XH*0.5
    rx, ry = f/2, XH*0.5
    n = 96
    outer, inner = [], []
    for i in range(n+1):
        t = i/n
        th = math.pi*(1 - 0.92*t)              # from the stem (left) over the top
        w = H + (W - H)*math.sin(min(t/0.55, 1)*math.pi/2)
        outer.append((cx + (rx + H/2)*math.cos(th), cy + ry*math.sin(th)))
        inner.append((cx + (rx - H/2)*math.cos(th), cy + (ry - w)*math.sin(th)))
    end = outer[-1]
    shape = Polygon(outer + inner[::-1])
    return unary_union([shape, ball(end[0] - P['ball']*0.55, end[1] - P['ball']*0.35, P['ball'])])

def g_r():
    x = P['head'] + H
    f = P['r_flag']
    g = unary_union([
        head(x), stem(x, XH, SL), foot(x),
        # flag: a small echo of the F's top wave, swelling into a ball
        flag(x, f),
    ])
    return g, x + f + P['ball']

GLYPHS = {'o': g_o, 'l': g_l, 'k': g_k, 'm': g_m, 'a': g_a, 'r': g_r}

def word(text, track):
    x, parts = 0.0, []
    for ch in text:
        g, adv = GLYPHS[ch]()
        parts.append(affinity.translate(g, x, 0))
        x += adv + track
    return unary_union(parts), x - track

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
    lower, width = word(P['text'], P['track'])
    lower = affinity.skew(lower, xs=P['slant'], origin=(0, 0))
    lower = lower.buffer(4, join_style=1).buffer(-4, join_style=1).simplify(0.3)
    lower = affinity.translate(lower, P['gap'], P['f_base'])   # share the F's baseline
    l_path = to_path(lower)

    out = os.path.dirname(HERE)
    full = unary_union([f_poly, lower]).bounds
    for name, fill in (('green', GREEN), ('parchment', PARCHMENT)):
        open(os.path.join(out, f'folkmark-logotype-{name}.svg'), 'w').write(svg([f_path, l_path], full, fill))
        open(os.path.join(out, f'folkmark-mark-{name}.svg'), 'w').write(svg([f_path], f_poly.bounds, fill, title='Folkmark F'))
    # paths for inlining (fill: currentColor) and the viewBox to use
    json.dump({'f': f_path, 'lower': l_path, 'bounds': full, 'f_bounds': f_poly.bounds},
              open(os.path.join(HERE, 'build.json'), 'w'))
    print('logotype bounds', [round(v) for v in full], '| F bounds', [round(v) for v in f_poly.bounds])
