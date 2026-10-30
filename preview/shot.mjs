/* 把 preview/effects.html 里四个特效各截一张，用于比对。
   node preview/shot.mjs [输出目录] */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('D:/Nodejs/node_global/node_modules/@playwright/mcp/node_modules/playwright');

const out = path.resolve(process.argv[2] ?? 'shots');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/Traveritas/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('[console]', m.text()));
await page.goto('file:///D:/Documents/dsh/dsh-thinking-slider/preview/effects.html');
await page.waitForFunction(() => window.__labReady === true);
await page.waitForTimeout(800);

/* 动画停在同一相位再截：不然每张图拍到的都是随机一帧，没法比较。 */
const freeze = (ms) =>
  page.evaluate((ms) => {
    for (const anim of document.getAnimations()) {
      anim.pause();
      anim.currentTime = ms;
    }
  }, ms);

for (const dark of [false, true]) {
  if (dark) await page.click('#themeDark');
  await page.waitForTimeout(300);
  await freeze(320);
  for (const fx of ['flow', 'dust', 'pulse', 'glyph']) {
    await page.locator(`section[data-fx="${fx}"]`).screenshot({
      path: path.join(out, `${fx}${dark ? '-dark' : ''}.png`),
      animations: 'allow',
    });
  }
}

await browser.close();
console.log('shots →', out);
