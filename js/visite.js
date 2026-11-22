(() => {
  "use strict";

  const byId = id => document.getElementById(id);
  const film = byId("film");
  const journey = byId("parcours");
  const screen = byId("ecran");
  const still = byId("photo-plan");
  const playButton = byId("lecture");
  const range = byId("curseur");
  const examine = byId("examiner");
  const canvas = byId("objet-3d");
  const objectControls = byId("commandes-objet");
  const status = byId("etat-lecture");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const portrait = matchMedia("(max-width: 720px) and (orientation: portrait)");
  const last = Number(range.max);
  const clamp = value => Math.min(last, Math.max(0, value));
  const format = value => "0:" + String(Math.floor(value)).padStart(2, "0");
  const chapters = [
    { start: 0, post: "Impression", title: "La presse offset", image: "offset" },
    { start: 14, post: "Découpe et rainage", title: "L’autoplatine", image: "decoupe" },
    { start: 26, post: "Pliage et collage", title: "La plieuse-colleuse", image: "pliage" },
    { start: 38, post: "Conditionnement", title: "Le départ à plat", image: "depart" },
    { start: 45, post: "Réception", title: "Chez le client", image: "client" }
  ];
  const captions = [
    [0, "Au margeur, des ventouses prennent une à une les feuilles de carton vierge sur la palette."],
    [2.45, "Sur la table de marge, les feuilles se chevauchent. Chacune s’arrête contre les taquets frontaux, puis la pince l’emporte."],
    [4, "Du margeur à la réception, les groupes imprimants se succèdent dans la presse offset."],
    [5.85, "À chaque groupe, une nouvelle encre se dépose. Le décor se compose couleur après couleur."],
    [9.1, "En réception, les feuilles s’empilent de nouveau. Le même décor apparaît quatre fois sur chacune."],
    [14, "Au poste de découpe, une palette de feuilles imprimées alimente l’autoplatine."],
    [16.35, "La feuille imprimée quitte la pile et avance vers la platine."],
    [17.9, "La platine monte contre la forme. Les filets découpent les contours et marquent les plis."],
    [21, "Les poinçons chassent les déchets vers le bac. Les pinces gardent la feuille en repère."],
    [23.6, "En réception, les quatre poses se déposent à plat sur leurs piles."],
    [26, "Au margeur de la plieuse-colleuse, les poses sont empilées à plat, côté intérieur visible."],
    [28.30, "Les bandes entraînent la pose à plat vers le bec de colle."],
    [29.25, "Sous la buse fixe, un filet de colle s’allonge sur la patte latérale pendant son passage."],
    [32, "Les guides rabattent les panneaux. La face imprimée revient à l’extérieur."],
    [36, "Le joint est pressé. Les étuis collés se suivent à plat en une nappe régulière."],
    [38, "Les étuis sont rangés à plat dans leur caisse de transport."],
    [39.4, "Les petits rabats se couchent, puis les grands. Un ruban adhésif ferme la jonction."],
    [42, "Les caisses fermées quittent le quai sur palette."],
    [45, "À réception, un étui sort de la caisse. Ses faces s’écartent le long des rainages."],
    [48.65, "Le fond se ferme, puis le couvercle. L’étui monté est posé sur la table."]
  ];
  const chapterButtons = Array.from(document.querySelectorAll("[data-sequence]"));
  const station = byId("station");
  const post = byId("poste");
  const title = byId("plan-titre");
  const caption = byId("geste");
  const clock = byId("temps");

  let time = 0;
  let chapterIndex = -1;
  let captionIndex = -1;
  let active = false;
  let loaded = false;
  let mediaFailed = false;
  let pendingSeek = null;
  let playFrame = 0;
  let playRequest = 0;
  let scrollFrame = 0;
  let startY = 0;
  let travel = 0;
  let alignedY = 0;
  let inspectorOpen = false;
  let inspectorRequest = 0;
  let inspectorUnavailable = false;
  let renderer;
  let rendererPromise;
  let angle = 0;

  function compact() { return motion.matches || mediaFailed; }

  // Scroll mode draws a pre-rendered image sequence: every position is a still frame, so
  // scrubbing stays smooth in both directions. The MP4 is only used for continuous playback.
  const sequence = byId("sequence");
  const sequenceContext = sequence.getContext("2d");
  const fps = 12, frameCount = 625;
  let frames = [], requested = new Set(), queue = [], inflight = 0, shown = -1, sequenceSet = "";
  function sequenceDir() { return "assets/film/seq/" + (portrait.matches ? "p/" : "l/"); }
  function resetSequence() {
    if (sequenceSet === sequenceDir()) return;
    sequenceSet = sequenceDir(); frames = []; requested = new Set(); queue = []; shown = -1;
    for (const step of [48, 12, 4, 1]) for (let i = 0; i < frameCount; i += step) queue.push(i);
  }
  function pump() {
    while (inflight < 6 && queue.length) {
      const i = queue.shift();
      if (requested.has(i)) continue;
      requested.add(i); inflight++;
      const image = new Image(), set = sequenceSet;
      image.decoding = "async";
      image.onload = () => { inflight--; if (set === sequenceSet) { frames[i] = image; if (shown !== Math.round(time * fps)) drawSequence(); } pump(); };
      image.onerror = () => { inflight--; pump(); };
      image.src = set + String(i + 1).padStart(3, "0") + ".webp?v=5";
    }
  }
  function want(index) {
    for (let d = 0; d < 10; d++) for (const i of [index + d, index - d]) if (i >= 0 && i < frameCount && !requested.has(i)) queue.unshift(i);
    pump();
  }
  function drawSequence() {
    resetSequence();
    const index = Math.min(frameCount - 1, Math.round(time * fps));
    want(index);
    let pick = -1;
    for (let d = 0; d < frameCount && pick < 0; d++) {
      if (frames[index - d]) pick = index - d; else if (frames[index + d]) pick = index + d;
    }
    if (pick < 0) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const box = sequence.parentElement, w = Math.round(box.clientWidth * ratio), h = Math.round(box.clientHeight * ratio);
    if (!w || !h) return;
    if (sequence.width !== w || sequence.height !== h) { sequence.width = w; sequence.height = h; shown = -1; }
    if (pick === shown) return;
    const image = frames[pick], scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
    const dw = image.naturalWidth * scale, dh = image.naturalHeight * scale;
    sequenceContext.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
    shown = pick === index ? pick : -1;
    journey.classList.add("sequence-ready");
  }

  function framePath(name) {
    return "assets/film/" + (portrait.matches ? "portrait/" : "") + name + ".webp?v=5";
  }

  function measure() {
    startY = window.scrollY + journey.getBoundingClientRect().top;
    travel = Math.max(0, journey.offsetHeight - screen.offsetHeight);
  }

  function refresh() {
    const index = chapters.reduce((match, item, i) => time >= item.start ? i : match, 0);
    if (index !== chapterIndex) {
      chapterIndex = index;
      const item = chapters[index];
      station.textContent = String(index + 1).padStart(2, "0") + " / 05";
      post.textContent = item.post;
      title.textContent = item.title;
      chapterButtons.forEach((button, i) => {
        if (i === index) button.setAttribute("aria-current", "step");
        else button.removeAttribute("aria-current");
      });
    }
    const line = captions.reduce((match, item, i) => time >= item[0] ? i : match, 0);
    if (captionIndex !== line) {
      captionIndex = line;
      caption.textContent = captions[line][1];
    }
    const clockValue = format(time);
    if (clock.textContent !== clockValue) {
      clock.textContent = clockValue;
    }
    range.value = String(time);
    range.setAttribute("aria-valuetext", clockValue + " sur 0:52, " + chapters[index].title);
    range.style.setProperty("--progress", (time / last * 100).toFixed(2) + "%");
    still.hidden = !(compact() && !active && !inspectorOpen);
    if (!still.hidden) {
      const file = framePath(time < 1 ? "feuille" : chapters[index].image);
      if (still.dataset.frame !== file) {
        still.dataset.frame = file;
        still.src = file;
      }
    }
    examine.hidden = time < last - 2 || inspectorOpen || inspectorUnavailable;
    playButton.classList.toggle("playing", active);
    journey.classList.toggle("sequence-mode", !active && !compact());
    if (!active && !compact()) drawSequence();
    document.dispatchEvent(new CustomEvent("larre:temps", {detail: {time, playing: active}}));
    const playLabel = mediaFailed ? "Réessayer de lire le film" : active ? "Mettre le film en pause" :
      time >= last - .1 ? "Revoir le film" : "Lire le film";
    playButton.setAttribute("aria-label", playLabel);
    playButton.title = playLabel;
  }

  function loadFilm() {
    if (loaded || mediaFailed) return;
    loaded = true;
    film.preload = "auto";
    film.load();
  }

  function applySeek() {
    if (pendingSeek === null || film.readyState < 1 || film.seeking || mediaFailed) return;
    const target = pendingSeek;
    pendingSeek = null;
    if (Math.abs(film.currentTime - target) > .018) film.currentTime = target;
  }

  function movePage() {
    alignedY = Math.round(startY + (travel * time / last));
    if (Math.abs(window.scrollY - alignedY) >= 1) window.scrollTo(0, alignedY);
  }

  function seek(value, align) {
    time = clamp(value);
    if (!active && !compact()) drawSequence();
    else if (active) {
      loadFilm();
      pendingSeek = time;
      applySeek();
    }
    if (align) movePage();
    refresh();
  }

  function pause() {
    if (!active) return;
    active = false;
    playRequest++;
    cancelAnimationFrame(playFrame);
    film.pause();
    refresh();
  }

  function endPlayback() {
    if (!active) return;
    pause();
    time = last;
    if (!compact()) movePage();
    refresh();
    status.textContent = "Film terminé. Vous pouvez maintenant faire tourner l’étui.";
  }

  function tick() {
    if (!active) return;
    if (!film.seeking && pendingSeek === null && film.readyState >= 2) {
      time = clamp(film.currentTime);
      refresh();
      if (!compact()) movePage();
      if (time >= last) { endPlayback(); return; }
    }
    playFrame = requestAnimationFrame(tick);
  }

  function play() {
    return; // Le film avance uniquement au défilement.
    if (active) return;
    if (mediaFailed) {
      mediaFailed = false;
      loaded = false;
      journey.classList.toggle("still-mode", compact());
      byId("mode-film").textContent = "La ligne de fabrication";
    }
    closeInspector();
    const restart = time >= last - .1;
    if (restart) time = 0;
    active = true;
    const request = ++playRequest;
    loadFilm();
    pendingSeek = time;
    applySeek();
    measure();
    movePage();
    refresh();
    film.play().then(() => {
      if (active && request === playRequest) tick();
    }).catch(error => {
      if (request !== playRequest) return;
      pause();
      if (error.name === "NotSupportedError") mediaFailure();
      else status.textContent = "La lecture est en pause. Utilisez le bouton de lecture pour la reprendre.";
    });
  }

  function togglePlayback() { if (active) pause(); else play(); }

  function manual(value, align = true) {
    pause();
    closeInspector();
    seek(value, align);
  }

  function syncScroll() {
    scrollFrame = 0;
    if (compact() || active || !travel) return;
    const position = window.scrollY - startY;
    const target = clamp(position * last / travel);
    if (inspectorOpen && (position < travel * .94 || position > travel + screen.offsetHeight * .6)) closeInspector();
    if (Math.abs(time - target) < .025) return;
    if ((position < 0 || position >= travel + screen.offsetHeight - 1) && !loaded) {
      time = target;
      refresh();
    } else {
      seek(target, false);
    }
  }

  function queueScroll() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(syncScroll);
  }

  function mediaFailure() {
    if (mediaFailed) return;
    const onScreen = screen.getBoundingClientRect();
    const viewing = onScreen.top <= 1 && onScreen.bottom > 1;
    mediaFailed = true;
    pause();
    journey.classList.add("still-mode");
    byId("mode-film").textContent = "Parcours en images";
    measure();
    if (viewing) movePage();
    refresh();
    status.textContent = "Le film s’affiche en images. Vous pouvez changer de chapitre ou utiliser Lecture pour réessayer.";
  }

  function enter(event, value, autoplay) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (location.hash !== "#parcours") history.pushState(null, "", "#parcours");
    measure();
    manual(value);
    playButton.focus({preventScroll:true});
    if (autoplay) play();
  }

  function motionChange() {
    pause();
    closeInspector();
    const box = screen.getBoundingClientRect();
    const viewing = box.top <= 1 && box.bottom > 1;
    journey.classList.toggle("still-mode", compact());
    measure();
    if (viewing) seek(time, true);
    else refresh();
  }

  function closeInspector(focus = false) {
    ++inspectorRequest;
    if (!inspectorOpen) return;
    inspectorOpen = false;
    canvas.hidden = objectControls.hidden = true;
    refresh();
    if (focus && !examine.hidden) examine.focus({preventScroll:true});
  }

  function spin(delta) {
    if (!inspectorOpen || !renderer) return;
    angle = (angle + delta) % (2 * Math.PI);
    renderer.draw(last, angle);
  }

  function inspectionFailure() {
    inspectorUnavailable = true;
    closeInspector();
    refresh();
    status.textContent = "La rotation 3D est indisponible sur cet appareil. L’étui monté reste visible à la fin du film.";
    range.focus({preventScroll:true});
  }

  async function openInspector() {
    pause();
    seek(last, true);
    inspectorOpen = true;
    const request = ++inspectorRequest;
    refresh();
    try {
      const scene = await import("./scene.js?v=5");
      if (!inspectorOpen || request !== inspectorRequest) return;
      canvas.hidden = false;
      rendererPromise ||= scene.atelierRenderer(canvas);
      renderer = await rendererPromise;
      if (!inspectorOpen || request !== inspectorRequest) return;
      angle = 0;
      spin(0);
      objectControls.hidden = false;
      byId("rotation-gauche").focus({preventScroll:true});
      status.textContent = "Étui en trois dimensions. Utilisez les boutons ou faites glisser l’étui de gauche à droite.";
    } catch {
      if (inspectorOpen && request === inspectorRequest) inspectionFailure();
    }
  }

  let drag = null;
  canvas.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    drag = event.clientX;
  });
  canvas.addEventListener("pointermove", event => {
    if (!event.isPrimary || drag === null) return;
    spin((event.clientX - drag) * .012);
    drag = event.clientX;
  });
  const stopDrag = () => { drag = null; };
  canvas.addEventListener("lostpointercapture", stopDrag);
  canvas.addEventListener("pointercancel", stopDrag);
  canvas.addEventListener("webglcontextlost", inspectionFailure);
  byId("rotation-gauche").addEventListener("click", () => spin(-Math.PI / 6));
  byId("rotation-droite").addEventListener("click", () => spin(Math.PI / 6));
  byId("fermer-objet").addEventListener("click", () => closeInspector(true));
  examine.addEventListener("click", openInspector);

  playButton.addEventListener("click", togglePlayback);
  byId("lancer")?.addEventListener("click", event => enter(event, 0, false));
  document.querySelectorAll("[data-enter]").forEach(link => {
    link.addEventListener("click", event => enter(event, Number(link.dataset.enter), false));
  });
  chapterButtons.forEach(button => button.addEventListener("click", () => manual(Number(button.dataset.sequence))));
  range.addEventListener("input", () => manual(Number(range.value)));
  range.addEventListener("keydown", event => {
    const step = event.shiftKey ? 5 : 1;
    const values = {ArrowLeft:time-step, ArrowDown:time-step, ArrowRight:time+step, ArrowUp:time+step, Home:0, End:last};
    if (!(event.key in values)) return;
    event.preventDefault();
    manual(values[event.key]);
  });
  document.addEventListener("keydown", event => {
    if (inspectorOpen && ["Escape","ArrowLeft","ArrowRight"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "Escape") closeInspector(true);
      else spin((event.key === "ArrowLeft" ? -1 : 1) * Math.PI / 12);
    } else if (active && !event.defaultPrevented && ["ArrowUp","ArrowDown","PageUp","PageDown","Home","End","Tab"].includes(event.key)) {
      pause();
    }
  });
  window.addEventListener("scroll", () => {
    if (active && !compact() && Math.abs(window.scrollY - alignedY) > 3) pause();
    queueScroll();
  }, {passive:true});
  window.addEventListener("wheel", pause, {passive:true});
  window.addEventListener("touchmove", pause, {passive:true});
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
  document.querySelectorAll("a[href^='#']").forEach(link => {
    if (link.hasAttribute("data-enter") || link.id === "lancer") return;
    link.addEventListener("click", () => {
      pause();
      closeInspector();
      if (link.hash === "#lecture-film") byId("lecture-film").open = true;
    });
  });
  window.addEventListener("hashchange", () => {
    pause();
    closeInspector();
    if (location.hash === "#lecture-film") byId("lecture-film").open = true;
    queueScroll();
  });
  film.addEventListener("loadedmetadata", applySeek);
  film.addEventListener("seeked", applySeek);
  film.addEventListener("ended", endPlayback);
  film.addEventListener("error", mediaFailure);
  const sources = Array.from(film.querySelectorAll("source"));
  sources[sources.length - 1].addEventListener("error", () => { if (film.readyState === 0) mediaFailure(); });
  motion.addEventListener("change", motionChange);
  function chooseFraming() {
    film.poster = framePath("feuille");
    const file = portrait.matches ? "fabrication-mobile.mp4?v=5" : "fabrication.mp4?v=5";
    if (loaded && !mediaFailed && film.currentSrc && !film.currentSrc.endsWith("/" + file)) {
      const resume = active;
      pause();
      loaded = false;
      pendingSeek = time;
      loadFilm();
      if (resume) play();
    }
    refresh();
  }
  portrait.addEventListener("change", chooseFraming);
  window.addEventListener("resize", () => { shown = -1; if (!active && !compact()) drawSequence(); });
  new IntersectionObserver((entries, observer) => {
    if (entries.some(entry => entry.isIntersecting) && !compact()) { drawSequence(); observer.disconnect(); }
  }, {rootMargin: "150% 0px"}).observe(journey);

  const processPage = "https://www.cartonnages-larre.fr/fr/process.html";
  const photos = {
    atelier: {
      title:"Le hall de production", alt:"Vue d’ensemble du hall de production de Cartonnages Larré à Bayonne.",
      detail:"Du bureau d’études au pliage-collage, l’entreprise travaille le carton compact et la micro-cannelure.",
      source:"https://www.cartonnages-larre.fr/fr/"
    },
    bureau: {
      title:"La table du bureau d’études", alt:"Table de découpe numérique et forme d’étui à plat au bureau d’études.",
      detail:"Le bureau d’études travaille le volume et réalise des prototypes. C’est ici que se décident les dimensions et les plis de l’étui."
    },
    presse: {
      title:"Vue de la presse publiée par Larré", alt:"Vue technique d’une presse offset avec ses groupes imprimants alignés.",
      detail:"Larré présente une impression offset allant jusqu’à six couleurs, avec possibilité de vernis. Dans le film, le motif se construit au fil des groupes imprimants."
    },
    autoplatine: {
      title:"L’autoplatine de découpe", alt:"Un opérateur règle la forme de découpe devant l’autoplatine de l’atelier.",
      detail:"Devant l’autoplatine, l’opérateur règle la forme. Ses filets découpent le carton et marquent les lignes de pli."
    },
    courroies: {
      title:"Les courroies de la plieuse-colleuse", alt:"Gros plan sur les courroies vertes et les galets métalliques de la plieuse-colleuse.",
      detail:"Les guides accompagnent les plis. Les courroies entraînent les étuis et maintiennent le collage pendant leur passage."
    }
  };
  const photoButtons = Array.from(document.querySelectorAll("[data-photo]"));
  photoButtons.forEach(button => button.addEventListener("click", () => {
    const key = button.dataset.photo;
    const photo = photos[key];
    const image = byId("vue-photo");
    image.alt = photo.alt;
    image.src = "assets/images/" + key + ".webp";
    image.classList.toggle("show-machine", key === "presse");
    byId("vue-legende").textContent = photo.title;
    byId("vue-detail").textContent = photo.detail;
    byId("vue-source").href = photo.source || processPage;
    photoButtons.forEach(item => item.setAttribute("aria-pressed", String(button === item)));
  }));

  document.documentElement.classList.add("enhanced");
  film.controls = false;
  journey.classList.toggle("still-mode", compact());
  if (location.hash === "#lecture-film") byId("lecture-film").open = true;
  const resize = () => {
    const onTrack = travel > 0 && window.scrollY >= startY && window.scrollY <= startY + travel;
    measure();
    if (onTrack && !compact()) movePage();
    if (inspectorOpen && renderer) spin(0);
    if (!compact()) queueScroll();
  };
  window.addEventListener("resize", resize);
  window.addEventListener("pageshow", resize);
  if (document.fonts) document.fonts.ready.then(resize);
  measure();
  chooseFraming();
  queueScroll();
})();
