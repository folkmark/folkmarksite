/* ============================================================
   FOLKMARK — script.js
   Two small jobs:
     1. Keep the footer year current.
     2. Defer-mount the (heavy, WebGL) Spline hero via the official
        <spline-viewer> web component so first paint stays fast —
        especially on mobile. The scene starts hidden and fades in on
        load, so the forest-green field is all that shows until it is
        ready: no white flash, no loading spinner.
   ============================================================ */
(function () {
  'use strict';

  /* ---- Footer year -------------------------------------------------- */
  var yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  /* ---- Deferred Spline hero mount ----------------------------------- */
  var mount = document.getElementById('spline-mount');
  if (!mount) { return; }

  // Respect reduced-motion: skip the animated WebGL scene entirely and
  // leave the static forest-green field in place.
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) { return; }

  // Pinned viewer runtime + the scene's code export. Swap SCENE_URL if the
  // scene is re-exported from the Spline editor (Export → Code).
  var VIEWER_SRC = 'https://unpkg.com/@splinetool/viewer@1.12.98/build/spline-viewer.js';
  var SCENE_URL  = 'https://prod.spline.design/7sQDucqU1m47Oo3Q/scene.splinecode';

  function mountScene() {
    if (mount.dataset.mounted === 'true') { return; }
    mount.dataset.mounted = 'true';

    // Load the viewer runtime once (ES module, injected late to keep first
    // paint fast). The custom element upgrades as soon as this defines it.
    if (!document.querySelector('script[data-spline-viewer]')) {
      var runtime = document.createElement('script');
      runtime.type = 'module';
      runtime.src = VIEWER_SRC;
      runtime.setAttribute('data-spline-viewer', '');
      document.head.appendChild(runtime);
    }

    var viewer = document.createElement('spline-viewer');
    viewer.setAttribute('url', SCENE_URL);
    viewer.setAttribute('background', '#1D3C2E'); // forest green — never white

    // Fade the scene in once it reports loaded; a timer fallback reveals it
    // even if the event never fires. If it errors, the green field simply
    // stays — a graceful, on-brand fallback.
    var reveal = function () { viewer.classList.add('is-loaded'); };
    viewer.addEventListener('load', reveal, { once: true });
    setTimeout(reveal, 5000);

    mount.appendChild(viewer);
  }

  // Wait until the page has loaded, then mount on the next idle frame
  // (capped so it never stalls indefinitely). The green field shows
  // meanwhile, so there's no blank/white gap.
  function schedule() {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(mountScene, { timeout: 1200 });
    } else {
      setTimeout(mountScene, 600);
    }
  }

  if (document.readyState === 'complete') {
    schedule();
  } else {
    window.addEventListener('load', schedule, { once: true });
  }
}());
