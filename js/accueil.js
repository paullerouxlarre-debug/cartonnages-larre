// Opening, played as a film in chapters: scrolling a little starts a chapter, which then plays
// on its own (impression, découpe, pliage-collage). Scrolling back rewinds quickly.
// Reduced motion shows the finished box.
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const section = document.getElementById("encre");
const canvas = document.getElementById("encre-3d");
const labels = [...section.querySelectorAll("[data-from]")].map(el => ({el, from: +el.dataset.from, to: +el.dataset.to, edge: +(el.dataset.edge || .018)}));
// Chapter ends in scene time, their playing time in seconds, and the hint shown once each one is over.
const chapters = [
  {end: 0, seconds: 1, hint: "Faites défiler : l’impression commence"},
  {end: .52, seconds: 15, hint: "Défilez : la découpe"},
  {end: .663, seconds: 5.5, hint: "Défilez : le pliage-collage"},
  {end: 1, seconds: 10, hint: ""}
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

let scene = null, progress = 0, frame = 0, visible = true, failed = false, chapter = 0, last = 0;
function measure() {
  const box = section.getBoundingClientRect();
  const travel = Math.max(1, section.offsetHeight - innerHeight);
  const t = clamp(-box.top / travel);
  // Four scroll stops: rest, then one per chapter. A small scroll is enough to start the next one.
  chapter = t < .04 ? 0 : t < .45 ? 1 : t < .78 ? 2 : 3;
  visible = box.bottom > 0 && box.top < innerHeight;
}
function advance(now) {
  const dt = Math.min(.1, last ? (now - last) / 1000 : 0); last = now;
  const target = chapters[chapter].end;
  if (progress < target) {
    // Play forward at the pace of the chapter being played.
    const k = chapters.findIndex(c => c.end > progress + 1e-6);
    const c = chapters[Math.max(1, k)], prev = chapters[Math.max(0, k - 1)];
    progress = Math.min(target, progress + dt * (c.end - prev.end) / c.seconds);
  } else if (progress > target) {
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
    const c = chapters[chapter], idle = !moving && c.hint;
    if (idle && hint.textContent !== c.hint) hint.textContent = c.hint;
    hintBox.classList.toggle("visible", !!idle);
  }
  for (const s of steps) s.el.classList.toggle("actif", progress >= s.from && progress < s.to);
  section.style.setProperty("--p", progress.toFixed(4));
  if (scene && visible) scene.draw(progress, now / 1000);
  // Keep the floating boxes alive while the closing shot is on screen.
  if (moving || (visible && progress > .8 && !motion.matches)) schedule(); else last = 0;
}
function schedule() { if (!frame) frame = requestAnimationFrame(render); }

async function start() {
  document.documentElement.classList.toggle("encre-fixe", motion.matches);
  if (motion.matches) {
    labels.forEach(l => { l.el.style.opacity = ""; l.el.style.visibility = ""; l.el.style.transform = ""; });
    statements.forEach(l => { l.el.style.opacity = ""; l.el.style.transform = ""; });
  }
  if (!scene && !failed) {
    try {
      const {inkScene} = await import("./encre3d.js?v=8");
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
