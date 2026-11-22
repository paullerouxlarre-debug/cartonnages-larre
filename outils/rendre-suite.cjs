// Renders the scroll-driven image sequence (12 images per second) straight from the 3D scene.
// Usage: node outils/rendre-suite.cjs URL DOSSIER --paysage|--portrait [premiere] [derniere]
const {chromium} = require('playwright');
const {mkdirSync, writeFileSync} = require('node:fs');
const path = require('node:path');
(async () => {
  const [base, dir, flag = '--paysage', from = '0', to = '624'] = process.argv.slice(2);
  const portrait = flag === '--portrait';
  const [width, height] = portrait ? [860, 892] : [1600, 945];
  mkdirSync(dir, {recursive: true});
  const browser = await chromium.launch({args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
  const page = await browser.newPage({viewport: {width, height}, deviceScaleFactor: 1});
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const url = new URL('render-seq', base.endsWith('/') ? base : base + '/').href;
  await page.route(url, r => r.fulfill({contentType: 'text/html', body: '<!doctype html><style>*{margin:0}canvas{display:block;width:100vw;height:100vh}</style><canvas></canvas>'}));
  await page.goto(url);
  await page.evaluate(async () => {
    const {atelierRenderer} = await import('./js/scene.js');
    const canvas = document.querySelector('canvas');
    const scene = await atelierRenderer(canvas);
    window.frame = t => { scene.draw(t); return canvas.toDataURL('image/webp', .76).split(',')[1]; };
  });
  const started = Date.now();
  for (let i = +from; i <= +to; i++) {
    const data = await page.evaluate(t => window.frame(t), i / 12);
    writeFileSync(path.join(dir, String(i + 1).padStart(3, '0') + '.webp'), Buffer.from(data, 'base64'));
    if (i % 50 === 0) console.log(i, Math.round((Date.now() - started) / 1000) + ' s');
  }
  await browser.close();
  console.log('fini', errors.length ? 'ERREURS: ' + errors.join(' | ') : 'sans erreur');
})();
