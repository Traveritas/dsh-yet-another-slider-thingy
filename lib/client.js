window.__ModuleLoader__.load({ id: "dsh-thinking-slider", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
/**
 * dsh-thinking-slider —— 浏览器端 bundle（v0.6.1）
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
const EFFECTS_KEY = PLUGIN_ID + ":effects";
const FX_OPTS_KEY = PLUGIN_ID + ":fx";
const LABELS_KEY = PLUGIN_ID + ":labels";
const CSS = "/* ── 思考强度滑条 · dsh-thinking-slider ─────────────────────────────────\r\n   顶替 composer 的模型位（conversation.input.model）。尺寸 / 字重 / 行高\r\n   照抄官方 ModelSelect：触发器 28px、13px 字；菜单 4px 内边距、34px 行；\r\n   面板材质直接复用宿主 MenuSurface，这里只管排布与滑条本身。\r\n\r\n   颜色：紧凑默认取宿主令牌（--dsw-*），Claude / Codex 有默认色板；\r\n   设置里可按槽覆盖（--dts-*-color），未改的槽仍按深浅取默认。\r\n   开关关闭、插件卸载、或组件渲染抛错时整段失效，座位回落原生。 */\r\n\r\n\r\n.dts-root {\r\n  position: relative;\r\n  display: flex;\r\n  min-width: 0;\r\n}\r\n\r\n/* ── 触发器：与原生模型位逐项对齐 ───────────────────────────────────── */\r\n.dts-trigger {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 4px;\r\n  height: 28px;\r\n  min-width: 0;\r\n  max-width: min(360px, 45cqw);\r\n  padding: 0 4px 0 8px;\r\n  border: none;\r\n  border-radius: var(--dsw-radius-sm);\r\n  background: none;\r\n  outline: none;\r\n  color: var(--dsw-alias-label-secondary);\r\n  font-size: 13px;\r\n  font-weight: 400;\r\n  line-height: 20px;\r\n  cursor: pointer;\r\n}\r\n\r\n.dts-trigger:hover:not(:disabled) {\r\n  background: var(--dsw-alias-interactive-bg-hover);\r\n}\r\n\r\n.dts-trigger:focus-visible:not([data-selection-focus]) {\r\n  box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));\r\n}\r\n\r\n.dts-trigger:disabled {\r\n  color: var(--dsw-alias-label-dimmed);\r\n  cursor: default;\r\n}\r\n\r\n.dts-triggerLabel {\r\n  min-width: 0;\r\n  overflow: hidden;\r\n  color: inherit;\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n\r\n.dts-triggerEffort {\r\n  flex-shrink: 1000;\r\n  min-width: 0;\r\n  overflow: hidden;\r\n  color: var(--dsw-alias-label-caption);\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n\r\n.dts-chevron {\r\n  flex: none;\r\n  color: var(--dsw-alias-label-caption);\r\n  transition: transform 0.12s ease;\r\n}\r\n\r\n.dts-chevron--open {\r\n  transform: rotate(180deg);\r\n}\r\n\r\n/* ── 菜单：材质交给 MenuSurface，这里只给尺寸与排布 ─────────────────── */\r\n.dts-menu {\r\n  position: fixed;\r\n  z-index: 1100;\r\n  display: flex;\r\n  flex-direction: column;\r\n  box-sizing: border-box;\r\n  width: 320px;\r\n  max-width: calc(100vw - 32px);\r\n  max-height: min(360px, calc(100vh - 96px));\r\n  padding: 4px;\r\n  overflow: hidden;\r\n  border: 0;\r\n  box-shadow: var(--dsw-elevation-prominent, 0 12px 32px rgba(0, 0, 0, 0.16));\r\n  color: var(--dsw-alias-label-primary);\r\n  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);\r\n  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2, rgba(128, 128, 128, 0.32));\r\n  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2, rgba(128, 128, 128, 0.48));\r\n}\r\n\r\n/* ── 模型格 ─────────────────────────────────────────────────────────── */\r\n.dts-cell {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 6px;\r\n  box-sizing: border-box;\r\n  width: auto;\r\n  min-width: 100%;\r\n  height: 34px;\r\n  padding: 0 8px;\r\n  border: none;\r\n  border-radius: var(--dsw-radius-md);\r\n  background: none;\r\n  outline: none;\r\n  color: inherit;\r\n  font-size: 13px;\r\n  line-height: 20px;\r\n  text-align: left;\r\n  cursor: pointer;\r\n}\r\n\r\n.dts-cell:hover,\r\n.dts-cell:focus-visible {\r\n  background: var(--dsw-alias-interactive-bg-hover);\r\n}\r\n\r\n.dts-cellLabel {\r\n  flex: none;\r\n  white-space: nowrap;\r\n}\r\n\r\n.dts-cellValue {\r\n  flex: auto;\r\n  min-width: 0;\r\n  overflow: hidden;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  text-align: right;\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n\r\n.dts-cellChevron {\r\n  flex: none;\r\n  width: 12px;\r\n  height: 12px;\r\n  color: var(--dsw-alias-menu-icon);\r\n}\r\n\r\n/* ── 强度带 ─────────────────────────────────────────────────────────── */\r\n.dts-band {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 2px;\r\n  padding: 4px 8px 6px;\r\n}\r\n\r\n.dts-bandHead {\r\n  display: flex;\r\n  align-items: baseline;\r\n  justify-content: space-between;\r\n  gap: 8px;\r\n  font-size: 13px;\r\n  line-height: 20px;\r\n}\r\n\r\n.dts-bandLabel {\r\n  flex: none;\r\n  color: var(--dsw-alias-label-primary);\r\n}\r\n\r\n.dts-bandValue {\r\n  min-width: 0;\r\n  overflow: hidden;\r\n  color: var(--dts-text-color, var(--dsw-alias-label-tertiary));\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n\r\n.dts-scale {\r\n  position: relative;\r\n  padding-top: 4px;\r\n}\r\n\r\n.dts-track {\r\n  position: relative;\r\n  height: var(--dts-track-h, 20px);\r\n  border-radius: var(--dsw-radius-sm);\r\n  outline: none;\r\n  cursor: pointer;\r\n  touch-action: none;\r\n}\r\n\r\n.dts-track--busy {\r\n  cursor: progress;\r\n}\r\n\r\n.dts-rail,\r\n.dts-fill {\r\n  position: absolute;\r\n  top: 50%;\r\n  left: var(--dts-pad, 6px);\r\n  z-index: 0;\r\n  height: 2px;\r\n  margin-top: -1px;\r\n  border-radius: 1px;\r\n  pointer-events: none;\r\n}\r\n\r\n.dts-rail {\r\n  right: var(--dts-pad, 6px);\r\n  background: var(--dts-track-color, var(--dsw-alias-border-l1));\r\n}\r\n\r\n.dts-fill {\r\n  background: var(--dts-fill-color, var(--dsw-alias-state-business-primary));\r\n  /* 逐档跨档 / 点刻度 / 松手吸附时，填充跟着拇指一起滑过去；\r\n     平滑拖动由 data-dts-follow 关掉。 */\r\n  transition: width 0.12s ease;\r\n}\r\n\r\n.dts-dot {\r\n  position: absolute;\r\n  top: 50%;\r\n  z-index: 1;\r\n  width: 4px;\r\n  height: 4px;\r\n  margin: -2px 0 0 -2px;\r\n  border-radius: 50%;\r\n  background: var(--dts-tick-color, var(--dsw-alias-label-caption));\r\n  opacity: 0.55;\r\n  pointer-events: none;\r\n  /* 跨档时和拇指一起淡过去：档位已切换、拇指还在路上，硬切会先闪一下。 */\r\n  transition:\r\n    background-color 0.12s ease,\r\n    opacity 0.12s ease;\r\n}\r\n\r\n.dts-dot--on {\r\n  background: var(--dts-accent-color, var(--dsw-alias-state-business-primary));\r\n  opacity: 1;\r\n}\r\n\r\n.dts-thumb {\r\n  position: absolute;\r\n  top: 50%;\r\n  z-index: 3;\r\n  box-sizing: border-box;\r\n  width: var(--dts-thumb-w, 12px);\r\n  height: var(--dts-thumb-h, 12px);\r\n  margin: calc(var(--dts-thumb-h, 12px) * -0.5) 0 0 calc(var(--dts-thumb-w, 12px) * -0.5);\r\n  border-radius: 50%;\r\n  background: var(--dts-thumb-color, var(--dsw-alias-bg-base));\r\n  box-shadow:\r\n    0 0 0 2px var(--dts-accent-color, var(--dsw-alias-state-business-primary)),\r\n    var(--dsw-elevation-prominent, 0 2px 6px rgba(0, 0, 0, 0.16));\r\n  pointer-events: none;\r\n  transition: left 0.12s ease;\r\n}\r\n\r\n/* 平滑拖动是逐帧跟手：哪怕 100ms 的过渡也会让拇指落在指针后面，所以关掉。\r\n   逐档拖动不关——拇指每跨一档正是靠这条过渡滑过去，而不是瞬移。 */\r\n.dts-track[data-dts-follow] .dts-thumb,\r\n.dts-track[data-dts-follow] .dts-fill {\r\n  transition: none;\r\n}\r\n\r\n/* 提交等待时不要把拇指调透明：填充就在拇指下面，半透明会让色条从拇指里\r\n   透出来，看起来像「色条盖在滑块上」。进度只由光标与触发器上的状态点表达。 */\r\n\r\n.dts-track:focus-visible .dts-thumb {\r\n  box-shadow:\r\n    0 0 0 2px var(--dts-accent-color, var(--dsw-alias-state-business-primary)),\r\n    0 0 0 4px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));\r\n}\r\n\r\n/* ── 皮肤色板：主色可在设置里改；这里给默认值 ──────────────────────\r\n   变量挂在 [data-dts-style] 上，会被菜单 inline style 的自定义色覆盖；\r\n   所以「改过的槽」深浅共用，「没改的槽」仍按深浅各走默认。 */\r\n[data-dts-style=\"claude\"] {\r\n  --dts-track-color: #edeae8;\r\n  --dts-fill-color: #e0dbd6;\r\n  --dts-thumb-color: #ffffff;\r\n  --dts-accent-color: #c6613f;\r\n  --dts-tick-color: #b6b2af;\r\n  --dts-text-color: var(--dsw-alias-label-caption);\r\n  /* 填充是浅暖灰，粒子跟强调色走才看得见；特效改到 Claude 上时才用得到。 */\r\n  --dts-particle-color: var(--dts-accent-color);\r\n}\r\n\r\n[data-dts-style=\"codex\"] {\r\n  --dts-track-color: color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent);\r\n  --dts-fill-color: #3a83f7;\r\n  --dts-thumb-color: #ffffff;\r\n  --dts-accent-color: #924ff7;\r\n  --dts-tick-color: color-mix(in srgb, var(--dsw-alias-label-primary) 50%, transparent);\r\n  --dts-text-color: var(--dsw-alias-label-caption);\r\n  --dts-particle-color: rgba(255, 255, 255, 0.72);\r\n}\r\n\r\nhtml:has(body[data-ds-dark-theme]) [data-dts-style=\"claude\"] {\r\n  --dts-track-color: #2a2623;\r\n  --dts-fill-color: #3a3330;\r\n  --dts-thumb-color: #f4efe8;\r\n  --dts-accent-color: #d97757;\r\n  --dts-tick-color: rgba(244, 239, 232, 0.34);\r\n}\r\n\r\nhtml:has(body[data-ds-dark-theme]) [data-dts-style=\"codex\"] {\r\n  --dts-accent-color: #ad7bf9;\r\n}\r\n\r\n/* ── 块面材质：暖灰哑光轨 + 24×28 圆角方拇指 ────────────────────────\r\n   轨道是整块 28px 的圆角矩形，填充只是更深的暖灰；\r\n   点用中性色（见下面的刻度规则），强调色只留给焦点环与流光。 */\r\n[data-dts-style=\"claude\"] .dts-track {\r\n  border-radius: 10px;\r\n  background: var(--dts-track-color);\r\n  box-shadow: inset 0 1px 1px rgba(70, 64, 59, 0.035);\r\n}\r\n\r\n[data-dts-style=\"claude\"] .dts-track::after {\r\n  content: \"\";\r\n  position: absolute;\r\n  z-index: 4;\r\n  inset: 0;\r\n  border: 1px solid rgba(76, 70, 65, 0.1);\r\n  border-radius: inherit;\r\n  pointer-events: none;\r\n}\r\n\r\n[data-dts-style=\"claude\"] .dts-rail {\r\n  top: 0;\r\n  right: 0;\r\n  bottom: 0;\r\n  left: 0;\r\n  height: auto;\r\n  margin: 0;\r\n  border-radius: 10px;\r\n  background: transparent;\r\n}\r\n\r\n[data-dts-style=\"claude\"] .dts-fill {\r\n  top: 0;\r\n  bottom: 0;\r\n  left: 0;\r\n  height: auto;\r\n  margin: 0;\r\n  border-radius: 9px 0 0 9px;\r\n  background: var(--dts-fill-color);\r\n  transition: width 0.28s cubic-bezier(0.2, 0, 0, 1);\r\n}\r\n\r\n/* 块面的点不用强调色：经过的档是「填充色 + 中性文字色」的混色，\r\n   不论下面压的是浅暖灰还是配色来的蓝底都读得出来；未经过的档用刻度色压淡。\r\n   旧版让末档常亮强调色，当前档是 High 时四个点全亮，读不出位置。 */\r\n[data-dts-style=\"claude\"] .dts-dot {\r\n  background: var(--dts-tick-color);\r\n  opacity: 0.82;\r\n}\r\n\r\n[data-dts-style=\"claude\"] .dts-dot--on {\r\n  background: color-mix(in srgb, var(--dts-fill-color) 25%, var(--dsw-alias-label-secondary));\r\n  opacity: 1;\r\n}\r\n\r\n[data-dts-style=\"claude\"] .dts-thumb {\r\n  border: 1px solid rgba(76, 70, 65, 0.2);\r\n  border-radius: 8px;\r\n  background: var(--dts-thumb-color);\r\n  box-shadow:\r\n    0 1px 2px rgba(62, 56, 50, 0.1),\r\n    0 4px 10px rgba(62, 56, 50, 0.06);\r\n  transition:\r\n    left 0.28s cubic-bezier(0.2, 0, 0, 1),\r\n    box-shadow 0.18s ease;\r\n}\r\n\r\n[data-dts-style=\"claude\"] .dts-track:focus-visible .dts-thumb {\r\n  box-shadow:\r\n    0 0 0 3px color-mix(in srgb, var(--dts-accent-color) 28%, transparent),\r\n    0 1px 2px rgba(62, 56, 50, 0.08),\r\n    0 4px 10px rgba(62, 56, 50, 0.055);\r\n}\r\n\r\n/* ── Codex 材质：24px 胶囊轨 + 4px 点 + 28px 白圆拇指 ────────────────\r\n   轨道本身是 28px 命中区，可见胶囊只用上下各 2px 的内缩；\r\n   蓝色进度、选中点变白、拇指溢出胶囊——都按 Codex 的 power slider。 */\r\n[data-dts-style=\"codex\"] .dts-track {\r\n  border-radius: 0;\r\n  background: transparent;\r\n}\r\n\r\n[data-dts-style=\"codex\"] .dts-rail {\r\n  top: 2px;\r\n  right: 0;\r\n  bottom: 2px;\r\n  left: 0;\r\n  height: auto;\r\n  margin: 0;\r\n  border-radius: 12px;\r\n  background: var(--dts-track-color);\r\n  box-shadow: inset 0 0 0 0.5px color-mix(in srgb, var(--dsw-alias-label-primary) 18%, transparent);\r\n}\r\n\r\n[data-dts-style=\"codex\"] .dts-fill {\r\n  top: 2px;\r\n  bottom: 2px;\r\n  left: 0;\r\n  height: auto;\r\n  margin: 0;\r\n  overflow: hidden;\r\n  border-radius: 12px 0 0 12px;\r\n  background: var(--dts-fill-color);\r\n  transition: width 0.2s cubic-bezier(0.23, 1, 0.32, 1);\r\n}\r\n\r\n[data-dts-style=\"codex\"] .dts-dot {\r\n  background: var(--dts-tick-color);\r\n  opacity: 1;\r\n}\r\n\r\n[data-dts-style=\"codex\"] .dts-dot--on {\r\n  background: color-mix(in srgb, var(--dts-thumb-color) 55%, transparent);\r\n}\r\n\r\n[data-dts-style=\"codex\"] .dts-thumb {\r\n  border: 0.5px solid color-mix(in srgb, var(--dsw-alias-label-primary) 40%, transparent);\r\n  border-radius: 50%;\r\n  background: var(--dts-thumb-color);\r\n  box-shadow:\r\n    0 1px 2px rgba(0, 0, 0, 0.14),\r\n    0 0 0 0.5px color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent);\r\n  transition:\r\n    left 0.2s cubic-bezier(0.23, 1, 0.32, 1),\r\n    box-shadow 0.15s ease;\r\n}\r\n\r\n[data-dts-style=\"codex\"] .dts-track:focus-visible .dts-thumb {\r\n  box-shadow:\r\n    0 0 0 2px var(--dts-accent-color),\r\n    0 0 2px rgba(0, 0, 0, 0.1);\r\n}\r\n\r\n/* ── Codex 满档：蓝色填充里的流动渐变 + 横穿粒子 ───────────────────\r\n   粒子按 Codex 的 FastTrackParticles 做法：一条和填充等宽的“轨道”从右往左\r\n   平移，粒子固定在轨道左端；整层裁在填充的圆角里，不越出滑条。 */\r\n.dts-flow {\r\n  /* 特效强度：0–1，来自已提交档位；平滑拖动时跟指针连续走。\r\n     一个变量管三件事——亮度（opacity）、鲜艳（filter）和速度（JS 乘\r\n     playbackRate），所以四个样式谁都不用自己再算一遍。 */\r\n  --dts-power: 0;\r\n  /* 最低档的底噪：默认留一点存在感（不然「特效开着」像没开）。\r\n     设置成「只在最高档」时座位把它写成 0——那时 0 就该是彻底看不见。 */\r\n  --dts-fx-floor: 0.18;\r\n  position: absolute;\r\n  inset: 0;\r\n  overflow: hidden;\r\n  border-radius: inherit;\r\n  pointer-events: none;\r\n  opacity: calc(var(--dts-fx-floor) + (1 - var(--dts-fx-floor)) * var(--dts-power));\r\n  transition: opacity 0.24s cubic-bezier(0.23, 1, 0.32, 1);\r\n  /* 越往上越鲜艳：在配色给的颜色上再加一层饱和度，改配色不用重设。 */\r\n  filter: saturate(calc(0.78 + 0.5 * var(--dts-power)));\r\n}\r\n\r\n.dts-flow[data-dts-flow-follow] {\r\n  transition: none;\r\n}\r\n\r\n/* 特效开到紧凑上：填充只有 2px，粒子（按 28px 轨道排的 top）根本放不下，\r\n   降级成只剩一道沿轨道扫过的流光。 */\r\n.dts-flow[data-dts-flow=\"thin\"] .dts-flowPath {\r\n  display: none;\r\n}\r\n\r\n.dts-flow[data-dts-flow=\"thin\"] .dts-flowSheen {\r\n  background: linear-gradient(\r\n    100deg,\r\n    transparent 0%,\r\n    color-mix(in srgb, var(--dts-particle-color, var(--dts-accent-color, var(--dsw-alias-state-business-primary))) 42%, transparent) 40%,\r\n    transparent 74%\r\n  );\r\n  background-size: 260% 100%;\r\n}\r\n\r\n.dts-flowSheen {\r\n  position: absolute;\r\n  inset: 0;\r\n  background: linear-gradient(\r\n    100deg,\r\n    transparent 0%,\r\n    color-mix(in srgb, var(--dts-accent-color, var(--dsw-alias-state-business-primary)) 30%, transparent) 24%,\r\n    color-mix(in srgb, var(--dts-particle-color, var(--dsw-alias-state-business-primary)) 18%, transparent) 42%,\r\n    transparent 66%\r\n  );\r\n  background-size: 220% 100%;\r\n  animation: dts-flow-sheen 3.4s linear infinite;\r\n}\r\n\r\n@keyframes dts-flow-sheen {\r\n  0% {\r\n    background-position: 180% 0;\r\n  }\r\n  100% {\r\n    background-position: -80% 0;\r\n  }\r\n}\r\n\r\n.dts-flowPath {\r\n  position: absolute;\r\n  inset-inline: 0;\r\n  top: var(--dts-flow-top, 8px);\r\n  height: 0;\r\n  opacity: 0;\r\n  transform: translateX(100%);\r\n  animation: dts-flow-travel var(--dts-flow-duration, 3.2s) linear infinite;\r\n  animation-delay: var(--dts-flow-delay, 0s);\r\n}\r\n\r\n.dts-flowPath i {\r\n  position: absolute;\r\n  top: -1.5px;\r\n  left: 0;\r\n  width: 3px;\r\n  height: 3px;\r\n  border-radius: 999px;\r\n  background: var(--dts-particle-color);\r\n  box-shadow: 0 0 5px color-mix(in srgb, var(--dts-particle-color) 34%, transparent);\r\n}\r\n\r\n@keyframes dts-flow-travel {\r\n  0% {\r\n    opacity: 0;\r\n    transform: translateX(100%);\r\n  }\r\n  8% {\r\n    opacity: 1;\r\n    transform: translateX(92%);\r\n  }\r\n  92% {\r\n    opacity: 1;\r\n    transform: translateX(8%);\r\n  }\r\n  100% {\r\n    opacity: 0;\r\n    transform: translateX(0);\r\n  }\r\n}\r\n\r\n/* ── 特效：四个样式共用一层外壳，靠 data-dts-fx 分流 ───────────────────\r\n   flow 流光场 / dust 密度粒子 / pulse 心跳 / glyph 字符点阵场。\r\n   强度只有 --dts-power 一根总线：档位越高越亮、越鲜艳、越快。\r\n   速度不写死在 CSS 里——基准时长固定，JS 用 getAnimations().playbackRate\r\n   乘上功率，平滑拖动时连续跟手，也不会让正在跑的动画跳一格。\r\n   紧凑的 2px 细轨放不下粒子和字符，统一降级成一道流光（data-dts-flow=\"thin\"）。 */\r\n\r\n/* 不属于当前样式的层一律不画。 */\r\n.dts-fxGlyph,\r\n.dts-fxGlowSoft,\r\n.dts-fxGlowStrong {\r\n  display: none;\r\n}\r\n\r\n/* 流光场：一块 5px 一格的画布（src/pixel-flow.js）。画布只有视口的 1/5 分之一个角，\r\n   像素放大回填充大小，就是主题那层流光缩小后的样子——所以这里只负责摆位置。 */\r\n.dts-pixelFlow {\r\n  display: none;\r\n}\r\n\r\n.dts-flow[data-dts-fx=\"flow\"] .dts-pixelFlow {\r\n  display: block;\r\n  position: absolute;\r\n  inset: 0;\r\n  width: 100%;\r\n  height: 100%;\r\n  border-radius: inherit;\r\n  image-rendering: pixelated;\r\n  pointer-events: none;\r\n}\r\n\r\n/* 密度粒子：还是原来那 8 颗横穿的小点，但档位决定「亮起来几颗」和「点多大」。\r\n   第 i 颗在 power 越过 i/8 之后才出现，所以低档是一两颗，满档是一整条流。 */\r\n.dts-flow:not([data-dts-fx=\"dust\"]) .dts-flowPath {\r\n  display: none;\r\n}\r\n\r\n.dts-flow[data-dts-fx=\"dust\"] .dts-flowPath i {\r\n  scale: clamp(0.01, calc(var(--dts-power) * 8.6 - var(--dts-fx-i, 0) * 8), 1.15);\r\n  box-shadow: 0 0 calc(3px + 8px * var(--dts-power))\r\n    color-mix(in srgb, var(--dts-dust-color, var(--dts-particle-color)) 52%, transparent);\r\n}\r\n\r\n/* 心跳：一层铺满的呼吸光 + 一道从拇指冲向左侧的脉冲波。\r\n   双峰的关键帧读起来像「咚·咚」，加上那道波就不只是「亮一下」了。 */\r\n.dts-flow[data-dts-fx=\"pulse\"] .dts-fxGlowSoft,\r\n.dts-flow[data-dts-fx=\"pulse\"] .dts-fxGlowStrong {\r\n  display: block;\r\n  position: absolute;\r\n  top: 0;\r\n  bottom: 0;\r\n}\r\n\r\n.dts-flow[data-dts-fx=\"pulse\"] .dts-fxGlowSoft {\r\n  inset-inline: 0;\r\n  animation: dts-fx-beat 2.1s cubic-bezier(0.42, 0, 0.58, 1) infinite;\r\n}\r\n\r\n.dts-flow[data-dts-fx=\"pulse\"] .dts-fxGlowStrong {\r\n  right: 0;\r\n  left: auto;\r\n  width: 58%;\r\n  animation: dts-fx-wave 2.1s cubic-bezier(0.2, 0.6, 0.3, 1) infinite;\r\n}\r\n\r\n.dts-fxGlowSoft {\r\n  background: linear-gradient(90deg, transparent 4%, color-mix(in srgb, var(--dts-pulse-color, var(--dts-particle-color)) 52%, transparent));\r\n}\r\n\r\n.dts-fxGlowStrong {\r\n  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--dts-pulse-color, var(--dts-particle-color)) 95%, transparent) 62%, transparent);\r\n}\r\n\r\n@keyframes dts-fx-beat {\r\n  0%,\r\n  100% {\r\n    opacity: 0.24;\r\n    transform: scaleX(0.97);\r\n  }\r\n  7% {\r\n    opacity: 1;\r\n    transform: scaleX(1.02);\r\n  }\r\n  16% {\r\n    opacity: 0.42;\r\n    transform: scaleX(0.99);\r\n  }\r\n  25% {\r\n    opacity: 0.9;\r\n    transform: scaleX(1.01);\r\n  }\r\n  42% {\r\n    opacity: 0.26;\r\n    transform: scaleX(0.97);\r\n  }\r\n}\r\n\r\n@keyframes dts-fx-wave {\r\n  0% {\r\n    opacity: 0;\r\n    transform: translateX(0) scaleX(0.6);\r\n  }\r\n  8% {\r\n    opacity: 0.95;\r\n    transform: translateX(-18%) scaleX(0.86);\r\n  }\r\n  38% {\r\n    opacity: 0.4;\r\n    transform: translateX(-110%) scaleX(1.15);\r\n  }\r\n  56%,\r\n  100% {\r\n    opacity: 0;\r\n    transform: translateX(-160%) scaleX(1.25);\r\n  }\r\n}\r\n\r\n/* 字符点阵场：两行等宽字符从右往左跑，慢的那行反着走、压到四成不抢戏。\r\n   每行里的字写两遍，translateX(-50%) 正好接回开头，循环看不出来。 */\r\n.dts-flow[data-dts-fx=\"glyph\"] .dts-fxGlyph {\r\n  display: flex;\r\n  flex-direction: column;\r\n  justify-content: center;\r\n  gap: 1px;\r\n  position: absolute;\r\n  inset: 0;\r\n  padding-left: 4px;\r\n  overflow: hidden;\r\n  font: 600 9px/10px Consolas, \"Cascadia Code\", ui-monospace, monospace;\r\n  letter-spacing: 0.16em;\r\n  white-space: nowrap;\r\n  color: color-mix(in srgb, var(--dts-glyph-color, var(--dts-particle-color)) 82%, transparent);\r\n  -webkit-mask-image: linear-gradient(90deg, transparent, #000 14%, #000 92%, transparent);\r\n  mask-image: linear-gradient(90deg, transparent, #000 14%, #000 92%, transparent);\r\n}\r\n\r\n.dts-fxGlyphRow {\r\n  display: block;\r\n  width: max-content;\r\n  animation: dts-fx-glyph 9s linear infinite;\r\n}\r\n\r\n.dts-fxGlyphRow--b {\r\n  opacity: 0.32;\r\n  animation-duration: 13.5s;\r\n  animation-direction: reverse;\r\n}\r\n\r\n@keyframes dts-fx-glyph {\r\n  to {\r\n    transform: translateX(-50%);\r\n  }\r\n}\r\n\r\n/* 细轨降级：2px 的填充只留一道扫过的流光（画布与字符都放不下）。 */\r\n.dts-flow[data-dts-flow=\"thin\"] .dts-pixelFlow,\r\n.dts-flow[data-dts-flow=\"thin\"] .dts-fxGlyph,\r\n.dts-flow[data-dts-flow=\"thin\"] .dts-fxGlowSoft,\r\n.dts-flow[data-dts-flow=\"thin\"] .dts-fxGlowStrong {\r\n  display: none;\r\n}\r\n\r\n.dts-flow[data-dts-flow=\"thin\"] .dts-flowSheen {\r\n  display: block;\r\n}\r\n\r\n/* 不画自带流光的样式（流光场 / 心跳 / 字符）把扫光层收起来；细轨那条规则\r\n   写在后面，优先级相同时由顺序决定，所以细轨仍然有扫光。 */\r\n.dts-flow[data-dts-fx=\"flow\"] .dts-flowSheen,\r\n.dts-flow[data-dts-fx=\"pulse\"] .dts-flowSheen,\r\n.dts-flow[data-dts-fx=\"glyph\"] .dts-flowSheen {\r\n  display: none;\r\n}\r\n\r\n/* ── 刻度 ─────────────────────────────────────────────────────────────\r\n   两种形态共用一套几何：每个词的中心钉在同一档圆点的 x 上（和圆点、填充、\r\n   拇指同一个 sliderPosition 公式），两端和中间都不会再偏半格。\r\n   居中会让两端的词探出轨道，所以宽度先按「放得下」限死；还出界的由座位量完\r\n   实际宽度再往里推（inline transform），最多推到 .dts-band 的内边距外沿。 */\r\n.dts-ticks,\r\n.dts-axis {\r\n  position: relative;\r\n  height: 16px;\r\n  margin-top: 2px;\r\n  color: var(--dts-text-color, var(--dsw-alias-label-caption));\r\n  font-size: 11px;\r\n  line-height: 16px;\r\n}\r\n\r\n.dts-tick,\r\n.dts-axisLabel {\r\n  position: absolute;\r\n  top: 0;\r\n  transform: translateX(-50%);\r\n  white-space: nowrap;\r\n  overflow: hidden;\r\n  text-overflow: ellipsis;\r\n}\r\n\r\n/* 每档占一格：比格宽就省略号，免得压到相邻档的名字上。 */\r\n.dts-tick {\r\n  max-width: calc((100% - var(--dts-pad, 6px) * 2) / var(--dts-levels, 4));\r\n}\r\n\r\n/* 两端字在整个轨道里只放两个，上限给整条轨道，出界交给实测位移。 */\r\n.dts-axisLabel {\r\n  max-width: calc(100% - var(--dts-pad, 6px) * 2);\r\n}\r\n\r\n.dts-tick {\r\n  padding: 0;\r\n  border: none;\r\n  background: none;\r\n  color: inherit;\r\n  font: inherit;\r\n  font-size: 11px;\r\n  line-height: 16px;\r\n  text-align: center;\r\n  cursor: pointer;\r\n}\r\n\r\n.dts-tick:hover,\r\n.dts-tick--on {\r\n  color: var(--dts-accent-color, var(--dsw-alias-label-primary));\r\n}\r\n\r\n/* Claude 的两个端点标签：Faster / Smarter，和别套一样落在滑条下方。 */\r\n.dts-axis {\r\n  pointer-events: none;\r\n}\r\n\r\n/* ── 深色：Claude 的暖灰要压到暗面；Codex 全走宿主令牌，不用单独写 ── */\r\nhtml:has(body[data-ds-dark-theme]) [data-dts-style=\"claude\"] .dts-track {\r\n  box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.35);\r\n}\r\n\r\nhtml:has(body[data-ds-dark-theme]) [data-dts-style=\"claude\"] .dts-track::after {\r\n  border-color: rgba(255, 255, 255, 0.07);\r\n}\r\n\r\nhtml:has(body[data-ds-dark-theme]) [data-dts-style=\"claude\"] .dts-thumb {\r\n  border-color: rgba(255, 255, 255, 0.2);\r\n  box-shadow:\r\n    0 1px 2px rgba(0, 0, 0, 0.28),\r\n    0 4px 12px rgba(0, 0, 0, 0.38);\r\n}\r\n\r\nhtml:has(body[data-ds-dark-theme]) [data-dts-style=\"claude\"] .dts-track:focus-visible .dts-thumb {\r\n  box-shadow:\r\n    0 0 0 3px color-mix(in srgb, var(--dts-accent-color) 30%, transparent),\r\n    0 1px 2px rgba(0, 0, 0, 0.28),\r\n    0 4px 12px rgba(0, 0, 0, 0.38);\r\n}\r\n\r\n@media (prefers-reduced-motion: reduce) {\r\n  .dts-thumb,\r\n  .dts-fill,\r\n  .dts-dot,\r\n  .dts-flow {\r\n    transition: none;\r\n  }\r\n\r\n  .dts-flowSheen {\r\n    animation: none;\r\n    opacity: 0.35;\r\n  }\r\n\r\n  .dts-flowPath {\r\n    animation: none;\r\n    opacity: 0;\r\n  }\r\n\r\n  /* 四个特效都停在看得见的一帧上：不动的光比没有光更像「关掉了动效」。\r\n     流光场的画布由 JS 看 reduced 只画一帧，这里不用管。 */\r\n  .dts-fxGlowSoft,\r\n  .dts-fxGlowStrong,\r\n  .dts-fxGlyphRow {\r\n    animation: none;\r\n  }\r\n\r\n  .dts-fxGlowSoft {\r\n    opacity: 0.4;\r\n  }\r\n\r\n  .dts-fxGlowStrong {\r\n    opacity: 0.6;\r\n  }\r\n}\r\n\r\n/* ── 模型列表 ───────────────────────────────────────────────────────── */\r\n.dts-searchRow {\r\n  position: relative;\r\n  flex-shrink: 0;\r\n  margin: 2px 0 3px;\r\n}\r\n\r\n.dts-searchRow .dts-search {\r\n  display: flex;\r\n  height: auto;\r\n  padding: 5px 7px;\r\n  border: 0 solid transparent;\r\n  border-radius: var(--dsw-radius-md);\r\n  background: none;\r\n}\r\n\r\n.dts-searchRow .dts-search--filled {\r\n  padding-right: 34px;\r\n}\r\n\r\n.dts-searchRow .dts-search:focus-within {\r\n  border-color: transparent;\r\n}\r\n\r\n.dts-searchRow .dts-search input {\r\n  padding: 0;\r\n  font-size: 12px;\r\n  line-height: normal;\r\n}\r\n\r\n.dts-searchRow .dts-search input::placeholder {\r\n  color: var(--dsw-alias-label-caption);\r\n}\r\n\r\n.dts-searchClear {\r\n  position: absolute;\r\n  top: 50%;\r\n  right: 4px;\r\n  display: inline-flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  width: 24px;\r\n  height: 24px;\r\n  padding: 0;\r\n  border: none;\r\n  border-radius: 50%;\r\n  background: none;\r\n  color: var(--dsw-alias-label-secondary);\r\n  cursor: pointer;\r\n  transform: translateY(-50%);\r\n}\r\n\r\n.dts-searchClear:hover,\r\n.dts-searchClear:focus-visible {\r\n  background: var(--dsw-alias-interactive-bg-hover);\r\n  outline: none;\r\n}\r\n\r\n.dts-groups {\r\n  min-height: 0;\r\n  overflow-y: auto;\r\n}\r\n\r\n.dts-option {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 6px;\r\n  box-sizing: border-box;\r\n  width: auto;\r\n  min-width: 100%;\r\n  min-height: 34px;\r\n  padding: 5px 7px;\r\n  border: none;\r\n  border-radius: var(--dsw-radius-md);\r\n  background: none;\r\n  outline: none;\r\n  color: inherit;\r\n  text-align: left;\r\n  cursor: pointer;\r\n}\r\n\r\n.dts-option:hover:not(:disabled),\r\n.dts-option:focus-visible,\r\n.dts-option--active:not(:disabled) {\r\n  background: var(--dsw-alias-interactive-bg-hover);\r\n}\r\n\r\n.dts-option:disabled {\r\n  color: var(--dsw-alias-label-dimmed);\r\n  cursor: default;\r\n}\r\n\r\n.dts-optionCopy {\r\n  display: flex;\r\n  flex: 1;\r\n  flex-direction: column;\r\n  min-width: 0;\r\n}\r\n\r\n.dts-modelName {\r\n  overflow: hidden;\r\n  color: inherit;\r\n  font-size: 13px;\r\n  font-weight: 400;\r\n  line-height: 18px;\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n\r\n.dts-check {\r\n  display: grid;\r\n  flex: 0 0 14px;\r\n  place-items: center;\r\n  color: var(--dsw-alias-label-primary);\r\n}\r\n\r\n.dts-check svg {\r\n  width: 14px;\r\n  height: 14px;\r\n}\r\n\r\n/* ── 状态 / 错误 / 空 ──────────────────────────────────────────────── */\r\n.dts-status,\r\n.dts-empty {\r\n  padding: 8px;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font-size: 12px;\r\n  line-height: 18px;\r\n}\r\n\r\n.dts-empty {\r\n  padding: 6px 8px 8px;\r\n}\r\n\r\n.dts-error,\r\n.dts-warning {\r\n  display: flex;\r\n  align-items: flex-start;\r\n  justify-content: space-between;\r\n  gap: 6px;\r\n  margin-bottom: 3px;\r\n  padding: 6px 7px;\r\n  border-radius: var(--dsw-radius-md);\r\n  background: var(--dsw-alias-interactive-bg-hover-danger);\r\n  color: var(--dsw-alias-state-error-primary);\r\n  font-size: 11px;\r\n  line-height: 16px;\r\n}\r\n\r\n.dts-warning {\r\n  background: var(--dsw-alias-bg-module-platform);\r\n  color: var(--dsw-alias-state-warn-label);\r\n}\r\n\r\n.dts-retry {\r\n  flex: none;\r\n  padding: 0;\r\n  border: none;\r\n  background: none;\r\n  color: inherit;\r\n  font: inherit;\r\n  font-weight: 600;\r\n  cursor: pointer;\r\n}\r\n\r\n/* ── 设置页「思考强度」 ───────────────────────────────────────────────── */\r\n.dts-settings {\r\n  container-type: inline-size;\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 0;\r\n  max-width: 880px;\r\n  padding: 2px 0 6px;\r\n}\r\n\r\n.dts-settings-head {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 2px;\r\n}\r\n\r\n.dts-settings-title {\r\n  font-size: 15px;\r\n  line-height: 1.35;\r\n  color: var(--dsw-alias-label-primary);\r\n}\r\n\r\n.dts-settings-sub {\r\n  font-size: 11.5px;\r\n  line-height: 1.5;\r\n  color: var(--dsw-alias-label-tertiary);\r\n}\r\n\r\n/* 类别：短词 + 向右收的细线。类别之间只靠这条线和 18px 留白隔开。 */\r\n.dts-group {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 10px;\r\n  margin: 18px 0 2px;\r\n}\r\n\r\n.dts-settings-head + .dts-group {\r\n  margin-top: 12px;\r\n}\r\n\r\n.dts-group-label {\r\n  flex: none;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font-size: 10.5px;\r\n  line-height: 16px;\r\n  letter-spacing: 0.16em;\r\n  white-space: nowrap;\r\n}\r\n\r\n.dts-group::after {\r\n  content: \"\";\r\n  flex: 1 1 auto;\r\n  height: 1px;\r\n  background: var(--dsw-alias-border-l1);\r\n}\r\n\r\n/* 一行三列：标签 / 控件 / 右侧说明。说明固定在最右一列，不跟芯片换行。 */\r\n.dts-settings-row {\r\n  display: grid;\r\n  grid-template-columns: 56px minmax(0, 1fr) minmax(0, 216px);\r\n  column-gap: 12px;\r\n  row-gap: 2px;\r\n  align-items: start;\r\n  padding: 3px 0;\r\n}\r\n\r\n.dts-settings-label {\r\n  color: var(--dsw-alias-label-secondary);\r\n  font-size: 11px;\r\n  line-height: 24px;\r\n  letter-spacing: 0.06em;\r\n  white-space: nowrap;\r\n}\r\n\r\n.dts-controls {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  align-items: center;\r\n  gap: 6px;\r\n  min-width: 0;\r\n  min-height: 24px;\r\n}\r\n\r\n.dts-settings-hint {\r\n  justify-self: end;\r\n  max-width: 100%;\r\n  padding-top: 4px;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font-size: 11px;\r\n  line-height: 16px;\r\n  text-align: right;\r\n  text-wrap: pretty;\r\n}\r\n\r\n.dts-settings-note {\r\n  margin: 3px 0 0 68px;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font-size: 11px;\r\n  line-height: 16px;\r\n}\r\n\r\n.dts-settings-status {\r\n  margin-top: 14px;\r\n  padding: 6px 9px;\r\n  border-radius: var(--dsw-radius-md);\r\n  background: var(--dsw-alias-interactive-bg-hover);\r\n  color: var(--dsw-alias-label-secondary);\r\n  font-size: 11px;\r\n  line-height: 16px;\r\n}\r\n\r\n.dts-chip {\r\n  padding: 4px 10px;\r\n  border: 0.5px solid var(--dsw-alias-border-l2);\r\n  border-radius: var(--dsw-radius-lg);\r\n  background: transparent;\r\n  color: var(--dsw-alias-label-secondary);\r\n  font-size: 12px;\r\n  line-height: 16px;\r\n  cursor: pointer;\r\n  transition:\r\n    background-color var(--ds-transition-duration-fast, 120ms) var(--ds-ease-in-out, ease),\r\n    border-color var(--ds-transition-duration-fast, 120ms) var(--ds-ease-in-out, ease),\r\n    color var(--ds-transition-duration-fast, 120ms) var(--ds-ease-in-out, ease);\r\n}\r\n\r\n.dts-chip:hover {\r\n  background: var(--dsw-alias-interactive-bg-hover);\r\n}\r\n\r\n.dts-chip--on {\r\n  border-color: var(--dsw-alias-brand-primary);\r\n  background: var(--dsw-alias-interactive-bg-hover);\r\n  color: var(--dsw-alias-label-primary);\r\n}\r\n\r\n.dts-chip--add {\r\n  border-style: dashed;\r\n  color: var(--dsw-alias-label-tertiary);\r\n}\r\n\r\n/* 窄容器：说明收到控件下面，仍靠右。 */\r\n@container (max-width: 640px) {\r\n  .dts-settings-row {\r\n    grid-template-columns: 48px minmax(0, 1fr);\r\n  }\r\n\r\n  .dts-settings-hint {\r\n    grid-column: 2;\r\n    justify-self: end;\r\n    padding-top: 0;\r\n  }\r\n\r\n  .dts-settings-note {\r\n    margin-left: 60px;\r\n  }\r\n\r\n  .dts-colorLabel {\r\n    flex-basis: 48px;\r\n  }\r\n\r\n  .dts-colorsHint {\r\n    padding-left: 56px;\r\n  }\r\n}\r\n\r\n/* ── 设置页「颜色」 ─────────────────────────────────────────────────── */\r\n.dts-colors {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 2px;\r\n  padding-top: 4px;\r\n}\r\n\r\n/* 浅色 / 深色两页：配色按模式各记一份值。 */\r\n.dts-modeTabs {\r\n  display: flex;\r\n  gap: 2px;\r\n  padding: 1px;\r\n  border: 0.5px solid var(--dsw-alias-border-l1);\r\n  border-radius: var(--dsw-radius-lg);\r\n  background: var(--dsw-alias-interactive-bg-hover);\r\n}\r\n\r\n.dts-modeTab {\r\n  padding: 1px 8px;\r\n  border: 0;\r\n  border-radius: var(--dsw-radius-md);\r\n  background: transparent;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font-size: 11px;\r\n  line-height: 16px;\r\n  cursor: pointer;\r\n}\r\n\r\n.dts-modeTab--on {\r\n  background: var(--dsw-alias-bg-base);\r\n  color: var(--dsw-alias-label-primary);\r\n  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);\r\n}\r\n\r\n/* 配色名称：草稿在组件里，失焦 / 回车才提交。 */\r\n.dts-paletteName {\r\n  flex: 1 1 120px;\r\n  min-width: 0;\r\n  max-width: 200px;\r\n  padding: 3px 8px;\r\n  border: 0.5px solid var(--dsw-alias-border-l2);\r\n  border-radius: var(--dsw-radius-md);\r\n  background: transparent;\r\n  color: var(--dsw-alias-label-primary);\r\n  font: inherit;\r\n  font-size: 12px;\r\n  line-height: 18px;\r\n}\r\n\r\n.dts-paletteName:focus {\r\n  outline: none;\r\n  border-color: var(--dsw-alias-brand-primary);\r\n}\r\n\r\n.dts-colorReset {\r\n  padding: 2px 8px;\r\n  border: 0.5px solid var(--dsw-alias-border-l2);\r\n  border-radius: var(--dsw-radius-lg);\r\n  background: transparent;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font-size: 11px;\r\n  line-height: 16px;\r\n  cursor: pointer;\r\n}\r\n\r\n.dts-colorReset:hover {\r\n  background: var(--dsw-alias-interactive-bg-hover);\r\n  color: var(--dsw-alias-label-secondary);\r\n}\r\n\r\n.dts-colorRow {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 8px;\r\n  min-height: 26px;\r\n  max-width: 440px;\r\n  padding: 1px 0;\r\n  color: var(--dsw-alias-label-secondary);\r\n  font-size: 12px;\r\n}\r\n\r\n.dts-colorLabel {\r\n  flex: 0 0 56px;\r\n  font-size: 11px;\r\n  letter-spacing: 0.06em;\r\n  white-space: nowrap;\r\n}\r\n\r\n.dts-colorInput {\r\n  flex: none;\r\n  width: 30px;\r\n  height: 22px;\r\n  padding: 0;\r\n  border: 0;\r\n  border-radius: 6px;\r\n  background: none;\r\n  cursor: pointer;\r\n}\r\n\r\n.dts-colorInput::-webkit-color-swatch-wrapper {\r\n  padding: 0;\r\n}\r\n\r\n.dts-colorInput::-webkit-color-swatch {\r\n  border: 0.5px solid var(--dsw-alias-border-l2);\r\n  border-radius: 6px;\r\n}\r\n\r\n.dts-colorInput::-moz-color-swatch {\r\n  border: 0.5px solid var(--dsw-alias-border-l2);\r\n  border-radius: 6px;\r\n}\r\n\r\n.dts-colorValue {\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font-family: var(--ds-font-family-code, Consolas, monospace);\r\n  font-size: 10px;\r\n  letter-spacing: 0.02em;\r\n}\r\n\r\n/* 空槽 = 跟随主题：色块退成近似色，右侧写「跟随主题」并出现 ↺ 恢复。 */\r\n.dts-colorRow--auto .dts-colorInput {\r\n  opacity: 0.45;\r\n}\r\n\r\n.dts-colorRow--auto .dts-colorValue {\r\n  font-family: inherit;\r\n  font-size: 11px;\r\n  letter-spacing: 0;\r\n}\r\n\r\n/* 深色页里沿用浅色值的槽：数值压淡，鼠标悬停有说明。 */\r\n.dts-colorValue--inherited {\r\n  opacity: 0.55;\r\n}\r\n\r\n.dts-colorClear {\r\n  flex: none;\r\n  margin-left: 2px;\r\n  padding: 0 6px;\r\n  border: 0;\r\n  border-radius: var(--dsw-radius-md);\r\n  background: none;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font-size: 12px;\r\n  line-height: 18px;\r\n  cursor: pointer;\r\n}\r\n\r\n.dts-colorClear:hover {\r\n  background: var(--dsw-alias-interactive-bg-hover);\r\n  color: var(--dsw-alias-label-secondary);\r\n}\r\n\r\n.dts-colorsDetails {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 6px;\r\n  margin-top: 2px;\r\n  padding-top: 6px;\r\n  border-top: 0.5px solid var(--dsw-alias-border-l1);\r\n}\r\n\r\n.dts-colorsDetails > summary {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 5px;\r\n  list-style: none;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font-size: 11px;\r\n  line-height: 16px;\r\n  cursor: pointer;\r\n}\r\n\r\n.dts-colorsDetails > summary::-webkit-details-marker {\r\n  display: none;\r\n}\r\n\r\n.dts-colorsDetails > summary::before {\r\n  content: \"›\";\r\n  display: inline-block;\r\n  width: 10px;\r\n  color: var(--dsw-alias-label-caption);\r\n  transition: transform 0.12s ease;\r\n}\r\n\r\n.dts-colorsDetails[open] > summary::before {\r\n  transform: rotate(90deg);\r\n}\r\n\r\n.dts-colorsDetails[open] > summary {\r\n  margin-bottom: 2px;\r\n}\r\n\r\n.dts-colorsHint {\r\n  padding-left: 64px;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font-size: 11px;\r\n  line-height: 16px;\r\n}\r\n";

/* 像素流光：src/pixel-flow.js，构建时内联到这里（预览页也直接引同一份文件）。
   里面还有解析 CSS 颜色用的 parseCssColor / readCssColor。 */
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


function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches === true);
    update();
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", update);
      return () => query.removeEventListener("change", update);
    }
    return undefined;
  }, []);
  return reduced;
}

/**
 * 流光场的画布：field 只建一次，功率 / 速度 / 减少动效都从 ref 里读，
 * 所以拖档、换设置都不会重建画布，动画也不会被打断。
 */
function FlowCanvas(props) {
  const canvasRef = React.useRef(null);
  const live = React.useRef(props);
  live.current = props;
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return undefined;
    const field = createPixelFlow(canvas, {
      cell: 5,
      color: () => readCssColor(canvas, ["--dts-flow-color", "--dts-particle-color", "--dts-accent-color"]),
      power: () => live.current.power,
      speed: () => live.current.speed,
      reduced: () => live.current.reduced,
    });
    return () => {
      if (field) field.dispose();
    };
  }, []);
  return h("canvas", { className: "dts-pixelFlow", ref: canvasRef, "aria-hidden": "true" });
}

/**
 * 滑条外观只描述形状与材质，颜色交给「配色」。
 * 紧凑是原来的细轨，块面是暖灰整块 + 圆角方拇指，胶囊是 24px 胶囊轨 + 白圆拇指。
 */
const SLIDER_STYLES = [
  { id: "compact", label: "紧凑" },
  { id: "claude", label: "块面" },
  { id: "codex", label: "胶囊" },
];
const DEFAULT_SLIDER_STYLE = "compact";
/**
 * 特效是四个样式加「关」：流光场 / 密度粒子 / 心跳 / 字符点阵。
 * auto 跟随外观（只有胶囊那套有），其余直接就是选中的样式。
 * 强度不在这里定：座位把档位换算成 0–1 的 --dts-power，四个样式共用一根值。
 * 特效层住在填充里，所以紧凑的 2px 细轨会自动降级成「只有流光」。
 */
const EFFECT_MODES = [
  { id: "off", label: "关" },
  { id: "auto", label: "跟随外观" },
  { id: "flow", label: "流光场" },
  { id: "dust", label: "密度粒子" },
  { id: "pulse", label: "心跳" },
  { id: "glyph", label: "字符点阵" },
];
const EFFECT_KINDS = ["flow", "dust", "pulse", "glyph"];
const DEFAULT_EFFECTS = "auto";
/**
 * 特效自己的两个设置：
 *   maxOnly 只在最高档出现（关 = 全程，功率跟档位走）；
 *   speeds  每个样式各一档速度倍率，存 0.7 / 1 / 1.4。
 */
const SPEED_STEPS = [
  { id: 0.7, label: "慢" },
  { id: 1, label: "标准" },
  { id: 1.4, label: "快" },
];
const DEFAULT_FX = {
  maxOnly: false,
  speeds: { flow: 1, dust: 1, pulse: 1, glyph: 1 },
};
const DEFAULT_FX_GETTER = () => DEFAULT_FX;
/** 字符点阵场里跑的字：渲染时首尾各写一遍，translateX(-50%) 才接得回开头。 */
const GLYPH_TEXT = "01+#×/=:·".repeat(9);
/**
 * 底部刻度与外观解耦：auto 跟随外观（块面用两端字，其余档位名）。
 * ticks 档位名（可点）/ axis 两端字 / none 不显示。
 */
const LABEL_FORMS = [
  { id: "auto", label: "跟随外观" },
  { id: "ticks", label: "档位名" },
  { id: "axis", label: "两端字" },
  { id: "none", label: "不显示" },
];
const DEFAULT_LABELS = "auto";
/** 两端字用这套皮肤自己的措辞：块面的滑条按理解深度方向排。 */
const AXIS_TEXT = ["Faster", "Smarter"];
/** 轨道矮于这个高度时粒子放不下，特效降级成只有流光。 */
const FLOW_THIN_TRACK_H = 24;
/**
 * 两端标签可以探出轨道多远：.dts-band 的水平内边距（8px）。
 * 量宽度时先从 computed style 读，这里只是读不到时的兜底。
 */
const LABEL_ROOM = 8;
/**
 * 拖动方式：
 *   step   逐档——指针每动一下就把位置取整到刻度，拇指从不落在两档之间。
 *   smooth 平滑——拇指连续跟手，读数与高亮停在已提交档，松手取整到最近档并提交
 *          （协议上仍是离散档位）。
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
const DEFAULT_EFFECTS_GETTER = () => DEFAULT_EFFECTS;
const DEFAULT_LABELS_GETTER = () => DEFAULT_LABELS;
const SMOOTH_OFF_GETTER = () => false;
const NOOP_SUBSCRIBE = () => () => {};

/** 等 `remote` / `remote.session` 的看门狗：老宿主没有这两个服务时退回旧路径。 */
const INJECT_FALLBACK_MS = 3000;
/** 特效里横穿填充的小点（密度粒子）；top / duration / delay 都是视觉参数。 */
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
const PALETTES_KEY = PLUGIN_ID + ":palettes";
const PALETTE_KEY = PLUGIN_ID + ":palette";
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const AUTO_PALETTE = "auto";
/**
 * 配色槽：前四个是主色；后三个收进「详细配置」，没填就跟随外观材质 / 宿主主题。
 * 空槽不是「黑色」，是「不覆盖」——这是稀疏配色的前提。
 */
const COLOR_SLOTS = [
  { id: "fill", label: "进度", group: "main" },
  { id: "accent", label: "强调", group: "main" },
  { id: "particle", label: "粒子", group: "main" },
  { id: "thumb", label: "拇指", group: "main" },
  { id: "track", label: "轨道", group: "detail" },
  { id: "tick", label: "刻度", group: "detail" },
  { id: "text", label: "文字", group: "detail" },
  /* 特效专用槽：默认留空 = 沿用主色 / 主题色，只在对应特效被选中时出现。 */
  { id: "flow", label: "流光", group: "fx" },
  { id: "dust", label: "尘埃", group: "fx" },
  { id: "pulse", label: "辉光", group: "fx" },
  { id: "glyph", label: "字符", group: "fx" },
];
const MAIN_SLOTS = COLOR_SLOTS.filter((slot) => slot.group === "main");
const DETAIL_SLOTS = COLOR_SLOTS.filter((slot) => slot.group === "detail");
const FX_SLOTS = COLOR_SLOTS.filter((slot) => slot.group === "fx");
/**
 * 内置配色：只填四个主色，详细三项留空（它们本来就是各外观的中性材质）。
 * 设置里改的是本地副本，之后的插件版本不会覆盖用户改过的值。
 */
const BUILTIN_PALETTES = [
  {
    id: "claude",
    name: "Claude 风",
    light: { fill: "#e0dbd6", accent: "#c6613f", particle: "#c6613f", thumb: "#ffffff" },
    dark: { fill: "#3a3330", accent: "#d97757", particle: "#d97757", thumb: "#f4efe8" },
  },
  {
    id: "codex",
    name: "Codex 风",
    light: { fill: "#3a83f7", accent: "#924ff7", particle: "#ffffff", thumb: "#ffffff" },
    dark: { fill: "#3a83f7", accent: "#ad7bf9", particle: "#ffffff", thumb: "#ffffff" },
  },
  {
    id: "tundra",
    name: "苔原",
    light: { fill: "#d3ddc7", accent: "#5a7d48", particle: "#5a7d48", thumb: "#ffffff" },
    dark: { fill: "#34412f", accent: "#a7c48f", particle: "#a7c48f", thumb: "#f1f5ea" },
  },
  {
    id: "seasalt",
    name: "海盐",
    light: { fill: "#cfe0e0", accent: "#4a787c", particle: "#4a787c", thumb: "#ffffff" },
    dark: { fill: "#2c3c3e", accent: "#8ec6c6", particle: "#8ec6c6", thumb: "#eef7f6" },
  },
  {
    id: "duskrose",
    name: "暮玫",
    light: { fill: "#e7d3d5", accent: "#a35a67", particle: "#a35a67", thumb: "#ffffff" },
    dark: { fill: "#3b2b2e", accent: "#d8959e", particle: "#d8959e", thumb: "#f8eeee" },
  },
];
const BUILTIN_PALETTE_IDS = BUILTIN_PALETTES.map((palette) => palette.id);
/**
 * 空槽时色块显示的颜色：按外观取浅色近似值，只用于设置页的取样；
 * 真正生效的颜色由该外观的 CSS 默认值（含宿主令牌）决定。
 */
const DEFAULT_COLORS = {
  compact: {
    track: "#e7e3de",
    fill: "#6f5685",
    thumb: "#ffffff",
    accent: "#6f5685",
    tick: "#8a8580",
    text: "#77736f",
    particle: "#ffffff",
    /* 特效槽留空时的取样：跟随粒子色（紧凑就是白）。 */
    flow: "#ffffff",
    dust: "#ffffff",
    pulse: "#ffffff",
    glyph: "#ffffff",
  },
  claude: {
    track: "#edeae8",
    fill: "#e0dbd6",
    thumb: "#ffffff",
    accent: "#c6613f",
    tick: "#b6b2af",
    text: "#77736f",
    /* 和强调色同值：这一套的填充太浅，白粒子看不见。 */
    particle: "#c6613f",
    flow: "#c6613f",
    dust: "#c6613f",
    pulse: "#c6613f",
    glyph: "#c6613f",
  },
  codex: {
    track: "#e8e8e8",
    fill: "#3a83f7",
    thumb: "#ffffff",
    accent: "#924ff7",
    tick: "#6d6b67",
    text: "#77736f",
    particle: "#ffffff",
    flow: "#ffffff",
    dust: "#ffffff",
    pulse: "#ffffff",
    glyph: "#ffffff",
  },
};
const EMPTY_COLORS = {};
const EMPTY_PALETTES = [];
const EMPTY_PALETTES_GETTER = () => EMPTY_PALETTES;
const AUTO_PALETTE_GETTER = () => AUTO_PALETTE;
const FALSE_GETTER = () => false;

/** 拇指圆心 / 刻度 / 填充共用的位置公式，几何全从 CSS 变量来。 */
function sliderPosition(ratio) {
  return `calc(var(--dts-pad) + ${ratio} * (100% - var(--dts-pad) * 2))`;
}

/**
 * 刻度词的落位：默认中心压在圆点上；盒子探出轨道超过 room 时往里推，刚好贴住边界。
 * center / width / labelWidth / room 都是 px；返回相对居中位置的位移（正 = 往右）。
 */
function clampLabelShift(center, width, labelWidth, room) {
  const half = labelWidth / 2;
  const min = half - room;
  const max = width - half + room;
  /* 比轨道还宽：交给 max-width 的省略号，硬推只会两头都出界。 */
  if (!(max >= min)) return 0;
  const clamped = Math.min(Math.max(center, min), max);
  return Math.round((clamped - center) * 100) / 100;
}

/** 位移写进 transform，保留 -50% 的居中；不到半个像素就不写。 */
function labelShiftTransform(shift) {
  if (typeof shift !== "number" || Math.abs(shift) < 0.05) return undefined;
  const sign = shift < 0 ? "-" : "+";
  return `translateX(calc(-50% ${sign} ${Math.abs(shift)}px))`;
}

function sameShifts(previous, next) {
  if (!Array.isArray(previous) || previous.length !== next.length) return false;
  return next.every((value, index) => Math.abs(value - previous[index]) < 0.05);
}

/* ── 配色：稀疏的两套值，空槽交给外观材质 / 宿主主题 ────────────────── */

function normalizePaletteId(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : AUTO_PALETTE;
}

/** 只留已知槽位的 6 位 hex；空槽照样缺席，不做补值。 */
function sanitizePaletteColors(raw) {
  const out = {};
  if (raw === null || typeof raw !== "object") return out;
  for (const slot of COLOR_SLOTS) {
    const value = raw[slot.id];
    if (typeof value === "string" && HEX_COLOR.test(value)) out[slot.id] = value.toLowerCase();
  }
  return out;
}

function sanitizePalette(raw) {
  if (raw === null || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (id === "" || id === AUTO_PALETTE) return null;
  const name = typeof raw.name === "string" && raw.name.trim() !== "" ? raw.name.trim().slice(0, 24) : "配色";
  return { id, name, light: sanitizePaletteColors(raw.light), dark: sanitizePaletteColors(raw.dark) };
}

function sanitizePalettes(raw) {
  const list = [];
  const seen = new Set();
  if (!Array.isArray(raw)) return list;
  for (const entry of raw) {
    const palette = sanitizePalette(entry);
    if (palette === null || seen.has(palette.id)) continue;
    seen.add(palette.id);
    list.push(palette);
  }
  return list;
}

/** 内置配色按出厂顺序排在前；存储里改过的同名项优先，缺的补回来。 */
function withBuiltins(palettes) {
  const byId = new Map(palettes.map((palette) => [palette.id, palette]));
  const head = BUILTIN_PALETTES.map((builtin) => {
    const stored = byId.get(builtin.id);
    if (stored === undefined) return { ...builtin, light: { ...builtin.light }, dark: { ...builtin.dark } };
    byId.delete(builtin.id);
    return stored;
  });
  return [...head, ...byId.values()];
}

function findPalette(palettes, id) {
  if (!Array.isArray(palettes)) return undefined;
  return palettes.find((palette) => palette.id === id);
}

/** 当前深浅下真正生效的值：深色缺的槽回落到浅色。 */
function paletteColors(palette, dark) {
  if (palette === undefined) return EMPTY_COLORS;
  const light = palette.light ?? EMPTY_COLORS;
  const mode = dark ? palette.dark ?? EMPTY_COLORS : EMPTY_COLORS;
  const out = {};
  for (const slot of COLOR_SLOTS) {
    const value = mode[slot.id] ?? light[slot.id];
    if (typeof value === "string") out[slot.id] = value;
  }
  return out;
}

function paletteVars(palette, dark) {
  const colors = paletteColors(palette, dark);
  const vars = {};
  for (const slot of COLOR_SLOTS) {
    const value = colors[slot.id];
    if (typeof value === "string") vars[`--dts-${slot.id}-color`] = value;
  }
  return vars;
}

/** 设置页里某个槽的显示值：有值就显示，没有就显示该外观的浅色近似。 */
function paletteSlotColor(palette, slotId, styleId, dark) {
  const effective = paletteColors(palette, dark)[slotId];
  if (typeof effective === "string") return effective;
  const defaults = DEFAULT_COLORS[styleId] ?? DEFAULT_COLORS[DEFAULT_SLIDER_STYLE];
  return defaults[slotId] ?? "#000000";
}

/**
 * 旧版把自定义颜色按外观存（`{"claude":{"fill":"#…"}}`）。升级时按外观拆成独立配色，
 * 名字标明来源，并选中当前外观那一套——不静默丢色，也不把两套外观的色硬凑成一袋。
 */
function migrateLegacyColors(raw, styleId) {
  const palettes = [];
  let activeId = AUTO_PALETTE;
  if (raw === null || typeof raw !== "object") return { palettes, activeId };
  for (const style of SLIDER_STYLES) {
    const colors = sanitizePaletteColors(raw[style.id]);
    if (Object.keys(colors).length === 0) continue;
    const palette = {
      id: `legacy-${style.id}`,
      name: `旧自定义 · ${style.label}`,
      light: colors,
      dark: {},
    };
    palettes.push(palette);
    if (style.id === styleId) activeId = palette.id;
  }
  if (activeId === AUTO_PALETTE && palettes.length > 0) activeId = palettes[0].id;
  return { palettes, activeId };
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
            getPalette: () =>
              typeof services.palette?.get === "function" ? services.palette.get() : AUTO_PALETTE,
            subscribePalette: (listener) =>
              typeof services.palette?.subscribe === "function"
                ? services.palette.subscribe(listener)
                : NOOP_SUBSCRIBE(),
            getPalettes: () =>
              typeof services.palettes?.get === "function" ? services.palettes.get() : EMPTY_PALETTES,
            subscribePalettes: (listener) =>
              typeof services.palettes?.subscribe === "function"
                ? services.palettes.subscribe(listener)
                : NOOP_SUBSCRIBE(),
            getDark: () => (typeof services.dark?.get === "function" ? services.dark.get() : false),
            subscribeDark: (listener) =>
              typeof services.dark?.subscribe === "function"
                ? services.dark.subscribe(listener)
                : NOOP_SUBSCRIBE(),
            getSmooth: () => (typeof services.smooth?.get === "function" ? services.smooth.get() : false),
            subscribeSmooth: (listener) =>
              typeof services.smooth?.subscribe === "function"
                ? services.smooth.subscribe(listener)
                : NOOP_SUBSCRIBE(),
            getEffects: () =>
              typeof services.effects?.get === "function" ? services.effects.get() : DEFAULT_EFFECTS,
            subscribeEffects: (listener) =>
              typeof services.effects?.subscribe === "function"
                ? services.effects.subscribe(listener)
                : NOOP_SUBSCRIBE(),
            getFx: () => (typeof services.fx?.get === "function" ? services.fx.get() : DEFAULT_FX),
            subscribeFx: (listener) =>
              typeof services.fx?.subscribe === "function" ? services.fx.subscribe(listener) : NOOP_SUBSCRIBE(),
            getLabels: () =>
              typeof services.labels?.get === "function" ? services.labels.get() : DEFAULT_LABELS,
            subscribeLabels: (listener) =>
              typeof services.labels?.subscribe === "function"
                ? services.labels.subscribe(listener)
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
      getPalette,
      subscribePalette,
      getPalettes,
      subscribePalettes,
      getDark,
      subscribeDark,
      getSmooth,
      subscribeSmooth,
      getEffects,
      subscribeEffects,
      getFx,
      subscribeFx,
      getLabels,
      subscribeLabels,
    } = props;

    const subscribe = React.useCallback((listener) => directory.subscribe(listener), [directory]);
    const state = React.useSyncExternalStore(subscribe, () => directory.getSnapshot());
    const styleId = React.useSyncExternalStore(
      typeof subscribeStyle === "function" ? subscribeStyle : NOOP_SUBSCRIBE,
      typeof getStyle === "function" ? getStyle : DEFAULT_STYLE_GETTER,
    );
    const paletteId = React.useSyncExternalStore(
      typeof subscribePalette === "function" ? subscribePalette : NOOP_SUBSCRIBE,
      typeof getPalette === "function" ? getPalette : AUTO_PALETTE_GETTER,
    );
    const palettes = React.useSyncExternalStore(
      typeof subscribePalettes === "function" ? subscribePalettes : NOOP_SUBSCRIBE,
      typeof getPalettes === "function" ? getPalettes : EMPTY_PALETTES_GETTER,
    );
    const dark = React.useSyncExternalStore(
      typeof subscribeDark === "function" ? subscribeDark : NOOP_SUBSCRIBE,
      typeof getDark === "function" ? getDark : FALSE_GETTER,
    );
    const smooth = React.useSyncExternalStore(
      typeof subscribeSmooth === "function" ? subscribeSmooth : NOOP_SUBSCRIBE,
      typeof getSmooth === "function" ? getSmooth : SMOOTH_OFF_GETTER,
    );
    const effectsMode = React.useSyncExternalStore(
      typeof subscribeEffects === "function" ? subscribeEffects : NOOP_SUBSCRIBE,
      typeof getEffects === "function" ? getEffects : DEFAULT_EFFECTS_GETTER,
    );
    const labelMode = React.useSyncExternalStore(
      typeof subscribeLabels === "function" ? subscribeLabels : NOOP_SUBSCRIBE,
      typeof getLabels === "function" ? getLabels : DEFAULT_LABELS_GETTER,
    );
    /* 特效自己的设置：只在最高档 / 每个样式的速度。 */
    const fxOptions = React.useSyncExternalStore(
      typeof subscribeFx === "function" ? subscribeFx : NOOP_SUBSCRIBE,
      typeof getFx === "function" ? getFx : DEFAULT_FX_GETTER,
    );
    const reduced = useReducedMotion();
    const geometry = SLIDER_GEOMETRY[styleId] ?? SLIDER_GEOMETRY[DEFAULT_SLIDER_STYLE];
    /* 两轴先解析成具体形态：座位里所有分支只看 effectsKind / labelForm。 */
    const effectsKind = resolveEffects(normalizeEffects(effectsMode), styleId);
    const fxMaxOnly = fxOptions.maxOnly === true;
    const fxSpeed = normalizeFx(fxOptions).speeds[effectsKind] ?? 1;
    const labelForm = resolveLabels(normalizeLabels(labelMode), styleId);
    const thinFlow = flowIsThin(geometry);
    /* 配色是独立一层：自动 = 不覆盖，交给外观 CSS；选中配色则按当前深浅取值。 */
    const activePaletteId = normalizePaletteId(paletteId);
    const activePalette =
      activePaletteId === AUTO_PALETTE ? undefined : findPalette(palettes, activePaletteId);
    const colorVars = paletteVars(activePalette, dark);
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
    /* 平滑模式下的连续位置（0–1）；逐档模式恒为 null。
       它只驱动拇指和填充，不参与读数 / 圆点 / aria 的取档。 */
    const [dragRatio, setDragRatio] = React.useState(null);
    /* 刻度词的实测位移（px，按档位下标）；null = 还没量过，先按居中画。 */
    const [labelShifts, setLabelShifts] = React.useState(null);
    const [menuPos, setMenuPos] = React.useState(null);
    const [toast, setToast] = React.useState(null);
    const [selectionFocus, setSelectionFocus] = React.useState(false);

    const rootRef = React.useRef(null);
    const triggerRef = React.useRef(null);
    const menuRef = React.useRef(null);
    const trackRef = React.useRef(null);
    /* 特效层：只用来给正在跑的动画乘播放速率（见下面的 effect）。 */
    const flowRef = React.useRef(null);
    const labelRefs = React.useRef([]);
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
    /**
     * 离散指示（读数 / 圆点 / 刻度高亮 / aria）用哪一档：
     *   - 逐档拖动：指针始终吸在刻度上，落到哪档就显示哪档；
     *   - 平滑拖动：停在已提交档，指针只驱动拇指和填充，松手提交后才更新——
     *     否则连续拖动时每越过一条档位中线，读数和圆点就来回翻一次。
     */
    const displayIndex =
      dragRatio === null && dragIndex !== null ? dragIndex : pendingEffortIndex >= 0 ? pendingEffortIndex : settledIndex;
    const indexRatio = (index) =>
      efforts.length <= 1 ? 0 : Math.max(0, Math.min(index, efforts.length - 1)) / (efforts.length - 1);
    /* 拇指 / 填充的位置：平滑拖动时用连续 ratio，其余按最近档取整。 */
    const ratio = dragRatio !== null ? dragRatio : indexRatio(displayIndex);
    /* 读数同理：逐档跟指针，平滑拖动中保持已提交档，松手才变。 */
    const bandValue =
      dragRatio === null && dragIndex !== null ? efforts[dragIndex]?.name ?? effortLabel : effortLabel;
    const lastIndex = Math.max(0, efforts.length - 1);
    /**
     * 特效强度（0–1），四个样式共用：
     *   - 逐档 / 点刻度 / 键盘：已提交档位在档位序列里的位置，最低档 0、最高档 1；
     *   - 平滑拖动：直接跟指针（拖动中读数仍停在已提交档，只有特效跟手）；
     *   - 开了「只在最高档」：只亮最后一格。平滑拖动进出这一格要跟手渐变，所以
     *     跨过最高档的吸附边界就开始 smoothstep 淡入，到右端满格；逐档 / 键盘
     *     仍只给 0 或 1，淡入淡出交给 CSS 的 opacity 过渡。
     *   「只在最高档」的功率不跟 displayIndex 走：平滑拖动时它冻结在已提交档，
     *   拿它算功率的话，指针在最高档里移动也毫无反应，只有松手提交那一下才翻——
     *   看上去就是特效凭空出现 / 消失。
     * CSS 用它算亮度与饱和度，JS 用它乘动画播放速率——一处取值，两边一致。
     */
    const fxPower = (() => {
      if (effectsKind === null || efforts.length <= 1) return 0;
      if (dragRatio !== null) {
        if (!fxMaxOnly) return Math.min(1, Math.max(0, dragRatio));
        /* 最高档那格：从「指针吸附到最高档」的分界线起淡入，边界处正好为 0。 */
        const zoneStart = (lastIndex - 0.5) / lastIndex;
        const t = Math.min(1, Math.max(0, (dragRatio - zoneStart) / (1 - zoneStart)));
        return t * t * (3 - 2 * t);
      }
      if (fxMaxOnly) return displayIndex >= lastIndex ? 1 : 0;
      return indexRatio(displayIndex);
    })();
    const flowStyle = { "--dts-power": fxPower };
    /* 「只在最高档」时 0 就是彻底看不见：把最低档那点底噪也关掉。 */
    if (fxMaxOnly) flowStyle["--dts-fx-floor"] = 0;
    /* 速度跟档位走：改 animation-duration 会让在跑的动画跳一格，改播放速率不会。
       菜单每次打开都会重建特效层、动画从 0 开始，所以 open 也要在依赖里。 */
    React.useEffect(() => {
      const node = flowRef.current;
      if (node === null || typeof node.getAnimations !== "function") return;
      const rate = (0.55 + 1.7 * fxPower) * fxSpeed;
      for (const animation of node.getAnimations({ subtree: true })) animation.playbackRate = rate;
    }, [fxPower, fxSpeed, effectsKind, styleId, open]);

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

    /* ── 刻度词落位：居中压在圆点上，盒子要出界才往里让 ──────────────────
       两端标签居中后有一半落在轨道外，轨道外侧只有 .dts-band 的水平内边距可
       以借；借完还宽就按实测宽度把词往里推，最多推到贴住内边距外沿。 */
    React.useLayoutEffect(() => {
      const count = labelForm === "axis" ? AXIS_TEXT.length : labelForm === "ticks" ? efforts.length : 0;
      const track = trackRef.current;
      if (!open || pane !== "root" || count === 0 || track === null) {
        setLabelShifts(null);
        return undefined;
      }
      let disposed = false;
      const measure = () => {
        if (disposed) return;
        const width = track.clientWidth;
        const nodes = labelRefs.current.slice(0, count);
        if (!(width > 0) || nodes.length !== count || nodes.some((node) => node === null || node === undefined)) return;
        const band = typeof track.closest === "function" ? track.closest(".dts-band") : null;
        const padding =
          band === null || typeof getComputedStyle !== "function" ? LABEL_ROOM : parseFloat(getComputedStyle(band).paddingLeft);
        const room = Number.isFinite(padding) ? padding : LABEL_ROOM;
        const next = nodes.map((node, index) => {
          const ratio = count === 1 ? 0 : index / (count - 1);
          const center = geometry.pad + ratio * (width - geometry.pad * 2);
          return clampLabelShift(center, width, node.offsetWidth, room);
        });
        setLabelShifts((previous) => (sameShifts(previous, next) ? previous : next));
      };
      measure();
      const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
      observer?.observe(track);
      window.addEventListener?.("resize", measure);
      const fonts = document.fonts;
      if (fonts !== undefined && typeof fonts?.ready?.then === "function") fonts.ready.then(measure).catch(() => {});
      return () => {
        disposed = true;
        observer?.disconnect();
        window.removeEventListener?.("resize", measure);
      };
    }, [open, pane, labelForm, styleId, efforts.map((level) => level.id).join("|")]);

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

    /**
     * 提交的唯一入口：select 可能 **同步抛**、也可能 reject（宿主写库失败时不一定
     * 包成 `{ ok: false }`）。两条路都要落到 Toast，否则用户只看到滑条弹回去。
     */
    const runSelection = (selection, onSuccess) => {
      let promise;
      try {
        promise = select(selection);
      } catch (error) {
        showToast(`${TEXT.toastSelectFailed}：${error?.message ?? error}`);
        return;
      }
      Promise.resolve(promise).then(
        (result) => settle(result, onSuccess),
        (error) => showToast(`${TEXT.toastSelectFailed}：${error?.message ?? error}`),
      );
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
      runSelection(selection, () => close(true));
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
      runSelection(selection, () => {});
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
      const nextIndex = Math.round(next * (efforts.length - 1));
      setDragIndex(nextIndex);
      /* 逐档模式不存连续位置：拇指直接落到刻度上。 */
      setDragRatio(smooth ? next : null);
    };

    const onTrackPointerMove = (event) => {
      if (dragIndex === null && dragRatio === null) return;
      const next = ratioAt(event.clientX);
      const nextIndex = Math.round(next * Math.max(0, efforts.length - 1));
      setDragIndex(nextIndex);
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
      /* 原生 range 也认 PageUp / PageDown；档位只有 3–4 档，按一档走。 */
      else if (event.key === "PageUp") next = Math.min(last, base + 1);
      else if (event.key === "PageDown") next = Math.max(0, base - 1);
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
                h("span", { className: "dts-bandValue", "aria-live": "polite" }, bandValue),
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
                    /* 只有平滑拖动需要逐帧跟手；它一出现就由 CSS 关掉过渡。
                       逐档不设这个标记——跨档时的滑动正是靠外观自带的过渡画出来。 */
                    "data-dts-follow": dragRatio !== null ? "" : undefined,
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
                    onPointerCancel: (event) => {
                      /* 触摸被系统手势 / 滚动接管：指针捕获和拖动状态都要收掉，
                         否则下一次悬停会被当成还在拖，松手时凭空提交一档。 */
                      trackRef.current?.releasePointerCapture?.(event?.pointerId);
                      setDragIndex(null);
                      setDragRatio(null);
                    },
                    onLostPointerCapture: () => {
                      /* 正常松手也走这儿：那时拖动状态已由 commitIndex 清掉，直接跳过。 */
                      if (dragIndex === null && dragRatio === null) return;
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
                    effectsKind !== null && efforts.length > 1
                      ? h(
                          "span",
                          {
                            className: "dts-flow",
                            "aria-hidden": "true",
                            ref: flowRef,
                            "data-dts-fx": effectsKind,
                            "data-dts-flow": thinFlow ? "thin" : undefined,
                            "data-dts-flow-follow": dragRatio !== null ? "" : undefined,
                            style: flowStyle,
                          },
                          /* 四个样式把各自的层都放在这里，CSS 按 data-dts-fx 只留一个；
                             这样切样式不重建 DOM，动画也不会从头开始。 */
                          h(FlowCanvas, { power: fxPower, speed: fxSpeed, reduced }),
                          h("span", { className: "dts-flowSheen" }),
                          h("span", { className: "dts-fxGlowSoft" }),
                          h("span", { className: "dts-fxGlowStrong" }),
                          h(
                            "span",
                            { className: "dts-fxGlyph" },
                            h("span", { className: "dts-fxGlyphRow" }, GLYPH_TEXT + GLYPH_TEXT),
                            h("span", { className: "dts-fxGlyphRow dts-fxGlyphRow--b" }, GLYPH_TEXT + GLYPH_TEXT),
                          ),
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
                                  /* 密度粒子用它决定「这颗要不要亮」：第 i 颗在功率越过 i/8 后出现。 */
                                  "--dts-fx-i": String(index / FLOW_PARTICLES.length),
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
                      className: "dts-dot" + (index <= displayIndex ? " dts-dot--on" : ""),
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
                labelForm === "none"
                  ? null
                  : labelForm === "axis"
                    ? h(
                        "div",
                        { className: "dts-axis", "aria-hidden": "true" },
                        AXIS_TEXT.map((label, index) =>
                          h(
                            "span",
                            {
                              key: label,
                              className: "dts-axisLabel",
                              ref: (node) => {
                                labelRefs.current[index] = node;
                              },
                              style: {
                                left: sliderPosition(index),
                                transform: labelShiftTransform(labelShifts?.[index]),
                              },
                            },
                            label,
                          ),
                        ),
                      )
                    : h(
                        "div",
                        { className: "dts-ticks", style: { "--dts-levels": efforts.length } },
                        efforts.map((level, index) =>
                          h(
                            "button",
                            {
                              key: level.id,
                              type: "button",
                              tabIndex: -1,
                              "aria-label": level.name,
                              className: "dts-tick" + (index === displayIndex ? " dts-tick--on" : ""),
                              ref: (node) => {
                                labelRefs.current[index] = node;
                              },
                              style: {
                                left: sliderPosition(index / Math.max(1, efforts.length - 1)),
                                transform: labelShiftTransform(labelShifts?.[index]),
                              },
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

function normalizeEffects(value) {
  /* 旧版的「开」就是胶囊那套流光 + 粒子：升级后归到密度粒子，不算丢设置。 */
  if (value === "on") return "dust";
  if (value === "off" || value === "auto") return value;
  return EFFECT_KINDS.includes(value) ? value : DEFAULT_EFFECTS;
}

function normalizeLabels(value) {
  return value === "ticks" || value === "axis" || value === "none" ? value : DEFAULT_LABELS;
}

/**
 * 特效该画哪一个：返回样式 id，或 null（不画）。
 * auto 只有胶囊那套有；与外观分家之后，这里就是座位与设置面板共用的唯一判定。
 */
function resolveEffects(mode, styleId) {
  if (mode === "auto") return styleId === "codex" ? "dust" : null;
  return EFFECT_KINDS.includes(mode) ? mode : null;
}

/** 底部刻度形态：auto 时块面用两端字，其余用档位名。 */
function resolveLabels(mode, styleId) {
  if (mode === "ticks" || mode === "axis" || mode === "none") return mode;
  return styleId === "claude" ? "axis" : "ticks";
}

/** 粒子要不要画：细轨（紧凑）只留流光。 */
function flowIsThin(geometry) {
  return geometry.trackH < FLOW_THIN_TRACK_H;
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

function storedEffects() {
  try {
    return normalizeEffects(window.localStorage.getItem(EFFECTS_KEY));
  } catch {
    return DEFAULT_EFFECTS;
  }
}

function rememberEffects(value) {
  try {
    window.localStorage.setItem(EFFECTS_KEY, normalizeEffects(value));
  } catch {
    /* 存不了就只在本次运行里生效 */
  }
}

/** 特效自己的设置（只在最高档 / 每个样式的速度）；坏值一律回默认，不半信半疑。 */
function normalizeFx(value) {
  const source = value !== null && typeof value === "object" ? value : {};
  const speeds = source.speeds !== null && typeof source.speeds === "object" ? source.speeds : {};
  const next = { maxOnly: source.maxOnly === true, speeds: {} };
  for (const kind of EFFECT_KINDS) {
    const speed = Number(speeds[kind]);
    next.speeds[kind] = SPEED_STEPS.some((step) => step.id === speed) ? speed : 1;
  }
  return next;
}

function storedFx() {
  try {
    return normalizeFx(JSON.parse(window.localStorage.getItem(FX_OPTS_KEY) ?? "null"));
  } catch {
    return normalizeFx(null);
  }
}

function rememberFx(value) {
  try {
    window.localStorage.setItem(FX_OPTS_KEY, JSON.stringify(normalizeFx(value)));
  } catch {
    /* 存不了就只在本次运行里生效 */
  }
}

function storedLabels() {
  try {
    return normalizeLabels(window.localStorage.getItem(LABELS_KEY));
  } catch {
    return DEFAULT_LABELS;
  }
}

function rememberLabels(value) {
  try {
    window.localStorage.setItem(LABELS_KEY, normalizeLabels(value));
  } catch {
    /* 存不了就只在本次运行里生效 */
  }
}

function storedLegacyColors() {
  try {
    return JSON.parse(window.localStorage.getItem(COLORS_KEY) || "{}");
  } catch {
    return {};
  }
}

function storedPalettes() {
  try {
    return withBuiltins(sanitizePalettes(JSON.parse(window.localStorage.getItem(PALETTES_KEY) || "[]")));
  } catch {
    return withBuiltins([]);
  }
}

function rememberPalettes(value) {
  try {
    window.localStorage.setItem(PALETTES_KEY, JSON.stringify(value));
  } catch {
    /* 存不了就只在本次运行里生效 */
  }
}

function storedPaletteId() {
  try {
    return normalizePaletteId(window.localStorage.getItem(PALETTE_KEY));
  } catch {
    return AUTO_PALETTE;
  }
}

function rememberPaletteId(value) {
  try {
    window.localStorage.setItem(PALETTE_KEY, normalizePaletteId(value));
  } catch {
    /* 存不了就只在本次运行里生效 */
  }
}

/** 迁移只看一次：存储里出现过 `:palettes`（哪怕空数组）就算已经迁移过。 */
function hasStoredPalettes() {
  try {
    return window.localStorage.getItem(PALETTES_KEY) !== null;
  } catch {
    return true;
  }
}

/**
 * 当前深浅：宿主编排页把 `data-ds-dark-theme` 挂在 body 上，CSS 与这里读同一个标记。
 * 拿不到 body 时按浅色处理。
 */
function createDarkStore() {
  const listeners = new Set();
  let dark = false;
  const read = () => {
    try {
      dark = document.body.hasAttribute("data-ds-dark-theme");
    } catch {
      dark = false;
    }
  };
  read();
  let observer = null;
  if (typeof MutationObserver === "function" && typeof document !== "undefined" && document.body) {
    observer = new MutationObserver(() => {
      const previous = dark;
      read();
      if (previous === dark) return;
      for (const fn of listeners) fn();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
  }
  return {
    get: () => dark,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    dispose: () => observer?.disconnect(),
  };
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
  return h(
    "div",
    { className: "dts-colorRow" + (props.overridden ? "" : " dts-colorRow--auto") },
    h("span", { className: "dts-colorLabel" }, props.label),
    h("input", {
      type: "color",
      className: "dts-colorInput",
      value: props.value,
      "aria-label": `${props.label}颜色`,
      onChange: (event) => props.onPick(event.target.value),
    }),
    h("span", {
      className: "dts-colorValue" + (props.inherited ? " dts-colorValue--inherited" : ""),
      title: props.inherited ? "深色没单独设置，沿用浅色值" : undefined,
    }, props.overridden ? props.value.toUpperCase() : "跟随主题"),
    props.overridden
      ? h(
          "button",
          {
            type: "button",
            className: "dts-colorClear",
            title: "恢复跟随主题",
            "aria-label": `${props.label}恢复跟随主题`,
            onClick: () => props.onClear(),
          },
          "↺",
        )
      : null,
  );
}

/** 某个槽在任一深浅里有没有值：决定显示「跟随主题」还是色值 + 重置按钮。 */
function paletteHasSlot(palette, slotId) {
  if (palette === undefined) return false;
  return typeof palette.light?.[slotId] === "string" || typeof palette.dark?.[slotId] === "string";
}

function ColorSection(props) {
  const { palette, styleId, mode, showParticle, fxKind } = props;
  const main = MAIN_SLOTS.filter((slot) => slot.id !== "particle" || showParticle);
  /* 特效色只有一个槽，跟着当前特效走；没开特效就不出现。 */
  const fxSlots = FX_SLOTS.filter((slot) => slot.id === fxKind);
  const rowFor = (slot) =>
    h(ColorRow, {
      key: slot.id,
      label: slot.label,
      value: paletteSlotColor(palette, slot.id, styleId, mode === "dark"),
      overridden: paletteHasSlot(palette, slot.id),
      inherited:
        mode === "dark" && palette?.dark?.[slot.id] === undefined && typeof palette?.light?.[slot.id] === "string",
      onPick: (value) => props.onPick(mode, slot.id, value),
      onClear: () => props.onClear(slot.id),
    });
  const anyOverride = COLOR_SLOTS.some((slot) => paletteHasSlot(palette, slot.id));
  return h(
    "div",
    { className: "dts-colors" },
    settingsRow("颜色", [
      h(
        "div",
        { key: "modes", className: "dts-modeTabs" },
        [
          ["light", "浅色"],
          ["dark", "深色"],
        ].map(([id, label]) =>
          h(
            "button",
            {
              key: id,
              type: "button",
              className: "dts-modeTab" + (mode === id ? " dts-modeTab--on" : ""),
              "aria-pressed": mode === id,
              onClick: () => props.onMode(id),
            },
            label,
          ),
        ),
      ),
      h(
        "button",
        { key: "reset", type: "button", className: "dts-colorReset", onClick: () => props.onReset() },
        "恢复默认",
      ),
    ]),
    anyOverride
      ? null
      : h("span", { className: "dts-colorsHint" }, "这套配色还没动过：主色跟随外观，详细三项跟随主题。"),
    main.map(rowFor),
    fxSlots.length === 0
      ? null
      : h(
          "div",
          { className: "dts-colorsFx" },
          fxSlots.map(rowFor),
          h("span", { className: "dts-colorsHint" }, "留空 = 跟随粒子色 / 主题色，不会盖掉主色。"),
        ),
    h(
      "details",
      { className: "dts-colorsDetails" },
      h("summary", null, "详细配置"),
      DETAIL_SLOTS.map(rowFor),
      h("span", { className: "dts-colorsHint" }, "空槽 = 跟随主题；改了会写进这套配色，深浅各自记。"),
    ),
  );
}

/**
 * 设置页的一行：标签 / 控件 / 右侧说明。
 * 说明独占右边一列，不跟着芯片换行；窄容器里由 CSS 收到控件下面。
 */
function settingsRow(label, controls, hint) {
  return h(
    "div",
    { className: "dts-settings-row" },
    h("span", { className: "dts-settings-label" }, label),
    h("div", { className: "dts-controls" }, controls),
    hint === undefined || hint === null || hint === ""
      ? null
      : h("span", { className: "dts-settings-hint" }, hint),
  );
}

/** 类别标题：一个短词加一条向右收的细线，行与行之间靠留白分开。 */
function settingsGroup(label) {
  return h("div", { className: "dts-group" }, h("span", { className: "dts-group-label" }, label));
}

function SettingsPanel(props) {
  const [state, setState] = React.useState(() => ({
    enabled: props.getEnabled(),
    status: props.getStatus(),
    style: props.getStyle(),
    smooth: props.getSmooth(),
    effects: props.getEffects(),
    fx: props.getFx(),
    labels: props.getLabels(),
    palette: props.getPalette(),
    palettes: props.getPalettes(),
    dark: props.getDark(),
  }));
  React.useEffect(() => {
    const read = () =>
      setState({
        enabled: props.getEnabled(),
        status: props.getStatus(),
        style: props.getStyle(),
        smooth: props.getSmooth(),
        effects: props.getEffects(),
        fx: props.getFx(),
        labels: props.getLabels(),
        palette: props.getPalette(),
        palettes: props.getPalettes(),
        dark: props.getDark(),
      });
    read();
    return props.subscribe(read);
  }, [props]);
  /* 颜色编辑在浅色 / 深色两页之间切；默认停在当前模式。 */
  const [mode, setMode] = React.useState(() => (props.getDark() ? "dark" : "light"));
  /* 名称输入的草稿：输入时不动 store，失焦或回车才提交，免得中文输入法被打断。 */
  const [nameDraft, setNameDraft] = React.useState(null);
  const enabled = state.enabled;
  const style = normalizeStyle(state.style);
  const smooth = Boolean(state.smooth);
  const effectsMode = normalizeEffects(state.effects);
  const labelMode = normalizeLabels(state.labels);
  const effectsKind = resolveEffects(effectsMode, style);
  const fxOptions = normalizeFx(state.fx);
  const fxKindLabel = EFFECT_MODES.find((entry) => entry.id === effectsKind)?.label ?? "当前特效";
  const labelForm = resolveLabels(labelMode, style);
  const thin = flowIsThin(SLIDER_GEOMETRY[style]);
  const paletteId = normalizePaletteId(state.palette);
  const palettes = Array.isArray(state.palettes) ? state.palettes : EMPTY_PALETTES;
  const activePalette = paletteId === AUTO_PALETTE ? undefined : findPalette(palettes, paletteId);
  const activeBuiltin = activePalette !== undefined && BUILTIN_PALETTE_IDS.includes(activePalette.id);
  const status = String(state.status ?? "");
  const showStatus = enabled && status !== "" && !status.startsWith("已接管");
  const effectsHint =
    effectsMode === "auto"
      ? `跟随外观：${style === "codex" ? "胶囊自带密度粒子" : "这套外观不画特效"}`
      : effectsKind === null
        ? "填充里不画特效"
        : thin
          ? "紧凑的细轨只走一道流光，放不下粒子与字符"
          : "档位越高越亮、越鲜艳、越快";
  const labelsHint =
    labelMode === "auto"
      ? `跟随外观：现在用${labelForm === "axis" ? "两端字" : "档位名"}`
      : labelForm === "ticks"
        ? "每档一个名字，点一下换档"
        : labelForm === "axis"
          ? "只留两端措辞，换档靠拖轨道或键盘"
          : "底下不留刻度行";
  const paletteName =
    nameDraft !== null && activePalette !== undefined && nameDraft.id === activePalette.id
      ? nameDraft.name
      : activePalette?.name ?? "";
  const commitName = () => {
    if (nameDraft === null || activePalette === undefined || nameDraft.id !== activePalette.id) return;
    const next = nameDraft.name.trim();
    setNameDraft(null);
    if (next !== "" && next !== activePalette.name) props.renamePalette(activePalette.id, next);
  };
  return h(
    "div",
    { className: "dts-settings" },
    h(
      "div",
      { className: "dts-settings-head" },
      h("span", { className: "dts-settings-title" }, "模型位 · 思考强度"),
      h("span", { className: "dts-settings-sub" }, "Composer 的模型菜单换成模型行 + 强度滑条"),
    ),
    settingsGroup("滑条"),
    settingsRow(
      "接管",
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
      enabled ? "模型位由本插件接管" : "使用 DSH 原生模型菜单",
    ),
    settingsRow(
      "外观",
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
      "只改形状与材质，颜色看下面的配色",
    ),
    settingsRow(
      "刻度",
      LABEL_FORMS.map((entry) =>
        h(
          "button",
          {
            key: entry.id,
            type: "button",
            className: "dts-chip" + (labelMode === entry.id ? " dts-chip--on" : ""),
            "aria-pressed": labelMode === entry.id,
            onClick: () => props.selectLabels(entry.id),
          },
          entry.label,
        ),
      ),
      labelsHint,
    ),
    settingsRow(
      "滑动",
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
      smooth ? "拖动跟手，读数停在已提交档；松手吸附并提交最近档" : "指针始终吸在刻度上，拖到哪就是哪一档",
    ),
    settingsGroup("特效"),
    settingsRow(
      "特效",
      EFFECT_MODES.map((entry) =>
        h(
          "button",
          {
            key: entry.id,
            type: "button",
            className: "dts-chip" + (effectsMode === entry.id ? " dts-chip--on" : ""),
            "aria-pressed": effectsMode === entry.id,
            onClick: () => props.selectEffects(entry.id),
          },
          entry.label,
        ),
      ),
      effectsHint,
    ),
    /* 下面两行只在真有特效时出现：关掉 / 这套外观没有特效时留着没意义。 */
    effectsKind === null
      ? null
      : settingsRow(
          "强度",
          [
            ["all", "全程跟档"],
            ["max", "只在最高档"],
          ].map(([id, label]) =>
            h(
              "button",
              {
                key: id,
                type: "button",
                className: "dts-chip" + (fxOptions.maxOnly === (id === "max") ? " dts-chip--on" : ""),
                "aria-pressed": fxOptions.maxOnly === (id === "max"),
                onClick: () => props.selectFxMax(id === "max"),
              },
              label,
            ),
          ),
          fxOptions.maxOnly ? "只有最高档才画，离开就淡出" : "档位越高越亮、越鲜艳、越快",
        ),
    effectsKind === null
      ? null
      : settingsRow(
          "速度",
          SPEED_STEPS.map((step) =>
            h(
              "button",
              {
                key: step.id,
                type: "button",
                className: "dts-chip" + (fxOptions.speeds[effectsKind] === step.id ? " dts-chip--on" : ""),
                "aria-pressed": fxOptions.speeds[effectsKind] === step.id,
                onClick: () => props.selectFxSpeed(effectsKind, step.id),
              },
              step.label,
            ),
          ),
          `只作用于${fxKindLabel}；档位本身也会改速度`,
        ),
    settingsGroup("配色"),
    settingsRow(
      "配色",
      [
        ...[{ id: AUTO_PALETTE, name: "自动" }, ...palettes].map((entry) =>
          h(
            "button",
            {
              key: entry.id,
              type: "button",
              className: "dts-chip" + (paletteId === entry.id ? " dts-chip--on" : ""),
              "aria-pressed": paletteId === entry.id,
              onClick: () => {
                setNameDraft(null);
                props.selectPalette(entry.id);
              },
            },
            entry.name,
          ),
        ),
        h(
          "button",
          {
            key: "add",
            type: "button",
            className: "dts-chip dts-chip--add",
            onClick: () => {
              setNameDraft(null);
              props.addPalette();
            },
          },
          "＋ 新增",
        ),
      ],
      activePalette === undefined ? "不覆盖颜色：跟着外观与主题走" : activePalette.name + "：改动立刻生效",
    ),
    activePalette === undefined
      ? null
      : settingsRow(
          "名称",
          [
            h("input", {
              key: "name",
              type: "text",
              className: "dts-paletteName",
              value: paletteName,
              maxLength: 24,
              "aria-label": "配色名称",
              onChange: (event) =>
                setNameDraft({ id: activePalette.id, name: event.target.value }),
              onBlur: commitName,
              onKeyDown: (event) => {
                if (event.key === "Enter") event.currentTarget?.blur?.();
              },
            }),
            activeBuiltin
              ? null
              : h(
                  "button",
                  {
                    key: "remove",
                    type: "button",
                    className: "dts-colorReset",
                    onClick: () => {
                      setNameDraft(null);
                      props.removePalette(activePalette.id);
                    },
                  },
                  "删除",
                ),
          ],
          activeBuiltin ? "内置配色，颜色与名字都能改" : null,
        ),
    activePalette === undefined
      ? h(
          "p",
          { className: "dts-settings-note" },
          "选一套配色或「＋ 新增」之后，下面可以改它的颜色。",
        )
      : h(ColorSection, {
          palette: activePalette,
          styleId: style,
          mode,
          showParticle: effectsKind !== null && !thin,
          fxKind: effectsKind,
          onMode: setMode,
          onPick: (targetMode, slot, value) => props.setPaletteColor(activePalette.id, targetMode, slot, value),
          onClear: (slot) => props.clearPaletteColor(activePalette.id, slot),
          onReset: () => props.resetPalette(activePalette.id),
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
  let smooth = storedSmooth();
  let effects = storedEffects();
  let fx = storedFx();
  let labels = storedLabels();
  /* 配色：内置项先补齐；旧版按外观存的自定义色迁移成独立配色，只迁一次。 */
  let palettes = storedPalettes();
  let paletteId = storedPaletteId();
  if (!hasStoredPalettes()) {
    const legacy = migrateLegacyColors(storedLegacyColors(), style);
    if (legacy.palettes.length > 0) {
      palettes = withBuiltins(legacy.palettes);
      paletteId = legacy.activeId;
      rememberPalettes(palettes);
      rememberPaletteId(paletteId);
    }
  }
  if (paletteId !== AUTO_PALETTE && findPalette(palettes, paletteId) === undefined) paletteId = AUTO_PALETTE;
  let status = "尚未初始化";
  let services = null;
  /* 注册座位用的 ctx：优先用声明了 remote.session 的那条注入 scope。 */
  let seatCtx = ctx;
  let slotReady = false;
  let seatDispose = null;
  const listeners = new Set();
  const notify = () => {
    for (const fn of listeners) fn();
  };
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
      notify();
    },
  };
  /* 配色列表 / 当前配色：两个快照共用一个订阅集合。 */
  const paletteListStore = {
    get: () => palettes,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  const activePaletteStore = {
    get: () => paletteId,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  const commitPalettes = (next) => {
    palettes = next;
    rememberPalettes(next);
    notify();
  };
  const patchPalette = (id, updater) => {
    if (findPalette(palettes, id) === undefined) return;
    commitPalettes(palettes.map((palette) => (palette.id === id ? updater(palette) : palette)));
  };
  const selectPalette = (id) => {
    const next = normalizePaletteId(id);
    if (next === paletteId) return;
    if (next !== AUTO_PALETTE && findPalette(palettes, next) === undefined) return;
    paletteId = next;
    rememberPaletteId(next);
    notify();
  };
  const addPalette = () => {
    let index = 1;
    while (palettes.some((palette) => palette.name === `配色 ${index}`)) index += 1;
    const palette = {
      id: `custom-${Date.now().toString(36)}-${palettes.length}`,
      name: `配色 ${index}`,
      light: {},
      dark: {},
    };
    paletteId = palette.id;
    rememberPaletteId(paletteId);
    commitPalettes([...palettes, palette]);
  };
  const renamePalette = (id, name) => {
    const next = String(name ?? "").trim().slice(0, 24);
    if (next === "") return;
    patchPalette(id, (palette) => ({ ...palette, name: next }));
  };
  const removePalette = (id) => {
    if (BUILTIN_PALETTE_IDS.includes(id)) return;
    const next = palettes.filter((palette) => palette.id !== id);
    if (next.length === palettes.length) return;
    if (paletteId === id) {
      paletteId = AUTO_PALETTE;
      rememberPaletteId(paletteId);
    }
    commitPalettes(next);
  };
  const setPaletteColor = (id, mode, slotId, value) => {
    if (mode !== "light" && mode !== "dark") return;
    if (!COLOR_SLOTS.some((slot) => slot.id === slotId)) return;
    if (typeof value !== "string" || !HEX_COLOR.test(value)) return;
    patchPalette(id, (palette) => ({
      ...palette,
      [mode]: { ...palette[mode], [slotId]: value.toLowerCase() },
    }));
  };
  const clearPaletteColor = (id, slotId) => {
    const factory = BUILTIN_PALETTES.find((palette) => palette.id === id);
    patchPalette(id, (palette) => {
      const light = { ...palette.light };
      const dark = { ...palette.dark };
      if (factory !== undefined) {
        /* 内置配色的 ↺ 是「回到出厂值」，不是「跟随主题」——出厂没有的槽才清掉。 */
        if (typeof factory.light[slotId] === "string") light[slotId] = factory.light[slotId];
        else delete light[slotId];
        if (typeof factory.dark[slotId] === "string") dark[slotId] = factory.dark[slotId];
        else delete dark[slotId];
      } else {
        delete light[slotId];
        delete dark[slotId];
      }
      return { ...palette, light, dark };
    });
  };
  const resetPalette = (id) => {
    const factory = BUILTIN_PALETTES.find((palette) => palette.id === id);
    patchPalette(id, (palette) => ({
      ...palette,
      light: factory !== undefined ? { ...factory.light } : {},
      dark: factory !== undefined ? { ...factory.dark } : {},
    }));
  };
  const darkStore = createDarkStore();

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
  /** 枚举型开关（特效 / 刻度）：读回来先归一，写出去同时落盘。 */
  const makeChoiceStore = (read, commit, normalize) => ({
    get: read,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set: (value) => {
      const next = normalize(value);
      if (next === read()) return;
      commit(next);
      for (const fn of listeners) fn();
    },
  });
  const effectsStore = makeChoiceStore(
    () => effects,
    (next) => {
      effects = next;
      rememberEffects(next);
    },
    normalizeEffects,
  );
  /** 特效自己的设置：整体替换，写盘时一起归一。 */
  const fxStore = {
    get: () => fx,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set: (next) => {
      const merged = normalizeFx(next);
      if (JSON.stringify(merged) === JSON.stringify(fx)) return;
      fx = merged;
      rememberFx(merged);
      for (const fn of listeners) fn();
    },
  };
  const labelsStore = makeChoiceStore(
    () => labels,
    (next) => {
      labels = next;
      rememberLabels(next);
    },
    normalizeLabels,
  );
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
      seatDispose = registerThinkingSliderSeat(seatCtx, setStatus, services) ?? null;
    } catch (error) {
      setStatus("注册异常：" + (error?.message ?? String(error)));
      console.warn("[thinking-slider] registration failed:", error);
    }
  };

  /**
   * 座位用哪条 ctx 注册，决定了它能不能安全调用 `directoryFor`。
   *
   * 宿主 `ModelDirectoryResolver` 内部会摸 `ctx.remote.session`，而 Cordis 的
   * reflect 代理按「调用方 ctx 的 inject 声明」放行——发射时抛的就是
   * `cannot get property "remote.session" without inject`。所以下面先等
   * `remote` / `remote.session` 就绪，再用**那条声明了它们的 scope** 去注册；
   * 老宿主没有这两个服务时，看门狗退回原来只看两条服务的路径。
   */
  const startSeat = (scope) => {
    if (services !== null) return;
    if (injectWatchdog !== null) {
      clearTimeout(injectWatchdog);
      injectWatchdog = null;
    }
    seatCtx = scope;
    services = {
      models: scope.modelDirectories,
      sessions: scope.sessions,
      style: styleStore,
      palette: activePaletteStore,
      palettes: paletteListStore,
      dark: darkStore,
      smooth: smoothStore,
      effects: effectsStore,
      fx: fxStore,
      labels: labelsStore,
    };
    setStatus("modelDirectories / sessions 已就绪");
    sync();
  };

  let injectWatchdog = null;
  ctx.effect(
    () => () => {
      if (injectWatchdog !== null) {
        clearTimeout(injectWatchdog);
        injectWatchdog = null;
      }
    },
    "thinking-slider: inject watchdog",
  );

  /* 服务在 apply 里先取好：槽位声明的 effect 里再开 ctx.inject 不可靠。 */
  try {
    ctx.inject(["modelDirectories", "sessions", "remote", "remote.session"], startSeat);
  } catch (error) {
    setStatus("订阅服务失败：" + (error?.message ?? String(error)));
  }

  /* 看门狗：`remote.session` 不可注入时第一条 inject 永远不会触发，按旧路径重来。 */
  if (services === null && typeof setTimeout === "function") {
    injectWatchdog = setTimeout(() => {
      injectWatchdog = null;
      if (services !== null) return;
      try {
        ctx.inject(["modelDirectories", "sessions"], startSeat);
      } catch (error) {
        setStatus("订阅服务失败：" + (error?.message ?? String(error)));
      }
    }, INJECT_FALLBACK_MS);
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
          getPalette: () => paletteId,
          selectPalette: (id) => selectPalette(id),
          getPalettes: () => palettes,
          addPalette: () => addPalette(),
          renamePalette: (id, name) => renamePalette(id, name),
          removePalette: (id) => removePalette(id),
          getDark: () => darkStore.get(),
          setPaletteColor: (id, mode, slotId, value) => setPaletteColor(id, mode, slotId, value),
          clearPaletteColor: (id, slotId) => clearPaletteColor(id, slotId),
          resetPalette: (id) => resetPalette(id),
          getSmooth: () => smooth,
          selectSmooth: (value) => smoothStore.set(value),
          getEffects: () => effects,
          selectEffects: (id) => effectsStore.set(id),
          getFx: () => fx,
          selectFxMax: (on) => fxStore.set({ ...fx, maxOnly: on === true }),
          selectFxSpeed: (kind, speed) => fxStore.set({ ...fx, speeds: { ...fx.speeds, [kind]: speed } }),
          getLabels: () => labels,
          selectLabels: (id) => labelsStore.set(id),
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
    darkStore.dispose();
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
    storedSmooth,
    storedEffects,
    storedLabels,
    storedFx,
    normalizeFx,
    resolveEffects,
    resolveLabels,
    flowIsThin,
    sliderPosition,
    clampLabelShift,
    labelShiftTransform,
    sameShifts,
    sanitizePalettes,
    withBuiltins,
    paletteColors,
    paletteVars,
    paletteSlotColor,
    paletteHasSlot,
    migrateLegacyColors,
    storedPalettes,
    storedPaletteId,
    rememberPalettes,
    BUILTIN_PALETTES,
    AUTO_PALETTE,
    COLOR_SLOTS,
    MAIN_SLOTS,
    DETAIL_SLOTS,
  },
};

return module.exports;
} });
