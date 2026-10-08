/* ============================================================
   FOLKMARK — script.js
   Two small jobs:
     1. Keep the footer year current.
     2. Lazy-load the interactive 3D mark (logo3d.js + self-hosted
        three.js) so first paint stays fast. The still render of the mark
        lives in the HTML; once the live canvas has drawn its first frame
        it fades in over it.

   On phones, reduced-motion, or constrained connections/devices the
   3D code is never loaded, so the still image remains — an intentional
   static hero instead of an animated one.
   ============================================================ */
(function () {
  'use strict';

  /* ---- Footer year -------------------------------------------------- */
  var yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  /* ---- Lazy 3D mark ----------------------------------------------- */
  var mountEl = document.getElementById('logo-mount');
  if (!mountEl) { return; }

  // Only load WebGL where it earns its cost: a precise pointer (i.e. not a
  // touchscreen), motion allowed, and not a constrained connection/device.
  // On phones — and anywhere this returns false — the still image stands
  // in: no extra download, no battery drain, no touch-vs-scroll conflict.
  function wantsScene() {
    var mm = window.matchMedia;
    if (mm) {
      if (mm('(prefers-reduced-motion: reduce)').matches) { return false; }
      if (mm('(pointer: coarse)').matches) { return false; }  // touchscreens
    }
    var c = navigator.connection;
    if (c && (c.saveData || /(?:^|-)2g$/.test(c.effectiveType || ''))) { return false; }
    if (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory < 4) { return false; }
    return true;
  }
  if (!wantsScene()) { return; }

  function loadScene() {
    import('./logo3d.js')
      .then(function (m) { m.mount(mountEl); })
      .catch(function () { /* WebGL unavailable: the still image stays */ });
  }

  // Wait until the page has loaded, then load on the next idle frame
  // (capped so it never stalls indefinitely). The still shows meanwhile.
  function schedule() {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(loadScene, { timeout: 1200 });
    } else {
      setTimeout(loadScene, 600);
    }
  }

  if (document.readyState === 'complete') {
    schedule();
  } else {
    window.addEventListener('load', schedule, { once: true });
  }
}());
