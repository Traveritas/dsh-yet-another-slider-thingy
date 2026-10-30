/**
 * dsh-thinking-slider —— 浏览器端 bundle（v0.4.0）
 *
 * 把 DSH composer 的模型位（`conversation.input.model`）换成「模型行 + 思考强度滑条」：
 * 模型行照旧下钻到分组列表，推理强度是带卡位的滑条（逐档 / 平滑两种拖动方式）。面板材质直接用宿主
 * MenuSurface，档位、分组、pending 与提交路径都来自宿主同一份模型目录。
 *
 * 依赖的宿主契约（DSH 0.2.1-rc.3，按 asar 里的真实源码核对）：
 *   - 槽位 `conversation.input.model`（single / session），官方条目 priority 0；
 *   - Cordis 服务 `modelDirectories`（ModelDirectoryResolver）与 `sessions`；
 *   - 浏览器基线模块 @deepseek-ai/dsh-client-ui-primitives（MenuSurface 等）。
 * 任何一项拿不到就安静回落原生座位，并在设置页写明原因。
 *
 * 注册方式：以 priority -1 注册同名槽位；卸载、关开关、组件渲染抛错都会回原生。
 */

const React = require("react");
const h = React.createElement;

const PLUGIN_ID = "dsh-thinking-slider";
const ENABLED_KEY = PLUGIN_ID + ":enabled";
const STYLE_KEY = PLUGIN_ID + ":style";
const SMOOTH_KEY = PLUGIN_ID + ":smooth";
const CSS = __CSS__;

/** 滑条外观：紧凑是原来的细轨，Claude / Codex 共用一套新几何。 */
const SLIDER_STYLES = [
  { id: "compact", label: "紧凑" },
  { id: "claude", label: "Claude" },
  { id: "codex", label: "Codex" },
];
const DEFAULT_SLIDER_STYLE = "compact";
/**
 * 拖动方式：
 *   step   逐档——指针每动一下就把位置取整到刻度，拇指从不落在两档之间。
 *   smooth 平滑——拇指连续跟手，松手取整到最近档并提交（协议上仍是离散档位）。
 */
const SLIDER_DRAGS = [
  { id: "step", label: "逐档" },
  { id: "smooth", label: "平滑" },
];
const DEFAULT_SLIDER_DRAG = "step";
/**
 * 交互骨架：pad 是拇指圆心到轨道两端的距离（= 拇指半径），
 * thumbW / thumbH 是拇指盒，trackH 是轨道的可点击高度。
 * 指针命中和所有 inline left / fill width 都从这里取，CSS 只负责材质。
 */
const SLIDER_GEOMETRY = {
  compact: { pad: 6, thumbW: 12, thumbH: 12, trackH: 20 },
  claude: { pad: 14, thumbW: 24, thumbH: 28, trackH: 28 },
  codex: { pad: 14, thumbW: 28, thumbH: 28, trackH: 28 },
};
const DEFAULT_STYLE_GETTER = () => DEFAULT_SLIDER_STYLE;
const SMOOTH_OFF_GETTER = () => false;
const NOOP_SUBSCRIBE = () => () => {};

/** Codex 满档时在蓝色填充里横穿的小点；top / duration / delay 都是视觉参数。 */
const FLOW_PARTICLES = [
  { top: 4, duration: 3.2, delay: 0 },
  { top: 9, duration: 3.8, delay: -0.7 },
  { top: 14, duration: 2.9, delay: -1.4 },
  { top: 19, duration: 3.5, delay: -2.1 },
  { top: 6, duration: 4.1, delay: -0.3 },
  { top: 11, duration: 3.0, delay: -1.8 },
  { top: 16, duration: 3.6, delay: -1.1 },
  { top: 21, duration: 3.3, delay: -2.5 },
];

const COLORS_KEY = PLUGIN_ID + ":colors";
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
/** main = 直接拉开档位识别度；其余收进「详细配置」。 */
const COLOR_SLOTS = [
  { id: "track", label: "轨道", main: true },
  { id: "fill", label: "进度", main: true },
  { id: "thumb", label: "拇指", main: true },
  { id: "accent", label: "强调", main: true },
  { id: "tick", label: "刻度", main: false },
  { id: "text", label: "文字", main: false },
  { id: "particle", label: "粒子", main: false },
];
const DEFAULT_COLORS = {
  compact: {
    track: "#e7e3de",
    fill: "#6f5685",
    thumb: "#ffffff",
    accent: "#6f5685",
    tick: "#8a8580",
    text: "#77736f",
    particle: "#ffffff",
  },
  claude: {
    track: "#edeae8",
    fill: "#e0dbd6",
    thumb: "#ffffff",
    accent: "#c6613f",
    tick: "#b6b2af",
    text: "#77736f",
    particle: "#ffffff",
  },
  codex: {
    track: "#e8e8e8",
    fill: "#3a83f7",
    thumb: "#ffffff",
    accent: "#924ff7",
    tick: "#6d6b67",
    text: "#77736f",
    particle: "#ffffff",
  },
};
const EMPTY_COLORS = {};
const EMPTY_COLORS_GETTER = () => EMPTY_COLORS;

/** 拇指圆心 / 刻度 / 填充共用的位置公式，几何全从 CSS 变量来。 */
function sliderPosition(ratio) {
  return `calc(var(--dts-pad) + ${ratio} * (100% - var(--dts-pad) * 2))`;
}

/**
 * 入口：返回 disposer；拿不到服务或 primitives 就返回 null，座位留守原生。
 *
 * 服务由 apply() 先取好再传进来：`slots.inject` 的回调跑在 effect 里，
 * 在那里再开一个 ctx.inject 不可靠。
 *
 * @param ctx - 插件上下文。
 * @param report - 状态回执（设置面板会在没接管成功时显示原因）。
 * @param services - `{ models, sessions }`；两个服务都就绪才会调用。
 */
function registerThinkingSliderSeat(ctx, report, services) {
  const say = (text) => {
    if (typeof report === "function") report(text);
  };
  let primitives;
  try {
    primitives = require("@deepseek-ai/dsh-client-ui-primitives");
  } catch (error) {
    say("缺少 ui-primitives 模块");
    console.warn("[thinking-slider] thinking slider needs the host ui-primitives module; the native model menu stays in place:", error);
    return null;
  }
  if (primitives === null || typeof primitives !== "object") {
    say("ui-primitives 模块为空");
    return null;
  }
  /* MenuSurface 是 React.forwardRef 的产物（对象，不是函数），别用 typeof 判函数。 */
  if (primitives.MenuSurface === undefined || primitives.MenuSurface === null) {
    say("ui-primitives 不完整（没有 MenuSurface）");
    return null;
  }

  const models = services?.models;
  const sessions = services?.sessions;
  if (models === undefined || sessions === undefined || typeof models.directoryFor !== "function") {
    say("modelDirectories / sessions 服务不可用");
    return null;
  }

  const Seat = createThinkingSliderSeat(primitives, say);
  if (Seat === null) {
    say("缺少 react-dom / createPortal");
    return null;
  }

  /* 旧版主题（0.7.0）也内联过这个座位；同装时不要抢同一个优先级。 */
  try {
    const taken = typeof ctx.slots.entries === "function" ? ctx.slots.entries("conversation.input.model") : null;
    if (Array.isArray(taken) && taken.some((entry) => entry?.options?.priority === -1)) {
      say("已有同优先级的接管条目（可能装了内联版主题），不重复注册");
      return null;
    }
  } catch {
    /* 查不到就照常注册，宿主会拒绝同优先级重复 */
  }

  let disposeSlot = null;
  try {
    disposeSlot = ctx.slots.register(
      {
        name: "conversation.input.model",
        priority: -1,
        inject: (sessionId) => {
          const directory = models.directoryFor(sessionId);
          const available = sessions.subagentAddress(sessionId) === undefined;
          return {
            available,
            directory: directory.store,
            load: () => {
              if (available) directory.load().catch(() => {});
            },
            select: (selection) => (available ? directory.select(selection) : Promise.resolve(undefined)),
            getStyle: () =>
              typeof services.style?.get === "function" ? services.style.get() : DEFAULT_SLIDER_STYLE,
            subscribeStyle: (listener) =>
              typeof services.style?.subscribe === "function"
                ? services.style.subscribe(listener)
                : NOOP_SUBSCRIBE(),
            getColors: () => (typeof services.colors?.get === "function" ? services.colors.get() : EMPTY_COLORS),
            subscribeColors: (listener) =>
              typeof services.colors?.subscribe === "function"
                ? services.colors.subscribe(listener)
                : NOOP_SUBSCRIBE(),
            getSmooth: () => (typeof services.smooth?.get === "function" ? services.smooth.get() : false),
            subscribeSmooth: (listener) =>
              typeof services.smooth?.subscribe === "function"
                ? services.smooth.subscribe(listener)
                : NOOP_SUBSCRIBE(),
          };
        },
      },
      Seat,
    );
  } catch (error) {
    /* 注册被宿主拒绝（结构变了 / 同名冲突）：保持原生座位，不难为插件。 */
    say("注册被拒绝：" + (error?.message ?? String(error)));
    console.warn("[thinking-slider] thinking slider seat was not registered; the native model menu stays in place:", error);
    return null;
  }
  try {
    const entries = typeof ctx.slots.entries === "function" ? ctx.slots.entries("conversation.input.model") : null;
    const first = Array.isArray(entries) ? entries[0] : undefined;
    if (first !== undefined && first.component === Seat) say("已接管（等待座位渲染）");
    else if (first !== undefined) say("已注册，但首位不是我们");
    else say("已注册，但槽位没有条目");
  } catch {
    say("已注册（顺序未校验）");
  }
  return () => {
    if (typeof disposeSlot === "function") disposeSlot();
  };
}

/**
 * 造座位组件。
 * @param primitives - 浏览器基线模块 @deepseek-ai/dsh-client-ui-primitives。
 * @param report - 状态回执；渲染成功 / 不可用时各报一次。
 * @returns 组件，或 null（缺少必要的宿主部件时）。
 */
function createThinkingSliderSeat(primitives, report) {
  const {
    MenuSurface,
    MenuGroup,
    Input,
    StateDot,
    Toast,
    IconChevronDownOutlineRegular,
    IconChevronRightOutlineRegular,
    IconCheckOutlineRegular,
    IconCloseFillRegular,
    IconWarningOutlineRegular,
    rankByName,
    observeStickyMenuGroups,
  } = primitives;
  /* MenuSurface 是 forwardRef 组件（对象）；只要求存在，不要求是函数。 */
  if (MenuSurface === undefined || MenuSurface === null || typeof rankByName !== "function") return null;

  let ReactDOM;
  try {
    ReactDOM = require("react-dom");
  } catch {
    return null;
  }
  if (ReactDOM === null || typeof ReactDOM !== "object" || typeof ReactDOM.createPortal !== "function") return null;

  const h = React.createElement;
  const Fragment = React.Fragment;
  const createPortal = ReactDOM.createPortal;

  /** 首次渲染时藏起来量尺寸，拿到真实宽高再摆位置（照抄原生 Menu 的做法）。 */
  const MEASURE_STYLE = { visibility: "hidden", left: 0, top: 0 };
  const ACCOUNT_PROVIDER = "deepseek-account";
  const OFFICIAL_PROVIDER = "deepseek-official";
  const TEXT = {
    model: "模型",
    effort: "推理强度",
    triggerFallback: "请选择模型",
    triggerLoading: "加载中…",
    triggerLabel: "模型与推理强度",
    ariaTrigger: "选择模型与推理强度",
    ariaMenu: "模型与推理强度",
    ariaModelList: "模型列表",
    ariaSlider: "推理强度",
    loadingCatalog: "正在加载模型…",
    emptyCatalog: "暂无可用模型",
    emptySearch: "没有匹配的模型",
    search: "搜索模型",
    searchClear: "清除搜索",
    retry: "重试",
    loadFailed: "模型目录加载失败",
    noEffort: "该模型不支持推理强度",
    effortPending: "正在切换…",
    toastSelectFailed: "切换失败",
    toastWriterHeld: "会话正被其他 DSH 占用，请退出后重试",
    providerDefault: "提供方默认",
  };

  /** 官方两档提供方排前，其余保持目录顺序。 */
  const providerRank = (id) => (id === ACCOUNT_PROVIDER ? 0 : id === OFFICIAL_PROVIDER ? 1 : 2);

  function ThinkingSliderSeat(props) {
    const {
      locked,
      available,
      directory,
      load,
      select,
      getStyle,
      subscribeStyle,
      getColors,
      subscribeColors,
      getSmooth,
      subscribeSmooth,
    } = props;

    const subscribe = React.useCallback((listener) => directory.subscribe(listener), [directory]);
    const state = React.useSyncExternalStore(subscribe, () => directory.getSnapshot());
    const styleId = React.useSyncExternalStore(
      typeof subscribeStyle === "function" ? subscribeStyle : NOOP_SUBSCRIBE,
      typeof getStyle === "function" ? getStyle : DEFAULT_STYLE_GETTER,
    );
    const colors = React.useSyncExternalStore(
      typeof subscribeColors === "function" ? subscribeColors : NOOP_SUBSCRIBE,
      typeof getColors === "function" ? getColors : EMPTY_COLORS_GETTER,
    );
    const smooth = React.useSyncExternalStore(
      typeof subscribeSmooth === "function" ? subscribeSmooth : NOOP_SUBSCRIBE,
      typeof getSmooth === "function" ? getSmooth : SMOOTH_OFF_GETTER,
    );
    const geometry = SLIDER_GEOMETRY[styleId] ?? SLIDER_GEOMETRY[DEFAULT_SLIDER_STYLE];
    const palette = colors?.[styleId] ?? EMPTY_COLORS;
    const colorVars = {};
    for (const slot of COLOR_SLOTS) {
      const value = palette[slot.id];
      if (typeof value === "string") colorVars[`--dts-${slot.id}-color`] = value;
    }
    const scaleVars = {
      "--dts-track-h": `${geometry.trackH}px`,
      "--dts-thumb-w": `${geometry.thumbW}px`,
      "--dts-thumb-h": `${geometry.thumbH}px`,
      "--dts-pad": `${geometry.pad}px`,
    };

    const [open, setOpen] = React.useState(false);
    const [pane, setPane] = React.useState("root");
    const [query, setQuery] = React.useState("");
    const [highlighted, setHighlighted] = React.useState(null);
    const [dragIndex, setDragIndex] = React.useState(null);
    /* 平滑模式下的连续位置（0–1）；逐档模式恒为 null。 */
    const [dragRatio, setDragRatio] = React.useState(null);
    const [menuPos, setMenuPos] = React.useState(null);
    const [toast, setToast] = React.useState(null);
    const [selectionFocus, setSelectionFocus] = React.useState(false);

    const rootRef = React.useRef(null);
    const triggerRef = React.useRef(null);
    const menuRef = React.useRef(null);
    const trackRef = React.useRef(null);
    const searchRef = React.useRef(null);
    const groupsRef = React.useRef(null);
    const keyTimer = React.useRef(null);
    const toastSeq = React.useRef(0);
    const lastAction = React.useRef("load");
    const id = React.useId();

    const groups = React.useMemo(() => {
      const source = Array.isArray(state.groups) ? state.groups : [];
      return source
        .map((group) => ({ ...group, models: Array.isArray(group.models) ? group.models : [] }))
        .sort((left, right) => providerRank(left.id) - providerRank(right.id));
    }, [state.groups]);

    const choices = React.useMemo(
      () => groups.flatMap((group) => group.models.map((model) => ({ group, model }))),
      [groups],
    );
    const showSearch = choices.length > 4;

    const current = state.current ?? null;
    const currentChoice =
      current === null
        ? undefined
        : choices.find((entry) => entry.group.id === current.provider && entry.model.id === current.model);
    const reasoning = currentChoice === undefined ? undefined : currentChoice.model.reasoning;
    const efforts = React.useMemo(
      () => (reasoning !== undefined && Array.isArray(reasoning.efforts) ? reasoning.efforts.filter((level) => level && typeof level.id === "string") : []),
      [reasoning],
    );
    const effectiveEffort = current === null ? undefined : current.reasoningEffort ?? reasoning?.defaultEffort;
    const effortIndex = efforts.findIndex((level) => level.id === effectiveEffort);
    const effortLabel =
      currentChoice === undefined
        ? undefined
        : reasoning === undefined
          ? state.retainedEffort
          : effortIndex >= 0
            ? efforts[effortIndex].name
            : effectiveEffort === undefined
              ? TEXT.providerDefault
              : effectiveEffort;

    const pending = state.pending ?? null;
    const busy = pending !== null;
    const pendingEffortIndex = (() => {
      if (pending === null || current === null) return -1;
      if (pending.provider !== current.provider || pending.model !== current.model) return -1;
      return efforts.findIndex((level) => level.id === pending.reasoningEffort);
    })();
    const settledIndex = effortIndex >= 0 ? effortIndex : efforts.length > 0 ? 0 : -1;
    const displayIndex = dragIndex !== null ? dragIndex : pendingEffortIndex >= 0 ? pendingEffortIndex : settledIndex;
    const indexRatio = (index) =>
      efforts.length <= 1 ? 0 : Math.max(0, Math.min(index, efforts.length - 1)) / (efforts.length - 1);
    /* 拇指 / 填充的位置：平滑拖动时用连续 ratio，其余按最近档取整。 */
    const ratio = dragRatio !== null ? dragRatio : indexRatio(displayIndex);
    const lastIndex = Math.max(0, efforts.length - 1);
    /**
     * Codex 满档特效强度（0–1）：
     *   - 平滑拖动：从「最近档刚落到最高档」的分界线起，随指针靠近右端连续升高；
     *   - 逐档 / 点刻度 / 键盘：只给 0 或 1，淡入淡出交给 CSS 的 opacity 过渡。
     * 两种拖动方式都不会在跨进最高档时硬切。
     */
    const flowIntensity = (() => {
      if (styleId !== "codex" || efforts.length <= 1) return 0;
      if (dragRatio !== null) {
        const zoneStart = (lastIndex - 0.5) / lastIndex;
        const t = Math.min(1, Math.max(0, (dragRatio - zoneStart) / (1 - zoneStart)));
        return t * t * (3 - 2 * t);
      }
      return displayIndex >= lastIndex ? 1 : 0;
    })();

    const filteredGroups = React.useMemo(
      () =>
        groups
          .map((group) => ({ ...group, models: rankByName(group.models, showSearch ? query.trim() : "") }))
          .filter((group) => group.models.length > 0),
      [groups, query, showSearch],
    );
    const visibleModels = React.useMemo(
      () => filteredGroups.flatMap((group) => group.models.map((model) => ({ group, model }))),
      [filteredGroups],
    );
    const currentVisibleIndex = visibleModels.findIndex(
      (entry) => entry.group.id === current?.provider && entry.model.id === current.model,
    );
    const activeModelIndex = Math.min(
      highlighted ?? Math.max(0, currentVisibleIndex),
      Math.max(0, visibleModels.length - 1),
    );

    const waiting = currentChoice === undefined && state.status === "loading";
    const modelLabel = waiting
      ? TEXT.triggerLoading
      : currentChoice?.model.name ?? TEXT.triggerFallback;
    const triggerTitle = effortLabel === undefined ? modelLabel : `${modelLabel} · ${effortLabel}`;
    const triggerAria =
      effortLabel === undefined
        ? `${TEXT.ariaTrigger}：${modelLabel}`
        : `${TEXT.ariaTrigger}：${modelLabel}，${TEXT.effort} ${effortLabel}`;

    const showToast = (text) => {
      toastSeq.current += 1;
      setToast({ seq: toastSeq.current, text });
    };

    /* ── 打开 / 关闭 ─────────────────────────────────────────────────── */
    const show = () => {
      setQuery("");
      setHighlighted(null);
      setDragIndex(null);
      setDragRatio(null);
      setSelectionFocus(false);
      setPane(currentChoice === undefined ? "model" : "root");
      setOpen(true);
      lastAction.current = "load";
      load();
      triggerRef.current?.focus();
    };

    const close = (restoreFocus = false) => {
      setOpen(false);
      setPane("root");
      setQuery("");
      setHighlighted(null);
      setDragIndex(null);
      setDragRatio(null);
      if (keyTimer.current !== null) {
        clearTimeout(keyTimer.current);
        keyTimer.current = null;
      }
      if (restoreFocus) queueMicrotask(() => triggerRef.current?.focus());
    };

    React.useEffect(() => {
      if (!open) return undefined;
      const outside = (event) => {
        const target = event.target;
        if (rootRef.current?.contains(target) === true) return;
        if (menuRef.current?.contains(target) === true) return;
        close(false);
      };
      document.addEventListener("mousedown", outside, true);
      return () => document.removeEventListener("mousedown", outside, true);
    }, [open]);

    /* 打开时把焦点放到模型格（没有当前模型就直接进模型列表）。 */
    React.useEffect(() => {
      if (!open) return;
      if (currentChoice === undefined) return;
      const target = menuRef.current?.querySelector('[data-dts="model-cell"]');
      if (target !== null && target !== undefined && typeof target.focus === 'function') target.focus();
    }, [open, currentChoice]);

    /* 下钻到模型列表：有搜索框就聚焦搜索框（原生同款行为）。 */
    React.useEffect(() => {
      if (!open || pane !== "model" || !showSearch) return;
      searchRef.current?.focus();
    }, [open, pane, showSearch]);

    React.useEffect(() => {
      const viewport = groupsRef.current;
      if (viewport === null || typeof observeStickyMenuGroups !== "function") return undefined;
      return observeStickyMenuGroups(viewport);
    }, [open, pane, filteredGroups]);

    React.useEffect(() => () => {
      if (keyTimer.current !== null) clearTimeout(keyTimer.current);
    }, []);

    /* 座位真的渲染出来了才报这一句：注册成功但组件崩了的话，状态会停在
       「已接管（等待座位渲染）」，设置面板一眼能看出是渲染问题。 */
    React.useEffect(() => {
      if (typeof report !== "function") return;
      report(available ? "已接管（座位已渲染）" : "会话不可用（subagent 不显示）");
    }, [available]);

    /* ── 菜单定位：贴在触发按钮上方，越界就收进视口 ──────────────────── */
    React.useLayoutEffect(() => {
      if (!open) {
        setMenuPos(null);
        return undefined;
      }
      const place = () => {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (rect === undefined) return;
        const MARGIN = 12;
        const width = menuRef.current?.offsetWidth ?? 0;
        const height = menuRef.current?.offsetHeight ?? 0;
        let x = rect.right - width;
        let y = rect.top - 8 - height;
        if (width > 0) x = Math.min(Math.max(x, MARGIN), window.innerWidth - width - MARGIN);
        if (height > 0) y = Math.min(Math.max(y, MARGIN), window.innerHeight - height - MARGIN);
        setMenuPos({ left: x, top: y });
      };
      place();
      window.addEventListener("scroll", place, true);
      window.addEventListener("resize", place);
      const observer = typeof ResizeObserver !== "undefined" && menuRef.current !== null ? new ResizeObserver(place) : null;
      if (menuRef.current !== null) observer?.observe(menuRef.current);
      return () => {
        observer?.disconnect();
        window.removeEventListener("scroll", place, true);
        window.removeEventListener("resize", place);
      };
    }, [open, pane, query, state, filteredGroups]);

    /* ── 提交 ─────────────────────────────────────────────────────────── */
    const settle = (result, onSuccess) => {
      if (result === undefined) return;
      if (result.ok) {
        onSuccess();
        return;
      }
      const code = result.error?.code;
      showToast(code === "session/writer-held" ? TEXT.toastWriterHeld : `${TEXT.toastSelectFailed}：${result.error?.message ?? code ?? ""}`);
    };

    const pickEffortFor = (model) => {
      const target = model.reasoning;
      if (target === undefined || !Array.isArray(target.efforts) || target.efforts.length === 0) return undefined;
      if (effectiveEffort !== undefined && target.efforts.some((level) => level.id === effectiveEffort)) return effectiveEffort;
      const from = efforts.findIndex((level) => level.id === effectiveEffort);
      if (from < 0) return target.defaultEffort;
      const index = Math.min(from, target.efforts.length - 1);
      return target.efforts[index]?.id;
    };

    const chooseModel = (group, model) => {
      if (busy) return;
      const nextEffort = pickEffortFor(model);
      const selection = {
        provider: group.id,
        model: model.id,
        ...(nextEffort === undefined ? {} : { reasoningEffort: nextEffort }),
      };
      lastAction.current = "select";
      setSelectionFocus(true);
      triggerRef.current?.focus();
      Promise.resolve(select(selection)).then((result) =>
        settle(result, () => close(true)),
      );
    };

    const commitIndex = (index) => {
      setDragRatio(null);
      if (busy || current === null) {
        setDragIndex(null);
        return;
      }
      if (efforts.length === 0) {
        setDragIndex(null);
        return;
      }
      const level = efforts[Math.max(0, Math.min(index, efforts.length - 1))];
      setDragIndex(null);
      if (level === undefined || level.id === effectiveEffort) return;
      lastAction.current = "select";
      const selection = {
        provider: current.provider,
        model: current.model,
        reasoningEffort: level.id,
      };
      Promise.resolve(select(selection)).then((result) => settle(result, () => {}));
    };

    const scheduleCommit = (index) => {
      setDragIndex(index);
      if (keyTimer.current !== null) clearTimeout(keyTimer.current);
      keyTimer.current = setTimeout(() => {
        keyTimer.current = null;
        commitIndex(index);
      }, 200);
    };

    /* ── 滑条指针 / 键盘 ─────────────────────────────────────────────── */
    const ratioAt = (clientX) => {
      const track = trackRef.current;
      if (track === null) return 0;
      const rect = track.getBoundingClientRect();
      const pad = geometry.pad;
      const span = Math.max(1, rect.width - pad * 2);
      return Math.min(1, Math.max(0, (clientX - rect.left - pad) / span));
    };

    const indexAt = (clientX) => Math.round(ratioAt(clientX) * Math.max(0, efforts.length - 1));

    const onTrackPointerDown = (event) => {
      if (busy || efforts.length === 0) return;
      event.preventDefault();
      trackRef.current?.focus();
      trackRef.current?.setPointerCapture?.(event.pointerId);
      const next = ratioAt(event.clientX);
      setDragIndex(Math.round(next * (efforts.length - 1)));
      /* 逐档模式不存连续位置：拇指直接落到刻度上。 */
      setDragRatio(smooth ? next : null);
    };

    const onTrackPointerMove = (event) => {
      if (dragIndex === null && dragRatio === null) return;
      const next = ratioAt(event.clientX);
      setDragIndex(Math.round(next * Math.max(0, efforts.length - 1)));
      if (smooth) setDragRatio(next);
    };

    const onTrackPointerUp = (event) => {
      if (dragIndex === null && dragRatio === null) return;
      trackRef.current?.releasePointerCapture?.(event.pointerId);
      /* 松手一律按最近档提交；平滑模式顺便把拇指交还给吸附动画。 */
      commitIndex(indexAt(event.clientX));
    };

    const onTrackKeyDown = (event) => {
      if (event.nativeEvent?.isComposing || efforts.length === 0 || busy) return;
      const base = dragIndex ?? displayIndex;
      const last = efforts.length - 1;
      let next = null;
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = Math.max(0, base - 1);
      else if (event.key === "ArrowRight" || event.key === "ArrowUp") next = Math.min(last, base + 1);
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = last;
      if (next === null) return;
      event.preventDefault();
      /* 键盘从「平滑拖动中的最近档」接管：先收掉连续位置，再走 200ms 防抖提交。 */
      setDragRatio(null);
      scheduleCommit(next);
    };

    /* ── 根容器键盘：Esc / Shift+Tab ─────────────────────────────────── */
    const onRootKeyDown = (event) => {
      if (event.nativeEvent?.isComposing) return;
      if (event.key === "Escape" && open) {
        event.preventDefault();
        if (pane !== "root") {
          setPane("root");
          setQuery("");
          setHighlighted(null);
          return;
        }
        close(true);
        return;
      }
      if (event.key === "Tab" && event.shiftKey && open) {
        event.preventDefault();
        close(true);
      }
    };

    if (!available) return null;

    /* ── 碎片 ─────────────────────────────────────────────────────────── */
    const modelCell = h(
      "button",
      {
        type: "button",
        role: "menuitem",
        "data-dts": "model-cell",
        className: "dts-cell",
        onClick: () => {
          setQuery("");
          setHighlighted(null);
          setPane("model");
        },
      },
      h("span", { className: "dts-cellLabel" }, TEXT.model),
      h(
        "span",
        { className: "dts-cellValue" },
        h(
          "span",
          {
            "data-provider-id": currentChoice?.group.id,
            "data-model-id": currentChoice?.model.id,
          },
          currentChoice === undefined ? modelLabel : currentChoice.model.name,
        ),
      ),
      h(IconChevronRightOutlineRegular, { className: "dts-cellChevron" }),
    );

    const effortsEmpty = currentChoice !== undefined && efforts.length === 0;
    const effortBand =
      currentChoice === undefined
        ? null
        : effortsEmpty
          ? h("div", { className: "dts-empty", role: "status" }, TEXT.noEffort)
          : h(
              "div",
              { className: "dts-band" },
              h(
                "div",
                { className: "dts-bandHead" },
                h("span", { className: "dts-bandLabel" }, TEXT.effort),
                h("span", { className: "dts-bandValue", "aria-live": "polite" }, dragIndex !== null ? efforts[dragIndex]?.name ?? effortLabel : effortLabel),
              ),
              h(
                "div",
                { className: "dts-scale", style: scaleVars },
                h(
                  "div",
                  {
                    ref: trackRef,
                    className: "dts-track" + (busy ? " dts-track--busy" : ""),
                    role: "slider",
                    "data-dts-dragging": dragIndex !== null ? "" : undefined,
                    "data-dts-busy": busy ? "" : undefined,
                    tabIndex: locked ? -1 : 0,
                    "aria-label": TEXT.ariaSlider,
                    "aria-valuemin": 0,
                    "aria-valuemax": Math.max(0, efforts.length - 1),
                    "aria-valuenow": Math.max(0, displayIndex),
                    "aria-valuetext": efforts[Math.max(0, displayIndex)]?.name ?? TEXT.effort,
                    "aria-disabled": busy || undefined,
                    onPointerDown: onTrackPointerDown,
                    onPointerMove: onTrackPointerMove,
                    onPointerUp: onTrackPointerUp,
                    onPointerCancel: () => {
                      setDragIndex(null);
                      setDragRatio(null);
                    },
                    onKeyDown: onTrackKeyDown,
                  },
                  h("span", { className: "dts-rail", "aria-hidden": "true" }),
                  h(
                    "span",
                    {
                      className: "dts-fill",
                      "aria-hidden": "true",
                      style: { width: sliderPosition(ratio) },
                    },
                    styleId === "codex" && efforts.length > 1
                      ? h(
                          "span",
                          {
                            className: "dts-flow",
                            "aria-hidden": "true",
                            "data-dts-flow-follow": dragRatio !== null ? "" : undefined,
                            style: { opacity: flowIntensity },
                          },
                          h("span", { className: "dts-flowSheen" }),
                          FLOW_PARTICLES.map((particle, index) =>
                            h(
                              "span",
                              {
                                key: index,
                                className: "dts-flowPath",
                                style: {
                                  "--dts-flow-top": `${particle.top}px`,
                                  "--dts-flow-duration": `${particle.duration}s`,
                                  "--dts-flow-delay": `${particle.delay}s`,
                                },
                              },
                              h("i", {}),
                            ),
                          ),
                        )
                      : null,
                  ),
                  efforts.map((level, index) =>
                    h("span", {
                      key: level.id,
                      className:
                        "dts-dot" +
                        (index <= displayIndex ? " dts-dot--on" : "") +
                        (index === efforts.length - 1 ? " dts-dot--last" : ""),
                      "aria-hidden": "true",
                      style: { left: sliderPosition(index / Math.max(1, efforts.length - 1)) },
                    }),
                  ),
                  h("span", {
                    className: "dts-thumb",
                    "aria-hidden": "true",
                    style: { left: sliderPosition(ratio) },
                  }),
                ),
                styleId === "claude"
                  ? h(
                      "div",
                      { className: "dts-axis", "aria-hidden": "true" },
                      h("span", null, "Faster"),
                      h("span", null, "Smarter"),
                    )
                  : h(
                      "div",
                      { className: "dts-ticks" },
                      efforts.map((level, index) =>
                        h(
                          "button",
                          {
                            key: level.id,
                            type: "button",
                            tabIndex: -1,
                            "aria-label": level.name,
                            className: "dts-tick" + (index === displayIndex ? " dts-tick--on" : ""),
                            onClick: () => {
                              if (!busy) commitIndex(index);
                            },
                          },
                          level.name,
                        ),
                      ),
                    ),
              ),
            );

    const searchRow = showSearch
      ? h(
          "div",
          { className: "dts-searchRow" },
          h(Input, {
            ref: searchRef,
            className: "dts-search" + (query !== "" ? " dts-search--filled" : ""),
            type: "text",
            role: "searchbox",
            "aria-label": TEXT.search,
            "aria-controls": `${id}-models`,
            "aria-activedescendant": activeModelIndex < 0 || visibleModels.length === 0 ? undefined : `${id}-model-${activeModelIndex}`,
            placeholder: TEXT.search,
            value: query,
            readOnly: busy,
            onChange: (event) => {
              setQuery(event.target.value);
              setHighlighted(0);
            },
            onKeyDown: (event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                if (busy || visibleModels.length === 0) return;
                const offset = event.key === "ArrowDown" ? 1 : -1;
                setHighlighted((activeModelIndex + offset + visibleModels.length) % visibleModels.length);
                return;
              }
              if (event.key === "Enter" || (event.key === "Tab" && !event.shiftKey)) {
                if (busy) return;
                const entry = visibleModels[activeModelIndex];
                if (entry === undefined) return;
                event.preventDefault();
                chooseModel(entry.group, entry.model);
              }
            },
          }),
          query !== ""
            ? h(
                "button",
                {
                  type: "button",
                  className: "dts-searchClear",
                  "aria-label": TEXT.searchClear,
                  onClick: () => {
                    setQuery("");
                    setHighlighted(0);
                    searchRef.current?.focus();
                  },
                },
                h(IconCloseFillRegular, {}),
              )
            : null,
        )
      : null;

    const loadError =
      state.error !== null && lastAction.current === "load"
        ? h(
            "div",
            { className: "dts-error", role: "status" },
            h("span", null, `${TEXT.loadFailed}：${state.error}`),
            h(
              "button",
              {
                type: "button",
                className: "dts-retry",
                onClick: () => {
                  lastAction.current = "load";
                  load();
                },
              },
              TEXT.retry,
            ),
          )
        : null;

    const failures = Array.isArray(state.failures)
      ? state.failures.map((failure) =>
          h(
            "div",
            { className: "dts-warning", role: "status", key: failure.id },
            h(
              "span",
              null,
              `「${failure.id === ACCOUNT_PROVIDER ? "DeepSeek 账号" : failure.name ?? failure.id}」加载失败：${failure.message ?? ""}`,
            ),
            h(
              "button",
              {
                type: "button",
                className: "dts-retry",
                onClick: () => {
                  lastAction.current = "load";
                  load();
                },
              },
              TEXT.retry,
            ),
          ),
        )
      : null;

    const modelPane = h(
      Fragment,
      null,
      searchRow,
      state.status === "loading"
        ? h("div", { className: "dts-status", role: "status" }, TEXT.loadingCatalog)
        : null,
      loadError,
      failures,
      h(
        "div",
        {
          ref: groupsRef,
          id: `${id}-models`,
          className: "dts-groups scrollable",
          role: "menu",
          "aria-label": TEXT.ariaModelList,
          hidden: filteredGroups.length === 0,
        },
        filteredGroups.map((group) =>
          h(
            MenuGroup,
            { label: group.name, key: group.id },
            group.models.map((model) => {
              const index = visibleModels.findIndex(
                (entry) => entry.group.id === group.id && entry.model.id === model.id,
              );
              const selected = current?.provider === group.id && current.model === model.id;
              const pendingModel =
                pending !== null && pending.provider === group.id && pending.model === model.id;
              return h(
                "button",
                {
                  key: model.id,
                  type: "button",
                  role: "menuitemradio",
                  "aria-checked": selected,
                  id: `${id}-model-${index}`,
                  "data-highlighted": index === activeModelIndex ? "" : undefined,
                  className:
                    "dts-option" +
                    (selected ? " dts-option--selected" : "") +
                    (index === activeModelIndex ? " dts-option--active" : ""),
                  title: model.name,
                  disabled: busy,
                  onMouseMove: () => {
                    if (showSearch && index !== activeModelIndex) setHighlighted(index);
                  },
                  onClick: () => chooseModel(group, model),
                },
                h("span", { className: "dts-optionCopy" }, h("span", { className: "dts-modelName", "data-provider-id": group.id, "data-model-id": model.id }, model.name)),
                h(
                  "span",
                  { className: "dts-check" },
                  pendingModel ? h(StateDot, { state: "ongoing" }) : selected ? h(IconCheckOutlineRegular, {}) : null,
                ),
              );
            }),
          ),
        ),
      ),
      state.status === "ready" && filteredGroups.length === 0
        ? h("div", { className: "dts-status", role: "status" }, choices.length === 0 ? TEXT.emptyCatalog : TEXT.emptySearch)
        : null,
    );

    const menu = open
      ? createPortal(
          h(
            MenuSurface,
            {
              ref: menuRef,
              id: `${id}-menu`,
              className: "dts-menu",
              "data-dts-style": styleId,
              style: { ...(menuPos ?? MEASURE_STYLE), ...colorVars },
              role: pane === "model" ? "group" : "menu",
              "aria-label": TEXT.ariaMenu,
              "aria-busy": state.status === "loading" || busy,
            },
            pane === "root" ? h(Fragment, null, modelCell, effortBand) : modelPane,
          ),
          document.body,
        )
      : null;

    return h(
      "div",
      { ref: rootRef, className: "dts-root", "data-dts-style": styleId, onKeyDown: onRootKeyDown },
      h(
        "button",
        {
          ref: triggerRef,
          type: "button",
          className: "dts-trigger",
          "aria-label": triggerAria,
          "aria-haspopup": "menu",
          "aria-expanded": open,
          "aria-controls": open ? `${id}-menu` : undefined,
          "aria-busy": busy,
          "data-selection-focus": selectionFocus ? "" : undefined,
          title: triggerTitle,
          disabled: locked,
          onBlur: () => setSelectionFocus(false),
          onClick: () => {
            if (open) close(true);
            else show();
          },
        },
        h("span", { className: "dts-triggerLabel" }, currentChoice === undefined ? modelLabel : currentChoice.model.name),
        effortLabel === undefined ? null : h("span", { className: "dts-triggerEffort" }, effortLabel),
        busy
          ? h(StateDot, { state: "ongoing" })
          : h(IconChevronDownOutlineRegular, { className: "dts-chevron" + (open ? " dts-chevron--open" : "") }),
      ),
      menu,
      toast !== null
        ? h(Toast, {
            key: toast.seq,
            text: toast.text,
            icon: h(IconWarningOutlineRegular, {}),
            anchor: rootRef.current?.closest("[data-composer-card]") ?? null,
            onDone: () => setToast(null),
          })
        : null,
    );
  }

  ThinkingSliderSeat.displayName = "ThinkingSliderSeat";
  return ThinkingSliderSeat;
}

/* ── 插件本体 ─────────────────────────────────────────────────────────── */

const MODES = [
  { id: "on", label: "开" },
  { id: "off", label: "关" },
];

function normalizeStyle(value) {
  return SLIDER_STYLES.some((entry) => entry.id === value) ? value : DEFAULT_SLIDER_STYLE;
}

function normalizeDrag(value) {
  return value === "smooth" ? "smooth" : DEFAULT_SLIDER_DRAG;
}

function storedStyle() {
  try {
    return normalizeStyle(window.localStorage.getItem(STYLE_KEY));
  } catch {
    return DEFAULT_SLIDER_STYLE;
  }
}

function rememberStyle(value) {
  try {
    window.localStorage.setItem(STYLE_KEY, value);
  } catch {
    /* 存不了就只在本次运行里生效 */
  }
}

/** 平滑是手感开关：存 `smooth` / `step`，读出来归一成布尔。 */
function storedSmooth() {
  try {
    return normalizeDrag(window.localStorage.getItem(SMOOTH_KEY)) === "smooth";
  } catch {
    return DEFAULT_SLIDER_DRAG === "smooth";
  }
}

function rememberSmooth(value) {
  try {
    window.localStorage.setItem(SMOOTH_KEY, value ? "smooth" : "step");
  } catch {
    /* 存不了就只在本次运行里生效 */
  }
}

function sanitizeColors(raw) {
  const out = {};
  if (raw === null || typeof raw !== "object") return out;
  for (const styleId of ["compact", "claude", "codex"]) {
    const source = raw[styleId];
    if (source === null || typeof source !== "object") continue;
    for (const slot of COLOR_SLOTS) {
      const value = source[slot.id];
      if (typeof value === "string" && HEX_COLOR.test(value)) {
        out[styleId] ??= {};
        out[styleId][slot.id] = value.toLowerCase();
      }
    }
  }
  return out;
}

function storedColors() {
  try {
    return sanitizeColors(JSON.parse(window.localStorage.getItem(COLORS_KEY) || "{}"));
  } catch {
    return {};
  }
}

function rememberColors(value) {
  try {
    window.localStorage.setItem(COLORS_KEY, JSON.stringify(value));
  } catch {
    /* 存不了就只在本次运行里生效 */
  }
}

function storedEnabled() {
  try {
    return window.localStorage.getItem(ENABLED_KEY) !== "off";
  } catch {
    return true;
  }
}

function rememberEnabled(value) {
  try {
    window.localStorage.setItem(ENABLED_KEY, value ? "on" : "off");
  } catch {
    /* 存不了就只在本次运行里生效 */
  }
}

function installStyles(ctx) {
  if (typeof document === "undefined") return;
  ctx.effect(() => {
    const tag = document.createElement("style");
    tag.dataset.plugin = PLUGIN_ID;
    tag.textContent = CSS;
    document.head.appendChild(tag);
    return () => {
      tag.remove();
    };
  }, "thinking-slider: stylesheet");
}

function ColorRow(props) {
  const value = props.value ?? props.fallback;
  return h(
    "label",
    { className: "dts-colorRow" },
    h("span", { className: "dts-colorLabel" }, props.label),
    h("input", {
      type: "color",
      className: "dts-colorInput",
      value,
      "aria-label": `${props.label}颜色`,
      onChange: (event) => props.onPick(event.target.value),
    }),
    h("span", { className: "dts-colorValue" }, value.toUpperCase()),
  );
}

function ColorSection(props) {
  const defaults = DEFAULT_COLORS[props.appearance] ?? {};
  const main = COLOR_SLOTS.filter((slot) => slot.main);
  const detail = COLOR_SLOTS.filter(
    (slot) => !slot.main && (slot.id !== "particle" || props.appearance === "codex"),
  );
  const row = (slot) =>
    h(ColorRow, {
      key: slot.id,
      label: slot.label,
      value: props.palette[slot.id],
      fallback: defaults[slot.id],
      onPick: (value) => props.onPick(slot.id, value),
    });
  return h(
    "div",
    { className: "dts-colors" },
    h(
      "div",
      { className: "dts-colorsHead" },
      h("span", { className: "dts-settings-label" }, "颜色"),
      h(
        "button",
        { type: "button", className: "dts-colorReset", onClick: () => props.onReset() },
        "恢复默认",
      ),
    ),
    main.map(row),
    detail.length > 0
      ? h(
          "details",
          { className: "dts-colorsDetails" },
          h("summary", null, "详细配置"),
          detail.map(row),
        )
      : null,
    h("span", { className: "dts-colorsHint" }, props.hint),
  );
}

function SettingsPanel(props) {
  const [state, setState] = React.useState(() => ({
    enabled: props.getEnabled(),
    status: props.getStatus(),
    style: props.getStyle(),
    colors: props.getColors(),
    smooth: props.getSmooth(),
  }));
  React.useEffect(() => {
    const read = () =>
      setState({
        enabled: props.getEnabled(),
        status: props.getStatus(),
        style: props.getStyle(),
        colors: props.getColors(),
        smooth: props.getSmooth(),
      });
    read();
    return props.subscribe(read);
  }, [props]);
  const enabled = state.enabled;
  const style = normalizeStyle(state.style);
  const smooth = Boolean(state.smooth);
  const palette = state.colors?.[style] ?? {};
  const status = String(state.status ?? "");
  const showStatus = enabled && status !== "" && !status.startsWith("已接管");
  return h(
    "div",
    { className: "dts-settings" },
    h(
      "div",
      { className: "dts-settings-head" },
      h("span", { className: "dts-settings-title" }, "模型位 · 思考强度"),
      h("span", { className: "dts-settings-sub" }, "composer 的模型菜单换成模型行 + 强度滑条"),
    ),
    h(
      "div",
      { className: "dts-settings-row" },
      h("span", { className: "dts-settings-label" }, "接管"),
      MODES.map((mode) =>
        h(
          "button",
          {
            key: mode.id,
            type: "button",
            className: "dts-chip" + (enabled === (mode.id === "on") ? " dts-chip--on" : ""),
            "aria-pressed": enabled === (mode.id === "on"),
            onClick: () => props.selectEnabled(mode.id),
          },
          mode.label,
        ),
      ),
      h("span", { className: "dts-settings-hint" }, enabled ? "模型位由本插件接管" : "使用 DSH 原生模型菜单"),
    ),
    h(
      "div",
      { className: "dts-settings-row" },
      h("span", { className: "dts-settings-label" }, "外观"),
      SLIDER_STYLES.map((entry) =>
        h(
          "button",
          {
            key: entry.id,
            type: "button",
            className: "dts-chip" + (style === entry.id ? " dts-chip--on" : ""),
            "aria-pressed": style === entry.id,
            onClick: () => props.selectStyle(entry.id),
          },
          entry.label,
        ),
      ),
      h("span", { className: "dts-settings-hint" }, "只改滑条材质，不改档位与提交"),
    ),
    h(
      "div",
      { className: "dts-settings-row" },
      h("span", { className: "dts-settings-label" }, "滑动"),
      SLIDER_DRAGS.map((entry) =>
        h(
          "button",
          {
            key: entry.id,
            type: "button",
            className: "dts-chip" + (smooth === (entry.id === "smooth") ? " dts-chip--on" : ""),
            "aria-pressed": smooth === (entry.id === "smooth"),
            onClick: () => props.selectSmooth(entry.id === "smooth"),
          },
          entry.label,
        ),
      ),
      h(
        "span",
        { className: "dts-settings-hint" },
        smooth ? "拖动跟手，松手吸附最近档；提交仍是离散档位" : "指针始终吸在刻度上，拖到哪就是哪一档",
      ),
    ),
    h(ColorSection, {
      appearance: style,
      palette,
      hint:
        style === "compact"
          ? "紧凑默认跟随主题；改动某个槽后，该槽覆盖主题色。"
          : "自定义颜色深浅共用；不改为各主题默认。",
      onPick: (slot, value) => props.selectColor(style, slot, value),
      onReset: () => props.resetColors(style),
    }),
    showStatus ? h("div", { className: "dts-settings-status" }, "未接管：" + status) : null,
  );
}

const inject = ["slots"];

function apply(ctx) {
  installStyles(ctx);

  let seatRetries = 0;
  if (typeof ctx.slots.onEntryError === "function") {
    ctx.effect(
      () =>
        ctx.slots.onEntryError((key, registration, error, retired) => {
          /* 冷启动竞态：宿主的 ModelDirectoryResolver 会在 remote.session 就绪前抛错，
             我们的条目比原生早渲染几毫秒，会被错误边界退役。等一拍换条新条目重来。 */
          if (String(key) !== "conversation.input.model") return;
          if (registration?.component?.displayName !== "ThinkingSliderSeat") return;
          if (seatRetries >= 3) return;
          seatRetries += 1;
          setTimeout(() => {
            release();
            sync();
          }, 300);
        }),
      "thinking-slider: entry-error",
    );
  }


  let enabled = storedEnabled();
  let style = storedStyle();
  let colors = storedColors();
  let smooth = storedSmooth();
  let status = "尚未初始化";
  let services = null;
  let slotReady = false;
  let seatDispose = null;
  const listeners = new Set();
  const styleStore = {
    get: () => style,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set: (id) => {
      const next = normalizeStyle(id);
      if (next === style) return;
      style = next;
      rememberStyle(next);
      for (const fn of listeners) fn();
    },
  };
  const colorStore = {
    get: () => colors,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set: (styleId, slotId, value) => {
      if (styleId !== "compact" && styleId !== "claude" && styleId !== "codex") return;
      if (!COLOR_SLOTS.some((slot) => slot.id === slotId)) return;
      if (typeof value !== "string" || !HEX_COLOR.test(value)) return;
      const next = {
        ...colors,
        [styleId]: { ...(colors[styleId] ?? {}), [slotId]: value.toLowerCase() },
      };
      colors = next;
      rememberColors(next);
      for (const fn of listeners) fn();
    },
    reset: (styleId) => {
      if (styleId !== "compact" && styleId !== "claude" && styleId !== "codex") return;
      if (colors[styleId] === undefined) return;
      const next = { ...colors };
      delete next[styleId];
      colors = next;
      rememberColors(next);
      for (const fn of listeners) fn();
    },
  };

  const setStatus = (text) => {
    const next = String(text ?? "");
    if (next.startsWith("已接管（座位已渲染）")) seatRetries = 0;
    if (next === status) return;
    status = next;
    for (const fn of listeners) fn();
  };
  const smoothStore = {
    get: () => smooth,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set: (value) => {
      const next = Boolean(value);
      if (next === smooth) return;
      smooth = next;
      rememberSmooth(next);
      for (const fn of listeners) fn();
    },
  };
  const release = () => {
    if (typeof seatDispose === "function") {
      const dispose = seatDispose;
      seatDispose = null;
      dispose();
    }
  };
  const sync = () => {
    if (!enabled) {
      setStatus("已关闭：使用原生菜单");
      release();
      return;
    }
    if (!slotReady) {
      setStatus("等待 conversation.input.model 槽位");
      release();
      return;
    }
    if (services === null) {
      setStatus("等待 modelDirectories / sessions 服务");
      release();
      return;
    }
    if (seatDispose !== null) return;
    try {
      seatDispose = registerThinkingSliderSeat(ctx, setStatus, services) ?? null;
    } catch (error) {
      setStatus("注册异常：" + (error?.message ?? String(error)));
      console.warn("[thinking-slider] registration failed:", error);
    }
  };

  /* 服务在 apply 里先取好：槽位声明的 effect 里再开 ctx.inject 不可靠。 */
  try {
    ctx.inject(["modelDirectories", "sessions"], (scope) => {
      services = {
        models: scope.modelDirectories,
        sessions: scope.sessions,
        style: styleStore,
        colors: colorStore,
        smooth: smoothStore,
      };
      setStatus("modelDirectories / sessions 已就绪");
      sync();
    });
  } catch (error) {
    setStatus("订阅服务失败：" + (error?.message ?? String(error)));
  }

  ctx.slots.inject("conversation.input.model", () => {
    slotReady = true;
    setStatus("槽位已声明，准备注册");
    sync();
    return () => {
      slotReady = false;
      release();
    };
  });

  ctx.slots.inject("settings.section", () =>
    ctx.slots.register(
      {
        name: "settings.section",
        id: "thinking-slider",
        order: 60,
        label: () => "思考强度",
        inject: () => ({
          getEnabled: () => enabled,
          getStyle: () => style,
          selectStyle: (id) => styleStore.set(id),
          getColors: () => colors,
          selectColor: (styleId, slotId, value) => colorStore.set(styleId, slotId, value),
          resetColors: (styleId) => colorStore.reset(styleId),
          getSmooth: () => smooth,
          selectSmooth: (value) => smoothStore.set(value),
          selectEnabled: (id) => {
            enabled = id !== "off";
            rememberEnabled(enabled);
            sync();
            for (const fn of listeners) fn();
          },
          getStatus: () => status,
          subscribe: (fn) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
          },
        }),
      },
      SettingsPanel,
    ),
  );

  ctx.effect(() => () => {
    release();
    listeners.clear();
  }, "thinking-slider: cleanup");
}

module.exports = {
  inject,
  apply,
  __test: {
    createThinkingSliderSeat,
    registerThinkingSliderSeat,
    SettingsPanel,
    storedEnabled,
    storedStyle,
    storedColors,
    storedSmooth,
  },
};
