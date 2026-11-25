// Offline renderer for the web scene. Requires Playwright, Chromium and FFmpeg.
const {chromium} = require('playwright');
const {spawn} = require('node:child_process');
const {mkdir} = require('node:fs/promises');
const path = require('node:path');
const {once} = require('node:events');

async function render(base, directory, portrait, hd) {
  const site = new URL(base.endsWith('/') ? base : base + '/');
  const executablePath = process.env.CHROME_BIN;
  const width = hd ? 1920 : portrait ? 720 : 1280;
  const height = hd ? 1080 : portrait ? 746 : 756;
  await mkdir(directory, {recursive:true});
  const browser = await chromium.launch({headless:true,executablePath,args:['--enable-unsafe-swiftshader']});
  let encoder;
  try {
    // HD is rendered at 1.5x and downscaled by FFmpeg: supersampling removes the jagged, pixelated edges.
    const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:hd?1.5:1});
    const url = new URL('render-frame',site).href;
    await page.route(url, route=>route.fulfill({contentType:'text/html',body:'<!doctype html><style>*{margin:0}canvas{display:block;width:100vw;height:100vh}</style><canvas></canvas>'}));
    await page.goto(url);
    await page.evaluate(async () => {
      const {atelierRenderer} = await import('./js/scene.js');
      const canvas = document.querySelector('canvas');
      const scene = await atelierRenderer(canvas);
      window.renderFrame = time => {
        scene.draw(time);
        return canvas.toDataURL('image/jpeg',.95).split(',')[1];
      };
    });
    // FROM and TO (frames) render one segment, so several processes can share a long film.
    const from=+(process.env.FROM||0), to=+(process.env.TO||52*24), part=process.env.FROM?'-'+String(from).padStart(4,'0'):'';
    const dest = path.join(directory,(hd?'fabrication-hd':portrait?'fabrication-mobile':'fabrication')+part+'.mp4');
    encoder = spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','24','-c:v','mjpeg','-i','pipe:0','-an',...(hd?['-vf','scale=1920:1080:flags=lanczos']:[]),'-c:v','libx264','-preset',hd?'slow':'fast','-crf',hd?'17':'20','-pix_fmt','yuv420p','-g','12','-keyint_min','12','-sc_threshold','0','-movflags','+faststart',dest],{stdio:['pipe','inherit','inherit']});
    const finished = once(encoder,'close');
    for(let frame=from;frame<=to;frame++){
      const data = await page.evaluate(t=>window.renderFrame(t),frame/24);
      if (!encoder.stdin.write(Buffer.from(data,'base64'))) await once(encoder.stdin,'drain');
      if(frame%240===0) console.log(frame/24+' s');
    }
    encoder.stdin.end();
    const [code] = await finished;
    if(code!==0) throw Error('FFmpeg '+code);
  } finally {
    if(encoder && encoder.exitCode===null) encoder.kill();
    await browser.close();
  }
}
const [base, directory, flag] = process.argv.slice(2);
if(!base || !directory) throw Error('Usage : node outils/rendre-film.cjs URL DOSSIER [--portrait|--hd]');
render(base,directory,flag==='--portrait',flag==='--hd').catch(error=>{console.error(error);process.exitCode=1;});
