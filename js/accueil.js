// Opening: the scroll position through #encre drives the 3D ink scene and its captions.
// Reduced motion shows the finished box.
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const section = document.getElementById("encre");
const canvas = document.getElementById("encre-3d");
const labels = [...section.querySelectorAll("[data-from]")].map(el => ({el, from: +el.dataset.from, to: +el.dataset.to}));
const steps = [...section.querySelectorAll("[data-actif]")].map(el => { const [from, to] = el.dataset.actif.split(",").map(Number); return {el, from, to}; });
const statements = [...document.querySelectorAll(".statements p")].map(el => ({el, from: +el.dataset.from, to: +el.dataset.to}));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const u = clamp((v - a) / (b - a)); return u * u * (3 - 2 * u); };

function fade(items, t, edge) {
  for (const s of items) {
    const v = smooth(s.from - (s.from > 0 ? edge : 1), s.from + edge, t) * (1 - smooth(s.to - edge, s.to + (s.to >= 1 ? 1 : edge), t));
    s.el.style.opacity = v.toFixed(3);
    s.el.style.visibility = v < .01 ? "hidden" : "visible";
    s.el.style.transform = `translateY(${((1 - v) * (t < s.from + edge ? 2.5 : -2.5)).toFixed(2)}vh)`;
  }
}

let scene = null, progress = 0, frame = 0, visible = true, failed = false;
function measure() {
  const box = section.getBoundingClientRect();
  const travel = Math.max(1, section.offsetHeight - innerHeight);
  progress = clamp(-box.top / travel);
  visible = box.bottom > 0 && box.top < innerHeight;
}
function render(now) {
  frame = 0;
  measure();
  fade(labels, progress, .018);
  for (const s of steps) s.el.classList.toggle("actif", progress >= s.from && progress < s.to);
  section.style.setProperty("--p", progress.toFixed(4));
  if (scene && visible) scene.draw(progress, now / 1000);
  // Keep the floating boxes alive while the closing shot is on screen.
  if (visible && progress > .8 && !motion.matches) schedule();
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
      const {inkScene} = await import("./encre3d.js?v=5");
      scene = await inkScene(canvas);
      document.documentElement.classList.add("encre-prete");
    } catch (error) {
      failed = true;
      document.documentElement.classList.add("encre-repli");
      console.warn("Scène 3D indisponible :", error.message);
    }
  }
  if (motion.matches && scene) { scene.draw(.97, 0); return; }
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
