// Contact sheet of the opening ink scene. Usage: node outils/rendre-encre.cjs URL SORTIE.jpg 0,.1,.2 [--portrait]
const {chromium} = require('playwright');
const {execFileSync} = require('node:child_process');
const {mkdtempSync, writeFileSync} = require('node:fs');
const os = require('node:os'), path = require('node:path');
(async () => {
  const [base, out, list, flag] = process.argv.slice(2);
  const [width, height] = flag === '--portrait' ? [430, 760] : [1280, 760];
  const browser = await chromium.launch({args:['--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const page = await browser.newPage({viewport:{width,height}});
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  const url = new URL('render-ink', base.endsWith('/') ? base : base + '/').href;
  await page.route(url, r => r.fulfill({contentType:'text/html', body:'<!doctype html><style>*{margin:0}canvas{display:block;width:100vw;height:100vh}</style><canvas></canvas>'}));
  await page.goto(url);
  await page.evaluate(async () => {
    const {inkScene} = await import('./js/encre3d.js?' + Date.now());
    const canvas = document.querySelector('canvas'); const s = await inkScene(canvas);
    window.frame = p => { s.draw(p, p * 20); return canvas.toDataURL('image/jpeg', .88).split(',')[1]; };
  });
  const dir = mkdtempSync(path.join(os.tmpdir(), 'encre-')), times = list.split(',').map(Number), files = [];
  for (const t of times) { const f = path.join(dir, files.length + '.jpg'); writeFileSync(f, Buffer.from(await page.evaluate(x => window.frame(x), t), 'base64')); files.push(f); }
  await browser.close();
  const cols = Math.min(4, files.length), w = flag === '--portrait' ? 240 : 480, args = [];
  files.forEach(f => args.push('-i', f));
  const fc = files.map((f, i) => `[${i}:v]scale=${w}:-2,drawtext=text='${times[i]}':x=8:y=8:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.5[v${i}]`).join(';') + ';' +
    files.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${files.length}:layout=` + files.map((_, i) => `${i % cols ? Array.from({length:i % cols}, (_, k) => 'w' + k).join('+') : '0'}_${Math.floor(i / cols) ? Array.from({length:Math.floor(i / cols)}, (_, k) => 'h' + k * cols).join('+') : '0'}`).join('|') + ':fill=black';
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args, '-filter_complex', fc, '-frames:v', '1', out]);
  console.log(out, errors.length ? 'ERREURS: ' + errors.join(' | ') : 'sans erreur');
})();
