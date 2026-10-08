/* ============================================================
   FOLKMARK — logo3d.js
   The 3D "F" mark, rebuilt natively with three.js (self-hosted in
   /vendor) — no Spline runtime, no third-party scene file.

   The outline, extrusion and camera framing are taken directly from
   the original Spline scene so the mark matches it exactly:
     - a closed bezier outline (15 anchors, below)
     - extruded 150 deep with an 8-unit, 2-segment bevel

   Light and motion use the brand palette only: the mark is parchment,
   lit by parchment-white light, falling off into the green shadow of
   the hero. It rises once on load, then follows the hero's scroll
   progress (--p on .hero: 0 at rest → 1 as it leaves), sinking back
   into the haze and turning away.

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

/* The brand's two colors. Light is parchment-white; the shadow side
   picks up the hero's green from the hemisphere fill. */
const PARCHMENT = 0xf7f4ee;
const GREEN     = 0x1d3c2e;

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

  // Satin parchment: soft enough that light falls off into real shadow
  // instead of glinting like plastic.
  const material = new THREE.MeshStandardMaterial({
    color: PARCHMENT,
    roughness: 0.6,
    metalness: 0.0,
  });

  return new THREE.Mesh(geometry, material);
}

/* Camera direction from the original scene: the mark is seen from
   slightly right of and below centre, which shows the underside of the
   top flourish and the bevelled return of the bottom swash. */
const VIEW_DIR = new THREE.Vector3(437.6, -202.9, 1179.8).normalize();

const easeOut = (x) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);

export function mount(container, options = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;   // keeps parchment true, no hue shift
  renderer.toneMappingExposure = 0.95;
  renderer.domElement.className = 'hero__canvas';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 10, 10000);

  /* ---- Lighting: parchment light, green shadow -------------------- */
  scene.add(new THREE.HemisphereLight(PARCHMENT, GREEN, 0.85));

  // Key: high and slightly in front, with real falloff, so the face runs
  // from fully lit at the top to a soft shadow at the foot.
  const key = new THREE.PointLight(PARCHMENT, 0, 0, 2);
  key.position.set(250, 1350, 750);
  scene.add(key);
  const KEY = 4.6e6;

  // Rim: behind and to the right — a clean edge along the bevels.
  const rim = new THREE.DirectionalLight(PARCHMENT, 0);
  rim.position.set(900, 1100, -800);
  scene.add(rim);
  const RIM = 1.8;

  const pivot = new THREE.Group();
  const mark = buildMark();
  pivot.add(mark);
  scene.add(pivot);

  // Frame the mark so it sits at roughly the same size it did in Spline,
  // and pulls back on narrow (portrait) viewports so it never crops.
  const DIST = 1700;
  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const pullBack = camera.aspect < 1.1 ? 1.1 / camera.aspect : 1;
    camera.position.copy(VIEW_DIR).multiplyScalar(DIST * pullBack);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  if (options.still) {
    key.intensity = KEY;
    rim.intensity = RIM;
    renderer.render(scene, camera);
    container.classList.add('is-live');
    return function unmount() { ro.disconnect(); renderer.dispose(); renderer.domElement.remove(); };
  }

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

  const hero = container.closest('.hero');
  const RISE = 2.6;              // seconds for the entrance
  const clock = new THREE.Clock();
  let raf = 0;
  let shown = false;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!visible) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // Entrance: rise out of the haze as the light comes up.
    const rise = easeOut(t / RISE);

    // Scroll: the hero's smoothed progress, written by script.js.
    const p = hero ? Math.max(0, parseFloat(hero.style.getPropertyValue('--p')) || 0) : 0;

    if (!drag.active) {           // spring the drag offset back home
      const k = 1 - Math.exp(-dt * 2.5);
      spin.x += (0 - spin.x) * k;
      spin.y += (0 - spin.y) * k;
    }
    const ease = 1 - Math.exp(-dt * 3);
    pivot.rotation.x += (target.x + spin.x + Math.sin(t * 0.4) * 0.03 + p * 0.35 - pivot.rotation.x) * ease;
    pivot.rotation.y += (target.y + spin.y + Math.sin(t * 0.21) * 0.1 - p * 0.5 - pivot.rotation.y) * ease;
    pivot.position.y = (1 - rise) * -320 + Math.sin(t * 0.7) * 8 - p * 380;

    key.intensity = KEY * (0.35 + 0.65 * rise) * (1 - p * 0.7);
    rim.intensity = RIM * rise * (1 - p * 0.5);

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
    renderer.dispose();
    renderer.domElement.remove();
  };
}
