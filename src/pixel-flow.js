/* ─────────────────────────────────────────────────────────────
   像素流光：滑条填充里的一小块「随机场」，按格子上色。
   和主题包的 WebGL 流光同源（域扭曲 fbm），但这里只画 300×28：
   一格 5 个 CSS 像素、三十来列，CPU 算完全够，所以用 canvas 2D，
   不额外开 WebGL 上下文，软件渲染的机器也能跑。

   用法：
     const field = createPixelFlow(canvas, {
       cell: 5,
       color: () => [r, g, b],      每帧（限流）读一次亮色
       power: () => 0..1,           档位强度：越高越快、越亮
       speed: () => 0.7..1.4,       设置里的速度倍率
       reduced: () => boolean,      减少动效：只画一帧
     });
     field.dispose();

   颜色只由调用方给，这里不碰主题变量。配色的两枚小工具也在本文件里，
   预览页和插件共用一份。
   ───────────────────────────────────────────────────────────── */

/** 任意 CSS 颜色 → [r, g, b]；解析不了返回 null。用 1×1 画布问浏览器，比手写解析稳。 */
let pixelColorProbe = null;
function parseCssColor(value) {
  if (typeof document === "undefined") return null;
  try {
    if (pixelColorProbe === null) {
      pixelColorProbe = document.createElement("canvas");
      pixelColorProbe.width = 1;
      pixelColorProbe.height = 1;
    }
    const ctx = pixelColorProbe.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "rgba(0, 0, 0, 0)";
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    /* 赋值失败时 fillStyle 停在透明的那个值上，用它当「认不出来」。 */
    if (data[3] === 0) return null;
    return [data[0], data[1], data[2]];
  } catch {
    return null;
  }
}

/** 按顺序找第一个有值的 CSS 变量，解析成 rgb。 */
function readCssColor(node, names) {
  try {
    const style = window.getComputedStyle(node);
    for (const name of names) {
      const raw = style.getPropertyValue(name).trim();
      if (raw === "") continue;
      const rgb = parseCssColor(raw);
      if (rgb !== null) return rgb;
    }
  } catch {
    /* 拿不到就沿用上一次的颜色 */
  }
  return null;
}

function createPixelFlow(canvas, options) {
  const opts = options || {};
  const CELL = opts.cell || 5;
  const FRAME_MS = 1000 / 30;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.5);
  /* 五阶透明度：和主题流光一样先量化，再用 Bayer 抖动抹开，所以放大后是硬格子。 */
  const STEPS = [0, 0.12, 0.3, 0.62, 0.92];
  const LEVELS = STEPS.length - 1;
  const SX = 26;
  const SY = 9;
  const WARP = 0.55;
  const OCTAVES = 4;
  const CONTRAST = 1.15;

  const ctx = typeof canvas.getContext === "function" ? canvas.getContext("2d", { alpha: true }) : null;
  if (!ctx) return null;

  const hash = (x, y, s) => {
    let h = x * 374761393 + y * 668265263 + s * 1274126177;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const smooth = (v) => v * v * (3 - 2 * v);
  const vnoise = (x, y, s) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = smooth(x - ix);
    const fy = smooth(y - iy);
    const a = hash(ix, iy, s);
    const b = hash(ix + 1, iy, s);
    const c = hash(ix, iy + 1, s);
    const d = hash(ix + 1, iy + 1, s);
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  };
  const fbm = (x, y, octaves, seed) => {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    for (let i = 0; i < octaves; i += 1) {
      sum += vnoise(x * freq, y * freq, seed + i * 17) * amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum;
  };

  let w = 0;
  let h = 0;
  let pixels = null;
  let time = 0;
  let raf = 0;
  let last = 0;
  let tick = 0;
  let color = [255, 255, 255];
  let disposed = false;

  const readColor = () => {
    if (typeof opts.color !== "function") return color;
    const next = opts.color();
    if (Array.isArray(next) && next.length >= 3) color = next;
    return color;
  };

  /* 画布尺寸不跟填充宽度走：填充一拖宽，按 5px 取整的列数就会来回跳，整场看起来在抖。
     这里量「轨道」的宽度（opts.span 或最近的 .dts-track），画布固定成它的整数倍，
     填充长起来只是把右边露出来——图案不动，也就不抖了。 */
  const measure = () => {
    if (typeof opts.span === "function") {
      const value = opts.span();
      if (value > 0) return value;
    }
    const track = typeof canvas.closest === "function" ? canvas.closest(".dts-track") : null;
    const box = track || canvas.parentElement;
    return box ? box.getBoundingClientRect().width : canvas.clientWidth || 1;
  };

  const resize = () => {
    if (disposed) return;
    const cssW = Math.max(CELL, measure());
    const box = canvas.parentElement;
    const cssH = box ? box.getBoundingClientRect().height : canvas.clientHeight;
    const nextW = Math.max(1, Math.ceil(cssW / CELL));
    const nextH = Math.max(1, Math.ceil((cssH || 1) / CELL));
    if (nextW === w && nextH === h) return;
    w = nextW;
    h = nextH;
    canvas.width = w;
    canvas.height = h;
    /* 画布按整格给尺寸：不拉伸，像素才是方的；多出来的一两像素被填充裁掉。 */
    canvas.style.width = `${w * CELL}px`;
    canvas.style.height = `${h * CELL}px`;
    pixels = ctx.createImageData(w, h);
    /* 尺寸变了底色也要重画，不然会留一块空白。 */
    tick = 0;
    paint();
  };

  const paint = () => {
    if (disposed || pixels === null) return;
    const data = pixels.data;
    const [r, g, b] = color;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const nx = x / SX;
        const ny = y / SY;
        const wx = nx + (fbm(nx * 1.1 + 3.1, ny * 1.1, 2, 11) - 0.5) * WARP * 2;
        const wy = ny + (fbm(nx * 1.1, ny * 1.1 + 7.7, 2, 23) - 0.5) * WARP * 2;
        let value = fbm(wx + time * 0.12, wy - time * 0.05, OCTAVES, 5);
        value = (value - 0.32) * CONTRAST * 2.4;
        value = value < 0 ? 0 : value > 1 ? 1 : value;
        const level = value * LEVELS + BAYER[(y & 3) * 4 + (x & 3)];
        const step = level < 0 ? 0 : level > LEVELS ? LEVELS : Math.floor(level);
        const i = (y * w + x) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = Math.round(STEPS[step] * 255);
      }
    }
    ctx.putImageData(pixels, 0, 0);
  };

  const loop = (now) => {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    if (now - last < FRAME_MS) return;
    const dt = last === 0 ? 0 : Math.min(0.1, (now - last) / 1000);
    last = now;
    const power = typeof opts.power === "function" ? opts.power() : 1;
    const speed = typeof opts.speed === "function" ? opts.speed() : 1;
    time += dt * (0.35 + 1.65 * power) * speed;
    /* 颜色每半秒左右重读一次：换配色 / 切深浅不需要重建 field。 */
    if (tick % 15 === 0) readColor();
    tick += 1;
    paint();
  };

  readColor();
  resize();

  if (typeof opts.reduced === "function" && opts.reduced()) {
    paint();
  } else if (typeof requestAnimationFrame === "function") {
    raf = requestAnimationFrame(loop);
  }

  /* 盯轨道而不是画布自己：画布尺寸是我们自己写的，盯它会在「布局 → 改尺寸 → 再布局」里打转。 */
  const observeTarget =
    (typeof canvas.closest === "function" ? canvas.closest(".dts-track") : null) || canvas.parentElement || canvas;
  const observer =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          resize();
        })
      : null;
  if (observer) observer.observe(observeTarget);

  return {
    resize,
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (observer) observer.disconnect();
    },
  };
}
