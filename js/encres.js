// Liquid ink: a small stable-fluids simulation (WebGL 2). Coloured dye is injected by the
// page — on arrival, while scrolling, at each printing unit and between stations — and runs
// down under its own weight. Glossy shading comes from the dye's gradient. Off for reduced motion.
const canvas = document.getElementById("encres");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const cover = document.querySelector(".cover");
const journey = document.getElementById("parcours");
const contact = document.getElementById("contact");
const statements = [...document.querySelectorAll(".statements p")].map(el => ({el, from: +el.dataset.from, to: +el.dataset.to}));

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = v => { v = clamp(v); return v * v * (3 - 2 * v); };
const span = (a, b, v) => ease((v - a) / (b - a));
function statementsAt(t) {
  for (const s of statements) {
    const v = span(s.from, s.from + .55, t) * (1 - span(s.to - .55, s.to, t));
    s.el.style.opacity = v.toFixed(3);
    s.el.style.transform = `translateY(${((1 - v) * (t < s.from + .6 ? 3 : -3)).toFixed(2)}vh) scale(${(.94 + v * .06).toFixed(3)})`;
  }
}

// Process inks, in linear colour. Black would vanish on the dark film; the brand orange replaces it.
const INK = {c: [0, .42, .78], m: [.86, .03, .36], y: [1, .74, .02], o: [1, .36, .16], p: [.95, .92, .86]};

const gl = canvas.getContext("webgl2", {alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false});
const renderable = gl && (gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"));
if (!renderable) {
  canvas.hidden = true;
  document.addEventListener("larre:temps", e => { if (!motion.matches) statementsAt(e.detail.time); });
} else {
  const narrow = () => innerWidth < 720;
  const SIM = 128, PRESSURE_ITER = 18;
  const vertex = `#version 300 es
  in vec2 aPosition; out vec2 vUv, vL, vR, vT, vB; uniform vec2 texel;
  void main(){ vUv=aPosition*.5+.5; vL=vUv-vec2(texel.x,0.); vR=vUv+vec2(texel.x,0.); vT=vUv+vec2(0.,texel.y); vB=vUv-vec2(0.,texel.y); gl_Position=vec4(aPosition,0.,1.); }`;
  const head = `#version 300 es
  precision highp float; precision highp sampler2D; in vec2 vUv, vL, vR, vT, vB; out vec4 o;`;
  const sources = {
    splat: `uniform sampler2D uTarget; uniform float aspect, radius; uniform vec3 color; uniform vec2 point;
      void main(){ vec2 p=vUv-point; p.x*=aspect; o=vec4(texture(uTarget,vUv).xyz+exp(-dot(p,p)/radius)*color,1.); }`,
    advect: `uniform sampler2D uVelocity, uSource; uniform vec2 simTexel; uniform float dt, dissipation;
      void main(){ vec2 c=vUv-dt*texture(uVelocity,vUv).xy*simTexel; o=texture(uSource,c)/(1.+dissipation*dt); }`,
    divergence: `uniform sampler2D uVelocity;
      void main(){ float L=texture(uVelocity,vL).x,R=texture(uVelocity,vR).x,T=texture(uVelocity,vT).y,B=texture(uVelocity,vB).y; vec2 C=texture(uVelocity,vUv).xy;
      if(vL.x<0.)L=-C.x; if(vR.x>1.)R=-C.x; if(vT.y>1.)T=-C.y; if(vB.y<0.)B=-C.y; o=vec4(.5*(R-L+T-B),0.,0.,1.); }`,
    curl: `uniform sampler2D uVelocity;
      void main(){ o=vec4(.5*(texture(uVelocity,vR).y-texture(uVelocity,vL).y-texture(uVelocity,vT).x+texture(uVelocity,vB).x),0.,0.,1.); }`,
    vorticity: `uniform sampler2D uVelocity, uCurl, uDye; uniform float curl, dt, gravity;
      void main(){ float L=texture(uCurl,vL).x,R=texture(uCurl,vR).x,T=texture(uCurl,vT).x,B=texture(uCurl,vB).x,C=texture(uCurl,vUv).x;
      vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L)); f/=length(f)+1e-4; f*=curl*C; f.y*=-1.;
      vec3 d=texture(uDye,vUv).rgb; float weight=min(max(d.r,max(d.g,d.b)),1.2);
      vec2 v=texture(uVelocity,vUv).xy+f*dt; v.y-=gravity*weight*dt; o=vec4(clamp(v,-1500.,1500.),0.,1.); }`,
    pressure: `uniform sampler2D uPressure, uDivergence;
      void main(){ o=vec4((texture(uPressure,vL).x+texture(uPressure,vR).x+texture(uPressure,vT).x+texture(uPressure,vB).x-texture(uDivergence,vUv).x)*.25,0.,0.,1.); }`,
    gradient: `uniform sampler2D uPressure, uVelocity;
      void main(){ vec2 v=texture(uVelocity,vUv).xy-vec2(texture(uPressure,vR).x-texture(uPressure,vL).x,texture(uPressure,vT).x-texture(uPressure,vB).x); o=vec4(v,0.,1.); }`,
    fade: `uniform sampler2D uTexture; uniform float value; void main(){ o=value*texture(uTexture,vUv); }`,
    display: `uniform sampler2D uTexture; uniform vec2 texel;
      float m(vec3 c){ return max(c.r,max(c.g,c.b)); }
      void main(){ vec3 c=texture(uTexture,vUv).rgb; float a=m(c);
        float dx=m(texture(uTexture,vR).rgb)-m(texture(uTexture,vL).rgb), dy=m(texture(uTexture,vT).rgb)-m(texture(uTexture,vB).rgb);
        vec3 n=normalize(vec3(dx,dy,.045)); vec3 light=normalize(vec3(-.35,.55,1.));
        float diffuse=clamp(dot(n,light)*.55+.62,.35,1.15);
        float spec=pow(clamp(dot(reflect(-light,n),vec3(0.,0.,1.)),0.,1.),38.)*.85;
        float alpha=smoothstep(.06,.30,a);
        vec3 hue=c/max(a,1e-3); vec3 col=hue*diffuse*mix(.78,1.,smoothstep(.3,1.2,a));
        o=vec4((min(col,1.)+spec)*alpha,alpha); }`
  };
  function shader(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s; }
  const vs = shader(gl.VERTEX_SHADER, vertex);
  const prog = {};
  for (const [name, src] of Object.entries(sources)) {
    const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, head + src));
    gl.bindAttribLocation(p, 0, "aPosition"); gl.linkProgram(p);
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
    prog[name] = {p, u};
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(0);

  function target(w, h, internal, format) {
    gl.activeTexture(gl.TEXTURE0);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.HALF_FLOAT, null);
    const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    return {tex, fbo, w, h, attach(unit) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); return unit; }};
  }
  const double = (...a) => { let r = target(...a), w = target(...a); return {get read() { return r; }, get write() { return w; }, swap() { [r, w] = [w, r]; }}; };
  let velocity, dye, pressure, divergence, curlT, simW, simH, dyeW, dyeH;
  function allocate() {
    const aspect = innerWidth / innerHeight, size = narrow() ? 512 : 900;
    simW = aspect >= 1 ? Math.round(SIM * aspect) : SIM; simH = aspect >= 1 ? SIM : Math.round(SIM / aspect);
    dyeW = aspect >= 1 ? Math.round(size * aspect) : size; dyeH = aspect >= 1 ? size : Math.round(size / aspect);
    velocity = double(simW, simH, gl.RG16F, gl.RG); dye = double(dyeW, dyeH, gl.RGBA16F, gl.RGBA);
    pressure = double(simW, simH, gl.R16F, gl.RED); divergence = target(simW, simH, gl.R16F, gl.RED); curlT = target(simW, simH, gl.R16F, gl.RED);
  }
  function blit(dest) {
    if (dest) { gl.viewport(0, 0, dest.w, dest.h); gl.bindFramebuffer(gl.FRAMEBUFFER, dest.fbo); }
    else { gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }
  function use(name, texelW, texelH) { const q = prog[name]; gl.useProgram(q.p); if (q.u.texel) gl.uniform2f(q.u.texel, 1 / texelW, 1 / texelH); return q.u; }

  // Public: drop ink at (x, y) in viewport fractions, y downward; velocity in px/s.
  const pending = [];
  function splat(x, y, vx, vy, color, radius = .0028, strength = 1) { pending.push([x, 1 - y, vx * .1, -vy * .1, color.map(c => c * strength), radius]); wake(); }
  function applySplat([x, y, vx, vy, color, radius]) {
    let u = use("splat", simW, simH);
    gl.uniform1i(u.uTarget, velocity.read.attach(0)); gl.uniform1f(u.aspect, innerWidth / innerHeight);
    gl.uniform2f(u.point, x, y); gl.uniform3f(u.color, vx, vy, 0); gl.uniform1f(u.radius, radius);
    blit(velocity.write); velocity.swap();
    u = use("splat", dyeW, dyeH);
    gl.uniform1i(u.uTarget, dye.read.attach(0)); gl.uniform1f(u.aspect, innerWidth / innerHeight);
    gl.uniform2f(u.point, x, y); gl.uniform3f(u.color, ...color); gl.uniform1f(u.radius, radius);
    blit(dye.write); dye.swap();
  }
  function step(dt) {
    gl.disable(gl.BLEND);
    let u = use("curl", simW, simH); gl.uniform1i(u.uVelocity, velocity.read.attach(0)); blit(curlT);
    u = use("vorticity", simW, simH);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0)); gl.uniform1i(u.uCurl, curlT.attach(1)); gl.uniform1i(u.uDye, dye.read.attach(2));
    gl.uniform1f(u.curl, 22); gl.uniform1f(u.dt, dt); gl.uniform1f(u.gravity, 150); blit(velocity.write); velocity.swap();
    u = use("divergence", simW, simH); gl.uniform1i(u.uVelocity, velocity.read.attach(0)); blit(divergence);
    u = use("fade", simW, simH); gl.uniform1i(u.uTexture, pressure.read.attach(0)); gl.uniform1f(u.value, .8); blit(pressure.write); pressure.swap();
    u = use("pressure", simW, simH); gl.uniform1i(u.uDivergence, divergence.attach(0));
    for (let i = 0; i < PRESSURE_ITER; i++) { gl.uniform1i(u.uPressure, pressure.read.attach(1)); blit(pressure.write); pressure.swap(); }
    u = use("gradient", simW, simH); gl.uniform1i(u.uPressure, pressure.read.attach(0)); gl.uniform1i(u.uVelocity, velocity.read.attach(1)); blit(velocity.write); velocity.swap();
    u = use("advect", simW, simH); gl.uniform2f(u.simTexel, 1 / simW, 1 / simH); gl.uniform1f(u.dt, dt);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0)); gl.uniform1i(u.uSource, velocity.read.attach(0)); gl.uniform1f(u.dissipation, .35); blit(velocity.write); velocity.swap();
    u = use("advect", dyeW, dyeH); gl.uniform2f(u.simTexel, 1 / simW, 1 / simH); gl.uniform1f(u.dt, dt);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0)); gl.uniform1i(u.uSource, dye.read.attach(1)); gl.uniform1f(u.dissipation, .8); blit(dye.write); dye.swap();
  }
  function render() {
    gl.disable(gl.BLEND);
    const u = use("display", dyeW, dyeH); gl.uniform1i(u.uTexture, dye.read.attach(0));
    gl.clearColor(0, 0, 0, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clear(gl.COLOR_BUFFER_BIT); blit(null);
  }

  let running = false, last = 0, quietSince = 0, raf = 0;
  function wake() { quietSince = performance.now(); if (!running && !motion.matches) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); } }
  function loop(now) {
    const dt = Math.min(.025, (now - last) / 1000); last = now;
    scrollInk(dt);
    while (pending.length) applySplat(pending.shift());
    step(dt); render();
    if (now - quietSince < 6500) raf = requestAnimationFrame(loop);
    else { running = false; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clear(gl.COLOR_BUFFER_BIT); }
  }
  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, 1.25);
    canvas.width = Math.round(innerWidth * ratio); canvas.height = Math.round(innerHeight * ratio);
    allocate();
  }

  // ——— Choreography ———
  const seq = [INK.c, INK.m, INK.y, INK.o];
  let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  function pour() {
    // Arrival: four inks are poured onto the cover photograph, right of the headline.
    seq.forEach((color, i) => setTimeout(() => {
      const x = narrow() ? .62 + i * .1 : .56 + i * .11;
      splat(x, .02, (rnd() - .5) * 600, 4200 + rnd() * 1400, color, narrow() ? .0032 : .0022, 1.1);
    }, 180 + i * 260));
  }
  let lastY = scrollY, lastTime = 0, printed = new Set(), crossed = new Set();
  function scrollInk(dt) {
    const dy = scrollY - lastY; lastY = scrollY;
    if (!dy) return;
    const speed = clamp(Math.abs(dy) / (dt * 1000 || 16), 0, 6);
    const coverBox = cover.getBoundingClientRect();
    // While the cover is visible, scrolling makes the ink run.
    if (coverBox.bottom > innerHeight * .2 && rnd() < .35 + speed * .1) {
      const color = seq[Math.floor(rnd() * 4)];
      splat((narrow() ? .66 : .55) + rnd() * (narrow() ? .3 : .42), coverBox.top / innerHeight * .4 + rnd() * .25, (rnd() - .5) * 200, Math.sign(dy) * (500 + speed * 260), color, .0012 + rnd() * .0014, .8);
    }
  }
  function filmInk(t, previous) {
    const down = t >= previous;
    // Each printing unit throws its colour across the top of the sheet.
    [[5.75, INK.c], [6.55, INK.m], [7.35, INK.y], [8.15, INK.o]].forEach(([at, color], i) => {
      if ((previous < at) === (t >= at) && Math.abs(t - at) < 1.2) {
        const y = .12 + i * .045;
        splat(down ? 0 : 1, y, (down ? 1 : -1) * 5200, 300, color, .0026, 1.25);
        splat(down ? 0 : 1, y + .03, (down ? 1 : -1) * 3800, 0, color, .0014, 1);
      }
    });
    // Between stations two inks collide and wash across the frame, as on a running press.
    [13.6, 25.6, 37.6, 44.7].forEach((at, i) => {
      if ((previous < at) === (t >= at) && Math.abs(t - at) < 1.5) {
        const a = seq[i % 4], b = seq[(i + 1) % 4];
        for (let k = 0; k < 3; k++) {
          const y = .32 + k * .1, lift = (down ? -1 : 1) * (300 + k * 200);
          splat(0, y, 4600 - k * 500, lift, a, .0022, 1);
          splat(1, y + .05, -4600 + k * 500, lift, b, .0022, 1);
        }
      }
    });
  }
  let contactInked = false;
  new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting || contactInked || motion.matches) return;
    contactInked = true;
    [[.1, INK.c, 1], [.9, INK.m, -1], [.3, INK.y, 1], [.75, INK.o, -1]].forEach(([x, color, dir], i) =>
      setTimeout(() => splat(x, .55 + i * .08, dir * 2200, -400, color, .0032, .9), i * 220));
  }, {threshold: .45}).observe(contact);

  // The pointer stirs the ink on the cover.
  let px = 0, py = 0;
  cover.addEventListener("pointermove", e => {
    if (motion.matches || e.pointerType !== "mouse") return;
    const dx = e.clientX - px, dy = e.clientY - py; px = e.clientX; py = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) < 2 || e.clientX < innerWidth * .45) return;
    splat(e.clientX / innerWidth, e.clientY / innerHeight, dx * 22, dy * 22, seq[Math.floor(performance.now() / 900) % 4], .0009, .55);
  });

  document.addEventListener("larre:temps", e => {
    const t = e.detail.time;
    if (motion.matches) return;
    statementsAt(t); filmInk(t, lastTime); lastTime = t;
  });
  addEventListener("scroll", () => { if (!motion.matches) wake(); }, {passive: true});
  addEventListener("resize", () => { resize(); });
  function start() {
    canvas.hidden = motion.matches;
    statements.forEach(s => { s.el.style.opacity = ""; s.el.style.transform = ""; });
    if (motion.matches) return;
    resize(); pour();
  }
  motion.addEventListener("change", start);
  start();
}
