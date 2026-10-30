/* 把 preview/effects.html 里四个特效各截一张，用于比对。
   需要自备 Playwright（不在插件依赖里）：
     npm i -D playwright            # 或在别的项目里装好
     DSH_PLAYWRIGHT=/path/to/playwright node preview/shot.mjs
   浏览器默认用 Playwright 自带的 Chromium；要指定本机浏览器时给 DSH_CHROMIUM。
   跑法：node preview/shot.mjs [输出目录]（默认 preview/shots） */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const playwrightModule = process.env.DSH_PLAYWRIGHT ?? 'playwright';

let chromium;
try {
  ({ chromium } = require(playwrightModule));
} catch (error) {
  console.error(`找不到 Playwright（${playwrightModule}）。装一份，或把模块路径给 DSH_PLAYWRIGHT。`);
  throw error;
}

const out = path.resolve(process.argv[2] ?? path.join(here, 'shots'));
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  ...(process.env.DSH_CHROMIUM ? { executablePath: process.env.DSH_CHROMIUM } : {}),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('[console]', m.text()));
await page.goto(pathToFileURL(path.join(here, 'effects.html')).href);
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
