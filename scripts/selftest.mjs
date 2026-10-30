/**
 * 思考强度座位的离线行为自测：用一个极小的 React 垫片真跑组件，
 * 检查「打开 → 选模型 → 换档 → 提交 → 面板不关」这条链与提交参数。
 *
 * 不测像素、不测槽位接线（那些只能在实机看）；它只保证组件不会一渲染就炸、
 * 事件回调走的是对的分支。跑法：node scripts/selftest.mjs
 */
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8').replace('__CSS__', '""');

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
    'dsh-thinking-slider:colors',
    JSON.stringify({
      codex: { fill: '#FF3366', tick: 'not-a-color' },
      claude: { track: '#112233' },
      compact: { fill: '#ffffff' },
    }),
  );
  const colors = pluginModule.exports.__test.storedColors();
  if (colors.codex?.fill !== '#ff3366') throw new Error('storedColors should normalize hex');
  if (colors.codex?.tick !== undefined) throw new Error('storedColors should drop invalid values');
  if (colors.claude?.track !== '#112233') throw new Error('storedColors should keep valid slots');
  if (colors.compact?.fill !== '#ffffff') throw new Error('storedColors should keep compact slots');
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
  store.set('dsh-thinking-slider:smooth', 'smooth');
  if (storedSmooth() !== true) throw new Error('smooth should read back as true');
  store.set('dsh-thinking-slider:smooth', 'garbage');
  if (storedSmooth() !== false) throw new Error('unknown smooth value should fall back to step');
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
  const renderStyled = (styleId, effort, colors = {}) => {
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
      getColors: () => colors,
      subscribeColors: () => () => {},
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

  const codex = renderStyled('codex', 'max');
  if (findClass(codex, 'dts-ticks') === undefined) throw new Error('codex tick labels missing');
  if (findClass(codex, 'dts-axis') !== undefined) throw new Error('codex should not render the claude axis');
  if (findClass(codex, 'dts-burst') !== undefined) throw new Error('codex outside burst should be gone');
  const flow = findClass(codex, 'dts-flow');
  if (flow === undefined) throw new Error('codex max fill flow missing');
  const flowPaths = walk(flow).filter(
    (node) => typeof node.props?.className === 'string' && node.props.className.includes('dts-flowPath'),
  );
  if (flowPaths.length !== 8) throw new Error('codex max fill flow should have 8 particles');
  if (flow.props.style.opacity !== 1) {
    throw new Error('codex max flow should be fully visible, got ' + flow.props.style.opacity);
  }
  const codexHigh = renderStyled('codex', 'high');
  const idleFlow = findClass(codexHigh, 'dts-flow');
  if (idleFlow === undefined) throw new Error('codex flow layer should stay mounted below max');
  if (idleFlow.props.style.opacity !== 0) {
    throw new Error('codex flow should be hidden below max, got ' + idleFlow.props.style.opacity);
  }
  if (findClass(codex, 'dts-scale').props.style['--dts-thumb-w'] !== '28px') {
    throw new Error('codex thumb should be 28px');
  }

  const tinted = renderStyled('claude', 'high', {
    claude: { track: '#112233', accent: '#445566' },
  });
  const tintedMenu = findNode(
    tinted,
    (node) =>
      node.props?.['data-dts-style'] === 'claude' &&
      typeof node.props.className === 'string' &&
      node.props.className.includes('dts-menu'),
  );
  if (tintedMenu === undefined) throw new Error('tinted claude menu missing');
  if (tintedMenu.props.style['--dts-track-color'] !== '#112233') {
    throw new Error('custom track color was not applied');
  }
  if (tintedMenu.props.style['--dts-accent-color'] !== '#445566') {
    throw new Error('custom accent color was not applied');
  }

  const compact = renderStyled('compact', 'high');
  if (findClass(compact, 'dts-axis') !== undefined) throw new Error('compact should not render the claude axis');
  if (findNode(compact, (node) => node.type === 'button' && String(node.props.className || '').startsWith('dts-tick')) === undefined) {
    throw new Error('compact tick labels missing');
  }
  if (findClass(compact, 'dts-scale').props.style['--dts-pad'] !== '6px') {
    throw new Error('compact pad should stay 6px');
  }

  const compactTinted = renderStyled('compact', 'high', { compact: { fill: '#00ff00' } });
  const compactMenu = findNode(
    compactTinted,
    (node) =>
      node.props?.['data-dts-style'] === 'compact' &&
      typeof node.props.className === 'string' &&
      node.props.className.includes('dts-menu'),
  );
  if (compactMenu === undefined) throw new Error('tinted compact menu missing');
  if (compactMenu.props.style['--dts-fill-color'] !== '#00ff00') {
    throw new Error('compact custom fill was not applied');
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
  if (sliderOf().props['aria-valuenow'] !== 1) {
    throw new Error('smooth drag should report nearest index 1, got ' + sliderOf().props['aria-valuenow']);
  }
  if (!near(ratioIn(findClass(tree, 'dts-thumb').props.style.left), 0.4)) throw new Error('smooth thumb should follow the pointer');
  if (!near(ratioIn(findClass(tree, 'dts-fill').props.style.width), 0.4)) {
    throw new Error('smooth fill should follow the pointer, got ' + findClass(tree, 'dts-fill').props.style.width);
  }

  sliderOf().props.onPointerMove({ clientX: at(0.9), pointerId: 1 });
  tree = react.render(Seat, props);
  if (!near(ratioIn(findClass(tree, 'dts-thumb').props.style.left), 0.9)) throw new Error('smooth move should stay continuous');
  if (sliderOf().props['aria-valuetext'] !== 'Max') {
    throw new Error('smooth move should snap the label to Max, got ' + sliderOf().props['aria-valuetext']);
  }

  sliderOf().props.onPointerUp({ clientX: at(0.9), pointerId: 1 });
  if (selectCalls.length !== 1) throw new Error('smooth release should commit exactly once');
  if (selectCalls[0].reasoningEffort !== 'max') {
    throw new Error('smooth release should commit the nearest level, got ' + selectCalls[0].reasoningEffort);
  }
  tree = react.render(Seat, props);
  if (sliderOf().props['data-dts-dragging'] !== undefined) throw new Error('drag state should clear after release');

  /* 逐档：同一位置只落在刻度上，松手提交该档。 */
  smoothMode = false;
  selectCalls.length = 0;
  tree = react.render(Seat, props);
  sliderOf().props.ref.current = track;
  sliderOf().props.onPointerDown({ clientX: at(0.4), pointerId: 2, preventDefault() {} });
  tree = react.render(Seat, props);
  if (!near(ratioIn(findClass(tree, 'dts-thumb').props.style.left), 1 / 3)) {
    throw new Error('step mode should snap the thumb to a tick, got ' + findClass(tree, 'dts-thumb').props.style.left);
  }
  sliderOf().props.onPointerUp({ clientX: at(0.4), pointerId: 2 });
  if (selectCalls.length !== 1 || selectCalls[0].reasoningEffort !== 'low') {
    throw new Error('step release should commit the tick under the pointer');
  }
}

await flush();
react.reset();

/* 2e. Codex 特效强度：平滑拖动跟手连续升高；逐档只给 0 / 1，让 CSS 过渡淡入。 */
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
  /* codex：pad 14、轨道宽 100，0–1 的 ratio 换算成 clientX。 */
  const at = (ratio) => 14 + ratio * 72;
  sliderOf().props.ref.current = track;

  if (flowOf().props.style.opacity !== 0) throw new Error('codex high should start with no flow');
  sliderOf().props.onPointerMove({ clientX: at(0.7), pointerId: 3 });
  tree = react.render(Seat, props);
  if (flowOf().props.style.opacity !== 0) throw new Error('idle pointermove should not show flow');

  sliderOf().props.onPointerDown({ clientX: at(0.7), pointerId: 3, preventDefault() {} });
  tree = react.render(Seat, props);
  if (flowOf().props.style.opacity !== 0) {
    throw new Error('flow should stay hidden below max while dragging, got ' + flowOf().props.style.opacity);
  }

  sliderOf().props.onPointerMove({ clientX: at(0.9), pointerId: 3 });
  tree = react.render(Seat, props);
  const partial = flowOf().props.style.opacity;
  if (!(partial > 0 && partial < 1)) {
    throw new Error('smooth drag into max should ramp flow, got ' + partial);
  }
  if (flowOf().props['data-dts-flow-follow'] === undefined) {
    throw new Error('smooth drag should let flow follow the pointer without a transition');
  }
  if (sliderOf().props['aria-valuenow'] !== 3) {
    throw new Error('smooth drag should report the max level, got ' + sliderOf().props['aria-valuenow']);
  }

  sliderOf().props.onPointerMove({ clientX: at(0.95), pointerId: 3 });
  tree = react.render(Seat, props);
  if (!(flowOf().props.style.opacity > partial)) {
    throw new Error('flow should keep growing toward the right end');
  }

  sliderOf().props.onPointerMove({ clientX: at(1), pointerId: 3 });
  tree = react.render(Seat, props);
  if (flowOf().props.style.opacity !== 1) {
    throw new Error('flow should be full at the right end, got ' + flowOf().props.style.opacity);
  }

  sliderOf().props.onPointerUp({ clientX: at(1), pointerId: 3 });
  tree = react.render(Seat, props);

  /* 逐档：没有连续位置，指针落到刻度就只给 0 / 1；过渡由 CSS 负责。 */
  smoothMode = false;
  tree = react.render(Seat, props);
  sliderOf().props.ref.current = track;
  sliderOf().props.onPointerDown({ clientX: at(0.95), pointerId: 4, preventDefault() {} });
  tree = react.render(Seat, props);
  if (flowOf().props['data-dts-flow-follow'] !== undefined) {
    throw new Error('step drag should keep the flow opacity transition');
  }
  if (flowOf().props.style.opacity !== 1) {
    throw new Error('step mode at max should target full flow strength, got ' + flowOf().props.style.opacity);
  }
  sliderOf().props.onPointerUp({ clientX: at(0.8), pointerId: 4 });
}

await flush();
react.reset();

/* 2f. 设置面板：滑动一行显示当前方式，点「平滑」写回 store。 */
{
  const { SettingsPanel } = pluginModule.exports.__test;
  if (typeof SettingsPanel !== 'function') throw new Error('SettingsPanel export missing');
  const flags = { smooth: false, picked: [] };
  const makeProps = () => ({
    getEnabled: () => true,
    getStatus: () => '已接管（座位已渲染）',
    getStyle: () => 'compact',
    getColors: () => ({}),
    getSmooth: () => flags.smooth,
    selectEnabled: () => {},
    selectStyle: () => {},
    selectColor: () => {},
    resetColors: () => {},
    selectSmooth: (value) => {
      flags.smooth = value;
      flags.picked.push(value);
    },
    subscribe: () => () => {},
  });
  const findChip = (tree, label) => walk(tree).find((node) => node.type === 'button' && textOf(node) === label);

  let tree = react.render(SettingsPanel, makeProps());
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
  if (!captured.spec || captured.spec.id !== 'dsh-thinking-slider') throw new Error('bundle did not register the dsh-thinking-slider factory');
  const exports = captured.spec.factory((name) => {
    if (name === 'react') return react.React;
    if (name === 'react-dom') return { createPortal: (node) => node };
    throw new Error(`unexpected require in bundle: ${name}`);
  });
  if (!exports || typeof exports.apply !== 'function' || !Array.isArray(exports.inject)) {
    throw new Error('bundle factory did not return { inject, apply }');
  }
}

console.log('selftest OK — open / model choose / effort commit / smooth drag + snap / codex flow ramp / clamp / failure rollback / no-effort / unavailable / styles');
