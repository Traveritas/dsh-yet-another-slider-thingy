/* 把 preview/demo.html 的三个场景录成 README 用的 GIF。
   需要自备 Playwright 与 ffmpeg：
     npm i -D playwright
     DSH_PLAYWRIGHT=/path/to/playwright FFMPEG=/path/to/ffmpeg node preview/gif.mjs [skins|drag|effects|all]
   浏览器默认用 Playwright 自带的 Chromium；要指定时给 DSH_CHROMIUM。
   输出：docs/<scene>.gif（25fps，720×400） */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(root, 'docs');

const playwrightModule = process.env.DSH_PLAYWRIGHT ?? 'playwright';
let chromium;
try {
  ({ chromium } = require(playwrightModule));
} catch (error) {
  console.error(`找不到 Playwright（${playwrightModule}）。装一份，或把模块路径给 DSH_PLAYWRIGHT。`);
  throw error;
}

const ffmpeg = process.env.FFMPEG ?? 'ffmpeg';
const SCENES = {
  skins: { duration: 4800, note: "三套外观" },
  drag: { duration: 3400, note: "逐档 / 平滑" },
  effects: { duration: 4600, note: "四套特效" },
};
const FPS = 25;

const wanted = (process.argv[2] ?? "all").toLowerCase();
const scenes = wanted === "all" ? Object.keys(SCENES) : [wanted];
for (const scene of scenes) {
  if (!(scene in SCENES)) {
    console.error(`未知场景：${scene}（可选 ${Object.keys(SCENES).join(" / ")}）`);
    process.exit(1);
  }
}

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  ...(process.env.DSH_CHROMIUM ? { executablePath: process.env.DSH_CHROMIUM } : {}),
});
const page = await browser.newPage({ viewport: { width: 720, height: 400 }, deviceScaleFactor: 2 });
page.on("pageerror", (error) => console.log("[pageerror]", error.message));
page.on("console", (message) => message.type() === "error" && console.log("[console]", message.text()));

const demoUrl = pathToFileURL(path.join(here, "demo.html")).href;

for (const scene of scenes) {
  const { duration, note } = SCENES[scene];
  const frames = fs.mkdtempSync(path.join(os.tmpdir(), `dsh-gif-${scene}-`));
  await page.goto(`${demoUrl}?scene=${scene}`);
  await page.waitForFunction(() => window.__ready === true);
  await page.evaluate(() => document.fonts.ready);

  const total = Math.round((duration / 1000) * FPS);
  for (let index = 0; index < total; index += 1) {
    const now = index * (1000 / FPS);
    await page.evaluate((t) => window.renderFrame(t), now);
    await page.screenshot({
      path: path.join(frames, `${String(index + 1).padStart(4, "0")}.png`),
      animations: "allow",
      caret: "hide",
    });
    if (index % 25 === 0) process.stdout.write(`  ${scene}: ${index + 1}/${total}\r`);
  }

  const output = path.join(outDir, `${scene}.gif`);
  execFileSync(
    ffmpeg,
    [
      "-y",
      "-framerate", String(FPS),
      "-i", path.join(frames, "%04d.png"),
      "-vf",
      "scale=720:400:flags=lanczos,split[a][b];[a]palettegen=max_colors=192:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle",
      "-loop", "0",
      output,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  fs.rmSync(frames, { recursive: true, force: true });
  const size = fs.statSync(output).size;
  console.log(`${note.padEnd(10)} → ${path.relative(root, output)}  ${(size / 1024 / 1024).toFixed(2)} MB  (${total} 帧)`);
}

await browser.close();
