/* ============================================================
   FOLKMARK — script.js
   Two small jobs:
     1. Keep the footer year current.
     2. Lazy-load the (heavy, WebGL) Spline runtime so first paint stays
        fast — especially on mobile. The <spline-viewer> and its inline
        poster live in the HTML; loading the runtime is what upgrades the
        element from the still poster to the live 3D scene.

   Reduced-motion: the runtime is never loaded, so the still poster image
   remains — an intentional static hero instead of an animated one.
   ============================================================ */
(function () {
  'use strict';

  /* ---- Footer year -------------------------------------------------- */
  var yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  /* ---- Lazy Spline runtime ------------------------------------------ */
  var viewer = document.querySelector('#spline-mount spline-viewer');
  if (!viewer) { return; }

  // Respect reduced-motion: leave the still poster in place, skip the
  // animated WebGL scene entirely.
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) { return; }

  // Pinned runtime. Loading (defining) it upgrades the static <spline-viewer>,
  // which then swaps its inline poster for the live scene.
  var VIEWER_SRC = 'https://unpkg.com/@splinetool/viewer@1.12.98/build/spline-viewer.js';

  function loadRuntime() {
    if (document.querySelector('script[data-spline-viewer]')) { return; }
    var runtime = document.createElement('script');
    runtime.type = 'module';
    runtime.src = VIEWER_SRC;
    runtime.setAttribute('data-spline-viewer', '');
    document.head.appendChild(runtime);
  }

  // Wait until the page has loaded, then load on the next idle frame
  // (capped so it never stalls indefinitely). The poster shows meanwhile.
  function schedule() {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(loadRuntime, { timeout: 1200 });
    } else {
      setTimeout(loadRuntime, 600);
    }
  }

  if (document.readyState === 'complete') {
    schedule();
  } else {
    window.addEventListener('load', schedule, { once: true });
  }
}());
