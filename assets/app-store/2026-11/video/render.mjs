// Vyrenderuje video.html snímek po snímku (30 fps) do frames/. node render.mjs [od] [do] [krok] [prefix]
import { chromium } from 'playwright';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const FPS = 30;
const from = Number(process.argv[2] ?? 0);
const to = Number(process.argv[3] ?? 29.5);
const step = Number(process.argv[4] ?? 1);          // 1 = každý snímek; 15 = náhled po půl vteřině
const outDir = process.argv[5] ?? 'frames';
const WORKERS = step === 1 ? 4 : 1;
mkdirSync(outDir, { recursive: true });
const config = existsSync('config.json') ? JSON.parse(readFileSync('config.json', 'utf8')) : {};

const first = Math.round(from * FPS);
const last = Math.round(to * FPS);
const frames = [];
for (let f = first; f < last; f += step) frames.push(f);

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
async function worker(index) {
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((cfg) => { window.CONFIG = cfg; }, config);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 300)));
  await page.goto(pathToFileURL(`${process.cwd()}/video.html`).href);
  await page.evaluate(() => window.prepare());
  for (let i = index; i < frames.length; i += WORKERS) {
    const f = frames[i];
    await page.evaluate((t) => window.setTime(t), f / FPS);
    await page.screenshot({ path: `${outDir}/f_${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 93 });
  }
  await ctx.close();
}
const started = Date.now();
await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i)));
await browser.close();
console.log(`hotovo: ${frames.length} snímků za ${Math.round((Date.now() - started) / 1000)} s`);
