// Ink and paper layer. Every shape is a pure function of the scroll position or of the film
// time, so scrolling back restores exactly the same picture. Disabled for reduced motion.
const canvas = document.getElementById("encres");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const ctx = canvas.getContext("2d");
const cover = document.querySelector(".cover");
const journey = document.getElementById("parcours");
const statements = [...document.querySelectorAll(".statements p")].map(el => ({el, from: +el.dataset.from, to: +el.dataset.to}));

const INK = {c: "#0a95c4", m: "#d42a7b", y: "#f3c21b", k: "#1d2624", o: "#ff784e"};
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = v => { v = clamp(v); return v * v * (3 - 2 * v); };
const span = (a, b, v) => ease((v - a) / (b - a));
const rand = seed => { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

let W = 0, H = 0, ratio = 1, filmTime = 0, intro = 0, introStart = performance.now(), frame = 0;

function resize() {
  ratio = Math.min(devicePixelRatio || 1, 1.5);
  W = innerWidth; H = innerHeight;
  canvas.width = Math.round(W * ratio); canvas.height = Math.round(H * ratio);
  schedule();
}

// A drop of ink: rounded head, tapered drip above it and a glossy highlight.
function drop(x, y, r, color, drip = 0, alpha = 1) {
  if (r <= .3 || alpha <= .01) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  if (drip > 0) {
    ctx.moveTo(x - r * .42, y - drip);
    ctx.quadraticCurveTo(x - r * .5, y - r * .4, x - r, y);
    ctx.arc(x, y, r, Math.PI, 0, true);
    ctx.quadraticCurveTo(x + r * .5, y - r * .4, x + r * .42, y - drip);
    ctx.arc(x, y - drip, r * .42, 0, Math.PI, true);
  } else ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha * .55;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(x - r * .35, y - r * .3, r * .22, r * .13, -.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// Opening: drops fall onto the cover, then run downwards and stretch as the page scrolls.
function coverInk(progress) {
  if (progress >= 1) return;
  const narrow = W < 720, colours = [INK.c, INK.m, INK.y, INK.k, INK.o];
  const count = narrow ? 14 : 26;
  for (let i = 0; i < count; i++) {
    const side = narrow ? .64 + rand(i) * .34 : .52 + rand(i) * .46;
    const x = side * W;
    const rest = (narrow ? .06 + rand(i + 9) * .2 : .1 + rand(i + 9) * .55) * H;
    const r = (narrow ? 4 : 6) + rand(i + 3) * (narrow ? 8 : 16);
    const fall = ease((intro - rand(i + 5) * .55) / .45);
    const y0 = -40 - rand(i + 7) * H * .3;
    const run = progress * H * (.6 + rand(i + 11) * 1.1);
    const y = y0 + (rest - y0) * fall + run;
    const drip = (fall >= 1 ? 1 : 0) * (r * .8 + progress * H * (.25 + rand(i + 13) * .5));
    drop(x, y, r * (1 - progress * .35), colours[i % 5], drip, .92 * (1 - progress * .6));
  }
}

// Offset: one ribbon of each process colour runs along the top edge when the sheet meets
// its printing unit, and leaves drips that keep running.
const ribbons = [[INK.c, 5.75], [INK.m, 6.55], [INK.y, 7.35], [INK.k, 8.15]];
function printingInk(t) {
  if (t < 5.5 || t > 12.5) return;
  const fade = 1 - span(10.6, 12.4, t);
  ribbons.forEach(([color, start], i) => {
    const head = span(start, start + 1.1, t);
    if (head <= 0) return;
    const y = 6 + i * 9, thick = W < 720 ? 6 : 8;
    ctx.globalAlpha = .88 * fade;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= head * W; x += 12) ctx.lineTo(x, y + Math.sin(x / 70 + i) * 2.4);
    for (let x = head * W; x >= 0; x -= 12) ctx.lineTo(x, y + thick + Math.sin(x / 55 + i * 2) * 2.4);
    ctx.fill();
    for (let d = 0; d < 7; d++) {
      const x = (rand(i * 10 + d) * .94 + .03) * W;
      if (x > head * W) continue;
      const age = t - start - (x / W) * 1.1;
      const length = clamp(age, 0, 3) * (40 + rand(d + i) * 90);
      drop(x, y + thick + length, 3.5 + rand(d * 3 + i) * 4, color, length, .9 * fade);
    }
  });
  ctx.globalAlpha = 1;
}

// Between stations, printed sheets fly across the frame toward the next machine.
const flights = [13.7, 25.7, 37.7, 44.8];
function sheet(x, y, w, h, angle, tilt, seed, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y); ctx.rotate(angle); ctx.scale(1, Math.max(.08, Math.abs(Math.cos(tilt))));
  ctx.shadowColor = "rgba(0,0,0,.28)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 10;
  ctx.fillStyle = "#f4efe5"; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.shadowColor = "transparent";
  // Four poses, like the sheet in the film: green panel, red wave, kraft stripe.
  for (let j = 0; j < 4; j++) {
    const px = -w / 2 + w * .06 + (j % 2) * w * .47, py = -h / 2 + h * .07 + Math.floor(j / 2) * h * .45;
    const pw = w * .41, ph = h * .38;
    ctx.fillStyle = "#1f3b35"; ctx.fillRect(px, py, pw * .28, ph);
    ctx.fillStyle = "#c9542f"; ctx.beginPath(); ctx.moveTo(px + pw * .28, py + ph);
    ctx.quadraticCurveTo(px + pw * .6, py + ph * (.25 + rand(seed + j) * .3), px + pw, py + ph * .55);
    ctx.lineTo(px + pw, py + ph); ctx.fill();
    ctx.fillStyle = "#d9c2a0"; ctx.fillRect(px + pw * .28, py, pw * .72, ph * .16);
  }
  ctx.restore();
}
function flyingSheets(t) {
  for (const [k, start] of flights.entries()) {
    const u = (t - start) / 2.1;
    if (u < 0 || u > 1) continue;
    const n = W < 720 ? 5 : 8;
    for (let i = 0; i < n; i++) {
      const delay = rand(i + k * 7) * .35, v = clamp((u - delay) / .65);
      if (v <= 0 || v >= 1) continue;
      const w = (W < 720 ? 120 : 210) * (.7 + rand(i + 2) * .6), h = w * .72;
      const x = -w + v * (W + 2 * w) + Math.sin(v * 3 + i) * 30;
      const y = H * (.15 + rand(i + 4) * .7) - Math.sin(v * Math.PI) * H * (.12 + rand(i + 8) * .2);
      sheet(x, y, w, h, -.5 + v * (1.3 + rand(i) * 2), v * Math.PI * (1 + rand(i + 3) * 2), i, Math.sin(v * Math.PI) * .95);
    }
  }
}

// Gluing: a thread of glue hangs from the top and breaks when the patch is done.
function glue(t) {
  if (t < 29 || t > 33) return;
  const x = W * (W < 720 ? .82 : .9), grow = span(29.1, 30.6, t), cut = span(31.6, 32.2, t);
  ctx.globalAlpha = .75 * (1 - span(32.4, 33, t));
  ctx.fillStyle = "#f6edc9";
  const top = cut * H * .55, bottom = grow * H * .62 + cut * H * .3;
  ctx.fillRect(x - 2.5, top, 5, Math.max(0, bottom - top));
  drop(x, bottom, 7, "#f6edc9", 0, ctx.globalAlpha);
  ctx.globalAlpha = 1;
}

function statementsAt(t) {
  for (const s of statements) {
    const v = span(s.from, s.from + .55, t) * (1 - span(s.to - .55, s.to, t));
    s.el.style.opacity = v.toFixed(3);
    s.el.style.transform = `translateY(${((1 - v) * (t < s.from + .6 ? 3 : -3)).toFixed(2)}vh) scale(${(.94 + v * .06).toFixed(3)})`;
  }
}

function draw() {
  frame = 0;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, W, H);
  intro = clamp((performance.now() - introStart) / 2600);
  const coverBox = cover.getBoundingClientRect();
  const coverProgress = clamp(-coverBox.top / Math.max(1, coverBox.height));
  if (coverBox.bottom > 0) coverInk(coverProgress);
  const filmBox = journey.getBoundingClientRect();
  if (filmBox.top < H && filmBox.bottom > 0) {
    printingInk(filmTime); flyingSheets(filmTime); glue(filmTime);
  }
  if (intro < 1) schedule();
}
function schedule() { if (!frame) frame = requestAnimationFrame(draw); }

function start() {
  if (motion.matches) { canvas.hidden = true; statements.forEach(s => { s.el.style.opacity = ""; s.el.style.transform = ""; }); return; }
  canvas.hidden = false;
  introStart = performance.now();
  resize();
}
document.addEventListener("larre:temps", event => { filmTime = event.detail.time; statementsAt(filmTime); schedule(); });
addEventListener("scroll", schedule, {passive: true});
addEventListener("resize", resize);
motion.addEventListener("change", start);
start();
