// Story intro viewer: a simple panel-by-panel modal opened from the start
// screen. Pure UI overlay — doesn't touch game state, Three.js, or the game
// loop at all. Each panel's text crawls upward over the image, Star-Wars
// style; see the storyScroll keyframes in css/style.css.

// Where the crawl should stop: the text block's top edge, in %-of-frame
// terms, such that its BOTTOM edge (the last line) lands at the frame's
// vertical middle rather than scrolling fully off past the top. Pulled out
// as a pure function — see tests/story-scroll.test.js — after an earlier
// version of this used a fraction of the animation's *duration* as a proxy
// for "reached the middle", which broke once text was much taller than the
// frame (duration and on-screen distance aren't proportional once the
// travelled distance itself was wrong).
function computeScrollEndPercent(textHeightPx, containerHeightPx) {
  return 50 - (textHeightPx / containerHeightPx) * 100;
}

// Node-only: lets tests/ `require()` this file for computeScrollEndPercent
// without a DOM. The rest of this file (the IIFE below) touches `document`
// at its top level, so it's guarded to not run there at all — never
// affects the browser, where `document` always exists.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeScrollEndPercent };
}

if (typeof document !== 'undefined') {
(function () {
  const PANELS = [
    {
      src: 'assets/story/panel1.jpg',
      caption: `Esta es la historia de Benito, un gato blanco panzon con un apetito legendario y un corazon aun mas grande. 

Todos los dias, despues de dar sus vueltas por el jardin en busca de leche y atun, se encontraba con Didi, una gata calico de mirada dulce y espiritu aventurero. 

Se habian conocido persiguiendo mariposas entre los rosales, y desde entonces eran inseparables. 

Cada atardecer se sentaban juntos en el banco de madera bajo el cerezo, compartiendo un cartón de leche y sonando con aventuras que, por suerte, todavia no sabian que estaban por vivir...`,
    },
    {
      src: 'assets/story/panel2.jpg',
      caption: `Pero una noche de luna llena, todo cambio!

 Un perro callejero, grandote, desalinado y con una sonrisa torcida que no auguraba nada bueno... 

Salto la cerca del jardin sin hacer ruido y antes de que nadie pudiera reaccionar, agarro a Didi entre sus patas y salio corriendo entre una nube de polvo y flores destrozadas.

Solo quedo el eco de un maullido asustado perdiendose en la noche... y un cartón de leche tirado en el pasto, derramandose de a poco, como si tambien estuviera llorando.`,
    },
    {
      src: 'assets/story/panel3.jpg',
      caption: `Benito no lo penso dos veces. Se seco las lagrimas con una pata, se ajusto su collar negro como si fuera una capa de heroe, y armo un atado con lo unico que un gato realmente necesita para una mision asi: un cartón de leche y una lata de atun para el camino.

"Te voy a encontrar, Didi, cueste lo que cueste", maullo decidido...

Y mirando el sendero que se perdia mas alla del jardin.

Ese dia, el gato mas glotón del barrio poco a poco y sin darse cuenta, se convertiria, en un heroe.`,
    },
    {
      src: 'assets/story/panel4.jpg',
      caption: `El camino era largo, y el sol ya se escondia detras de las colinas cuando Benito diviso, en lo alto de una loma lejana, una casucha siniestra con una bandera de calavera flameando al viento.

Trago saliva, junto coraje, y siguio caminando hacia el peligro sin dudar ni un segundo. 

Lo que Benito todavia no sabia era que esta aventura recien estaba empezando... 

Que lo esperaban trepadas, gatos rivales, y hasta un Gato Grande dispuesto a todo con tal de detenerlo.

Continuara...`,
    },
  ];

  // Preloaded as blob: URLs, not just `new Image()` — the dev server sends
  // Cache-Control: no-store (deliberately, to avoid stale-cache confusion
  // while iterating), so a plain preload wouldn't stop the browser
  // re-fetching over the network on every panel switch. Fetching once here
  // and swapping <img src> to the in-memory blob URL is instant regardless
  // of cache headers. Falls back to the original URL if a fetch fails.
  const preloadedSrc = PANELS.map((p) => p.src);
  Promise.all(PANELS.map((p, i) =>
    fetch(p.src).then((r) => r.blob()).then((blob) => {
      preloadedSrc[i] = URL.createObjectURL(blob);
    }).catch(() => {})
  ));

  const modal = document.getElementById('storyModal');
  const imageWrap = document.getElementById('storyImageWrap');
  const img = document.getElementById('storyImage');
  const scrollText = document.getElementById('storyScrollText');
  const counter = document.getElementById('storyCounter');
  const btnOpen = document.getElementById('storyBtn');
  const btnClose = document.getElementById('storyClose');
  const btnPrev = document.getElementById('storyPrev');
  const btnNext = document.getElementById('storyNext');

  let index = 0;
  let renderToken = 0; // guards against a stale image load resolving after the user already moved on
  let currentAnim = null; // the live CSSAnimation, so Space-hold can adjust its playbackRate
  const FAST_RATE = 4;

  function render() {
    counter.textContent = `${index + 1} / ${PANELS.length}`;
    btnPrev.disabled = index === 0;
    btnNext.textContent = index === PANELS.length - 1 ? 'Cerrar' : 'Siguiente →';

    const myToken = ++renderToken;
    const targetSrc = preloadedSrc[index];

    // Don't start the crawl (or show a stale/half-loaded picture) until the
    // image has actually finished loading — a fresh blob may still be
    // fetching (e.g. panel 1 on an auto-shown first run, before its preload
    // has had time to resolve), which previously left the old image
    // sitting there with the new text already scrolling over it.
    imageWrap.classList.add('loading');
    scrollText.style.animationName = 'none';

    function startCrawl() {
      if (myToken !== renderToken) return; // a newer render() superseded this one
      imageWrap.classList.remove('loading');
      scrollText.textContent = PANELS[index].caption;

      // Longer text gets more time to scroll by, so it stays readable.
      const seconds = Math.max(11, Math.min(30, PANELS[index].caption.length / 11));
      scrollText.style.animationDuration = `${seconds}s`;

      // Target: the LAST LINE (bottom of the text block) ends up at the
      // vertical middle of the frame, not scrolled all the way past the
      // top. In frame-relative % (top:0 = frame top, top:100 = frame
      // bottom), the block's top edge needs to be at "50% minus its own
      // height" for its bottom edge to land on the 50% mark. Since the
      // text is usually much taller than the frame, this is a much shorter
      // trip than "scroll fully off the top" — using a fraction of the
      // animation's *duration* as a proxy for that (the previous approach)
      // was wrong here, since duration and on-screen distance aren't
      // proportional once the endpoint itself is wrong.
      const containerH = imageWrap.clientHeight || 1;
      const textH = scrollText.scrollHeight || 1;
      const endPercent = computeScrollEndPercent(textH, containerH);
      scrollText.style.setProperty('--scroll-end', `${endPercent}%`);

      // A CSS animation with fill-mode:forwards freezes at its end state
      // once played — restart it by toggling off, forcing a reflow, then
      // back on (the standard "restart a CSS animation" trick).
      void scrollText.offsetWidth;
      scrollText.style.animationName = 'storyScroll';

      // Drive the auto-advance off the Web Animations API's own completion
      // signal rather than a hand-timed setTimeout — .finished already
      // accounts for playbackRate changes (see the Space-hold fast-forward
      // below), so speeding up the crawl speeds up the advance too, for
      // free, instead of needing separate remaining-time bookkeeping.
      currentAnim = scrollText.getAnimations()[0];
      if (currentAnim) {
        currentAnim.playbackRate = 1;
        const myAnim = currentAnim;
        myAnim.finished.then(() => {
          if (myToken === renderToken) advance();
        }).catch(() => {}); // rejects if cancelled (panel changed before finishing) — fine
      }
    }

    if (img.src === targetSrc && img.complete) {
      startCrawl();
    } else {
      img.onload = startCrawl;
      img.onerror = startCrawl; // don't get stuck on a failed load
      img.src = targetSrc;
    }
  }

  function advance() {
    if (index < PANELS.length - 1) { index++; render(); } else { close(); }
  }

  function open() {
    SFX.unlock();
    Music.play();
    index = 0;
    render();
    modal.classList.remove('hidden');
  }

  function close() {
    Music.stop();
    modal.classList.add('hidden');
  }

  btnOpen.addEventListener('click', open);
  btnClose.addEventListener('click', close);
  btnPrev.addEventListener('click', () => {
    if (index > 0) { index--; render(); }
  });
  btnNext.addEventListener('click', advance);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener('keydown', (e) => {
    if (modal.classList.contains('hidden')) return;
    if (e.code === 'Escape') close();
    else if (e.code === 'ArrowRight') btnNext.click();
    else if (e.code === 'ArrowLeft' && index > 0) { index--; render(); }
    else if (e.code === 'Space') {
      e.preventDefault(); // don't let it scroll the page behind the modal
      if (currentAnim) currentAnim.playbackRate = FAST_RATE;
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && currentAnim) currentAnim.playbackRate = 1;
  });

  // First time ever on this browser: show the story automatically instead
  // of waiting for a click — also means it plays while the 3D model loads
  // in the background rather than the player just staring at "Cargando...".
  // storyBtn itself was never actually gated on the model being ready (no
  // `disabled` anywhere in its wiring), so it's already clickable during
  // load too; this just removes the need to click it at all on a first run.
  let seenBefore = true;
  try {
    seenBefore = !!localStorage.getItem('benitoStorySeen');
    if (!seenBefore) localStorage.setItem('benitoStorySeen', '1');
  } catch (e) {
    seenBefore = false; // storage unavailable (e.g. private browsing) — just show it
  }
  if (!seenBefore) open();
})();
}
