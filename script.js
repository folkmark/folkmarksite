/* ============================================================
   FOLKMARK — script.js
   Two small jobs:
     1. Keep the footer year current.
     2. Defer-mount the (heavy, WebGL) Spline hero so first paint
        stays fast — especially on mobile.
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

  function mountScene() {
    if (mount.dataset.mounted === 'true') { return; }
    mount.dataset.mounted = 'true';
    // Exact embed as provided — do not modify.
    mount.innerHTML =
      "<iframe src='https://my.spline.design/folkmarkf-zlB40628vqBkXU3bEiIoL77P/' frameborder='0' width='100%' height='100%'></iframe>";
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
