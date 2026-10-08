/* ============================================================
   FOLKMARK — logo3d.js
   The 3D "F" mark, rebuilt natively with three.js (self-hosted in
   /vendor) — no Spline runtime, no third-party scene file.

   The outline, extrusion and camera framing are taken directly from
   the original Spline scene so the mark matches it exactly:
     - a closed bezier outline (15 anchors, below)
     - extruded 150 deep with an 8-unit, 2-segment bevel

   Atmosphere (after dark):
     - the mark is aged bone/enamel, lit by a cool moon rim from behind
       and a warm lantern from below-left that gutters and flickers
     - sparse warm motes drift up through the light around it
     - on load it rises out of the haze as the lantern catches; as the
       page scrolls it sinks back down and dims

   Interaction: drag to turn the mark (it eases back when released);
   otherwise it sways gently and leans toward the pointer.

   Exported mount(el, { still }) returns a cleanup function. With
   still: true it renders one frame in the rest pose (used to make the
   static poster) and skips the loop and listeners.
   ============================================================ */
import * as THREE from './vendor/three.module.min.js';

/* Outline anchors, in Spline's 2D shape space (y up).
   Each row: [x, y,  inX, inY,  outX, outY] — the anchor, then its
   incoming and outgoing bezier handles (absolute coordinates). */
const OUTLINE = [
  [1.23, 1.81, -118.09, -94.92, -20.06, -65.43],
  [264.38, 15.01, 182.27, -126.48, 235.52, 15.36],
  [149.30, 16.58, 149.30, 16.58, 149.30, 16.58],
  [204.63, 176.90, 204.63, 176.90, 204.63, 176.90],
  [323.94, 177.43, 323.94, 177.43, 323.94, 177.43],
  [352.74, 247.23, 342.78, 220.32, 225.15, 293.12],
  [150.03, 217.38, 129.31, 284.23, 63.46, 262.58],
  [190.55, 437.57, 108.81, 398.77, 378.35, 526.70],
  [673.38, 428.57, 600.63, 264.51, 790.05, 282.53],
  [369.89, 239.24, 604.11, 121.31, 366.04, 229.39],
  [347.33, 177.10, 347.33, 177.10, 347.33, 177.10],
  [456.98, 177.57, 456.98, 177.57, 456.98, 177.57],
  [402.70, 12.97, 402.70, 12.97, 402.70, 12.97],
  [286.62, 15.43, 330.21, 14.58, 236.40, -132.00],
  [70.93, -267.90, 173.78, -270.28, -48.33, -265.14],
];

/* Palette. Parchment and the greens are the brand's; the lantern amber
   and the warm motes are light only, never surface fills. */
const PARCHMENT = 0xf7f4ee;
const MOON      = 0xcfe0d6;   // cool, green-tinged moonlight
const LANTERN   = 0xffae5e;   // kerosene flame
const MOTE      = new THREE.Color(0xffd9a8);   // lantern-lit dust

function buildShape() {
  const shape = new THREE.Shape();
  shape.moveTo(OUTLINE[0][0], OUTLINE[0][1]);
  for (let i = 0; i < OUTLINE.length; i++) {
    const a = OUTLINE[i];
    const b = OUTLINE[(i + 1) % OUTLINE.length];
    shape.bezierCurveTo(a[4], a[5], b[2], b[3], b[0], b[1]);
  }
  return shape;
}

function buildMark() {
  const geometry = new THREE.ExtrudeGeometry(buildShape(), {
    depth: 150 - 2 * 8,      // Spline's depth includes the bevel on both faces
    bevelEnabled: true,
    bevelThickness: 8,
    bevelSize: 8,
    bevelSegments: 2,
    curveSegments: 40,
  });
  geometry.center();
  geometry.computeVertexNormals();

  // Aged enamel / bone: warm off-white with a soft satin, so the light
  // falls off into real shadow instead of glinting like plastic.
  const material = new THREE.MeshStandardMaterial({
    color: PARCHMENT,
    roughness: 0.62,
    metalness: 0.0,
  });

  return new THREE.Mesh(geometry, material);
}

/* ---- Motes ------------------------------------------------------- */
/* Sparse, warm specks drifting slowly upward through the light — dust in
   a projector beam, ash off a lantern. They brighten and fade softly. */
const MOTE_COUNT = 70;

function buildMotes() {
  const pos = new Float32Array(MOTE_COUNT * 3);
  const seed = new Float32Array(MOTE_COUNT * 4);
  for (let i = 0; i < MOTE_COUNT; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * 2600;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 1400;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 1400;
    seed[i * 4]     = Math.random() * 100;          // phase
    seed[i * 4 + 1] = 0.15 + Math.random() * 0.35;  // shimmer rate
    seed[i * 4 + 2] = 0.4 + Math.random() * 0.9;    // size
    seed[i * 4 + 3] = 12 + Math.random() * 28;      // rise speed
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('seed', new THREE.BufferAttribute(seed, 4));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime:  { value: 0 },
      uFade:  { value: 0 },
      uScale: { value: 1 },
      uColor: { value: MOTE },
    },
    vertexShader: /* glsl */`
      attribute vec4 seed;
      uniform float uTime, uScale;
      varying float vGlow;
      void main() {
        vec3 p = position;
        // Rise slowly, wrapping over a 1400-unit column; wander sideways.
        p.y = mod(p.y + 700.0 + uTime * seed.w, 1400.0) - 700.0;
        p.x += sin(uTime * 0.11 + seed.x) * 90.0;
        p.z += cos(uTime * 0.09 + seed.x * 1.3) * 60.0;
        // Fade in and out at the ends of the column, shimmer in between.
        float edge = smoothstep(-700.0, -450.0, p.y) * (1.0 - smoothstep(350.0, 700.0, p.y));
        vGlow = edge * (0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * seed.y * 3.0 + seed.x), 3.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = seed.z * uScale * 16000.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uFade;
      varying float vGlow;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = pow(max(0.0, 1.0 - d), 2.5) * vGlow * uFade * 0.5;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

/* Camera direction from the original scene: the mark is seen from
   slightly right of and below centre, which shows the underside of the
   top flourish and the bevelled return of the bottom swash. */
const VIEW_DIR = new THREE.Vector3(437.6, -202.9, 1179.8).normalize();

/* Cheap 1D value noise for the lantern's gutter. */
function noise1(x) {
  const i = Math.floor(x), f = x - i;
  const h = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

const easeOut = (x) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);

export function mount(container, options = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.domElement.className = 'hero__canvas';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 10, 10000);

  /* ---- Lighting: moonlight above, a lantern below ------------ */
  const sky = new THREE.HemisphereLight(0x5a786a, 0x040907, 0.45);
  scene.add(sky);

  // Moon: high and slightly in front. A point light with real falloff,
  // so the face runs from moonlit at the top into shadow at the foot.
  const moonKey = new THREE.PointLight(MOON, 0, 0, 2);
  moonKey.position.set(250, 1350, 750);
  scene.add(moonKey);
  const MOON_KEY = 3.4e6;

  // Moon rim: behind and to the right — a cool edge along the bevels.
  const moon = new THREE.DirectionalLight(MOON, 2.6);
  moon.position.set(900, 1100, -800);
  scene.add(moon);

  // Lantern: low, front-left, warm; it gutters in the loop and catches
  // the undersides of the flourish and crossbar.
  const lantern = new THREE.PointLight(LANTERN, 0, 0, 2);
  lantern.position.set(-700, -650, 600);
  scene.add(lantern);
  const LANTERN_BASE = 6e5;

  const pivot = new THREE.Group();
  const mark = buildMark();
  pivot.add(mark);
  scene.add(pivot);

  // Frame the mark so it sits at roughly the same size it did in Spline,
  // and pulls back on narrow (portrait) viewports so it never crops.
  const DIST = 1700;
  let motes = null;
  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const pullBack = camera.aspect < 1.1 ? 1.1 / camera.aspect : 1;
    camera.position.copy(VIEW_DIR).multiplyScalar(DIST * pullBack);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    if (motes) motes.material.uniforms.uScale.value = dpr * h / 900;
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  if (options.still) {
    lantern.intensity = LANTERN_BASE;
    moonKey.intensity = MOON_KEY;
    renderer.render(scene, camera);
    container.classList.add('is-live');
    return function unmount() { ro.disconnect(); renderer.dispose(); renderer.domElement.remove(); };
  }

  motes = buildMotes();
  scene.add(motes);
  resize();

  /* ---- Interaction ------------------------------------------------- */
  const target = { x: 0, y: 0 };   // pointer lean (radians)
  const drag = { active: false, x: 0, y: 0, rx: 0, ry: 0 };
  const spin = { x: 0, y: 0 };     // drag offset, eases back to 0

  function onPointerMove(e) {
    const r = container.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    target.y = nx * 0.18;
    target.x = ny * 0.12;
    if (drag.active) {
      spin.y = drag.ry + (e.clientX - drag.x) * 0.006;
      spin.x = drag.rx + (e.clientY - drag.y) * 0.004;
    }
  }
  function onPointerDown(e) {
    drag.active = true;
    drag.x = e.clientX; drag.y = e.clientY;
    drag.rx = spin.x; drag.ry = spin.y;
    container.setPointerCapture && container.setPointerCapture(e.pointerId);
    container.classList.add('is-dragging');
  }
  function onPointerUp() {
    drag.active = false;
    container.classList.remove('is-dragging');
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  container.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  /* ---- Render loop (paused when the hero is off-screen) ----------- */
  let visible = true;
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
  io.observe(container);

  const RISE = 3.2;              // seconds for the entrance
  const clock = new THREE.Clock();
  let raf = 0;
  let shown = false;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!visible) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // Entrance: rise out of the haze, lantern catching as it comes.
    const rise = easeOut(t / RISE);
    const catchT = Math.min(Math.max((t - 0.4) / 2.2, 0), 1);
    // A couple of false starts before the wick takes.
    const sputter = catchT < 1 ? (noise1(t * 14) > 0.45 ? 1 : 0.25) * catchT : 1;

    // Scroll: sink back into the haze and dim as the hero leaves.
    const h = container.clientHeight || 1;
    const sc = Math.min(Math.max(window.scrollY / h, 0), 1);

    if (!drag.active) {           // spring the drag offset back home
      const k = 1 - Math.exp(-dt * 2.5);
      spin.x += (0 - spin.x) * k;
      spin.y += (0 - spin.y) * k;
    }
    const ease = 1 - Math.exp(-dt * 3);
    pivot.rotation.x += (target.x + spin.x + Math.sin(t * 0.4) * 0.035 - pivot.rotation.x) * ease;
    pivot.rotation.y += (target.y + spin.y + Math.sin(t * 0.21) * 0.14 - pivot.rotation.y) * ease;
    pivot.rotation.z = Math.sin(t * 0.33) * 0.015;
    pivot.position.y = (1 - rise) * -320 + Math.sin(t * 0.7) * 10 - sc * 260;

    // Lantern gutter: slow breathing plus fast flame noise.
    const flame = 0.78 + 0.14 * noise1(t * 1.3) + 0.12 * noise1(t * 9.7) - 0.06 * noise1(t * 23.0);
    lantern.intensity = LANTERN_BASE * flame * sputter * (1 - sc * 0.6);
    lantern.position.x = -650 + noise1(t * 2.1) * 40;
    moon.intensity = 2.6 * (0.3 + 0.7 * rise);
    moonKey.intensity = MOON_KEY * (0.5 + 0.5 * rise) * (1 - sc * 0.5);

    motes.material.uniforms.uTime.value = t;
    motes.material.uniforms.uFade.value = Math.min(Math.max((t - 1.2) / 3, 0), 1);

    renderer.render(scene, camera);
    if (!shown) { shown = true; container.classList.add('is-live'); }
  }
  frame();

  return function unmount() {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    container.removeEventListener('pointerdown', onPointerDown);
    mark.geometry.dispose();
    mark.material.dispose();
    motes.geometry.dispose();
    motes.material.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
