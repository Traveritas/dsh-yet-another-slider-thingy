window.__ModuleLoader__.load({ id: "dsh-thinking-slider", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
/**
 * dsh-thinking-slider —— 浏览器端 bundle（v0.1.0）
 *
 * 把 DSH composer 的模型位（`conversation.input.model`）换成「模型行 + 思考强度滑条」：
 * 模型行照旧下钻到分组列表，推理强度是带卡位的滑条。面板材质直接用宿主
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
const CSS = "/* ── 思考强度滑条 · dsh-thinking-slider ─────────────────────────────────\r\n   顶替 composer 的模型位（conversation.input.model）。尺寸 / 字重 / 行高\r\n   照抄官方 ModelSelect：触发器 28px、13px 字；菜单 4px 内边距、34px 行；\r\n   面板材质直接复用宿主 MenuSurface，这里只管排布与滑条本身。\r\n\r\n   颜色一律走宿主令牌（--dsw-*），所以任何主题、深浅模式都自动跟。\r\n   开关关闭、插件卸载、或组件渲染抛错时整段失效，座位回落原生。 */\r\n\r\n\r\n.dts-root {\r\n  position: relative;\r\n  display: flex;\r\n  min-width: 0;\r\n}\r\n\r\n/* ── 触发器：与原生模型位逐项对齐 ───────────────────────────────────── */\r\n.dts-trigger {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 4px;\r\n  height: 28px;\r\n  min-width: 0;\r\n  max-width: min(360px, 45cqw);\r\n  padding: 0 4px 0 8px;\r\n  border: none;\r\n  border-radius: var(--dsw-radius-sm);\r\n  background: none;\r\n  outline: none;\r\n  color: var(--dsw-alias-label-secondary);\r\n  font-size: 13px;\r\n  font-weight: 400;\r\n  line-height: 20px;\r\n  cursor: pointer;\r\n}\r\n\r\n.dts-trigger:hover:not(:disabled) {\r\n  background: var(--dsw-alias-interactive-bg-hover);\r\n}\r\n\r\n.dts-trigger:focus-visible:not([data-selection-focus]) {\r\n  box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));\r\n}\r\n\r\n.dts-trigger:disabled {\r\n  color: var(--dsw-alias-label-dimmed);\r\n  cursor: default;\r\n}\r\n\r\n.dts-triggerLabel {\r\n  min-width: 0;\r\n  overflow: hidden;\r\n  color: inherit;\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n\r\n.dts-triggerEffort {\r\n  flex-shrink: 1000;\r\n  min-width: 0;\r\n  overflow: hidden;\r\n  color: var(--dsw-alias-label-caption);\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n\r\n.dts-chevron {\r\n  flex: none;\r\n  color: var(--dsw-alias-label-caption);\r\n  transition: transform 0.12s ease;\r\n}\r\n\r\n.dts-chevron--open {\r\n  transform: rotate(180deg);\r\n}\r\n\r\n/* ── 菜单：材质交给 MenuSurface，这里只给尺寸与排布 ─────────────────── */\r\n.dts-menu {\r\n  position: fixed;\r\n  z-index: 1100;\r\n  display: flex;\r\n  flex-direction: column;\r\n  box-sizing: border-box;\r\n  width: 320px;\r\n  max-width: calc(100vw - 32px);\r\n  max-height: min(360px, calc(100vh - 96px));\r\n  padding: 4px;\r\n  overflow: hidden;\r\n  border: 0;\r\n  box-shadow: var(--dsw-elevation-prominent, 0 12px 32px rgba(0, 0, 0, 0.16));\r\n  color: var(--dsw-alias-label-primary);\r\n  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);\r\n  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2, rgba(128, 128, 128, 0.32));\r\n  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2, rgba(128, 128, 128, 0.48));\r\n}\r\n\r\n/* ── 模型格 ─────────────────────────────────────────────────────────── */\r\n.dts-cell {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 6px;\r\n  box-sizing: border-box;\r\n  width: auto;\r\n  min-width: 100%;\r\n  height: 34px;\r\n  padding: 0 8px;\r\n  border: none;\r\n  border-radius: var(--dsw-radius-md);\r\n  background: none;\r\n  outline: none;\r\n  color: inherit;\r\n  font-size: 13px;\r\n  line-height: 20px;\r\n  text-align: left;\r\n  cursor: pointer;\r\n}\r\n\r\n.dts-cell:hover,\r\n.dts-cell:focus-visible {\r\n  background: var(--dsw-alias-interactive-bg-hover);\r\n}\r\n\r\n.dts-cellLabel {\r\n  flex: none;\r\n  white-space: nowrap;\r\n}\r\n\r\n.dts-cellValue {\r\n  flex: auto;\r\n  min-width: 0;\r\n  overflow: hidden;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  text-align: right;\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n\r\n.dts-cellChevron {\r\n  flex: none;\r\n  width: 12px;\r\n  height: 12px;\r\n  color: var(--dsw-alias-menu-icon);\r\n}\r\n\r\n/* ── 强度带 ─────────────────────────────────────────────────────────── */\r\n.dts-band {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 2px;\r\n  padding: 4px 8px 6px;\r\n}\r\n\r\n.dts-bandHead {\r\n  display: flex;\r\n  align-items: baseline;\r\n  justify-content: space-between;\r\n  gap: 8px;\r\n  font-size: 13px;\r\n  line-height: 20px;\r\n}\r\n\r\n.dts-bandLabel {\r\n  flex: none;\r\n  color: var(--dsw-alias-label-primary);\r\n}\r\n\r\n.dts-bandValue {\r\n  min-width: 0;\r\n  overflow: hidden;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n\r\n.dts-scale {\r\n  position: relative;\r\n  padding-top: 4px;\r\n}\r\n\r\n.dts-track {\r\n  position: relative;\r\n  height: 20px;\r\n  border-radius: var(--dsw-radius-sm);\r\n  outline: none;\r\n  cursor: pointer;\r\n  touch-action: none;\r\n}\r\n\r\n.dts-track--busy {\r\n  cursor: progress;\r\n}\r\n\r\n.dts-rail,\r\n.dts-fill {\r\n  position: absolute;\r\n  top: 50%;\r\n  left: 6px;\r\n  height: 2px;\r\n  margin-top: -1px;\r\n  border-radius: 1px;\r\n  pointer-events: none;\r\n}\r\n\r\n.dts-rail {\r\n  right: 6px;\r\n  background: var(--dsw-alias-border-l1);\r\n}\r\n\r\n.dts-fill {\r\n  background: var(--dsw-alias-state-business-primary);\r\n}\r\n\r\n.dts-dot {\r\n  position: absolute;\r\n  top: 50%;\r\n  width: 4px;\r\n  height: 4px;\r\n  margin: -2px 0 0 -2px;\r\n  border-radius: 50%;\r\n  background: var(--dsw-alias-label-caption);\r\n  opacity: 0.55;\r\n  pointer-events: none;\r\n}\r\n\r\n.dts-dot--on {\r\n  background: var(--dsw-alias-state-business-primary);\r\n  opacity: 1;\r\n}\r\n\r\n.dts-thumb {\r\n  position: absolute;\r\n  top: 50%;\r\n  width: 12px;\r\n  height: 12px;\r\n  margin: -6px 0 0 -6px;\r\n  border-radius: 50%;\r\n  background: var(--dsw-alias-bg-base);\r\n  box-shadow:\r\n    0 0 0 2px var(--dsw-alias-state-business-primary),\r\n    var(--dsw-elevation-prominent, 0 2px 6px rgba(0, 0, 0, 0.16));\r\n  pointer-events: none;\r\n  transition: left 0.12s ease;\r\n}\r\n\r\n.dts-track--busy .dts-thumb {\r\n  opacity: 0.6;\r\n}\r\n\r\n.dts-track:focus-visible .dts-thumb {\r\n  box-shadow:\r\n    0 0 0 2px var(--dsw-alias-state-business-primary),\r\n    0 0 0 4px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));\r\n}\r\n\r\n.dts-ticks {\r\n  display: flex;\r\n  padding: 0 6px;\r\n}\r\n\r\n.dts-tick {\r\n  flex: 1;\r\n  min-width: 0;\r\n  padding: 0;\r\n  border: none;\r\n  background: none;\r\n  color: var(--dsw-alias-label-caption);\r\n  font: inherit;\r\n  font-size: 11px;\r\n  line-height: 16px;\r\n  text-align: center;\r\n  white-space: nowrap;\r\n  overflow: hidden;\r\n  text-overflow: ellipsis;\r\n  cursor: pointer;\r\n}\r\n\r\n.dts-tick:first-child {\r\n  text-align: left;\r\n}\r\n\r\n.dts-tick:last-child {\r\n  text-align: right;\r\n}\r\n\r\n.dts-tick:hover,\r\n.dts-tick--on {\r\n  color: var(--dsw-alias-label-primary);\r\n}\r\n\r\n/* ── 模型列表 ───────────────────────────────────────────────────────── */\r\n.dts-searchRow {\r\n  position: relative;\r\n  flex-shrink: 0;\r\n  margin: 2px 0 3px;\r\n}\r\n\r\n.dts-searchRow .dts-search {\r\n  display: flex;\r\n  height: auto;\r\n  padding: 5px 7px;\r\n  border: 0 solid transparent;\r\n  border-radius: var(--dsw-radius-md);\r\n  background: none;\r\n}\r\n\r\n.dts-searchRow .dts-search--filled {\r\n  padding-right: 34px;\r\n}\r\n\r\n.dts-searchRow .dts-search:focus-within {\r\n  border-color: transparent;\r\n}\r\n\r\n.dts-searchRow .dts-search input {\r\n  padding: 0;\r\n  font-size: 12px;\r\n  line-height: normal;\r\n}\r\n\r\n.dts-searchRow .dts-search input::placeholder {\r\n  color: var(--dsw-alias-label-caption);\r\n}\r\n\r\n.dts-searchClear {\r\n  position: absolute;\r\n  top: 50%;\r\n  right: 4px;\r\n  display: inline-flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  width: 24px;\r\n  height: 24px;\r\n  padding: 0;\r\n  border: none;\r\n  border-radius: 50%;\r\n  background: none;\r\n  color: var(--dsw-alias-label-secondary);\r\n  cursor: pointer;\r\n  transform: translateY(-50%);\r\n}\r\n\r\n.dts-searchClear:hover,\r\n.dts-searchClear:focus-visible {\r\n  background: var(--dsw-alias-interactive-bg-hover);\r\n  outline: none;\r\n}\r\n\r\n.dts-groups {\r\n  min-height: 0;\r\n  overflow-y: auto;\r\n}\r\n\r\n.dts-option {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 6px;\r\n  box-sizing: border-box;\r\n  width: auto;\r\n  min-width: 100%;\r\n  min-height: 34px;\r\n  padding: 5px 7px;\r\n  border: none;\r\n  border-radius: var(--dsw-radius-md);\r\n  background: none;\r\n  outline: none;\r\n  color: inherit;\r\n  text-align: left;\r\n  cursor: pointer;\r\n}\r\n\r\n.dts-option:hover:not(:disabled),\r\n.dts-option:focus-visible,\r\n.dts-option--active:not(:disabled) {\r\n  background: var(--dsw-alias-interactive-bg-hover);\r\n}\r\n\r\n.dts-option:disabled {\r\n  color: var(--dsw-alias-label-dimmed);\r\n  cursor: default;\r\n}\r\n\r\n.dts-optionCopy {\r\n  display: flex;\r\n  flex: 1;\r\n  flex-direction: column;\r\n  min-width: 0;\r\n}\r\n\r\n.dts-modelName {\r\n  overflow: hidden;\r\n  color: inherit;\r\n  font-size: 13px;\r\n  font-weight: 400;\r\n  line-height: 18px;\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n\r\n.dts-check {\r\n  display: grid;\r\n  flex: 0 0 14px;\r\n  place-items: center;\r\n  color: var(--dsw-alias-label-primary);\r\n}\r\n\r\n.dts-check svg {\r\n  width: 14px;\r\n  height: 14px;\r\n}\r\n\r\n/* ── 状态 / 错误 / 空 ──────────────────────────────────────────────── */\r\n.dts-status,\r\n.dts-empty {\r\n  padding: 8px;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font-size: 12px;\r\n  line-height: 18px;\r\n}\r\n\r\n.dts-empty {\r\n  padding: 6px 8px 8px;\r\n}\r\n\r\n.dts-error,\r\n.dts-warning {\r\n  display: flex;\r\n  align-items: flex-start;\r\n  justify-content: space-between;\r\n  gap: 6px;\r\n  margin-bottom: 3px;\r\n  padding: 6px 7px;\r\n  border-radius: var(--dsw-radius-md);\r\n  background: var(--dsw-alias-interactive-bg-hover-danger);\r\n  color: var(--dsw-alias-state-error-primary);\r\n  font-size: 11px;\r\n  line-height: 16px;\r\n}\r\n\r\n.dts-warning {\r\n  background: var(--dsw-alias-bg-module-platform);\r\n  color: var(--dsw-alias-state-warn-label);\r\n}\r\n\r\n.dts-retry {\r\n  flex: none;\r\n  padding: 0;\r\n  border: none;\r\n  background: none;\r\n  color: inherit;\r\n  font: inherit;\r\n  font-weight: 600;\r\n  cursor: pointer;\r\n}\r\n\r\n/* ── 设置页「思考强度」 ───────────────────────────────────────────────── */\r\n.dts-settings {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 10px;\r\n  padding: 2px 0 6px;\r\n}\r\n\r\n.dts-settings-head {\r\n  display: flex;\r\n  align-items: baseline;\r\n  gap: 10px;\r\n}\r\n\r\n.dts-settings-title {\r\n  font-size: 15px;\r\n  color: var(--dsw-alias-label-primary);\r\n}\r\n\r\n.dts-settings-sub {\r\n  font-size: 11px;\r\n  letter-spacing: 0.08em;\r\n  text-transform: uppercase;\r\n  color: var(--dsw-alias-label-tertiary);\r\n}\r\n\r\n.dts-settings-row {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  align-items: center;\r\n  gap: 8px;\r\n}\r\n\r\n.dts-settings-label {\r\n  font-size: 11px;\r\n  letter-spacing: 0.08em;\r\n  text-transform: uppercase;\r\n  color: var(--dsw-alias-label-secondary);\r\n}\r\n\r\n.dts-chip {\r\n  padding: 4px 10px;\r\n  border: 0.5px solid var(--dsw-alias-border-l2);\r\n  border-radius: var(--dsw-radius-lg);\r\n  background: transparent;\r\n  color: var(--dsw-alias-label-secondary);\r\n  font-size: 12px;\r\n  cursor: pointer;\r\n}\r\n\r\n.dts-chip:hover {\r\n  background: var(--dsw-alias-interactive-bg-hover);\r\n}\r\n\r\n.dts-chip--on {\r\n  border-color: var(--dsw-alias-brand-primary);\r\n  background: var(--dsw-alias-interactive-bg-hover);\r\n  color: var(--dsw-alias-label-primary);\r\n}\r\n\r\n.dts-settings-hint,\r\n.dts-settings-status {\r\n  font-size: 11px;\r\n  color: var(--dsw-alias-label-tertiary);\r\n}\r\n";

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

  let injectTraces = 0;
  let disposeSlot = null;
  try {
    disposeSlot = ctx.slots.register(
      {
        name: "conversation.input.model",
        priority: -1,
        inject: (sessionId) => {
          if (injectTraces < 3) {
            injectTraces += 1;
            trace("inject#" + injectTraces + " " + String(sessionId));
          }
          const directory = models.directoryFor(sessionId);
          const available = sessions.subagentAddress(sessionId) === undefined;
          return {
            available,
            directory: directory.store,
            load: () => {
              if (available) directory.load().catch(() => {});
            },
            select: (selection) => (available ? directory.select(selection) : Promise.resolve(undefined)),
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
    const { locked, available, directory, load, select } = props;

    const subscribe = React.useCallback((listener) => directory.subscribe(listener), [directory]);
    const state = React.useSyncExternalStore(subscribe, () => directory.getSnapshot());

    const [open, setOpen] = React.useState(false);
    const [pane, setPane] = React.useState("root");
    const [query, setQuery] = React.useState("");
    const [highlighted, setHighlighted] = React.useState(null);
    const [dragIndex, setDragIndex] = React.useState(null);
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
    const ratio = efforts.length <= 1 ? 0 : Math.max(0, Math.min(displayIndex, efforts.length - 1)) / (efforts.length - 1);

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
    const indexAt = (clientX) => {
      const track = trackRef.current;
      if (track === null || efforts.length === 0) return 0;
      const rect = track.getBoundingClientRect();
      const pad = 6;
      const span = Math.max(1, rect.width - pad * 2);
      const ratioAtPoint = Math.min(1, Math.max(0, (clientX - rect.left - pad) / span));
      return Math.round(ratioAtPoint * (efforts.length - 1));
    };

    const onTrackPointerDown = (event) => {
      if (busy || efforts.length === 0) return;
      event.preventDefault();
      trackRef.current?.focus();
      trackRef.current?.setPointerCapture?.(event.pointerId);
      setDragIndex(indexAt(event.clientX));
    };

    const onTrackPointerMove = (event) => {
      if (dragIndex === null) return;
      setDragIndex(indexAt(event.clientX));
    };

    const onTrackPointerUp = (event) => {
      if (dragIndex === null) return;
      trackRef.current?.releasePointerCapture?.(event.pointerId);
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
                { className: "dts-scale" },
                h(
                  "div",
                  {
                    ref: trackRef,
                    className: "dts-track" + (busy ? " dts-track--busy" : ""),
                    role: "slider",
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
                    onPointerCancel: () => setDragIndex(null),
                    onKeyDown: onTrackKeyDown,
                  },
                  h("span", { className: "dts-rail", "aria-hidden": "true" }),
                  h("span", {
                    className: "dts-fill",
                    "aria-hidden": "true",
                    style: { width: `calc(6px + ${ratio} * (100% - 12px))` },
                  }),
                  efforts.map((level, index) =>
                    h("span", {
                      key: level.id,
                      className: "dts-dot" + (index <= displayIndex ? " dts-dot--on" : ""),
                      "aria-hidden": "true",
                      style: { left: `calc(6px + ${index / Math.max(1, efforts.length - 1)} * (100% - 12px))` },
                    }),
                  ),
                  h("span", {
                    className: "dts-thumb",
                    "aria-hidden": "true",
                    style: { left: `calc(6px + ${ratio} * (100% - 12px))` },
                  }),
                ),
                h(
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
              style: menuPos ?? MEASURE_STYLE,
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
      { ref: rootRef, className: "dts-root", onKeyDown: onRootKeyDown },
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

/* 临时诊断：每次状态变化都记一条，启动时没接管可以离线读现场。 */
function trace(text) {
  try {
    const key = PLUGIN_ID + ":trace";
    const raw = window.localStorage.getItem(key);
    const list = raw === null ? [] : JSON.parse(raw);
    const log = Array.isArray(list) ? list : [];
    log.push({ t: Date.now(), s: String(text) });
    window.localStorage.setItem(key, JSON.stringify(log.slice(-30)));
  } catch {
    /* 隐私模式 / 配额满了就算了 */
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

function SettingsPanel(props) {
  const [state, setState] = React.useState(() => ({
    enabled: props.getEnabled(),
    status: props.getStatus(),
  }));
  React.useEffect(() => {
    const read = () => setState({ enabled: props.getEnabled(), status: props.getStatus() });
    read();
    return props.subscribe(read);
  }, [props]);
  const enabled = state.enabled;
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
    showStatus ? h("div", { className: "dts-settings-status" }, "未接管：" + status) : null,
  );
}

const inject = ["slots"];

function apply(ctx) {
  trace("apply");
  installStyles(ctx);

  let seatRetries = 0;
  if (typeof ctx.slots.onEntryError === "function") {
    ctx.effect(
      () =>
        ctx.slots.onEntryError((key, registration, error, retired) => {
          const stack = String(error?.stack ?? "")
            .split(String.fromCharCode(10))
            .slice(0, 4)
            .join(" | ");
          trace(`entryError ${String(key)} retired=${String(retired)} ${error?.message ?? String(error)} :: ${stack}`);
          if (String(key) !== "conversation.input.model") return;
          if (registration?.component?.displayName !== "ThinkingSliderSeat") return;
          if (seatRetries >= 3) return;
          seatRetries += 1;
          trace("re-register #" + seatRetries);
          setTimeout(() => {
            release();
            sync();
          }, 300);
        }),
      "thinking-slider: entry-error",
    );
  }


  let enabled = storedEnabled();
  let status = "尚未初始化";
  let services = null;
  let slotReady = false;
  let seatDispose = null;
  const listeners = new Set();

  const setStatus = (text) => {
    const next = String(text ?? "");
    trace(next);
    if (next.startsWith("已接管（座位已渲染）")) seatRetries = 0;
    if (next === status) return;
    status = next;
    for (const fn of listeners) fn();
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
      services = { models: scope.modelDirectories, sessions: scope.sessions };
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

  ctx.effect(() => {
    const timer = setTimeout(() => {
      let detail = "";
      try {
        const spec = typeof ctx.slots.spec === "function" ? ctx.slots.spec("conversation.input.model") : undefined;
        const list = typeof ctx.slots.entries === "function" ? ctx.slots.entries("conversation.input.model") : [];
        const live =
          typeof ctx.slots.entriesOfSlot === "function"
            ? ctx.slots.entriesOfSlot("conversation.input.model")
            : [];
        const winner = Array.isArray(live) ? live[0] : undefined;
        detail = `slot=${spec === undefined ? "none" : "declared"} entries=${Array.isArray(list) ? list.length : "?"} live=${Array.isArray(live) ? live.length : "?"} livePri=${winner?.options?.priority ?? "none"} ours=${winner?.component?.displayName === "ThinkingSliderSeat"} status=${status}`;
      } catch (error) {
        detail = "probe error: " + (error?.message ?? String(error));
      }
      trace("4s: " + detail);
    }, 4000);
    timer?.unref?.();
    return () => clearTimeout(timer);
  }, "thinking-slider: probe");

  ctx.effect(() => () => {
    release();
    listeners.clear();
  }, "thinking-slider: cleanup");
}

module.exports = {
  inject,
  apply,
  __test: { createThinkingSliderSeat, registerThinkingSliderSeat, storedEnabled },
};

return module.exports;
} });
