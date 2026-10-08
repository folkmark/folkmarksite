/* ============================================================
   FOLKMARK — script.js
   Three small jobs:
     1. Keep the footer year current.
     2. Scroll: weighted smooth scrolling (Lenis) on desktop, and a
        smoothed -1 → 0 → 1 progress value on each [data-scroll] element
        that CSS turns into motion.
     3. Lazy-load the interactive 3D mark (logo3d.js + self-hosted
        three.js) so first paint stays fast. On capable desktops it rises
        out of the haze; everywhere else the still render stands in.

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

  /* ---- Scroll progress: -1 → 0 → 1 -------------------------------- */
  // Every [data-scroll] element gets two custom properties, smoothed
  // toward the true scroll position each frame so motion glides rather
  // than stepping with the wheel (native scrolling is left untouched):
  //   --p   linear progress: -1 entering from below, 0 centred in the
  //         viewport, 1 leaving off the top
  //   --pe  the same, eased — it holds at 0 around the centre (so type
  //         is still while it's being read) and eases out at both ends
  // CSS maps these to transforms and opacity, so one continuous curve
  // drives each element in, holds it, and carries it out — no separate
  // enter and exit animations. Reduced motion: never set, so everything
  // rests at 0 (the CSS defaults).
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var tracked = [].slice.call(document.querySelectorAll('[data-scroll]'));

  // Weighted smooth scrolling (Lenis, self-hosted) for mouse and trackpad
  // only: touch keeps the phone's own native scrolling, and reduced motion
  // keeps the browser's. Lenis still moves the real scroll position, so
  // everything below just listens to ordinary scroll events.
  var lenis = null;
  var finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  if (!reduce && finePointer && window.Lenis) {
    lenis = new window.Lenis({ autoRaf: true, lerp: 0.085, wheelMultiplier: 0.9, anchors: true });
  }

  if (!reduce && tracked.length) {
    var items = tracked.map(function (el) { return { el: el, p: null, target: 0 }; });
    var running = false;
    var last = 0;

    var measure = function () {
      var vh = window.innerHeight;
      var room = document.documentElement.scrollHeight - vh - window.scrollY;
      items.forEach(function (it) {
        var r = it.el.getBoundingClientRect();
        var span = (vh + r.height) / 2;
        var t = (vh / 2 - (r.top + r.height / 2)) / span;
        // Near the foot of the page an element may never reach the centre.
        // Where it will end up at full scroll is its "rest": remap the
        // entering half so it arrives at 0 exactly as the page bottoms out.
        var atEnd = t + Math.max(room, 0) / span;
        if (atEnd < 0) { t = t >= atEnd ? 0 : -1 + (t + 1) / (atEnd + 1); }
        it.target = Math.min(Math.max(t, -1), 1);
        if (it.p === null) { it.p = it.target; }   // first paint: no glide
      });
    };

    // Ease with a held centre: flat through |p| < 0.12, smoothstep after.
    var eased = function (p) {
      var x = Math.min(Math.max((Math.abs(p) - 0.12) / 0.88, 0), 1);
      return (p < 0 ? -1 : 1) * x * x * (3 - 2 * x);
    };

    var write = function (it) {
      it.el.style.setProperty('--p', it.p.toFixed(4));
      it.el.style.setProperty('--pe', eased(it.p).toFixed(4));
    };

    var tick = function (now) {
      var dt = Math.min((now - last) / 1000 || 0.016, 0.05);
      last = now;
      measure();
      // Smoothing (higher = tighter). With Lenis the scroll itself already
      // glides, so follow it closely rather than stacking a second lag.
      var k = 1 - Math.exp(-dt * (lenis ? 18 : 7));
      var moving = false;
      items.forEach(function (it) {
        var d = it.target - it.p;
        if (Math.abs(d) > 0.0004) { it.p += d * k; moving = true; } else { it.p = it.target; }
        write(it);
      });
      if (moving) { requestAnimationFrame(tick); } else { running = false; }
    };

    var kick = function () {
      if (running) { return; }
      running = true;
      last = performance.now();
      requestAnimationFrame(tick);
    };

    measure();
    items.forEach(write);
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', kick);
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
