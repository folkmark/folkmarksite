/* ============================================================
   FOLKMARK — script.js
   Three small jobs:
     1. Keep the footer year current.
     2. Track how far the hero has scrolled, for the ridge/fog parallax.
     3. Lazy-load the interactive 3D mark (logo3d.js + self-hosted
        three.js) so first paint stays fast. On capable desktops it rises
        out of the fog; everywhere else the still render stands in.

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

  /* ---- Hero scroll depth ------------------------------------------ */
  // Exposes how far the hero has scrolled away (0–1) as --hero-scroll, so
  // the ridges and fog can part at different speeds (CSS does the rest).
  var hero = document.querySelector('.hero');
  if (hero) {
    var ticking = false;
    var update = function () {
      ticking = false;
      var p = Math.min(Math.max(window.scrollY / (hero.offsetHeight || 1), 0), 1);
      hero.style.setProperty('--hero-scroll', p.toFixed(3));
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---- Lazy 3D mark ----------------------------------------------- */
  // The inline script in <head> decides whether this device gets WebGL
  // (precise pointer, motion allowed, not a constrained device) and marks
  // <html class="has-3d">. Everywhere else the still image stands in: no
  // extra download, no battery drain, no touch-vs-scroll conflict.
  var root = document.documentElement;
  var mountEl = document.getElementById('logo-mount');
  if (!mountEl || !root.classList.contains('has-3d')) { return; }

  // If the 3D mark can't start (no WebGL, blocked script), drop back to
  // the still rather than leaving an empty hero.
  function fallBack() { root.classList.remove('has-3d'); }
  setTimeout(function () {
    if (!mountEl.classList.contains('is-live')) { fallBack(); }
  }, 6000);

  function loadScene() {
    import('./logo3d.js')
      .then(function (m) { m.mount(mountEl); })
      .catch(fallBack);
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
