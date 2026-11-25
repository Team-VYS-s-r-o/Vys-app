// Natočí běžící aplikaci ostře (860×1756): čas v aplikaci se zpomalí K× a fotí se snímek za snímkem.
// node rec2.mjs <název> <cesta> '<kroky JSON>' [role]   — časy v krocích jsou v čase APLIKACE (ms).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { newAppContext } from './app-common.mjs';
const [name, route, stepsJson = '[]', role = 'participant'] = process.argv.slice(2);
const steps = JSON.parse(stepsJson);
const K = Number(process.env.K || 3);
const dir = `rec/${name}`;
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await newAppContext(browser, role, { width: 430, height: 878, scale: 2 });
await ctx.addInitScript(() => {
  const realNow = performance.now.bind(performance);
  const realDateNow = Date.now.bind(Date);
  let k = 1, baseReal = realNow(), baseVirt = realNow();
  const virt = () => baseVirt + (realNow() - baseReal) / k;
  const d0 = realDateNow(), p0 = realNow();
  window.__slow = (nk) => { baseVirt = virt(); baseReal = realNow(); k = nk; };
  performance.now = () => virt();
  Date.now = () => Math.round(d0 + (virt() - p0));
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf(() => cb(virt()));
  const st = window.setTimeout.bind(window), si = window.setInterval.bind(window);
  window.setTimeout = (fn, d = 0, ...a) => st(fn, d * k, ...a);
  window.setInterval = (fn, d = 0, ...a) => si(fn, d * k, ...a);
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 160)));
await page.goto(`http://localhost:8081/${route}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(Number(process.env.WARM || 9000));
await page.getByText('Rozumím').first().click({ timeout: 800 }).catch(() => {});
const cdp = await ctx.newCDPSession(page);
await cdp.send('Animation.enable').catch(() => {});
await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / K }).catch(() => {});
await page.evaluate((k) => window.__slow(k), K);
const t0 = Date.now();
const appTime = () => (Date.now() - t0) / K;
let running = true; const frames = []; let n = 0;
const capture = (async () => {
  while (running) {
    const t = appTime();
    const buf = await page.screenshot({ type: 'jpeg', quality: 93 }).catch(() => null);
    if (!buf) break;
    const file = `f_${String(n++).padStart(5, '0')}.jpg`;
    writeFileSync(`${dir}/${file}`, buf);
    frames.push({ file, t: +(t / 1000).toFixed(4) });
  }
})();
const marks = [];
const sleepApp = (ms) => new Promise((r) => setTimeout(r, ms * K));
for (const step of steps) {
  try {
    if (step.wait) await sleepApp(step.wait);
    if (step.click) { marks.push({ at: +(appTime() / 1000).toFixed(2), what: step.click }); await page.getByText(step.click, { exact: step.exact ?? false }).nth(step.nth ?? 0).click({ timeout: 6000, force: true }); }
    if (step.xy) { marks.push({ at: +(appTime() / 1000).toFixed(2), what: 'xy' }); await page.mouse.click(step.xy[0], step.xy[1]); }
    if (step.move) await page.mouse.move(step.move[0], step.move[1]);
    if (step.drag) { const [x, y1, y2, ms = 500] = step.drag; await page.mouse.move(x, y1); await page.mouse.down(); const n = 24; for (let i = 1; i <= n; i += 1) { await page.mouse.move(x, y1 + (y2 - y1) * (i / n)); await sleepApp(ms / n); } await page.mouse.up(); }
    if (step.wheel) { for (let i = 0; i < (step.times || 30); i += 1) { await page.mouse.wheel(0, step.wheel); await sleepApp(16); } }
  } catch (e) { console.log('STEP FAIL', JSON.stringify(step), String(e).split('\n')[0].slice(0, 140)); }
}
running = false; await capture;
writeFileSync(`${dir}/frames.json`, JSON.stringify({ frames, marks }));
console.log(name, 'snímků', frames.length, 'délka v aplikaci', frames.at(-1)?.t, 's', JSON.stringify(marks));
await browser.close();
