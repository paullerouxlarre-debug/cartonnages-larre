// Opening, played as a film in chapters: scrolling a little starts a chapter, which then plays
// on its own (impression, découpe, pliage-collage). Scrolling back rewinds quickly.
// Reduced motion shows the finished box.
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const section = document.getElementById("encre");
const canvas = document.getElementById("encre-3d");
const labels = [...section.querySelectorAll("[data-from]")].map(el => ({el, from: +el.dataset.from, to: +el.dataset.to, edge: +(el.dataset.edge || .018)}));
// Chapter ends in scene time, their playing time in seconds, and the hint shown once each one is over.
const chapters = [
  {end: 0, seconds: 1, hint: "Faites défiler pour lancer l’impression"},
  {end: .512, seconds: 20, hint: "Impression terminée · défilez pour la découpe", playing: "Étape 1/4 · l’impression en cours"},
  {end: .658, seconds: 9, hint: "Découpe terminée · défilez pour le pliage-collage", playing: "Étape 2/4 · la découpe en cours"},
  {end: .814, seconds: 9, hint: "Pliage terminé · défilez pour monter l’étui", playing: "Étape 3/4 · le pliage-collage en cours"},
  {end: 1, seconds: 10, hint: matchMedia("(pointer: coarse)").matches ? "Glissez pour tourner la boîte · puis défilez" : "Tournez la boîte à la souris · puis défilez", playing: "Étape 4/4 · l’étui prend forme"}
];
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

let clockIn = -1, local = 0;
// Even pace with a short start and a short settle (about 0.8 s each), so the steps keep a steady rhythm.
let ramp = .08;
const easeChapter = u => { const a = ramp, v = 1 / (1 - a); return u < a ? v * u * u / (2 * a) : u > 1 - a ? 1 - v * (1 - u) * (1 - u) / (2 * a) : v * (u - a / 2); };
const invEase = v => { let a = 0, b = 1; for (let i = 0; i < 24; i++) { const m = (a + b) / 2; if (easeChapter(m) < v) a = m; else b = m; } return (a + b) / 2; };
let scene = null, progress = 0, frame = 0, visible = true, failed = false, chapter = 0, last = 0;
function measure() {
  const box = section.getBoundingClientRect();
  const travel = Math.max(1, section.offsetHeight - innerHeight);
  const t = clamp(-box.top / travel);
  // Four scroll stops: rest, then one per chapter. A small scroll is enough to start the next one.
  chapter = t < .03 ? 0 : t < .35 ? 1 : t < .6 ? 2 : t < .85 ? 3 : 4;
  visible = box.bottom > 0 && box.top < innerHeight;
}
function advance(now) {
  const dt = Math.min(.1, last ? (now - last) / 1000 : 0); last = now;
  const target = chapters[chapter].end;
  if (progress < target) {
    // Play forward at the pace of the chapter being played.
    // Each chapter plays on its own clock and eases into a settled frame at its end.
    const k = Math.max(1, chapters.findIndex(c => c.end > progress + 1e-6));
    const c = chapters[k], prev = chapters[k - 1], span = c.end - prev.end;
    ramp = Math.min(.2, .8 / c.seconds);
    clockIn = clockIn === k ? k : (local = invEase((progress - prev.end) / span), k);
    local = Math.min(1, local + dt / c.seconds);
    progress = Math.min(target, prev.end + span * easeChapter(local));
    if (local >= 1) progress = c.end;
  } else if (progress > target) {
    clockIn = -1;
    progress = Math.max(target, progress - dt * .35);
  }
  return progress !== target;
}
function render(now) {
  frame = 0;
  measure();
  const moving = advance(now);
  fade(labels, progress);
  if (hintBox) {
    // At rest: invite to scroll. While a chapter plays: say which step is on screen.
    const c = chapters[chapter], idle = !moving && !!c.hint, playing = moving && progress < c.end && chapters.find(x => x.end > progress + 1e-6)?.playing;
    const text = idle ? (chapter === 4 && turned ? "Défilez pour découvrir nos boîtes" : c.hint) : playing || "";
    if (text && hint.textContent !== text) hint.textContent = text;
    hintBox.classList.toggle("visible", !!text);
    hintBox.classList.toggle("lecture", !idle);
  }
  for (const s of steps) s.el.classList.toggle("actif", progress >= s.from && progress < s.to);
  section.style.setProperty("--p", progress.toFixed(4));
  turning(progress);
  if (scene && visible) scene.draw(progress, now / 1000, view);
  // Keep the floating boxes alive while the closing shot is on screen.
  if (moving || (visible && progress > .8 && !motion.matches)) schedule(); else last = 0;
}
function schedule() { if (!frame) frame = requestAnimationFrame(render); }

// Once the box stands, it can be turned by hand: drag sideways to spin it, up and down to tilt the view.
const stage = canvas.parentElement, view = {yaw: 0, tilt: 0};
let drag = null, spinSpeed = 0, turned = false;
const canTurn = () => !!scene && !motion.matches && progress >= .9;
function turning(p) {
  const on = canTurn();
  section.classList.toggle("tournable", on);
  if (!on) { view.yaw *= .85; view.tilt *= .85; spinSpeed = 0; return; }
  if (!drag) { view.yaw += spinSpeed; spinSpeed *= .93; }
}
stage.addEventListener("pointerdown", e => {
  if (!canTurn() || e.button > 0) return;
  drag = {x: e.clientX, y: e.clientY};
  stage.setPointerCapture(e.pointerId);
  section.classList.add("tourne");
});
stage.addEventListener("pointermove", e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag = {x: e.clientX, y: e.clientY};
  spinSpeed = dx * .009; view.yaw += spinSpeed;
  view.tilt = clamp(view.tilt + dy * .004, -.25, .45);
  if (Math.abs(dx) + Math.abs(dy) > 2) turned = true;
  schedule();
});
const release = () => { drag = null; section.classList.remove("tourne"); };
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);

// The opening holds the page: each scroll gesture plays one step, and the page continues
// only once the box stands. Scrolling up steps back. Reduced motion and the 2D fallback scroll freely.
const stopAt = [0, .25, .5, .75, 1];
const holding = () => !!scene && !failed && !motion.matches;
const travelOf = () => Math.max(1, section.offsetHeight - innerHeight);
function inOpening() {
  const top = scrollY + section.getBoundingClientRect().top;
  return scrollY >= top - 2 && scrollY <= top + travelOf() + 2;
}
// Number of chapters already played to their end.
const played = () => chapters.reduce((d, c, i) => c.end <= progress + 1e-6 ? i : d, 0);
// True when the gesture should go to the page itself: past the finished box, or above the start.
const free = dir => (dir > 0 && chapter === 4 && played() === 4) || (dir < 0 && chapter === 0);
function step(dir) {
  const next = dir > 0 ? Math.min(4, played() + 1) : Math.max(0, chapter - 1);
  if (dir > 0 && next <= chapter) return;
  const top = scrollY + section.getBoundingClientRect().top;
  scrollTo({top: Math.round(top + travelOf() * stopAt[next]), behavior: "instant"});
  schedule();
}
let lastWheel = 0, wheelUsed = false;
addEventListener("wheel", e => {
  if (!holding() || e.ctrlKey || !inOpening()) return;
  const now = performance.now(), fresh = now - lastWheel > 220; lastWheel = now;
  const dir = Math.sign(e.deltaY);
  if (!dir || free(dir)) return;
  e.preventDefault();
  if (fresh) wheelUsed = false;
  if (!wheelUsed) { wheelUsed = true; step(dir); }
}, {passive: false});
let touchFrom = null, touchUsed = false;
addEventListener("touchstart", e => { touchFrom = {x: e.touches[0].clientX, y: e.touches[0].clientY}; touchUsed = false; }, {passive: true});
addEventListener("touchmove", e => {
  if (!holding() || !touchFrom || !inOpening()) return;
  const dy = touchFrom.y - e.touches[0].clientY, dx = touchFrom.x - e.touches[0].clientX;
  if (drag || Math.abs(dx) > Math.abs(dy)) { if (drag) e.preventDefault(); return; }
  const dir = Math.sign(dy);
  if (!dir || free(dir)) return;
  e.preventDefault();
  if (!touchUsed && Math.abs(dy) > 24) { touchUsed = true; step(dir); }
}, {passive: false});
addEventListener("keydown", e => {
  if (!holding() || e.altKey || e.metaKey || e.ctrlKey || e.target.closest?.("input, textarea, select, [contenteditable]") || !inOpening()) return;
  const dir = ["ArrowDown", "PageDown", "End"].includes(e.key) ? 1 : ["ArrowUp", "PageUp", "Home"].includes(e.key) ? -1 : e.key === " " ? (e.shiftKey ? -1 : 1) : 0;
  if (!dir || free(dir)) return;
  e.preventDefault();
  if (!e.repeat) step(dir);
});

async function start() {
  document.documentElement.classList.toggle("encre-fixe", motion.matches);
  if (motion.matches) {
    labels.forEach(l => { l.el.style.opacity = ""; l.el.style.visibility = ""; l.el.style.transform = ""; });
    statements.forEach(l => { l.el.style.opacity = ""; l.el.style.transform = ""; });
  }
  if (!scene && !failed) {
    try {
      const {inkScene} = await import("./encre3d.js?v=10");
      scene = await inkScene(canvas);
      document.documentElement.classList.add("encre-prete");
    } catch (error) {
      failed = true;
      document.documentElement.classList.add("encre-repli");
      console.warn("Scène 3D indisponible :", error.message);
    }
  }
  if (motion.matches && scene) { progress = 1; scene.draw(.97, 0); return; }
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
