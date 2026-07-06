/**
 * Start downloading the AR model on the landing page so ar.html loads faster.
 */
(function preloadVeritasModel() {
  const phone = /android|iphone|ipod/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && Math.min(window.innerWidth, window.innerHeight) < 900);
  const src = phone ? 'assets/veritas-ar-ready-mobile.glb' : 'assets/veritas-ar-ready.glb';

  if (!document.querySelector(`link[rel="preload"][href="${src}"]`)) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'fetch';
    link.href = src;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }

  fetch(src, { mode: 'cors', credentials: 'same-origin' }).catch(() => {});
})();
