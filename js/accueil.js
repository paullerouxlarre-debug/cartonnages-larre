// Opening, played as a film in chapters driven by buttons: « Étape suivante » plays the next step,
// which runs on its own and stops on a settled frame; « Étape précédente » goes back one step.
// The page scrolls freely. Once the box stands it can be grabbed and turned.
// Reduced motion shows the finished box.
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const section = document.getElementById("encre");
const canvas = document.getElementById("encre-3d");
const root = document.documentElement;
const labels = [...section.querySelectorAll("[data-from]")].map(el => ({el, from: +el.dataset.from, to: +el.dataset.to, edge: +(el.dataset.edge || .018)}));
// Chapter ends in scene time, their playing time in seconds, the label of the button that plays
// them, and the label shown while they play.
const chapters = [
  {end: 0, seconds: 1},
  {end: .512, seconds: 18, keys: [[0, 0], [1 / 18, .05 / .512], [13.4 / 18, .36 / .512], [1, 1]], next: "Lancer l’impression", playing: "Impression en cours"},
  {end: .658, seconds: 9, next: "Étape suivante : la découpe", playing: "Découpe en cours"},
  {end: .814, seconds: 9, next: "Étape suivante : le pliage-collage", playing: "Pliage-collage en cours"},
  {end: 1, seconds: 10, next: "Étape suivante : l’étui", playing: "L’étui prend forme"}
];
const LAST = chapters.length - 1;
const nextButton = section.querySelector("[data-cmd=suivant]");
const nextLabel = nextButton?.querySelector("span");
const backButton = section.querySelector("[data-cmd=retour]");
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
// `chapter` is the step asked for; only the buttons change it.
let scene = null, progress = 0, frame = 0, visible = true, failed = false, chapter = 0, last = 0, clockIn = -1, local = 0;
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

let shown = "";
function controls(moving) {
  if (!nextButton) return;
  // While a step plays, the button says which one; at rest it names the next step.
  const text = moving ? chapters[chapter].playing + "…" : finished() ? "Revoir depuis le début" : chapters[chapter + 1].next;
  if (text !== shown) { nextLabel.textContent = text; shown = text; }
  nextButton.classList.toggle("en-cours", moving);
  nextButton.classList.toggle("revoir", !moving && finished());
  nextButton.setAttribute("aria-disabled", moving ? "true" : "false");
  if (backButton) backButton.hidden = chapter === 0;
}

function render(now) {
  frame = 0;
  const box = section.getBoundingClientRect();
  visible = box.bottom > 0 && box.top < innerHeight;
  const moving = advance(now);
  fade(labels, progress);
  controls(moving);
  for (const s of steps) s.el.classList.toggle("actif", progress >= s.from && progress < s.to);
  section.classList.toggle("lance", chapter > 0 || progress > 0);
  section.classList.toggle("fini", finished());
  section.classList.toggle("a-tourne", turned);
  section.style.setProperty("--p", progress.toFixed(4));
  turning();
  if (scene && visible) scene.draw(progress, now / 1000, view);
  // Keep the floating boxes alive while the closing shot is on screen.
  if (moving || drag || Math.abs(view.yaw - aim.yaw) > 1e-4 || Math.abs(spinSpeed) > 1e-4 || (visible && progress > .8 && !motion.matches)) schedule(); else last = 0;
}
function schedule() { if (!frame) frame = requestAnimationFrame(render); }

const ready = () => !!scene && !failed && !motion.matches;
function go(k) {
  if (!ready()) return;
  chapter = clamp(k, 0, LAST);
  schedule();
}
nextButton?.addEventListener("click", () => {
  if (!ready() || progress < chapters[chapter].end) return; // a step is still playing
  if (finished()) { progress = 0; chapter = 0; clockIn = -1; aim.yaw = aim.tilt = 0; go(1); return; }
  go(chapter + 1);
});
backButton?.addEventListener("click", () => { if (chapter > 0) go(chapter - 1); });
// The four steps of the rail: jump to the start of a step and play it.
section.querySelectorAll("[data-chapitre]").forEach(b => b.addEventListener("click", () => {
  const k = +b.dataset.chapitre;
  if (ready()) { progress = chapters[k - 1].end; clockIn = -1; go(k); }
}));

// Once the box stands, it can be grabbed and turned: sideways all the way round, up and down to
// see the top or the bottom. The view follows the hand smoothly and keeps a little momentum.
const stage = canvas.parentElement, view = {yaw: 0, tilt: 0, zoom: 0}, aim = {yaw: 0, tilt: 0};
let drag = null, spinSpeed = 0, turned = false;
const canTurn = () => !!scene && !motion.matches && progress >= .9;
function turning() {
  const on = canTurn();
  section.classList.toggle("tournable", on);
  if (!on) { aim.yaw = aim.tilt = 0; spinSpeed = 0; turned = false; }
  else if (!drag) { aim.yaw += spinSpeed; spinSpeed *= .94; }
  view.yaw += (aim.yaw - view.yaw) * .22;
  view.tilt += (aim.tilt - view.tilt) * .22;
  view.zoom += ((on && turned ? 1 : 0) - view.zoom) * .08;
}
stage.addEventListener("pointerdown", e => {
  if (!canTurn() || e.button > 0 || e.target.closest("button, a")) return;
  // No text selection, no drag of the page's image: the hand only holds the box.
  e.preventDefault();
  getSelection()?.removeAllRanges();
  drag = {x: e.clientX, y: e.clientY, t: e.timeStamp};
  stage.setPointerCapture(e.pointerId);
  section.classList.add("tourne");
  spinSpeed = 0;
  schedule();
});
stage.addEventListener("pointermove", e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y, dt = Math.max(8, e.timeStamp - drag.t);
  drag = {x: e.clientX, y: e.clientY, t: e.timeStamp};
  aim.yaw += dx * .008;
  aim.tilt = clamp(aim.tilt + dy * .004, -.3, .75);
  spinSpeed = clamp(dx * .008 * 16 / dt, -.12, .12);
  if (Math.abs(dx) + Math.abs(dy) > 2) turned = true;
  schedule();
});
const letGo = () => { if (!drag) return; drag = null; section.classList.remove("tourne"); schedule(); };
stage.addEventListener("pointerup", letGo);
stage.addEventListener("pointercancel", letGo);
stage.addEventListener("lostpointercapture", letGo);
section.addEventListener("dragstart", e => e.preventDefault());
section.addEventListener("contextmenu", e => { if (drag) e.preventDefault(); });
// Keyboard: with the box on screen, the arrow keys turn it.
addEventListener("keydown", e => {
  if (!canTurn() || !visible || e.target.closest?.("input, textarea, select, [contenteditable]")) return;
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); aim.yaw += e.key === "ArrowLeft" ? -.25 : .25; turned = true; schedule(); }
});

async function start() {
  root.classList.toggle("encre-fixe", motion.matches);
  if (motion.matches) {
    labels.forEach(l => { l.el.style.opacity = ""; l.el.style.visibility = ""; l.el.style.transform = ""; });
    statements.forEach(l => { l.el.style.opacity = ""; l.el.style.transform = ""; });
  }
  if (!scene && !failed) {
    try {
      const {inkScene} = await import("./encre3d.js?v=18");
      scene = await inkScene(canvas);
      root.classList.add("encre-prete");
    } catch (error) {
      failed = true;
      root.classList.add("encre-repli");
      console.warn("Scène 3D indisponible :", error.message);
    }
  }
  if (motion.matches && scene) { progress = 1; chapter = LAST; scene.draw(.97, 0); return; }
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
