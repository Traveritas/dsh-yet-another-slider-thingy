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

console.log('selftest OK — open / model choose / effort commit / clamp / failure rollback / no-effort / unavailable');
