# dsh-thinking-slider

把 DSH composer 的**模型位**（`conversation.input.model`）换成「模型行 + 思考强度滑条」：
模型行照旧下钻到按提供方分组的模型列表，推理强度是带卡位的离散滑条。面板材质直接用宿主的
`MenuSurface`，档位、分组、pending 与提交路径都来自宿主同一份模型目录。

```
┌──────────────────────────── 320 ─┐
│ 模型              DeepSeek V4   › │
│ 推理强度                    High  │
│  ●────────○────────○────────○     │
│ 关闭       低        高       最高 │
└──────────────────────────────────┘
```

## 安装

应用内插件管理器：设置 → 插件 → 添加插件，spec 填本目录的绝对路径：

```
D:\Documents\dsh\dsh-thinking-slider
```

装好后在**设置 → 思考强度**里开关。桌面端没有 HMR 时需要完整重启；有 HMR 时保存后约二十秒
热加载。

## 行为

- 触发按钮照抄原生：28px、13px、「模型名 · 档名」、pending 时用 `StateDot` 代替箭头。
- 滑条是**离散**的：档位来自适配器公布的 `reasoning.efforts`（DeepSeek 目前是
  Off / Low / High / Max，名字原样显示）。拖动只改视觉，**松手、点刻度、或键盘停手 200ms
  才提交**；提交后面板不关，方便连续微调。
- 键盘：轨道 `role="slider"`，←/→（及 ↑/↓）逐档、Home/End 到两端；Esc 退出子面板或关闭；
  Shift+Tab 关闭。
- 换模型：同 id 档位保留，目标模型没有该档就按序号就近钳制；目标模型没有推理元数据时不带
  `reasoningEffort`（走目录默认）。
- 失败：滑条回滚到已提交档，用原生 `Toast`（锚在 composer 卡片上）报错；目录加载失败仍是
  面板内的错误条 + 重试。`available === false`（subagent 会话）整座不渲染。
- 设置存在 `localStorage["dsh-thinking-slider:enabled"]`，`off` = 关；关掉立刻回原生菜单。

## 依赖的宿主契约

对着 DSH **0.2.1-rc.3** 的 asar 源码核对：

| 依赖 | 用途 |
|---|---|
| 槽位 `conversation.input.model`（single / session） | 官方条目 priority 0，本插件以 **-1** 覆盖；卸载 / 关开关 / 渲染抛错都会回原生 |
| Cordis 服务 `modelDirectories`、`sessions` | `directoryFor(sessionId)` 的 store 与 `select`；`subagentAddress` 判可用性 |
| 浏览器基线模块 `@deepseek-ai/dsh-client-ui-primitives` | `MenuSurface / MenuGroup / Input / StateDot / Toast / rankByName / observeStickyMenuGroups` |
| `[data-composer-card]` | Toast 锚点 |

任何一项拿不到就不注册，座位保持原生；设置页会显示「未接管：原因」。

## 已知限制

- **转发不了 `conversation.input.model.label`**：渲染器的 `renderSlot` 只允许条目调用自己声明的
  子槽位，而该子槽位已被官方条目声明（再声明会直接抛错）。所以模型名直出目录名，装了
  `dsh-client-ui-deepseek-model-label-1017` 这类标签装饰的插件在**座位上**不再显示徽章；
  `/model` 弹窗不受影响。
- **半公开契约**：`ctx.modelDirectories`（`ModelDirectoryResolver`）与 store 的 snapshot 形状随
  DSH 版本可能变；大版本升级后要复核。
- **与旧版主题冲突**：`dsh-theme-averita` 0.7.0 曾把这个座位内联在主题包里。两者同装时，
  本插件检测到已有 `priority: -1` 的条目会拒绝注册并提示；先升级主题到不再内联的版本。
- 不接管 `/model` 弹窗：从弹窗换模型仍会套用该模型的默认档。

## 样式

- 类名统一 `dts-*`，颜色全走宿主令牌（`--dsw-alias-*`、`--dsw-radius-*`、`--dsw-elevation-prominent`），
  任何主题、深浅模式都自动跟。
- 几何目前是 JS 与 CSS 共用的：命中计算的左右留白 6px、拇指 12px 同时写在
  `src/client.js`（`indexAt()`）和 `src/style.css`（`calc(6px + ratio * (100% - 12px))`）。
  只改颜色 / 字色 / 圆角没问题；改拇指大小、留白或竖排要两边一起改。
- 档位名来自适配器，只读；想做中文别名或每档描述，需要在组件里加映射。

## 开发

```powershell
node scripts/build.mjs     # src/client.js + src/style.css -> lib/client.js（内联样式）
node scripts/selftest.mjs  # 极小 React 垫片里真跑座位：打开 / 选模型 / 键盘换档 / 钳制 / 失败回滚 / 无推理 / subagent
```

- [`src/client.js`](src/client.js)：座位组件、注册函数、设置分区与插件 apply。构建时把
  `__CSS__` 换成样式表 JSON。
- [`src/style.css`](src/style.css)：`dts-*` 全部样式（座位 + 设置页）。
- 与主题的关系：`dsh-theme-averita` 的「配套插件」之一，互不依赖；主题不再内联这个座位。
