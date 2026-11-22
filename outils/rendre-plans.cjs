// Renders a contact sheet of chosen seconds. Usage: node outils/rendre-plans.cjs URL SORTIE.jpg 2,4.1,13 [--portrait]
const {chromium} = require('playwright');
const {execFileSync} = require('node:child_process');
const {mkdtempSync, writeFileSync} = require('node:fs');
const os = require('node:os'), path = require('node:path');
(async () => {
  const [base, out, list, flag] = process.argv.slice(2);
  const portrait = flag === '--portrait';
  const [width, height] = portrait ? [720, 746] : [1280, 756];
  const browser = await chromium.launch({args:['--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport:{width,height}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const url = new URL('render-frame', base.endsWith('/') ? base : base + '/').href;
  await page.route(url, r => r.fulfill({contentType:'text/html', body:'<!doctype html><style>*{margin:0}canvas{display:block;width:100vw;height:100vh}</style><canvas></canvas>'}));
  await page.goto(url);
  await page.evaluate(async () => {
    const {atelierRenderer} = await import('./js/scene.js?' + Date.now());
    const canvas = document.querySelector('canvas');
    const scene = await atelierRenderer(canvas);
    window.renderFrame = t => { scene.draw(t); return canvas.toDataURL('image/jpeg', .9).split(',')[1]; };
  });
  const dir = mkdtempSync(path.join(os.tmpdir(), 'plans-'));
  const times = list.split(',').map(Number), files = [];
  for (const t of times) {
    const f = path.join(dir, t.toFixed(2).padStart(5, '0') + '.jpg');
    writeFileSync(f, Buffer.from(await page.evaluate(x => window.renderFrame(x), t), 'base64'));
    files.push(f);
  }
  await browser.close();
  const cols = Math.min(4, files.length), scale = portrait ? 360 : 480;
  const args = [];
  files.forEach(f => args.push('-i', f));
  const parts = files.map((f, i) => `[${i}:v]scale=${scale}:-2,drawtext=text='${times[i]}s':x=8:y=8:fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.5[v${i}]`);
  const layout = files.map((_, i) => `${(i % cols) ? Array.from({length:i % cols}, (_, k) => `w${k}`).join('+') : '0'}_${Math.floor(i / cols) ? Array.from({length:Math.floor(i / cols)}, (_, k) => `h${k * cols}`).join('+') : '0'}`).join('|');
  const fc = parts.join(';') + ';' + files.map((_, i) => `[v${i}]`).join('') + (files.length > 1 ? `xstack=inputs=${files.length}:layout=${layout}:fill=black` : 'null');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args, '-filter_complex', fc, '-frames:v', '1', out]);
  console.log(out, errors.length ? 'ERREURS: ' + errors.join(' | ') : 'sans erreur');
})();
