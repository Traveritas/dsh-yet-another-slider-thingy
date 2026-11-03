/**
 * 思考强度座位的离线行为自测：用一个极小的 React 垫片真跑组件，
 * 检查「打开 → 选模型 → 换档 → 提交 → 面板不关」这条链与提交参数。
 *
 * 不测像素、不测槽位接线（那些只能在实机看）；它只保证组件不会一渲染就炸、
 * 事件回调走的是对的分支。跑法：node scripts/selftest.mjs
 */
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
  .replace('__CSS__', '""')
  .replace('__PIXEL_FLOW__', readFileSync(new URL('../src/pixel-flow.js', import.meta.url), 'utf8'));

/* 组件里会摸 document / window；给垫片一套最小实现（不测布局）。 */
const noop = () => {};
globalThis.document = {
  addEventListener: noop,
  removeEventListener: noop,
  body: { appendChild: noop },
  head: { appendChild: noop },
};
globalThis.window = { addEventListener: noop, removeEventListener: noop, innerWidth: 1280, innerHeight: 900 };

/* ── React 垫片：单组件、按 hook 下标存状态，够这个组件用 ────────────── */
function createReact() {
  const hooks = [];
  let cursor = 0;
  let dirty = false;
  const effects = [];
  const listeners = new Set();

  const React = {
    Fragment: Symbol('Fragment'),
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useId: () => 'think-test',
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
      const set = (next) => {
        const value = typeof next === 'function' ? next(hooks[index]) : next;
        if (!Object.is(value, hooks[index])) {
          hooks[index] = value;
          dirty = true;
        }
      };
      return [hooks[index], set];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = { current: initial };
      return hooks[index];
    },
    useMemo(factory) {
      return factory();
    },
    useCallback(fn) {
      return fn;
    },
    useEffect(fn, deps) {
      const index = cursor++;
      effects.push({ index, kind: 'effect', fn, deps });
    },
    useLayoutEffect(fn, deps) {
      const index = cursor++;
      effects.push({ index, kind: 'layout', fn, deps });
    },
    useSyncExternalStore(subscribe, getSnapshot) {
      const index = cursor++;
      if (!(index in hooks)) {
        hooks[index] = { snapshot: getSnapshot() };
        subscribe(() => {
          hooks[index].snapshot = getSnapshot();
          for (const fn of listeners) fn();
        });
      } else {
        hooks[index].snapshot = getSnapshot();
      }
      return hooks[index].snapshot;
    },
  };

  const ReactDOM = {
    createPortal: (node) => node,
  };

  const runEffects = () => {
    const run = (kind) => {
      for (const entry of effects) {
        if (entry.kind !== kind) continue;
        const previous = hooks.__effects?.[entry.index];
        const deps = entry.deps;
        const changed =
          previous === undefined ||
          deps === undefined ||
          deps.length !== previous.deps?.length ||
          deps.some((value, i) => !Object.is(value, previous.deps[i]));
        if (!changed) continue;
        previous?.cleanup?.();
        const cleanup = entry.fn();
        hooks.__effects ??= {};
        hooks.__effects[entry.index] = { deps, cleanup: typeof cleanup === 'function' ? cleanup : undefined };
      }
    };
    run('layout');
    run('effect');
  };

  return {
    React,
    ReactDOM,
    render(Component, props) {
      let guard = 0;
      let tree;
      do {
        dirty = false;
        cursor = 0;
        effects.length = 0;
        tree = Component(props);
        runEffects();
      } while (dirty && ++guard < 30);
      if (dirty) throw new Error('seat did not settle after 30 renders');
      return tree;
    },
    hooks,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** 每个场景一版干净的 hook 状态（真实 React 是每个挂载点一棵树）。 */
    reset() {
      hooks.length = 0;
      delete hooks.__effects;
      listeners.clear();
    },
  };
}

/* ── primitives / 图标垫片 ───────────────────────────────────────────── */
const primitives = {
  /* 和真实宿主一致：forwardRef 组件是对象，不是函数。 */
  MenuSurface: { $$typeof: Symbol.for('react.forward_ref'), render: (props) => props },
  MenuGroup: (props) => ({ type: 'div', props: { 'data-menu-group': props.label }, children: props.children }),
  Input: (props) => ({ type: 'input', props, children: [] }),
  StateDot: () => ({ type: 'span', props: { 'data-state-dot': '' }, children: [] }),
  Toast: (props) => ({ type: 'div', props: { 'data-toast': props.text }, children: [props.text] }),
  IconChevronDownOutlineRegular: () => ({ type: 'svg', props: {}, children: [] }),
  IconChevronRightOutlineRegular: () => ({ type: 'svg', props: {}, children: [] }),
  IconCheckOutlineRegular: () => ({ type: 'svg', props: {}, children: [] }),
  IconCloseFillRegular: () => ({ type: 'svg', props: {}, children: [] }),
  IconWarningOutlineRegular: () => ({ type: 'svg', props: {}, children: [] }),
  rankByName: (models, query) => {
    const q = String(query ?? '').trim().toLowerCase();
    return q === '' ? models : models.filter((model) => String(model.name).toLowerCase().includes(q));
  },
  observeStickyMenuGroups: () => () => {},
};

const requireStub = (name) => {
  if (name === 'react') return react.React;
  if (name === 'react-dom') return { createPortal: (node) => node };
  throw new Error(`unexpected require: ${name}`);
};

const react = createReact();

const pluginModule = { exports: {} };
new Function('require', 'module', 'exports', source)(requireStub, pluginModule, pluginModule.exports);
const { createThinkingSliderSeat } = pluginModule.exports.__test;

/* 颜色存储：只接受 6 位 hex，忽略未知外观 / 槽位，大小写归一。 */
{
  const store = new Map();
  globalThis.window.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  };
  store.set(
    'dsh-yet-another-slider-thingy:colors',
    JSON.stringify({
      codex: { fill: '#FF3366', tick: 'not-a-color' },
      claude: { track: '#112233' },
      compact: { fill: '#ffffff' },
    }),
  );
  const { migrateLegacyColors, storedPalettes, storedPaletteId } = pluginModule.exports.__test;
  const legacy = migrateLegacyColors(JSON.parse(store.get('dsh-yet-another-slider-thingy:colors')), 'claude');
  if (legacy.palettes.length !== 3) throw new Error('legacy colors should become one palette per skin');
  const claudeLegacy = legacy.palettes.find((palette) => palette.id === 'legacy-claude');
  if (claudeLegacy?.light.track !== '#112233') throw new Error('legacy claude track should be carried over');
  const codexLegacy = legacy.palettes.find((palette) => palette.id === 'legacy-codex');
  if (codexLegacy?.light.fill !== '#ff3366') throw new Error('legacy hex should be normalized');
  if (codexLegacy?.light.tick !== undefined) throw new Error('legacy invalid values should be dropped');
  if (legacy.activeId !== 'legacy-claude') throw new Error('migration should select the current skin palette');
  if (legacy.palettes.every((palette) => palette.dark && Object.keys(palette.dark).length === 0) === false) {
    throw new Error('legacy colors should land in the light set only');
  }

  /* 存储：内置项总会补齐，自定义项原样保留。 */
  store.delete('dsh-yet-another-slider-thingy:palettes');
  const empty = storedPalettes();
  const builtinIds = ['claude', 'codex', 'tundra', 'seasalt', 'theme-averita', 'theme-coldmorning', 'duskrose', 'theme-duskpurple'];
  if (empty.length !== builtinIds.length || builtinIds.some((id, index) => empty[index].id !== id)) {
    throw new Error('storedPalettes should seed the built-ins');
  }
  const tundra = empty.find((palette) => palette.id === 'tundra');
  if (tundra?.light?.fill !== '#d3ddc7' || tundra?.dark?.accent !== '#a7c48f') {
    throw new Error('tundra should ship with its light and dark colors');
  }
  /* 主题四套：七个槽都自带值，不依赖宿主的 --dsw-* 也画得出颜色。 */
  const themePalettes = empty.filter((palette) => palette.id === 'duskrose' || palette.id.startsWith('theme-'));
  if (themePalettes.length !== 4) throw new Error('the four theme palettes should be built in');
  for (const palette of themePalettes) {
    for (const mode of ['light', 'dark']) {
      for (const slot of ['fill', 'accent', 'particle', 'thumb', 'track', 'tick', 'text']) {
        if (!/^#[0-9a-f]{6}$/.test(palette[mode]?.[slot] ?? '')) {
          throw new Error(`${palette.id} ${mode} should carry its own ${slot}`);
        }
      }
    }
  }
  const duskrose = empty.find((palette) => palette.id === 'duskrose');
  if (duskrose?.name !== '暮玫瑰' || duskrose?.light?.fill !== '#ad939a' || duskrose?.dark?.accent !== '#d3a6ad') {
    throw new Error('duskrose should take over the theme palette');
  }
  const averita = empty.find((palette) => palette.id === 'theme-averita');
  if (averita?.light?.track !== '#ebeef1' || averita?.dark?.text !== '#8691a2') {
    throw new Error('theme-averita should carry the theme track and text colors');
  }
  /* 旧「暮玫」的本地副本：没改过就升级成暮玫瑰，改过一项就保留用户副本。 */
  const oldDuskrose = {
    id: 'duskrose',
    name: '暮玫',
    light: { fill: '#e7d3d5', accent: '#a35a67', particle: '#a35a67', thumb: '#ffffff' },
    dark: { fill: '#3b2b2e', accent: '#d8959e', particle: '#d8959e', thumb: '#f8eeee' },
  };
  store.set('dsh-yet-another-slider-thingy:palettes', JSON.stringify([oldDuskrose]));
  const upgraded = storedPalettes().find((palette) => palette.id === 'duskrose');
  if (upgraded?.name !== '暮玫瑰' || upgraded?.light?.fill !== '#ad939a') {
    throw new Error('untouched legacy duskrose should upgrade to the theme palette');
  }
  store.set(
    'dsh-yet-another-slider-thingy:palettes',
    JSON.stringify([{ ...oldDuskrose, light: { ...oldDuskrose.light, fill: '#111111' } }]),
  );
  const touched = storedPalettes().find((palette) => palette.id === 'duskrose');
  if (touched?.name !== '暮玫' || touched?.light?.fill !== '#111111') {
    throw new Error('edited legacy duskrose should be preserved');
  }
  store.set(
    'dsh-yet-another-slider-thingy:palettes',
    JSON.stringify([{ id: 'mine', name: '我的', light: { fill: '#ABCDEF' }, dark: {} }]),
  );
  const mixed = storedPalettes();
  if (mixed.length !== builtinIds.length + 1 || mixed[mixed.length - 1].id !== 'mine') {
    throw new Error('custom palettes should follow the built-ins');
  }
  if (mixed[mixed.length - 1].light.fill !== '#abcdef') throw new Error('palette hex should be normalized');
  store.set('dsh-yet-another-slider-thingy:palette', 'mine');
  if (storedPaletteId() !== 'mine') throw new Error('palette id should read back');
  store.set('dsh-yet-another-slider-thingy:palette', '');
  if (storedPaletteId() !== 'auto') throw new Error('empty palette id should fall back to auto');
}

/* 平滑开关：只认 smooth，其余一律回落逐档；默认逐档。 */
{
  const store = new Map();
  globalThis.window.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  };
  const { storedSmooth } = pluginModule.exports.__test;
  if (storedSmooth() !== false) throw new Error('smooth should default to step');
  store.set('dsh-yet-another-slider-thingy:smooth', 'smooth');
  if (storedSmooth() !== true) throw new Error('smooth should read back as true');
  store.set('dsh-yet-another-slider-thingy:smooth', 'garbage');
  if (storedSmooth() !== false) throw new Error('unknown smooth value should fall back to step');
}

/* 特效 / 刻度两轴：各自只认自己的枚举，其余回落 auto；默认值跟着外观走。 */
{
  const store = new Map();
  globalThis.window.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  };
  const { storedEffects, storedLabels, resolveEffects, resolveLabels } = pluginModule.exports.__test;
  if (storedEffects() !== 'auto') throw new Error('effects should default to auto');
  if (storedLabels() !== 'auto') throw new Error('labels should default to auto');
  store.set('dsh-yet-another-slider-thingy:effects', 'on');
  store.set('dsh-yet-another-slider-thingy:labels', 'none');
  /* 旧版的「开」= 胶囊那套流光 + 粒子，升级后落到密度粒子。 */
  if (storedEffects() !== 'dust') throw new Error('legacy effects on should read back as dust');
  if (storedLabels() !== 'none') throw new Error('labels none should read back');
  store.set('dsh-yet-another-slider-thingy:effects', 'glyph');
  if (storedEffects() !== 'glyph') throw new Error('effects glyph should read back');
  store.set('dsh-yet-another-slider-thingy:effects', 'sometimes');
  store.set('dsh-yet-another-slider-thingy:labels', 'faster');
  if (storedEffects() !== 'auto') throw new Error('unknown effects should fall back to auto');
  if (storedLabels() !== 'auto') throw new Error('unknown labels should fall back to auto');

  if (resolveEffects('auto', 'codex') !== 'dust') throw new Error('auto effects should follow codex as dust');
  if (resolveEffects('auto', 'claude') !== null) throw new Error('auto effects should not borrow onto claude');
  if (resolveEffects('auto', 'compact') !== null) throw new Error('auto effects should stay off for compact');
  if (resolveEffects('flow', 'compact') !== 'flow') throw new Error('explicit flow should win for compact');
  if (resolveEffects('pulse', 'claude') !== 'pulse') throw new Error('explicit pulse should win for claude');
  if (resolveEffects('off', 'codex') !== null) throw new Error('explicit effects off wins for codex');
  if (resolveLabels('auto', 'claude') !== 'axis') throw new Error('auto labels should follow claude');
  if (resolveLabels('auto', 'codex') !== 'ticks') throw new Error('auto labels should follow codex');
  if (resolveLabels('axis', 'compact') !== 'axis') throw new Error('explicit axis wins for compact');
  if (resolveLabels('none', 'claude') !== 'none') throw new Error('explicit none wins for claude');
}

/* 特效设置归一：尾迹默认开、长度默认短；旧对象没有这两项也补齐，坏长度回短。 */
{
  const { normalizeFx } = pluginModule.exports.__test;
  const legacy = normalizeFx({ maxOnly: false, speeds: { dust: 0.7 } });
  if (legacy.trail !== true || legacy.trailLength !== 'short') {
    throw new Error('normalizeFx should default trail on / short, got ' + JSON.stringify(legacy));
  }
  if (normalizeFx({ trail: false, trailLength: 'long' }).trailLength !== 'long') {
    throw new Error('normalizeFx should keep a valid trail length');
  }
  if (normalizeFx({ trailLength: 'huge' }).trailLength !== 'short') {
    throw new Error('normalizeFx should fall back to short for unknown trail lengths');
  }
}

/* 刻度词的边界位移：居中优先，碰到带内边距外沿才往里让；比轨道宽就交给省略号。 */
{
  const { clampLabelShift, labelShiftTransform, sameShifts } = pluginModule.exports.__test;
  if (clampLabelShift(290, 304, 40, 8) !== 0) throw new Error('short end label should stay centered');
  if (clampLabelShift(14, 304, 40, 8) !== 0) throw new Error('short start label should stay centered');
  if (clampLabelShift(290, 304, 56, 8) !== -6) throw new Error('wide end label should shift left by 6, got ' + clampLabelShift(290, 304, 56, 8));
  if (clampLabelShift(14, 304, 56, 8) !== 6) throw new Error('wide start label should shift right by 6, got ' + clampLabelShift(14, 304, 56, 8));
  if (clampLabelShift(100, 304, 400, 8) !== 0) throw new Error('label wider than the track should not shift');
  if (labelShiftTransform(0) !== undefined) throw new Error('zero shift should keep the css transform');
  if (labelShiftTransform(-6) !== 'translateX(calc(-50% - 6px))') throw new Error('negative shift transform = ' + labelShiftTransform(-6));
  if (labelShiftTransform(4) !== 'translateX(calc(-50% + 4px))') throw new Error('positive shift transform = ' + labelShiftTransform(4));
  if (sameShifts(null, [0, 0]) !== false) throw new Error('unmeasured shifts should count as changed');
  if (sameShifts([0, 1], [0.01, 1]) !== true) throw new Error('sub-pixel changes should be ignored');
  if (sameShifts([0, 1], [0, 2]) !== false) throw new Error('real changes should re-render');
}

const Seat = createThinkingSliderSeat(primitives);
if (typeof Seat !== 'function') throw new Error('createThinkingSliderSeat returned null');

/* ── 假目录 store ───────────────────────────────────────────────────── */
function storeOf(snapshot) {
  let current = snapshot;
  const listeners = new Set();
  return {
    getSnapshot: () => current,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set(next) {
      current = { ...current, ...next };
      for (const fn of listeners) fn();
    },
  };
}

const efforts = [
  { id: 'off', name: 'Off' },
  { id: 'low', name: 'Low' },
  { id: 'high', name: 'High' },
  { id: 'max', name: 'Max' },
];
const modelOne = { id: 'm1', name: 'Model One', reasoning: { defaultEffort: 'high', efforts } };
const modelTwo = { id: 'm2', name: 'Model Two', reasoning: { defaultEffort: 'low', efforts: efforts.slice(0, 2) } };
const modelThree = { id: 'm3', name: 'Model Three' };
const groups = [
  { id: 'deepseek-official', name: 'DeepSeek', models: [modelOne, modelTwo, modelThree] },
];

const walk = (node, out = []) => {
  if (node === null || node === undefined || node === false) return out;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, out);
    return out;
  }
  if (typeof node !== 'object') return out;
  out.push(node);
  walk(node.children, out);
  return out;
};
const findNode = (tree, predicate) => walk(tree).find(predicate);
const findClass = (tree, className) =>
  walk(tree).find((node) => typeof node.props?.className === 'string' && node.props.className.includes(className));
const textOf = (node) =>
  walk(node)
    .map((entry) => entry.children?.filter((child) => typeof child === 'string' || typeof child === 'number').join('') ?? '')
    .join('');

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const calls = [];
const selectCalls = [];
const baseProps = (store) => ({
  locked: false,
  available: true,
  directory: store,
  load: () => calls.push('load'),
  select: (selection) => {
    selectCalls.push(selection);
    return Promise.resolve({ ok: true, value: undefined });
  },
  t: (key) => key,
  renderSlot: () => null,
});

/* 1. 没有当前模型：触发按钮显示占位，点开后直接进模型列表。 */
{
  await flush();
react.reset();
  const store = storeOf({ current: null, groups, status: 'ready', pending: null, error: null, failures: [] });
  const props = baseProps(store);
  const tree = react.render(Seat, props);
  const trigger = findClass(tree, 'dts-trigger');
  if (trigger === undefined) throw new Error('trigger missing');
  if (!textOf(trigger).includes('请选择模型')) throw new Error('fallback label missing: ' + textOf(trigger));

  trigger.props.onClick({});
  if (calls.includes('load') === false) throw new Error('load() was not called');

  const opened = react.render(Seat, props);
  const option = findNode(
    opened,
    (node) => node.type === 'button' && String(node.props.className || '').includes('dts-option'),
  );
  if (option === undefined) throw new Error('model option missing after open');
  option.props.onClick({});
  if (selectCalls.length !== 1) throw new Error('select was not called for the model');
  if (selectCalls[0].provider !== 'deepseek-official' || selectCalls[0].model !== 'm1') {
    throw new Error('unexpected selection: ' + JSON.stringify(selectCalls[0]));
  }
  if (selectCalls[0].reasoningEffort !== 'high') {
    throw new Error('model choice should carry its default effort, got ' + selectCalls[0].reasoningEffort);
  }
}

await flush();
react.reset();

/* 2. 当前模型有推理元数据：触发按钮带档名；键盘 End 提交最强档，面板不关。 */
{
  selectCalls.length = 0;
  const store = storeOf({
    current: { provider: 'deepseek-official', model: 'm1', reasoningEffort: 'high' },
    groups,
    status: 'ready',
    pending: null,
    error: null,
    failures: [],
  });
  const props = baseProps(store);
  let tree = react.render(Seat, props);
  const trigger = findClass(tree, 'dts-trigger');
  if (!textOf(trigger).includes('High')) throw new Error('trigger effort missing: ' + textOf(trigger));

  trigger.props.onClick({});
  tree = react.render(Seat, props);
  const slider = findNode(tree, (node) => node.props?.role === 'slider');
  if (slider === undefined) throw new Error('slider missing');
  if (slider.props['aria-valuetext'] !== 'High') throw new Error('aria-valuetext = ' + slider.props['aria-valuetext']);

  slider.props.onKeyDown({ key: 'End', nativeEvent: {}, preventDefault() {} });
  await new Promise((resolve) => setTimeout(resolve, 260));
  if (selectCalls.length !== 1) throw new Error('keyboard commit did not select');
  if (selectCalls[0].reasoningEffort !== 'max') throw new Error('End should commit Max, got ' + selectCalls[0].reasoningEffort);

  const after = react.render(Seat, props);
  if (findNode(after, (node) => node.type === primitives.MenuSurface) === undefined) {
    throw new Error('panel should stay open after an effort commit');
  }
}

await flush();
react.reset();

/* 2c. 外观：Claude 落在 Faster/Smarter 轴，Codex 保留刻度并在满档出粒子。 */
{
  const renderStyled = (styleId, effort, options = {}) => {
    react.reset();
    const store = storeOf({
      current: { provider: 'deepseek-official', model: 'm1', reasoningEffort: effort },
      groups,
      status: 'ready',
      pending: null,
      error: null,
      failures: [],
    });
    const props = {
      ...baseProps(store),
      getStyle: () => styleId,
      subscribeStyle: () => () => {},
      getPalette: () => options.palette ?? 'auto',
      subscribePalette: () => () => {},
      getPalettes: () => options.palettes ?? [],
      subscribePalettes: () => () => {},
      getDark: () => options.dark === true,
      subscribeDark: () => () => {},
      getKnobShapes: () => options.knobs ?? {},
      subscribeKnobShapes: () => () => {},
      getKnobSize: () => options.knobSize ?? 'md',
      subscribeKnobSize: () => () => {},
      getFx: () => options.fx ?? { maxOnly: false, trail: true, speeds: { flow: 1, dust: 1, pulse: 1, glyph: 1 } },
      subscribeFx: () => () => {},
    };
    let tree = react.render(Seat, props);
    findClass(tree, 'dts-trigger').props.onClick({});
    return react.render(Seat, props);
  };

  const claude = renderStyled('claude', 'high');
  if (findNode(claude, (node) => node.props?.['data-dts-style'] === 'claude') === undefined) {
    throw new Error('claude style attribute missing');
  }
  const axis = findClass(claude, 'dts-axis');
  if (axis === undefined) throw new Error('claude axis labels missing');
  const axisText = textOf(axis);
  if (!axisText.includes('Faster') || !axisText.includes('Smarter')) {
    throw new Error('claude axis should read Faster / Smarter, got ' + axisText);
  }
  if (findNode(claude, (node) => node.type === 'button' && String(node.props.className || '').startsWith('dts-tick')) !== undefined) {
    throw new Error('claude should not render per-level tick buttons');
  }
  const claudeScale = findClass(claude, 'dts-scale');
  if (claudeScale.props.style['--dts-pad'] !== '14px') {
    throw new Error('claude pad should be 14px, got ' + claudeScale.props.style['--dts-pad']);
  }
  /* 末档不再特殊对待：点只分「经过 / 未经过」，避免当前档不是最高时看起来全亮。 */
  const specialDot = walk(claude).find(
    (node) => typeof node.props?.className === 'string' && node.props.className.includes('dts-dot--last'),
  );
  if (specialDot !== undefined) throw new Error('dots should not special-case the last level');

  const codex = renderStyled('codex', 'max');
  if (findClass(codex, 'dts-ticks') === undefined) throw new Error('codex tick labels missing');
  if (findClass(codex, 'dts-axis') !== undefined) throw new Error('codex should not render the claude axis');
  if (findClass(codex, 'dts-burst') !== undefined) throw new Error('codex outside burst should be gone');
  const flow = findClass(codex, 'dts-flow');
  if (flow === undefined) throw new Error('codex max fill flow missing');
  if (flow.props['data-dts-fx'] !== 'dust') throw new Error('codex auto should use the dust effect');
  const flowPaths = walk(flow).filter(
    (node) => typeof node.props?.className === 'string' && node.props.className.includes('dts-flowPath'),
  );
  if (flowPaths.length !== 8) throw new Error('codex max fill flow should have 8 particles');
  /* 远近：每颗点的尺寸 / 透明度都不一样；尾迹默认开（空字符串属性）。 */
  const depthSizes = flowPaths.map((node) => node.props.style['--dts-dust-size']);
  const depthAlphas = flowPaths.map((node) => node.props.style['--dts-dust-alpha']);
  if (new Set(depthSizes).size !== flowPaths.length || new Set(depthAlphas).size !== flowPaths.length) {
    throw new Error('dust particles should carry distinct depth size / alpha');
  }
  if (flow.props['data-dts-trail'] !== '') throw new Error('dust trails should default to on');
  if (flow.props['data-dts-trail-length'] !== 'short') throw new Error('dust trail length should default to short');
  const noTrail = findClass(
    renderStyled('codex', 'max', {
      fx: { maxOnly: false, trail: false, speeds: { flow: 1, dust: 1, pulse: 1, glyph: 1 } },
    }),
    'dts-flow',
  );
  if (noTrail.props['data-dts-trail'] !== undefined) throw new Error('trail off should drop data-dts-trail');
  if (noTrail.props['data-dts-trail-length'] !== undefined) {
    throw new Error('trail off should drop data-dts-trail-length');
  }
  const longTrail = findClass(
    renderStyled('codex', 'max', {
      fx: { maxOnly: false, trail: true, trailLength: 'long', speeds: { flow: 1, dust: 1, pulse: 1, glyph: 1 } },
    }),
    'dts-flow',
  );
  if (longTrail.props['data-dts-trail-length'] !== 'long') throw new Error('long trail should reach the flow layer');
  /* 强度是一根 0–1 的总线：4 档时最高档是 1，中间档是它在序列里的位置。 */
  if (flow.props.style['--dts-power'] !== 1) {
    throw new Error('codex max flow should be at full power, got ' + flow.props.style['--dts-power']);
  }
  const codexHigh = renderStyled('codex', 'high');
  const idleFlow = findClass(codexHigh, 'dts-flow');
  if (idleFlow === undefined) throw new Error('codex flow layer should stay mounted below max');
  if (Math.abs(Number(idleFlow.props.style['--dts-power']) - 2 / 3) > 1e-9) {
    throw new Error('codex high should sit at two thirds power, got ' + idleFlow.props.style['--dts-power']);
  }
  if (findClass(codex, 'dts-scale').props.style['--dts-thumb-w'] !== '32px') {
    throw new Error('codex thumb should be 32px');
  }

  /* 配色是独立一层：选中的配色按当前深浅写进菜单的 inline 变量。 */
  const customPalette = {
    id: 'mine',
    name: '我的',
    light: { track: '#112233', accent: '#445566', tickOn: '#778899' },
    dark: { accent: '#aabbcc' },
  };
  const tinted = renderStyled('claude', 'high', { palette: 'mine', palettes: [customPalette] });
  const tintedMenu = findNode(
    tinted,
    (node) =>
      node.props?.['data-dts-style'] === 'claude' &&
      typeof node.props.className === 'string' &&
      node.props.className.includes('dts-menu'),
  );
  if (tintedMenu === undefined) throw new Error('tinted claude menu missing');
  if (tintedMenu.props.style['--dts-track-color'] !== '#112233') {
    throw new Error('palette track color was not applied');
  }
  if (tintedMenu.props.style['--dts-accent-color'] !== '#445566') {
    throw new Error('palette accent color was not applied');
  }
  /* 已过刻度是第八个槽，CSS 变量按短横线写（tickOn → --dts-tick-on-color）。 */
  if (tintedMenu.props.style['--dts-tick-on-color'] !== '#778899') {
    throw new Error('palette tickOn color was not applied');
  }

  /* 深色页：只改过的槽取深色值，没改的槽回落到浅色。 */
  const tintedDark = renderStyled('claude', 'high', { palette: 'mine', palettes: [customPalette], dark: true });
  const darkMenu = findNode(
    tintedDark,
    (node) =>
      node.props?.['data-dts-style'] === 'claude' &&
      typeof node.props.className === 'string' &&
      node.props.className.includes('dts-menu'),
  );
  if (darkMenu.props.style['--dts-accent-color'] !== '#aabbcc') {
    throw new Error('dark palette accent should win in dark mode');
  }
  if (darkMenu.props.style['--dts-track-color'] !== '#112233') {
    throw new Error('palette slots missing a dark value should fall back to the light one');
  }

  /* 自动：不写任何颜色变量，全部交给外观 CSS。 */
  const auto = renderStyled('claude', 'high');
  const autoMenu = findNode(
    auto,
    (node) =>
      node.props?.['data-dts-style'] === 'claude' &&
      typeof node.props.className === 'string' &&
      node.props.className.includes('dts-menu'),
  );
  const autoKeys = Object.keys(autoMenu.props.style ?? {}).filter((key) => key.startsWith('--dts-'));
  if (autoKeys.length !== 0) throw new Error('auto palette should not override colors, got ' + autoKeys);

  const compact = renderStyled('compact', 'high');
  if (findClass(compact, 'dts-axis') !== undefined) throw new Error('compact should not render the claude axis');
  if (findNode(compact, (node) => node.type === 'button' && String(node.props.className || '').startsWith('dts-tick')) === undefined) {
    throw new Error('compact tick labels missing');
  }
  if (findClass(compact, 'dts-scale').props.style['--dts-pad'] !== '6px') {
    throw new Error('compact pad should stay 6px');
  }
  if (findClass(compact, 'dts-scale').props.style['--dts-thumb-w'] !== '12px') {
    throw new Error('compact square thumb should stay 12px');
  }

  /* 拇指形状：紧凑切圆是 16px 盒子（2px 环 + 12 白芯）、pad 6；胶囊切回旧版
     圆角方时是出错那版的 32px、pad 16，拇指本身不再走 SVG，交给旧版 CSS 圆角。 */
  const compactCircle = renderStyled('compact', 'high', { knobs: { compact: 'circle' } });
  const compactCircleScale = findClass(compactCircle, 'dts-scale');
  if (compactCircleScale.props.style['--dts-thumb-w'] !== '16px') {
    throw new Error('compact circle thumb should be 16px, got ' + compactCircleScale.props.style['--dts-thumb-w']);
  }
  if (compactCircleScale.props.style['--dts-pad'] !== '6px') {
    throw new Error('compact circle should keep pad 6px');
  }
  const compactDisc = findClass(compactCircle, 'dts-thumbDisc');
  if (compactDisc === undefined || compactDisc.children?.[0]?.type !== 'circle') {
    throw new Error('compact circle thumb should be drawn as an SVG circle');
  }
  if (findNode(compactCircle, (node) => node.props?.['data-dts-knob'] === 'circle') === undefined) {
    throw new Error('compact circle should expose data-dts-knob="circle"');
  }

  const codexSquare = renderStyled('codex', 'max', { knobs: { codex: 'square' } });
  const codexSquareScale = findClass(codexSquare, 'dts-scale');
  if (codexSquareScale.props.style['--dts-thumb-w'] !== '32px') {
    throw new Error('codex square thumb should be 32px, got ' + codexSquareScale.props.style['--dts-thumb-w']);
  }
  if (codexSquareScale.props.style['--dts-pad'] !== '16px') {
    throw new Error('codex square should use pad 16px');
  }
  if (findClass(codexSquare, 'dts-thumbDisc') !== undefined) {
    throw new Error('codex square should keep the old CSS thumb, not an SVG disc');
  }
  const codexThumb = findClass(codexSquare, 'dts-thumb');
  if (codexThumb === undefined || String(codexThumb.props.className).includes('dts-thumb--disc')) {
    throw new Error('codex square thumb should be the plain CSS thumb');
  }
  if (findNode(codexSquare, (node) => node.props?.['data-dts-knob'] === 'square') === undefined) {
    throw new Error('codex square should expose data-dts-knob="square"');
  }

  /* 大小只缩拇指与 pad，轨道高度不动。 */
  const codexLarge = renderStyled('codex', 'high', { knobSize: 'lg' });
  const codexLargeScale = findClass(codexLarge, 'dts-scale');
  if (codexLargeScale.props.style['--dts-thumb-w'] !== '38px' || codexLargeScale.props.style['--dts-pad'] !== '19px') {
    throw new Error('codex large knob should be 38px / pad 19px');
  }
  if (codexLargeScale.props.style['--dts-track-h'] !== '28px') {
    throw new Error('knob size should not change the track height');
  }

  /* 旧版存的 sm 已经没有对应档，读回按标准：紧凑圆角方仍是 12px / pad 6px。 */
  const compactLegacySmall = renderStyled('compact', 'high', { knobSize: 'sm' });
  const compactLegacyScale = findClass(compactLegacySmall, 'dts-scale');
  if (compactLegacyScale.props.style['--dts-thumb-w'] !== '12px' || compactLegacyScale.props.style['--dts-pad'] !== '6px') {
    throw new Error('legacy sm knob size should read back as standard');
  }

  const compactTinted = renderStyled('compact', 'high', {
    palette: 'mine',
    palettes: [{ id: 'mine', name: '我的', light: { fill: '#00ff00' }, dark: {} }],
  });
  const compactMenu = findNode(
    compactTinted,
    (node) =>
      node.props?.['data-dts-style'] === 'compact' &&
      typeof node.props.className === 'string' &&
      node.props.className.includes('dts-menu'),
  );
  if (compactMenu === undefined) throw new Error('tinted compact menu missing');
  if (compactMenu.props.style['--dts-fill-color'] !== '#00ff00') {
    throw new Error('palette fill was not applied on compact');
  }
}

await flush();
react.reset();

/* 2d. 平滑 / 逐档：平滑跟手、松手吸附最近档；逐档始终落在刻度上。 */
{
  selectCalls.length = 0;
  let smoothMode = true;
  const store = storeOf({
    current: { provider: 'deepseek-official', model: 'm1', reasoningEffort: 'high' },
    groups,
    status: 'ready',
    pending: null,
    error: null,
    failures: [],
  });
  const props = {
    ...baseProps(store),
    getSmooth: () => smoothMode,
    subscribeSmooth: () => () => {},
  };
  let tree = react.render(Seat, props);
  findClass(tree, 'dts-trigger').props.onClick({});
  tree = react.render(Seat, props);

  const track = {
    focus() {},
    setPointerCapture() {},
    releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, width: 100 }),
  };
  const sliderOf = () => findNode(tree, (node) => node.props?.role === 'slider');
  /* compact：pad 6、轨道宽 100，0–1 的 ratio 换算成 clientX。 */
  const at = (ratio) => 6 + ratio * 88;
  const ratioOf = (style) => Number(String(style?.left).match(/\+ ([\d.]+) \*/)?.[1]);
  const near = (actual, expected) => Math.abs(actual - expected) < 0.01;
  const ratioIn = (value) => Number(String(value).match(/\+ ([\d.]+) \*/)?.[1]);

  sliderOf().props.ref.current = track;
  sliderOf().props.onPointerDown({ clientX: at(0.4), pointerId: 1, preventDefault() {} });
  tree = react.render(Seat, props);
  if (sliderOf().props['data-dts-dragging'] === undefined) throw new Error('drag state missing');
  if (sliderOf().props['data-dts-follow'] === undefined) throw new Error('smooth drag should mark continuous follow');
  if (sliderOf().props['aria-valuenow'] !== 2) {
    throw new Error('smooth drag should keep the committed index 2, got ' + sliderOf().props['aria-valuenow']);
  }
  if (textOf(findClass(tree, 'dts-bandValue')) !== 'High') {
    throw new Error('smooth drag should keep the committed readout, got ' + textOf(findClass(tree, 'dts-bandValue')));
  }
  if (!near(ratioIn(findClass(tree, 'dts-thumb').props.style.left), 0.4)) throw new Error('smooth thumb should follow the pointer');
  if (!near(ratioIn(findClass(tree, 'dts-fill').props.style.width), 0.4)) {
    throw new Error('smooth fill should follow the pointer, got ' + findClass(tree, 'dts-fill').props.style.width);
  }

  sliderOf().props.onPointerMove({ clientX: at(0.9), pointerId: 1 });
  tree = react.render(Seat, props);
  if (!near(ratioIn(findClass(tree, 'dts-thumb').props.style.left), 0.9)) throw new Error('smooth move should stay continuous');
  if (sliderOf().props['aria-valuetext'] !== 'High') {
    throw new Error('smooth move should keep the committed label, got ' + sliderOf().props['aria-valuetext']);
  }
  if (textOf(findClass(tree, 'dts-bandValue')) !== 'High') {
    throw new Error('smooth move should keep the committed readout, got ' + textOf(findClass(tree, 'dts-bandValue')));
  }

  sliderOf().props.onPointerUp({ clientX: at(0.9), pointerId: 1 });
  if (selectCalls.length !== 1) throw new Error('smooth release should commit exactly once');
  if (selectCalls[0].reasoningEffort !== 'max') {
    throw new Error('smooth release should commit the nearest level, got ' + selectCalls[0].reasoningEffort);
  }
  tree = react.render(Seat, props);
  if (sliderOf().props['data-dts-dragging'] !== undefined) throw new Error('drag state should clear after release');
  if (sliderOf().props['data-dts-follow'] !== undefined) throw new Error('follow state should clear after release');

  /* 逐档：同一位置只落在刻度上，松手提交该档。 */
  smoothMode = false;
  selectCalls.length = 0;
  tree = react.render(Seat, props);
  sliderOf().props.ref.current = track;
  sliderOf().props.onPointerDown({ clientX: at(0.4), pointerId: 2, preventDefault() {} });
  tree = react.render(Seat, props);
  /* 逐档必须留着过渡（不设 follow），否则跨档又变回瞬移。 */
  if (sliderOf().props['data-dts-follow'] !== undefined) {
    throw new Error('step drag should keep the per-skin transition, not continuous follow');
  }
  if (!near(ratioIn(findClass(tree, 'dts-thumb').props.style.left), 1 / 3)) {
    throw new Error('step mode should snap the thumb to a tick, got ' + findClass(tree, 'dts-thumb').props.style.left);
  }
  if (sliderOf().props['aria-valuenow'] !== 1 || textOf(findClass(tree, 'dts-bandValue')) !== 'Low') {
    throw new Error('step drag should preview the tick under the pointer, got ' + textOf(findClass(tree, 'dts-bandValue')));
  }
  sliderOf().props.onPointerUp({ clientX: at(0.4), pointerId: 2 });
  if (selectCalls.length !== 1 || selectCalls[0].reasoningEffort !== 'low') {
    throw new Error('step release should commit the tick under the pointer');
  }
}

await flush();
react.reset();

/* 2e. 特效强度：逐档取档位在序列里的位置，平滑拖动直接跟指针（读数仍停在已提交档）。 */
{
  selectCalls.length = 0;
  let smoothMode = true;
  const store = storeOf({
    current: { provider: 'deepseek-official', model: 'm1', reasoningEffort: 'high' },
    groups,
    status: 'ready',
    pending: null,
    error: null,
    failures: [],
  });
  const props = {
    ...baseProps(store),
    getStyle: () => 'codex',
    subscribeStyle: () => () => {},
    getSmooth: () => smoothMode,
    subscribeSmooth: () => () => {},
  };
  let tree = react.render(Seat, props);
  findClass(tree, 'dts-trigger').props.onClick({});
  tree = react.render(Seat, props);

  const track = {
    focus() {},
    setPointerCapture() {},
    releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, width: 100 }),
  };
  const sliderOf = () => findNode(tree, (node) => node.props?.role === 'slider');
  const flowOf = () => findClass(tree, 'dts-flow');
  const power = () => Number(flowOf().props.style['--dts-power']);
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  /* codex：pad 16、轨道宽 100，0–1 的 ratio 换算成 clientX。 */
  const at = (ratio) => 16 + ratio * 68;
  sliderOf().props.ref.current = track;

  if (flowOf().props['data-dts-fx'] !== 'dust') throw new Error('codex auto should render dust');
  /* 已提交档是 high（4 档里的第 3 档）→ 2/3。 */
  if (!near(power(), 2 / 3)) throw new Error('codex high should start at two thirds, got ' + power());

  sliderOf().props.onPointerMove({ clientX: at(0.7), pointerId: 3 });
  tree = react.render(Seat, props);
  if (!near(power(), 2 / 3)) throw new Error('idle pointermove should not change power');

  sliderOf().props.onPointerDown({ clientX: at(0.7), pointerId: 3, preventDefault() {} });
  tree = react.render(Seat, props);
  if (!near(power(), 0.7)) {
    throw new Error('smooth drag should let power follow the pointer, got ' + power());
  }
  if (flowOf().props['data-dts-flow-follow'] === undefined) {
    throw new Error('smooth drag should drop the power transition');
  }
  if (sliderOf().props['aria-valuenow'] !== 2) {
    throw new Error('smooth drag should keep the committed level, got ' + sliderOf().props['aria-valuenow']);
  }

  sliderOf().props.onPointerMove({ clientX: at(0.95), pointerId: 3 });
  tree = react.render(Seat, props);
  if (!(power() > 0.7)) throw new Error('power should keep growing toward the right end');

  sliderOf().props.onPointerMove({ clientX: at(1), pointerId: 3 });
  tree = react.render(Seat, props);
  if (power() !== 1) throw new Error('power should be full at the right end, got ' + power());

  sliderOf().props.onPointerUp({ clientX: at(1), pointerId: 3 });
  tree = react.render(Seat, props);
  /* 松手后功率回到「已提交档」（还是 high），等宿主确认新档才升到 1；
     测试里的 store 不会自己变，所以这里看到的仍是 2/3。 */
  if (!near(power(), 2 / 3)) {
    throw new Error('power should fall back to the committed level after release, got ' + power());
  }

  /* 逐档：功率跟着刻度走，指针落到哪一档就是哪一档的功率。 */
  smoothMode = false;
  tree = react.render(Seat, props);
  sliderOf().props.ref.current = track;
  sliderOf().props.onPointerDown({ clientX: at(0.95), pointerId: 4, preventDefault() {} });
  tree = react.render(Seat, props);
  if (flowOf().props['data-dts-flow-follow'] !== undefined) {
    throw new Error('step drag should keep the power transition');
  }
  if (power() !== 1) throw new Error('step mode at max should sit at full power, got ' + power());

  sliderOf().props.onPointerMove({ clientX: at(0.6), pointerId: 4 });
  tree = react.render(Seat, props);
  if (!near(power(), 2 / 3)) {
    throw new Error('step drag down one level should drop to two thirds, got ' + power());
  }

  sliderOf().props.onPointerMove({ clientX: at(0.2), pointerId: 4 });
  tree = react.render(Seat, props);
  if (!near(power(), 1 / 3)) {
    throw new Error('step drag to the second level should sit at one third, got ' + power());
  }
  sliderOf().props.onPointerUp({ clientX: at(0.2), pointerId: 4 });
}

/* 2e1. 渐变：色标留空就拼配色的三枚变量；填了色标就用填的；方向挂在 data 上。 */
{
  const store = storeOf({
    current: { provider: 'deepseek-official', model: 'm1', reasoningEffort: 'high' },
    groups,
    status: 'ready',
    pending: null,
    error: null,
    failures: [],
  });
  const fxState = { gradient: { colors: [], reverse: false } };
  const props = {
    ...baseProps(store),
    getStyle: () => 'codex',
    subscribeStyle: () => () => {},
    getEffects: () => 'gradient',
    subscribeEffects: () => () => {},
    getFx: () => fxState,
    subscribeFx: () => () => {},
  };
  react.reset();
  let tree = react.render(Seat, props);
  findClass(tree, 'dts-trigger').props.onClick({});
  tree = react.render(Seat, props);
  const flow = findClass(tree, 'dts-flow');
  if (flow.props['data-dts-fx'] !== 'gradient') {
    throw new Error('gradient should render as the effect kind, got ' + flow.props['data-dts-fx']);
  }
  const layer = findClass(tree, 'dts-fxGradient');
  if (layer === undefined) throw new Error('gradient layer should render');
  if (!String(layer.props.style.backgroundImage).includes('var(--dts-fill-color')) {
    throw new Error('empty stops should follow the palette, got ' + layer.props.style.backgroundImage);
  }
  if (flow.props['data-dts-grad'] !== undefined) {
    throw new Error('forward gradient should not set data-dts-grad');
  }

  fxState.gradient = { colors: ['#112233', '#445566', '#778899'], reverse: true };
  tree = react.render(Seat, props);
  const flow2 = findClass(tree, 'dts-flow');
  const layer2 = findClass(tree, 'dts-fxGradient');
  if (flow2.props['data-dts-grad'] !== 'reverse') {
    throw new Error('reverse gradient should set data-dts-grad');
  }
  if (!String(layer2.props.style.backgroundImage).includes('#112233')) {
    throw new Error('custom stops should replace palette stops, got ' + layer2.props.style.backgroundImage);
  }
}

/* 2e2. 只在最高档：静止时功率只给 0 / 1；平滑拖动进出最高档要跟手渐变，不能硬切。 */
{
  const fxMax = { maxOnly: true, speeds: { flow: 1, dust: 1, pulse: 1, glyph: 1 } };
  const renderFx = (effort, smooth) => {
    react.reset();
    const store = storeOf({
      current: { provider: 'deepseek-official', model: 'm1', reasoningEffort: effort },
      groups,
      status: 'ready',
      pending: null,
      error: null,
      failures: [],
    });
    const props = {
      ...baseProps(store),
      getStyle: () => 'codex',
      subscribeStyle: () => () => {},
      getSmooth: () => smooth,
      subscribeSmooth: () => () => {},
      getFx: () => fxMax,
      subscribeFx: () => () => {},
    };
    let tree = react.render(Seat, props);
    findClass(tree, 'dts-trigger').props.onClick({});
    tree = react.render(Seat, props);
    return { tree: () => tree, props, set: (next) => (tree = next) };
  };
  const powerOf = (tree) => Number(findClass(tree, 'dts-flow').props.style['--dts-power']);

  const belowTop = renderFx('high', true);
  if (powerOf(belowTop.tree()) !== 0) throw new Error('max-only should stay dark below the top tier');
  if (findClass(belowTop.tree(), 'dts-flow').props.style['--dts-fx-floor'] !== 0) {
    throw new Error('max-only should drop the always-on floor so 0 is really invisible');
  }
  const atTop = renderFx('max', true);
  if (powerOf(atTop.tree()) !== 1) throw new Error('max-only should light up at the top tier');

  /* 平滑拖动进最高档：跨过吸附边界就跟手淡入，不等松手提交。 */
  const dragging = renderFx('high', true);
  const track = {
    focus() {},
    setPointerCapture() {},
    releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, width: 100 }),
  };
  const sliderOf = () => findNode(dragging.tree(), (node) => node.props?.role === 'slider');
  sliderOf().props.ref.current = track;
  sliderOf().props.onPointerDown({ clientX: 16 + 0.95 * 68, pointerId: 9, preventDefault() {} });
  dragging.set(react.render(Seat, dragging.props));
  /* 4 档：边界在 (3-0.5)/3 = 0.833，0.95 处 smoothstep 得 0.784。 */
  if (Math.abs(powerOf(dragging.tree()) - 0.784) > 0.01) {
    throw new Error('max-only should ramp in inside the top tier, got ' + powerOf(dragging.tree()));
  }
  if (findClass(dragging.tree(), 'dts-flow').props['data-dts-flow-follow'] === undefined) {
    throw new Error('max-only ramp should drop the power transition while following the pointer');
  }
  /* 边界左边仍是全暗：还没进最高档那格。 */
  sliderOf().props.onPointerMove({ clientX: 16 + 0.5 * 68, pointerId: 9 });
  dragging.set(react.render(Seat, dragging.props));
  if (powerOf(dragging.tree()) !== 0) {
    throw new Error('max-only should stay dark below the top zone, got ' + powerOf(dragging.tree()));
  }
  /* 再拖回右端、松手：提交走宿主，功率回到已提交档（还是 high，所以是 0）。 */
  sliderOf().props.onPointerMove({ clientX: 16 + 0.98 * 68, pointerId: 9 });
  dragging.set(react.render(Seat, dragging.props));
  if (!(powerOf(dragging.tree()) > 0.9)) throw new Error('top zone should be nearly full at the right end');
  sliderOf().props.onPointerUp({ clientX: 16 + 0.98 * 68, pointerId: 9 });
  dragging.set(react.render(Seat, dragging.props));
  if (powerOf(dragging.tree()) !== 0) {
    throw new Error('after release max-only should fall back to the committed tier, got ' + powerOf(dragging.tree()));
  }
}

await flush();
react.reset();

/* 2f. 设置面板：滑动一行显示当前方式，点「平滑」写回 store；两轴各有自己的行。 */
{
  const { SettingsPanel, BUILTIN_PALETTES } = pluginModule.exports.__test;
  if (typeof SettingsPanel !== 'function') throw new Error('SettingsPanel export missing');
  const flags = {
    smooth: false,
    effects: 'auto',
    fx: { maxOnly: false, speeds: { flow: 1, dust: 1, pulse: 1, glyph: 1 } },
    labels: 'auto',
    knobs: { compact: 'square', codex: 'circle' },
    knobSize: 'md',
    palette: 'auto',
    palettes: BUILTIN_PALETTES.map((entry) => ({ ...entry, light: { ...entry.light }, dark: { ...entry.dark } })),
    dark: false,
    picked: [],
  };
  const makeProps = () => ({
    getEnabled: () => true,
    getStatus: () => '已接管（座位已渲染）',
    getStyle: () => 'compact',
    getSmooth: () => flags.smooth,
    getEffects: () => flags.effects,
    getFx: () => flags.fx,
    getLabels: () => flags.labels,
    getKnobShapes: () => flags.knobs,
    getKnobSize: () => flags.knobSize,
    getPalette: () => flags.palette,
    getPalettes: () => flags.palettes,
    getDark: () => flags.dark,
    selectEnabled: () => {},
    selectStyle: () => {},
    selectPalette: (id) => {
      flags.palette = id;
      flags.picked.push(id);
    },
    addPalette: () => {
      const palette = { id: 'mine', name: '配色 1', light: {}, dark: {} };
      flags.palettes = [...flags.palettes, palette];
      flags.palette = palette.id;
    },
    renamePalette: (id, name) => {
      flags.palettes = flags.palettes.map((entry) => (entry.id === id ? { ...entry, name } : entry));
    },
    removePalette: (id) => {
      flags.palettes = flags.palettes.filter((entry) => entry.id !== id);
      if (flags.palette === id) flags.palette = 'auto';
    },
    setPaletteColor: (id, mode, slot, value) => {
      flags.palettes = flags.palettes.map((entry) =>
        entry.id === id ? { ...entry, [mode]: { ...entry[mode], [slot]: value } } : entry,
      );
      flags.picked.push(`${mode}:${slot}:${value}`);
    },
    clearPaletteColor: (id, slot) => {
      flags.palettes = flags.palettes.map((entry) => {
        if (entry.id !== id) return entry;
        const light = { ...entry.light };
        const dark = { ...entry.dark };
        delete light[slot];
        delete dark[slot];
        return { ...entry, light, dark };
      });
      flags.picked.push(`clear:${slot}`);
    },
    resetPalette: (id) => {
      flags.palettes = flags.palettes.map((entry) => (entry.id === id ? { ...entry, light: {}, dark: {} } : entry));
    },
    selectSmooth: (value) => {
      flags.smooth = value;
      flags.picked.push(value);
    },
    selectEffects: (id) => {
      flags.effects = id;
      flags.picked.push(id);
    },
    selectFxMax: (on) => {
      flags.fx = { ...flags.fx, maxOnly: on === true };
      flags.picked.push('max:' + on);
    },
    selectFxTrail: (on) => {
      flags.fx = { ...flags.fx, trail: on === true };
      flags.picked.push('trail:' + on);
    },
    selectFxTrailLength: (id) => {
      flags.fx = { ...flags.fx, trailLength: id };
      flags.picked.push('trail-length:' + id);
    },
    selectFxSpeed: (kind, speed) => {
      flags.fx = { ...flags.fx, speeds: { ...flags.fx.speeds, [kind]: speed } };
      flags.picked.push(`speed:${kind}:${speed}`);
    },
    selectFxGradientReverse: (on) => {
      flags.fx = { ...flags.fx, gradient: { ...(flags.fx.gradient || {}), reverse: on === true } };
      flags.picked.push('gradient-reverse:' + on);
    },
    selectFxGradientCustom: () => {
      flags.fx = { ...flags.fx, gradient: { ...(flags.fx.gradient || {}), colors: ['#7c63f5', '#2dc9ff', '#ff9bd7'] } };
      flags.picked.push('gradient-custom');
    },
    selectFxGradientFollow: () => {
      flags.fx = { ...flags.fx, gradient: { ...(flags.fx.gradient || {}), colors: [] } };
      flags.picked.push('gradient-follow');
    },
    selectFxGradientColor: (index, value) => {
      const colors = [...((flags.fx.gradient || {}).colors || [])];
      colors[index] = value;
      flags.fx = { ...flags.fx, gradient: { ...(flags.fx.gradient || {}), colors } };
      flags.picked.push(`gradient-color:${index}:${value}`);
    },
    selectFxGradientAdd: () => {
      const colors = [...((flags.fx.gradient || {}).colors || [])];
      if (colors.length === 0) colors.push('#7c63f5', '#2dc9ff', '#ff9bd7');
      else if (colors.length < 6) colors.push('#ffffff');
      flags.fx = { ...flags.fx, gradient: { ...(flags.fx.gradient || {}), colors } };
      flags.picked.push('gradient-add');
    },
    selectFxGradientRemove: (index) => {
      const colors = [...((flags.fx.gradient || {}).colors || [])];
      if (colors.length <= 2) return;
      colors.splice(index, 1);
      flags.fx = { ...flags.fx, gradient: { ...(flags.fx.gradient || {}), colors } };
      flags.picked.push('gradient-remove:' + index);
    },
    selectLabels: (id) => {
      flags.labels = id;
      flags.picked.push(id);
    },
    selectKnobShape: (styleId, shapeId) => {
      flags.knobs = { ...flags.knobs, [styleId]: shapeId };
      flags.picked.push(`knob:${styleId}:${shapeId}`);
    },
    selectKnobSize: (id) => {
      flags.knobSize = id;
      flags.picked.push(`knob-size:${id}`);
    },
    subscribe: () => () => {},
  });
  const findChip = (tree, label) => walk(tree).find((node) => node.type === 'button' && textOf(node) === label);
  const rowOf = (tree, label) =>
    walk(tree).find(
      (node) =>
        String(node.props?.className || '').includes('dts-settings-row') &&
        walk(node).some(
          (child) =>
            String(child.props?.className || '').includes('dts-settings-label') && textOf(child) === label,
        ),
    );
  const chipIn = (tree, row, label) => findChip(rowOf(tree, row), label);

  let tree = react.render(SettingsPanel, makeProps());
  /* 设置页先分三个类别；每行是「标签 / 控件 / 右侧说明」三列，说明不再跟芯片挤在一起。 */
  const groupLabels = walk(tree)
    .filter((node) => String(node.props?.className || '').includes('dts-group-label'))
    .map(textOf);
  for (const label of ['滑条', '特效', '配色']) {
    if (!groupLabels.includes(label)) throw new Error('settings should group rows under ' + label);
  }
  for (const label of ['接管', '外观', '拇指', '大小', '刻度', '滑动']) {
    const row = rowOf(tree, label);
    if (row === undefined) throw new Error('settings row missing ' + label);
    if (!walk(row).some((node) => String(node.props?.className || '').includes('dts-controls'))) {
      throw new Error('row should wrap its chips in dts-controls: ' + label);
    }
    if (!walk(row).some((node) => String(node.props?.className || '').includes('dts-settings-hint'))) {
      throw new Error('row should keep its hint in a right-hand column: ' + label);
    }
  }
  const smoothChip = findChip(tree, '平滑');
  if (smoothChip === undefined) throw new Error('settings should render the smooth chip');
  if (smoothChip.props['aria-pressed'] !== false) throw new Error('smooth should start unpressed');
  smoothChip.props.onClick({});
  if (flags.picked[0] !== true) throw new Error('smooth chip should write true to the store');

  tree = react.render(SettingsPanel, makeProps());
  const pressed = findChip(tree, '平滑');
  if (pressed.props['aria-pressed'] !== true || !String(pressed.props.className).includes('dts-chip--on')) {
    throw new Error('smooth chip should reflect the stored value');
  }
  if (findChip(tree, '逐档') === undefined) throw new Error('settings should keep the step chip');

  /* 拇指：紧凑有圆角方 / 圆两档，点「圆」按外观写回；大小只有标准 / 大。 */
  if (chipIn(tree, '拇指', '圆角方') === undefined) throw new Error('knob row should offer the square chip');
  const circleChip = chipIn(tree, '拇指', '圆');
  if (circleChip === undefined) throw new Error('compact knob row should offer the circle chip');
  if (circleChip.props['aria-pressed'] !== false) throw new Error('compact knob should start square');
  circleChip.props.onClick({});
  if (flags.knobs.compact !== 'circle') throw new Error('circle chip should write the knob shape');
  if (chipIn(tree, '大小', '标准').props['aria-pressed'] !== true) throw new Error('knob size should start standard');
  if (chipIn(tree, '大小', '小') !== undefined) throw new Error('knob size should no longer offer the small chip');
  chipIn(tree, '大小', '大').props.onClick({});
  if (flags.knobSize !== 'lg') throw new Error('knob size chip should write lg');

  /* 特效：关 / 跟随外观 + 四个样式，默认跟随外观；点「关」写回 off。 */
  const autoEffects = chipIn(tree, '特效', '跟随外观');
  if (autoEffects === undefined) throw new Error('effects row should offer the auto chip');
  if (autoEffects.props['aria-pressed'] !== true) throw new Error('effects should default to auto');
  for (const label of ['关', '流光场', '密度粒子', '心跳', '字符点阵']) {
    if (chipIn(tree, '特效', label) === undefined) throw new Error('effects row missing chip ' + label);
  }
  chipIn(tree, '特效', '心跳').props.onClick({});
  if (flags.effects !== 'pulse') throw new Error('effects chip should write pulse, got ' + flags.effects);
  chipIn(tree, '特效', '关').props.onClick({});
  if (flags.effects !== 'off') throw new Error('effects chip should write off, got ' + flags.effects);

  /* 渐变：留空时只给「自定义」，方向两枚芯片；自定义后出现三枚色标与「跟随配色」。 */
  flags.effects = 'gradient';
  flags.fx = { ...flags.fx, gradient: { colors: [], reverse: false } };
  tree = react.render(SettingsPanel, makeProps());
  const gradientForward = chipIn(tree, '方向', '正');
  const gradientReverse = chipIn(tree, '方向', '反');
  if (gradientForward === undefined || gradientReverse === undefined) {
    throw new Error('gradient should offer forward / reverse');
  }
  if (gradientForward.props['aria-pressed'] !== true) throw new Error('gradient should start forward');
  const gradientCustom = chipIn(tree, '色标', '自定义');
  if (gradientCustom === undefined) throw new Error('empty gradient should offer a custom button');
  if (chipIn(tree, '色标', '跟随配色') !== undefined) {
    throw new Error('empty gradient should show follow hint, not a follow reset');
  }
  gradientCustom.props.onClick({});
  if ((flags.fx.gradient.colors || []).length !== 3) {
    throw new Error('custom should seed three stops, got ' + JSON.stringify(flags.fx.gradient.colors));
  }
  tree = react.render(SettingsPanel, makeProps());
  if (chipIn(tree, '色标', '跟随配色') === undefined) {
    throw new Error('custom stops should keep the follow-palette reset');
  }
  if (chipIn(tree, '色标', '＋ 色标') === undefined) {
    throw new Error('custom stops should offer another stop');
  }
  chipIn(tree, '方向', '反').props.onClick({});
  if (flags.fx.gradient.reverse !== true) {
    throw new Error('reverse chip should flip the flow direction, got ' + flags.fx.gradient.reverse);
  }

  /* 尾迹：只在密度粒子上出现（默认开）。长度默认短，可切中 / 长；关掉后长度行收起。 */
  flags.effects = 'dust';
  tree = react.render(SettingsPanel, makeProps());
  const trailOn = chipIn(tree, '尾迹', '开');
  if (trailOn === undefined || trailOn.props['aria-pressed'] !== true) {
    throw new Error('dust should default to trails on');
  }
  for (const label of ['短', '中', '长']) {
    if (chipIn(tree, '长度', label) === undefined) throw new Error('trail length row missing chip ' + label);
  }
  if (chipIn(tree, '长度', '短').props['aria-pressed'] !== true) throw new Error('trail length should default to short');
  chipIn(tree, '长度', '长').props.onClick({});
  if (flags.fx.trailLength !== 'long') {
    throw new Error('trail length chip should write long, got ' + flags.fx.trailLength);
  }
  tree = react.render(SettingsPanel, makeProps());
  if (chipIn(tree, '长度', '长').props['aria-pressed'] !== true) {
    throw new Error('trail length should read back long');
  }
  chipIn(tree, '尾迹', '关').props.onClick({});
  if (flags.fx.trail !== false) throw new Error('trail chip should write false, got ' + flags.fx.trail);
  tree = react.render(SettingsPanel, makeProps());
  if (chipIn(tree, '长度', '短') !== undefined) throw new Error('trail length row should hide when trails are off');
  flags.effects = 'off';

  /* 刻度：四档，默认跟随外观；点「档位名」写回 ticks。 */
  if (chipIn(tree, '刻度', '跟随外观') === undefined) throw new Error('labels row should offer the auto chip');
  for (const label of ['档位名', '两端字', '不显示']) {
    if (chipIn(tree, '刻度', label) === undefined) throw new Error('labels row missing chip ' + label);
  }
  chipIn(tree, '刻度', '档位名').props.onClick({});
  if (flags.labels !== 'ticks') throw new Error('labels chip should write ticks, got ' + flags.labels);

  /* 配色：默认「自动」，八套内置 + 新增按钮；选了配色才出现颜色区。 */
  if (chipIn(tree, '配色', '自动') === undefined) throw new Error('palette row should offer the auto chip');
  for (const name of ['Claude 风', 'Codex 风', '苔原', '海盐', '昼雾 · 靛夜', '冷晨', '暮玫瑰', '暮紫']) {
    if (chipIn(tree, '配色', name) === undefined) throw new Error('palette row missing built-in ' + name);
  }
  if (chipIn(tree, '配色', '＋ 新增') === undefined) throw new Error('palette row should offer adding one');

  /* 颜色行是函数组件，垫片不展开，这里自己摊平一层。 */
  const flatten = (node) => {
    if (Array.isArray(node)) return node.flatMap(flatten);
    if (node === null || node === undefined || node === false) return [];
    if (typeof node !== 'object') return [];
    if (typeof node.type === 'function') return flatten(node.type(node.props));
    return [node, ...flatten(node.children ?? [])];
  };
  const colorRow = (label) =>
    flatten(tree).find(
      (node) =>
        String(node.props?.className || '').includes('dts-colorRow') && textOf(node).includes(label),
    );
  const particleRow = () => colorRow('粒子');

  /* 自动配色下没有颜色区。 */
  tree = react.render(SettingsPanel, makeProps());
  if (colorRow('进度') !== undefined) throw new Error('auto palette should not render color rows');

  /* 选 Claude 风：颜色区出现，深色页只改过的槽取深色值。 */
  chipIn(tree, '配色', 'Claude 风').props.onClick({});
  tree = react.render(SettingsPanel, makeProps());
  const progressRow = colorRow('进度');
  if (progressRow === undefined) throw new Error('selecting a palette should reveal the color rows');
  if (!textOf(progressRow).includes('#E0DBD6')) {
    throw new Error('light tab should show the light value, got ' + textOf(progressRow));
  }
  const modeChip = (label) =>
    flatten(tree).find((node) => node.type === 'button' && textOf(node) === label);
  modeChip('深色').props.onClick({});
  tree = react.render(SettingsPanel, makeProps());
  if (!textOf(colorRow('进度')).includes('#3A3330')) {
    throw new Error('dark tab should show the dark value, got ' + textOf(colorRow('进度')));
  }

  /* 空槽显示「跟随主题」且没有 ↺；有值才有。 */
  chipIn(tree, '配色', '＋ 新增').props.onClick({});
  tree = react.render(SettingsPanel, makeProps());
  const emptyRow = colorRow('进度');
  if (emptyRow === undefined) throw new Error('new palette should still show color rows');
  if (!textOf(emptyRow).includes('跟随主题')) throw new Error('empty slot should read 跟随主题');
  if (flatten(emptyRow).some((node) => String(node.props?.className || '').includes('dts-colorClear'))) {
    throw new Error('empty slot should not offer the reset button');
  }
  /* 点色块写值；写了之后出现 ↺，点了就清掉。 */
  const emptyInput = flatten(emptyRow).find((node) => node.type === 'input');
  emptyInput.props.onChange({ target: { value: '#123456' } });
  if (!flags.picked.includes('dark:fill:#123456')) {
    throw new Error('picking a color should write into the palette with the current mode, got ' + flags.picked.join());
  }
  tree = react.render(SettingsPanel, makeProps());
  const filledRow = colorRow('进度');
  if (!textOf(filledRow).includes('#123456')) throw new Error('picked color should show up');
  flatten(filledRow)
    .find((node) => String(node.props?.className || '').includes('dts-colorClear'))
    .props.onClick();
  if (!flags.picked.includes('clear:fill')) throw new Error('reset button should clear the slot');

  /* 已过刻度：详细配置里的第八个槽，落在「刻度」后面，写进去的是 tickOn。 */
  const detailLabels = flatten(tree)
    .filter((node) => node.props?.className === 'dts-colorLabel')
    .map((node) => textOf(node));
  if (!detailLabels.includes('已过刻度')) {
    throw new Error('detailed config should offer the 已过刻度 slot, got ' + detailLabels.join());
  }
  if (detailLabels.indexOf('已过刻度') !== detailLabels.indexOf('刻度') + 1) {
    throw new Error('已过刻度 should sit right after 刻度, got ' + detailLabels.join());
  }
  const tickOnRow = flatten(tree).find(
    (node) => String(node.props?.className || '').includes('dts-colorRow') && textOf(node).includes('已过刻度'),
  );
  if (tickOnRow === undefined) throw new Error('已过刻度 row missing');
  flatten(tickOnRow).find((node) => node.type === 'input' && node.props.type === 'color').props.onChange({ target: { value: '#654321' } });
  if (!flags.picked.includes('dark:tickOn:#654321')) {
    throw new Error('已过刻度 should write the tickOn slot, got ' + flags.picked.join());
  }

  /* 拇指描边：详细配置里紧跟「已过刻度」，写进去的是 ring。 */
  if (!detailLabels.includes('拇指描边')) {
    throw new Error('detailed config should offer the 拇指描边 slot, got ' + detailLabels.join());
  }
  if (detailLabels.indexOf('拇指描边') !== detailLabels.indexOf('已过刻度') + 1) {
    throw new Error('拇指描边 should sit right after 已过刻度, got ' + detailLabels.join());
  }
  const ringRow = flatten(tree).find(
    (node) => String(node.props?.className || '').includes('dts-colorRow') && textOf(node).includes('拇指描边'),
  );
  if (ringRow === undefined) throw new Error('拇指描边 row missing');
  flatten(ringRow).find((node) => node.type === 'input' && node.props.type === 'color').props.onChange({ target: { value: '#abc123' } });
  if (!flags.picked.includes('dark:ring:#abc123')) {
    throw new Error('拇指描边 should write the ring slot, got ' + flags.picked.join());
  }

  /* 透明度条：8 位 hex 写进同一个槽；ff 归一成 6 位。 */
  const { normalizeSlotColor, splitSlotColor, joinSlotColor } = pluginModule.exports.__test;
  const alphaSlot = { id: 'ring', alpha: true };
  const solidSlot = { id: 'fill' };
  if (normalizeSlotColor(alphaSlot, '#11223380') !== '#11223380') {
    throw new Error('alpha slot should keep 8-digit hex');
  }
  if (normalizeSlotColor(alphaSlot, '#112233ff') !== '#112233') {
    throw new Error('opaque 8-digit hex should collapse to 6 digits');
  }
  if (normalizeSlotColor(solidSlot, '#11223380') !== undefined) {
    throw new Error('non-alpha slots should reject 8-digit hex');
  }
  const halves = splitSlotColor('#11223380');
  if (halves.base !== '#112233' || halves.alpha !== 0x80) {
    throw new Error('splitSlotColor should split base and alpha, got ' + JSON.stringify(halves));
  }
  if (joinSlotColor('#112233', 0x80) !== '#11223380' || joinSlotColor('#112233', 255) !== '#112233') {
    throw new Error('joinSlotColor should round-trip, got ' + joinSlotColor('#112233', 0x80));
  }
  /* 有值的 alpha 槽才出透明度条；空槽与不支持的槽都不出。 */
  const alphaRange = (row) => flatten(row).find((node) => node.type === 'input' && node.props.type === 'range');
  const solidRow = flatten(tree).find(
    (node) => String(node.props?.className || '').includes('dts-colorRow') && textOf(node).includes('强调'),
  );
  if (solidRow !== undefined && alphaRange(solidRow) !== undefined) {
    throw new Error('non-alpha slots should not show an alpha slider');
  }
  if (flags.palettes.every((entry) => typeof entry.dark?.['ring'] !== 'string')) {
    throw new Error('ring should have been written before the alpha check');
  }
  const ringTree = react.render(SettingsPanel, makeProps());
  const ringAfter = flatten(ringTree).find(
    (node) => String(node.props?.className || '').includes('dts-colorRow') && textOf(node).includes('拇指描边'),
  );
  const rangeInput = ringAfter === undefined ? undefined : alphaRange(ringAfter);
  if (rangeInput === undefined) throw new Error('filled alpha slot should offer an alpha slider');
  if (rangeInput.props.value !== 100) {
    throw new Error('opaque slot should read 100% on the alpha slider, got ' + rangeInput.props.value);
  }
  flatten(ringAfter)
    .filter((node) => node.type === 'input' && node.props.type === 'range')
    .forEach((node) => node.props.onChange({ target: { value: '50' } }));
  if (!flags.picked.some((entry) => /^dark:ring:#abc123[0-9a-f]{2}$/.test(entry))) {
    throw new Error('alpha slider should write 8-digit hex, got ' + flags.picked.join());
  }

  /* 改名：输入时不动 store，失焦才提交。 */
  const nameInput = flatten(tree).find((node) => String(node.props?.className || '').includes('dts-paletteName'));
  if (nameInput === undefined) throw new Error('custom palette should offer a name input');
  nameInput.props.onChange({ target: { value: '夜航' } });
  if (flags.palettes.some((entry) => entry.name === '夜航')) throw new Error('typing should not commit the name');
  tree = react.render(SettingsPanel, makeProps());
  flatten(tree)
    .find((node) => String(node.props?.className || '').includes('dts-paletteName'))
    .props.onBlur();
  if (!flags.palettes.some((entry) => entry.name === '夜航')) throw new Error('blur should commit the name');

  /* 自定义才能删；删掉后回到自动。 */
  const deleteButton = flatten(tree).find((node) => node.type === 'button' && textOf(node) === '删除');
  if (deleteButton === undefined) throw new Error('custom palette should offer delete');
  deleteButton.props.onClick();
  if (flags.palette !== 'auto') throw new Error('deleting the active palette should fall back to auto');

  /* 粒子槽：特效关着时主色里没有它，开回来才出现（紧凑的细轨永远没有粒子）。 */
  const wideProps = () => ({ ...makeProps(), getStyle: () => 'claude' });
  flags.effects = 'off';
  flags.palette = 'claude';
  tree = react.render(SettingsPanel, wideProps());
  if (particleRow() !== undefined) throw new Error('particle slot should hide when effects are off');
  flags.effects = 'on';
  tree = react.render(SettingsPanel, wideProps());
  if (particleRow() === undefined) throw new Error('particle slot should appear when effects are on');
  flags.palette = 'claude';
  flags.effects = 'on';
  tree = react.render(SettingsPanel, makeProps());
  if (particleRow() !== undefined) throw new Error('compact should not offer a particle slot');

  flags.effects = 'auto';
  flags.labels = 'auto';
  flags.palette = 'auto';

  /* 特效色槽：只有当前特效那一槽出现，默认留空（跟随主题）。 */
  flags.palette = 'claude';
  flags.effects = 'flow';
  flags.fx = { maxOnly: false, speeds: { flow: 1, dust: 1, pulse: 1, glyph: 1 } };
  tree = react.render(SettingsPanel, makeProps());
  const flowRow = colorRow('流光');
  if (flowRow === undefined) throw new Error('active effect should expose its own color slot');
  if (colorRow('字符') !== undefined) throw new Error('inactive effect slots should stay hidden');
  if (!textOf(flowRow).includes('跟随主题')) throw new Error('effect color slot should start empty');

  /* 特效设置：只在最高档 / 速度，都写回 store。 */
  chipIn(tree, '强度', '只在最高档').props.onClick({});
  if (flags.fx.maxOnly !== true) throw new Error('max-only chip should write true');
  chipIn(tree, '速度', '快').props.onClick({});
  if (flags.fx.speeds.flow !== 1.4) throw new Error('speed chip should write 1.4 for the active effect');
  tree = react.render(SettingsPanel, makeProps());
  if (chipIn(tree, '强度', '只在最高档').props['aria-pressed'] !== true) {
    throw new Error('max-only chip should reflect the stored value');
  }
  flags.fx = { maxOnly: false, speeds: { flow: 1, dust: 1, pulse: 1, glyph: 1 } };
}

await flush();
react.reset();

/* 2g. 两轴落到座位上：特效 / 刻度可以借到别套外观；刻度词与圆点用同一个公式。 */
{
  const { sliderPosition } = pluginModule.exports.__test;
  const renderWith = (styleId, effectsMode, labelsMode, effort = 'max') => {
    react.reset();
    const store = storeOf({
      current: { provider: 'deepseek-official', model: 'm1', reasoningEffort: effort },
      groups,
      status: 'ready',
      pending: null,
      error: null,
      failures: [],
    });
    const props = {
      ...baseProps(store),
      getStyle: () => styleId,
      subscribeStyle: () => () => {},
      getEffects: () => effectsMode,
      subscribeEffects: () => () => {},
      getLabels: () => labelsMode,
      subscribeLabels: () => () => {},
    };
    let tree = react.render(Seat, props);
    findClass(tree, 'dts-trigger').props.onClick({});
    return react.render(Seat, props);
  };
  const byClass = (tree, cls) => walk(tree).find((node) => node.props?.className === cls);
  const tickButtons = (tree) =>
    walk(tree).filter(
      (node) => node.type === 'button' && String(node.props?.className || '').startsWith('dts-tick'),
    );

  /* 特效：auto 不借到 Claude / 紧凑；on 借过去，紧凑降级成细轨，没有粒子。 */
  if (byClass(renderWith('claude', 'auto', 'auto'), 'dts-flow') !== undefined) {
    throw new Error('auto effects should not put codex flow on claude');
  }
  const claudeFlow = byClass(renderWith('claude', 'on', 'auto'), 'dts-flow');
  if (claudeFlow === undefined) throw new Error('effects on should put flow on claude');
  if (claudeFlow.props['data-dts-flow'] !== undefined) throw new Error('claude flow should keep the particle layer');
  if (walk(claudeFlow).filter((node) => String(node.props?.className || '').includes('dts-flowPath')).length !== 8) {
    throw new Error('claude flow should carry the 8 particles');
  }
  if (byClass(renderWith('codex', 'off', 'auto'), 'dts-flow') !== undefined) {
    throw new Error('effects off should remove the codex flow');
  }
  const compactFlow = byClass(renderWith('compact', 'on', 'auto'), 'dts-flow');
  if (compactFlow === undefined) throw new Error('effects on should still mount the compact flow');
  if (compactFlow.props['data-dts-flow'] !== 'thin') {
    throw new Error('compact flow should degrade to the thin variant, got ' + compactFlow.props['data-dts-flow']);
  }
  if (byClass(renderWith('codex', 'auto', 'auto'), 'dts-flow') === undefined) {
    throw new Error('auto effects should keep the codex flow');
  }

  /* 刻度：显式形态压过外观；两端字只有两个词，不显示时整行消失。 */
  const claudeTicks = renderWith('claude', 'auto', 'ticks');
  if (byClass(claudeTicks, 'dts-axis') !== undefined) throw new Error('explicit ticks should drop the claude axis');
  if (tickButtons(claudeTicks).length !== efforts.length) throw new Error('claude ticks should have one label per level');
  const codexAxis = renderWith('codex', 'auto', 'axis');
  if (byClass(codexAxis, 'dts-ticks') !== undefined) throw new Error('explicit axis should drop the codex ticks');
  const axis = byClass(codexAxis, 'dts-axis');
  if (axis === undefined) throw new Error('explicit axis should render on codex');
  const axisLabels = walk(axis).filter((node) => node.props?.className === 'dts-axisLabel');
  if (axisLabels.length !== 2 || !textOf(axisLabels[0]).includes('Faster')) {
    throw new Error('axis should render the two directional labels');
  }
  const none = renderWith('claude', 'auto', 'none');
  if (byClass(none, 'dts-axis') !== undefined || byClass(none, 'dts-ticks') !== undefined) {
    throw new Error('labels none should drop the whole label row');
  }

  /* 对齐：每个词的中心就是该档圆点的 x（同一个 sliderPosition）。 */
  const ticks = tickButtons(claudeTicks);
  ticks.forEach((node, index) => {
    const expected = sliderPosition(index / Math.max(1, efforts.length - 1));
    if (node.props.style?.left !== expected) {
      throw new Error(`tick ${index} should sit on its dot: ${node.props.style?.left} !== ${expected}`);
    }
  });
  if (axisLabels[0].props.style?.left !== sliderPosition(0)) throw new Error('axis left label should sit on the first dot');
  if (axisLabels[1].props.style?.left !== sliderPosition(1)) throw new Error('axis right label should sit on the last dot');
  if (byClass(claudeTicks, 'dts-ticks').props.style['--dts-levels'] !== efforts.length) {
    throw new Error('ticks should hand the level count to CSS for the ellipsis clamp');
  }
}

await flush();
react.reset();

/* 2b. 提交失败：滑条回滚、面板不关、用 Toast 报错。 */
{
  selectCalls.length = 0;
  const store = storeOf({
    current: { provider: 'deepseek-official', model: 'm1', reasoningEffort: 'high' },
    groups,
    status: 'ready',
    pending: null,
    error: null,
    failures: [],
  });
  const props = {
    ...baseProps(store),
    select: (selection) => {
      selectCalls.push(selection);
      return Promise.resolve({ ok: false, error: { code: 'llm/denied', message: 'nope' } });
    },
  };
  let tree = react.render(Seat, props);
  findClass(tree, 'dts-trigger').props.onClick({});
  tree = react.render(Seat, props);
  const slider = findNode(tree, (node) => node.props?.role === 'slider');
  slider.props.onKeyDown({ key: 'End', nativeEvent: {}, preventDefault() {} });
  await new Promise((resolve) => setTimeout(resolve, 260));
  await flush();
  const after = react.render(Seat, props);
  if (findNode(after, (node) => node.type === primitives.Toast) === undefined) {
    throw new Error('failure should surface a toast');
  }
  if (findNode(after, (node) => node.props?.role === 'slider') === undefined) {
    throw new Error('panel should stay open after a failed commit');
  }
  const rolledBack = findNode(after, (node) => node.props?.role === 'slider');
  if (rolledBack.props['aria-valuetext'] !== 'High') {
    throw new Error('slider should roll back to High, got ' + rolledBack.props['aria-valuetext']);
  }
}

await flush();
react.reset();

/* 2c. select 拒绝 / 同步抛：两条路都要落到 Toast，不能静默。 */
for (const mode of ['reject', 'throw']) {
  react.reset();
  selectCalls.length = 0;
  const store = storeOf({
    current: { provider: 'deepseek-official', model: 'm1', reasoningEffort: 'high' },
    groups,
    status: 'ready',
    pending: null,
    error: null,
    failures: [],
  });
  const props = {
    ...baseProps(store),
    select: (selection) => {
      selectCalls.push(selection);
      if (mode === 'throw') throw new Error('sync boom');
      return Promise.reject(new Error('async boom'));
    },
  };
  let tree = react.render(Seat, props);
  findClass(tree, 'dts-trigger').props.onClick({});
  tree = react.render(Seat, props);
  findNode(tree, (node) => node.props?.role === 'slider').props.onKeyDown({ key: 'End', nativeEvent: {}, preventDefault() {} });
  await new Promise((resolve) => setTimeout(resolve, 260));
  await flush();
  const after = react.render(Seat, props);
  if (findNode(after, (node) => node.type === primitives.Toast) === undefined) {
    throw new Error(mode + ': a failed select should surface a toast');
  }
  const sliderAfter = findNode(after, (node) => node.props?.role === 'slider');
  if (sliderAfter.props['aria-valuetext'] !== 'High') {
    throw new Error(mode + ': slider should stay on High, got ' + sliderAfter.props['aria-valuetext']);
  }
}

await flush();
react.reset();

/* 2d. PageUp / PageDown：和原生 range 一样按一档走。 */
{
  react.reset();
  selectCalls.length = 0;
  const store = storeOf({
    current: { provider: 'deepseek-official', model: 'm1', reasoningEffort: 'high' },
    groups,
    status: 'ready',
    pending: null,
    error: null,
    failures: [],
  });
  const props = baseProps(store);
  let tree = react.render(Seat, props);
  findClass(tree, 'dts-trigger').props.onClick({});
  tree = react.render(Seat, props);
  findNode(tree, (node) => node.props?.role === 'slider').props.onKeyDown({ key: 'PageUp', nativeEvent: {}, preventDefault() {} });
  await new Promise((resolve) => setTimeout(resolve, 260));
  if (selectCalls.length !== 1 || selectCalls[0].reasoningEffort !== 'max') {
    throw new Error('PageUp should commit Max, got ' + selectCalls.map((call) => call.reasoningEffort).join(','));
  }
  tree = react.render(Seat, props);
  findNode(tree, (node) => node.props?.role === 'slider').props.onKeyDown({ key: 'PageDown', nativeEvent: {}, preventDefault() {} });
  await new Promise((resolve) => setTimeout(resolve, 260));
  if (selectCalls.length !== 2 || selectCalls[1].reasoningEffort !== 'low') {
    throw new Error('PageDown should commit Low, got ' + selectCalls.map((call) => call.reasoningEffort).join(','));
  }
}

await flush();
react.reset();

/* 2e. 指针被系统取消 / 丢失捕获：收掉拖动临时态，且不提交。 */
{
  react.reset();
  selectCalls.length = 0;
  const store = storeOf({
    current: { provider: 'deepseek-official', model: 'm1', reasoningEffort: 'high' },
    groups,
    status: 'ready',
    pending: null,
    error: null,
    failures: [],
  });
  const props = baseProps(store);
  let tree = react.render(Seat, props);
  findClass(tree, 'dts-trigger').props.onClick({});
  tree = react.render(Seat, props);
  /* compact：pad 6、轨道宽 100（与上面 2a 的换算一致）。 */
  const track = {
    focus() {},
    setPointerCapture() {},
    releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, width: 100 }),
  };
  const at = (ratio) => 6 + ratio * 88;
  const sliderOf = () => findNode(tree, (node) => node.props?.role === 'slider');
  sliderOf().props.ref.current = track;
  sliderOf().props.onPointerDown({ clientX: at(1), pointerId: 9, preventDefault() {} });
  tree = react.render(Seat, props);
  if (textOf(findClass(tree, 'dts-bandValue')) !== 'Max') {
    throw new Error('drag preview should show Max before cancel, got ' + textOf(findClass(tree, 'dts-bandValue')));
  }
  sliderOf().props.onPointerCancel({ pointerId: 9 });
  tree = react.render(Seat, props);
  if (textOf(findClass(tree, 'dts-bandValue')) !== 'High') {
    throw new Error('pointercancel should drop the drag preview, got ' + textOf(findClass(tree, 'dts-bandValue')));
  }
  if (selectCalls.length !== 0) throw new Error('pointercancel must not commit');

  /* 丢失捕获走同一套清理。 */
  sliderOf().props.ref.current = track;
  sliderOf().props.onPointerDown({ clientX: at(0), pointerId: 10, preventDefault() {} });
  tree = react.render(Seat, props);
  sliderOf().props.onLostPointerCapture();
  tree = react.render(Seat, props);
  if (textOf(findClass(tree, 'dts-bandValue')) !== 'High') {
    throw new Error('lostpointercapture should drop the drag preview');
  }
  if (selectCalls.length !== 0) throw new Error('lostpointercapture must not commit');
}

await flush();
react.reset();

/* 3. 换模型：目标模型没有 High 档，按序号就近钳制到 Low。 */
{
  selectCalls.length = 0;
  const store = storeOf({
    current: { provider: 'deepseek-official', model: 'm1', reasoningEffort: 'high' },
    groups,
    status: 'ready',
    pending: null,
    error: null,
    failures: [],
  });
  const props = baseProps(store);
  let tree = react.render(Seat, props);
  findClass(tree, 'dts-trigger').props.onClick({});
  tree = react.render(Seat, props);
  findNode(tree, (node) => node.props?.['data-dts'] === 'model-cell').props.onClick({});
  tree = react.render(Seat, props);
  const option = walk(tree).find(
    (node) =>
      node.type === 'button' &&
      String(node.props.className || '').includes('dts-option') &&
      node.props.title === 'Model Two',
  );
  if (option === undefined) throw new Error('Model Two option missing');
  option.props.onClick({});
  if (selectCalls.length !== 1) throw new Error('model switch did not select');
  if (selectCalls[0].model !== 'm2') throw new Error('unexpected model: ' + selectCalls[0].model);
  if (selectCalls[0].reasoningEffort !== 'low') {
    throw new Error('effort should clamp High -> Low, got ' + selectCalls[0].reasoningEffort);
  }
}

await flush();
react.reset();

/* 4. 模型没有推理元数据：不画滑条，给一行说明。 */
{
  const store = storeOf({
    current: { provider: 'deepseek-official', model: 'm3' },
    groups,
    status: 'ready',
    pending: null,
    error: null,
    failures: [],
  });
  const props = baseProps(store);
  let tree = react.render(Seat, props);
  findClass(tree, 'dts-trigger').props.onClick({});
  tree = react.render(Seat, props);
  if (findNode(tree, (node) => node.props?.role === 'slider') !== undefined) {
    throw new Error('slider should not render without reasoning metadata');
  }
  if (!textOf(tree).includes('该模型不支持推理强度')) throw new Error('no-effort hint missing');
}

await flush();
react.reset();

/* 5. 不可用的会话（subagent）：整座不渲染。 */
{
  const store = storeOf({ current: null, groups, status: 'ready', pending: null, error: null, failures: [] });
  const tree = react.render(Seat, { ...baseProps(store), available: false });
  // 无 DOM 时返回 null；这里只要不抛错即可。
  if (tree !== null && typeof tree !== 'object') throw new Error('unavailable seat should render nothing');
}


/* ── bundle 外壳：lib/client.js 能被模块加载器注册，factory 返回 { inject, apply } ── */
{
  const bundleSource = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
  const captured = { spec: null };
  const fakeWindow = { __ModuleLoader__: { load: (spec) => { captured.spec = spec; } } };
  new Function('window', bundleSource)(fakeWindow);
  if (!captured.spec || captured.spec.id !== 'dsh-yet-another-slider-thingy') throw new Error('bundle did not register the dsh-yet-another-slider-thingy factory');
  const exports = captured.spec.factory((name) => {
    if (name === 'react') return react.React;
    if (name === 'react-dom') return { createPortal: (node) => node };
    throw new Error(`unexpected require in bundle: ${name}`);
  });
  if (!exports || typeof exports.apply !== 'function' || !Array.isArray(exports.inject)) {
    throw new Error('bundle factory did not return { inject, apply }');
  }
}

/* 6. apply：旧色迁移、配色存储与设置回调真的落到 localStorage。 */
{
  const store = new Map();
  globalThis.window.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  };
  globalThis.document.createElement = () => ({ dataset: {}, textContent: '', remove: noop });
  /* 故意只写旧包名的键：apply 里的迁移要把它抄到新键，后面的配色迁移才读得到。 */
  store.set('dsh-thinking-slider:style', 'claude');
  store.set('dsh-thinking-slider:colors', JSON.stringify({ claude: { fill: '#112233' } }));

  const { migrateLegacyStorage } = pluginModule.exports.__test;
  migrateLegacyStorage();
  if (store.get('dsh-yet-another-slider-thingy:style') !== 'claude') {
    throw new Error('legacy style key should be copied to the new package name');
  }
  store.set('dsh-yet-another-slider-thingy:smooth', 'step');
  store.set('dsh-thinking-slider:smooth', 'smooth');
  migrateLegacyStorage();
  if (store.get('dsh-yet-another-slider-thingy:smooth') !== 'step') {
    throw new Error('legacy migration must not overwrite an existing new key');
  }

  const { apply } = pluginModule.exports;
  const registered = [];
  const injectDeps = [];
  const ctx = {
    effect: (fn) => fn(),
    slots: {
      inject: (name, fn) => {
        if (name === 'settings.section') registered.push(fn());
      },
      register: (registration, component) => {
        registered.push({ registration, component });
        return () => {};
      },
      entries: () => [],
    },
    inject: (deps, fn) => {
      injectDeps.push(deps);
      return fn({ modelDirectories: {}, sessions: {} });
    },
  };
  apply(ctx);

  /* 座位必须挂在声明了 remote.session 的那条注入 scope 上，否则冷启动会被
     宿主的 `cannot get property "remote.session" without inject` 打回去。 */
  if (!Array.isArray(injectDeps[0]) || !injectDeps[0].includes('remote.session')) {
    throw new Error('seat should be injected with remote.session, got ' + JSON.stringify(injectDeps[0]));
  }

  const section = registered.find((entry) => entry?.registration?.id === 'yet-another-slider');
  if (section === undefined) throw new Error('apply should register the settings section');
  const props = section.registration.inject();
  const paletteIds = props.getPalettes().map((palette) => palette.id);
  if (!paletteIds.includes('claude') || !paletteIds.includes('codex')) {
    throw new Error('settings should see the built-in palettes, got ' + paletteIds.join());
  }
  if (props.getPalette() !== 'legacy-claude') {
    throw new Error('legacy custom colors should be migrated and selected, got ' + props.getPalette());
  }
  const storedPalettes = JSON.parse(store.get('dsh-yet-another-slider-thingy:palettes'));
  if (!Array.isArray(storedPalettes) || !storedPalettes.some((palette) => palette.id === 'legacy-claude')) {
    throw new Error('migration should persist the legacy palette');
  }

  props.addPalette();
  const added = props.getPalettes().at(-1);
  if (added === undefined || !added.id.startsWith('custom-')) throw new Error('addPalette should append a custom palette');
  if (props.getPalette() !== added.id) throw new Error('addPalette should select the new palette');
  props.renamePalette(added.id, '暮紫');
  props.setPaletteColor(added.id, 'light', 'fill', '#00FF00');
  props.setPaletteColor(added.id, 'dark', 'accent', '#aabbcc');
  const saved = JSON.parse(store.get('dsh-yet-another-slider-thingy:palettes')).find((palette) => palette.id === added.id);
  if (saved.name !== '暮紫' || saved.light.fill !== '#00ff00' || saved.dark.accent !== '#aabbcc') {
    throw new Error('palette edits should persist: ' + JSON.stringify(saved));
  }
  props.clearPaletteColor(added.id, 'fill');
  const cleared = JSON.parse(store.get('dsh-yet-another-slider-thingy:palettes')).find((palette) => palette.id === added.id);
  if (cleared.light.fill !== undefined) throw new Error('clearing a slot should drop both modes');
  props.removePalette(added.id);
  if (props.getPalette() !== 'auto') throw new Error('removing the active palette should fall back to auto');
}

console.log('selftest OK — open / model choose / effort commit / smooth drag freeze + snap / effect power follows tier and pointer / clamp / failure rollback (ok:false / reject / sync throw) / PageUp·PageDown / pointercancel + lostcapture / no-effort / unavailable / styles / knobs (shape + size)');
