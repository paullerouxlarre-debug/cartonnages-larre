// Opening, played as a film in chapters. The page holds still while it plays: each gesture
// (wheel, swipe, arrow key, or the buttons) plays one step, which then runs on its own and stops
// on a settled frame. Once the box stands it can be turned by hand, and the page is released.
// Reduced motion shows the finished box and scrolls freely.
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const coarse = matchMedia("(pointer: coarse)").matches;
const section = document.getElementById("encre");
const canvas = document.getElementById("encre-3d");
const root = document.documentElement;
const labels = [...section.querySelectorAll("[data-from]")].map(el => ({el, from: +el.dataset.from, to: +el.dataset.to, edge: +(el.dataset.edge || .018)}));
// Chapter ends in scene time, their playing time in seconds, the hint once each one is over,
// and the label shown while it plays.
const chapters = [
  {end: 0, seconds: 1, hint: "Faites défiler pour lancer l’impression"},
  {end: .512, seconds: 18, keys: [[0, 0], [1 / 18, .05 / .512], [13.4 / 18, .36 / .512], [1, 1]], hint: "Impression terminée · défilez pour la découpe", playing: "Étape 1/4 · l’impression"},
  {end: .658, seconds: 9, hint: "Découpe terminée · défilez pour le pliage-collage", playing: "Étape 2/4 · la découpe"},
  {end: .814, seconds: 9, hint: "Pliage terminé · défilez pour monter l’étui", playing: "Étape 3/4 · le pliage-collage"},
  {end: 1, seconds: 10, hint: coarse ? "Glissez pour tourner la boîte · puis défilez" : "Tournez la boîte à la souris · puis défilez", playing: "Étape 4/4 · l’étui prend forme"}
];
const LAST = chapters.length - 1;
const hint = document.getElementById("encre-indice"), hintBox = hint?.parentElement;
const steps = [...section.querySelectorAll("[data-actif]")].map(el => { const [from, to] = el.dataset.actif.split(",").map(Number); return {el, from, to}; });
const statements = [...document.querySelectorAll(".statements p")].map(el => ({el, from: +el.dataset.from, to: +el.dataset.to}));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const u = clamp((v - a) / (b - a)); return u * u * (3 - 2 * u); };

function fade(items, t) {
  for (const s of items) {
    const edge = s.edge;
    const v = smooth(s.from - (s.from > 0 ? edge : 1), s.from + edge, t) * (1 - smooth(s.to - edge, s.to + (s.to >= 1 ? 1 : edge), t));
    s.el.style.opacity = v.toFixed(3);
    s.el.style.visibility = v < .01 ? "hidden" : "visible";
    s.el.style.transform = `translateY(${((1 - v) * (t < s.from + edge ? 2.5 : -2.5)).toFixed(2)}vh)`;
  }
}

// Even pace with a short start and a short settle (about 0.8 s each), so the steps keep a steady rhythm.
let ramp = .08;
const easeChapter = u => { const a = ramp, v = 1 / (1 - a); return u < a ? v * u * u / (2 * a) : u > 1 - a ? 1 - v * (1 - u) * (1 - u) / (2 * a) : v * (u - a / 2); };
// Optional keys [time, scene] inside a chapter give its parts their own pace:
// the title leaves in one second, each ink gets two, the varnish and its reflection four and a half.
const through = (keys, u, back = false) => {
  if (!keys) return u;
  const [a, b] = back ? [1, 0] : [0, 1];
  for (let i = 1; i < keys.length; i++) if (u <= keys[i][a]) { const k0 = keys[i - 1], k1 = keys[i]; return k0[b] + (k1[b] - k0[b]) * (u - k0[a]) / (k1[a] - k0[a]); }
  return 1;
};
const invEase = v => { let a = 0, b = 1; for (let i = 0; i < 24; i++) { const m = (a + b) / 2; if (easeChapter(m) < v) a = m; else b = m; } return (a + b) / 2; };
// `chapter` is the step asked for; it only changes through a gesture or a button, never through the scroll position.
let scene = null, progress = 0, frame = 0, visible = true, failed = false, chapter = 0, last = 0, clockIn = -1, local = 0;
const played = () => chapters.reduce((d, c, i) => c.end <= progress + 1e-6 ? i : d, 0);
const finished = () => chapter === LAST && progress >= 1;

function advance(now) {
  const dt = Math.min(.1, last ? (now - last) / 1000 : 0); last = now;
  const target = chapters[chapter].end;
  if (progress < target) {
    // Each chapter plays on its own clock and eases into a settled frame at its end.
    const k = Math.max(1, chapters.findIndex(c => c.end > progress + 1e-6));
    const c = chapters[k], prev = chapters[k - 1], span = c.end - prev.end;
    ramp = Math.min(.2, .8 / c.seconds);
    if (clockIn !== k) { local = invEase(through(c.keys, (progress - prev.end) / span, true)); clockIn = k; }
    local = Math.min(1, local + dt / c.seconds);
    progress = Math.min(target, prev.end + span * through(c.keys, easeChapter(local)));
    if (local >= 1) progress = c.end;
  } else if (progress > target) {
    // Going back: a quick rewind to the end of the previous step.
    clockIn = -1;
    progress = Math.max(target, progress - dt * .6);
  }
  return progress !== target;
}

function render(now) {
  frame = 0;
  const box = section.getBoundingClientRect();
  visible = box.bottom > 0 && box.top < innerHeight;
  const moving = advance(now);
  hold();
  fade(labels, progress);
  if (hintBox) {
    // At rest: invite to go on. While a chapter plays: say which step is on screen.
    const c = chapters[chapter], idle = !moving && !!c.hint;
    const playing = moving && progress < c.end && chapters.find(x => x.end > progress + 1e-6)?.playing;
    const text = idle ? (chapter === LAST && turned ? "Défilez pour découvrir nos boîtes" : c.hint) : playing || "";
    if (text && hint.textContent !== text) hint.textContent = text;
    hintBox.classList.toggle("visible", !!text);
    hintBox.classList.toggle("lecture", !idle);
  }
  for (const s of steps) s.el.classList.toggle("actif", progress >= s.from && progress < s.to);
  section.classList.toggle("en-lecture", moving);
  section.classList.toggle("lance", chapter > 0 || progress > 0);
  section.classList.toggle("fini", finished());
  section.style.setProperty("--p", progress.toFixed(4));
  turning();
  if (scene && visible) scene.draw(progress, now / 1000, view);
  // Keep the floating boxes alive while the closing shot is on screen.
  if (moving || drag || Math.abs(spinSpeed) > 1e-4 || (visible && progress > .8 && !motion.matches)) schedule(); else last = 0;
}
function schedule() { if (!frame) frame = requestAnimationFrame(render); }

// The page is held at the top while the opening is not finished.
const holding = () => !!scene && !failed && !motion.matches;
function hold() {
  root.classList.toggle("encre-tenue", holding() && scrollY <= 2 && !finished());
}
function go(k) {
  if (!holding()) return;
  chapter = clamp(k, 0, LAST);
  if (chapter < LAST) turned = false;
  schedule();
}
// One gesture forward plays the next step (never skips one that is still playing); back goes one step back.
function step(dir) {
  if (dir > 0) {
    if (finished()) { release(); return; }
    const next = Math.min(LAST, played() + 1);
    if (next > chapter) go(next);
  } else if (chapter > 0) go(chapter - 1);
}
function release() {
  root.classList.remove("encre-tenue");
  document.getElementById("boites")?.scrollIntoView({behavior: motion.matches ? "auto" : "smooth"});
}
const atTop = () => holding() && scrollY <= 2;

// Wheel: a gesture is a burst of events; it counts once, after a deliberate vertical movement.
// Sideways trackpad movement turns the finished box instead.
// A gesture that started lower down the page (momentum reaching the top) never rewinds the opening.
let lastWheel = 0, wheelSum = 0, wheelUsed = false, wheelFromTop = false;
addEventListener("wheel", e => {
  const now = performance.now();
  if (now - lastWheel > 250) { wheelSum = 0; wheelUsed = false; wheelFromTop = scrollY <= 2; }
  lastWheel = now;
  if (!atTop() || e.ctrlKey || !wheelFromTop) return;
  const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY);
  if (sideways) {
    if (canTurn()) { e.preventDefault(); spin(-e.deltaX * .004, 0); }
    return;
  }
  if (finished() && e.deltaY > 0) return; // the page scrolls on to the boxes
  e.preventDefault();
  wheelSum += e.deltaY;
  if (!wheelUsed && Math.abs(wheelSum) > 30) { wheelUsed = true; step(Math.sign(wheelSum)); }
}, {passive: false});

// Touch: a vertical swipe plays a step; a sideways drag on the finished box turns it.
let touchFrom = null, touchUsed = false;
addEventListener("touchstart", e => { touchFrom = scrollY <= 2 ? {x: e.touches[0].clientX, y: e.touches[0].clientY} : null; touchUsed = false; }, {passive: true});
addEventListener("touchmove", e => {
  if (!atTop() || !touchFrom) return;
  const dy = touchFrom.y - e.touches[0].clientY, dx = touchFrom.x - e.touches[0].clientX;
  if (drag || Math.abs(dx) > Math.abs(dy)) { e.preventDefault(); return; }
  if (finished() && dy > 0) return;
  e.preventDefault();
  if (!touchUsed && Math.abs(dy) > 30) { touchUsed = true; step(Math.sign(dy)); }
}, {passive: false});

addEventListener("keydown", e => {
  if (!atTop() || e.altKey || e.metaKey || e.ctrlKey || e.target.closest?.("input, textarea, select, button, a, [contenteditable]")) return;
  const dir = ["ArrowDown", "PageDown", "End"].includes(e.key) ? 1 : ["ArrowUp", "PageUp", "Home"].includes(e.key) ? -1 : e.key === " " ? (e.shiftKey ? -1 : 1) : 0;
  if (!dir) return;
  if (canTurn() && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;
  e.preventDefault();
  if (!e.repeat) step(dir);
});
addEventListener("keydown", e => {
  if (!canTurn() || !atTop() || e.target.closest?.("input, textarea, select, [contenteditable]")) return;
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); spin(e.key === "ArrowLeft" ? -.06 : .06, 0); }
});

// Buttons: the four steps of the rail, back one step, skip the opening.
section.querySelectorAll("[data-chapitre]").forEach(b => b.addEventListener("click", () => {
  const k = +b.dataset.chapitre;
  // Asking for a step jumps to its start and plays it.
  if (holding()) { progress = chapters[k - 1].end; clockIn = -1; go(k); scrollTo({top: 0}); }
}));
section.querySelector("[data-cmd=retour]")?.addEventListener("click", () => step(-1));
section.querySelector("[data-cmd=passer]")?.addEventListener("click", () => { if (holding()) { chapter = LAST; progress = 1; clockIn = -1; schedule(); } release(); });

// Once the box stands, it can be turned by hand: drag sideways to spin it, up and down to tilt the view.
const stage = canvas.parentElement, view = {yaw: 0, tilt: 0, zoom: 0};
let drag = null, spinSpeed = 0, turned = false;
const canTurn = () => !!scene && !motion.matches && progress >= .9;
function spin(dYaw, dTilt) {
  spinSpeed = dYaw; view.yaw += dYaw;
  view.tilt = clamp(view.tilt + dTilt, -.25, .45);
  if (Math.abs(dYaw) + Math.abs(dTilt) > .01) turned = true;
  schedule();
}
function turning() {
  const on = canTurn();
  section.classList.toggle("tournable", on);
  if (!on) { view.yaw *= .85; view.tilt *= .85; view.zoom *= .85; spinSpeed = 0; return; }
  view.zoom += ((turned ? 1 : 0) - view.zoom) * .08;
  if (!drag) { view.yaw += spinSpeed; spinSpeed *= .93; }
}
stage.addEventListener("pointerdown", e => {
  if (!canTurn() || e.button > 0 || e.target.closest("button, a")) return;
  drag = {x: e.clientX, y: e.clientY};
  stage.setPointerCapture(e.pointerId);
  section.classList.add("tourne");
});
stage.addEventListener("pointermove", e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag = {x: e.clientX, y: e.clientY};
  spin(dx * .009, dy * .004);
});
const letGo = () => { drag = null; section.classList.remove("tourne"); };
stage.addEventListener("pointerup", letGo);
stage.addEventListener("pointercancel", letGo);

async function start() {
  root.classList.toggle("encre-fixe", motion.matches);
  if (motion.matches) {
    root.classList.remove("encre-tenue");
    labels.forEach(l => { l.el.style.opacity = ""; l.el.style.visibility = ""; l.el.style.transform = ""; });
    statements.forEach(l => { l.el.style.opacity = ""; l.el.style.transform = ""; });
  }
  if (!scene && !failed) {
    try {
      const {inkScene} = await import("./encre3d.js?v=15");
      scene = await inkScene(canvas);
      root.classList.add("encre-prete");
    } catch (error) {
      failed = true;
      root.classList.add("encre-repli");
      console.warn("Scène 3D indisponible :", error.message);
    }
  }
  if (motion.matches && scene) { progress = 1; chapter = LAST; scene.draw(.97, 0); return; }
  // A reload lower down the page shows the finished box rather than replaying from the start.
  if (scrollY > 2 && progress === 0) { chapter = LAST; progress = 1; }
  schedule();
}

// The album slides sideways as the page scrolls; each photograph sharpens as it reaches the centre.
const gallery = document.getElementById("galerie");
const track = gallery.querySelector(".galerie-piste");
const views = [...track.children];
function slide() {
  if (motion.matches) { track.style.transform = ""; return; }
  const box = gallery.getBoundingClientRect();
  const travel = Math.max(1, gallery.offsetHeight - innerHeight);
  const t = clamp(-box.top / travel);
  const shift = Math.max(0, track.scrollWidth - innerWidth);
  track.style.transform = `translate3d(${(-t * shift).toFixed(1)}px,0,0)`;
  for (const v of views) {
    const r = v.getBoundingClientRect(), centre = (r.left + r.width / 2) / innerWidth - .5;
    v.style.setProperty("--net", (1 - clamp(Math.abs(centre) * 1.6)).toFixed(3));
  }
}
addEventListener("scroll", () => { if (!motion.matches) schedule(); requestAnimationFrame(slide); }, {passive: true});
addEventListener("resize", slide);
slide();
addEventListener("resize", () => { if (scene) scene.draw(motion.matches ? .97 : progress, performance.now() / 1000); schedule(); });
motion.addEventListener("change", start);
// The box types draw themselves when their section arrives on screen.
const range = document.getElementById("boites");
if (range && "IntersectionObserver" in window) {
  document.documentElement.classList.add("gamme-anim");
  new IntersectionObserver((entries, watch) => {
    if (entries.some(e => e.isIntersecting)) { range.classList.add("vu"); watch.disconnect(); }
  }, {threshold: .18}).observe(range);
}
start();
