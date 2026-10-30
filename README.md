# dsh-thinking-slider

把 DSH composer 的**模型位**（`conversation.input.model`）换成「模型行 + 思考强度滑条」：
模型行照旧下钻到按提供方分组的模型列表，推理强度是带卡位的离散滑条，拖动方式可切**逐档**
（默认，指针始终吸在刻度上）或**平滑**（拇指连续跟手，松手吸附到最近档）。面板材质直接用宿主的
`MenuSurface`，档位、分组、pending 与提交路径都来自宿主同一份模型目录。

```
┌──────────────────────────── 320 ─┐
│ 模型              DeepSeek V4   › │
│ 推理强度                    High  │
│  ●────────○────────○────────○     │
│ 关闭       低        高       最高 │
└──────────────────────────────────┘
```

外观可切：**紧凑**（默认，细轨）/ **Claude**（暖灰轨道 + 圆角方拇指）/ **Codex**（蓝色进度 + 圆点 + 满档流光）。
三条共用同一套档位与提交路径，只换材质与刻度排布；Claude / Codex 的主色可在设置里改。

## 安装

应用内插件管理器：设置 → 插件 → 添加插件，spec 填本目录的绝对路径：

```
D:\Documents\dsh\dsh-thinking-slider
```

装好后在**设置 → 思考强度**里开关、切外观和拖动方式。桌面端没有 HMR 时需要完整重启；有 HMR 时保存后约二十秒
热加载。

## 行为

- 触发按钮照抄原生：28px、13px、「模型名 · 档名」、pending 时用 `StateDot` 代替箭头。
- 滑条是**离散**的：档位来自适配器公布的 `reasoning.efforts`（不同模型可能是 3 档或 4 档，名字原样显示）。拖动只改视觉，**松手、点刻度、或键盘停手 200ms
  才提交**；提交后面板不关，方便连续微调。
- **拖动方式**在设置里切：`逐档`（默认）指针每动一下就取整到刻度；`平滑` 时拇指与填充连续跟手，
  松手按最近档吸附（用各外观现有的缓动滑回去）并提交同一档。平滑只改手感——宿主只接受离散
  `reasoningEffort`，不会产生中间值。读数与圆点高亮在拖动中始终取最近档。
- 键盘：轨道 `role="slider"`，←/→（及 ↑/↓）逐档、Home/End 到两端；Esc 退出子面板或关闭；
  Shift+Tab 关闭。
- 换模型：同 id 档位保留，目标模型没有该档就按序号就近钳制；目标模型没有推理元数据时不带
  `reasoningEffort`（走目录默认）。
- 失败：滑条回滚到已提交档，用原生 `Toast`（锚在 composer 卡片上）报错；目录加载失败仍是
  面板内的错误条 + 重试。`available === false`（subagent 会话）整座不渲染。
- 设置存在 `localStorage["dsh-thinking-slider:enabled"]`，`off` = 关；关掉立刻回原生菜单。
- 外观存在 `localStorage["dsh-thinking-slider:style"]`，`compact` / `claude` / `codex`；只换滑条材质，
  不改档位、提交时机或失败回滚。
- 拖动方式存在 `localStorage["dsh-thinking-slider:smooth"]`，`step` / `smooth`；切换立即生效，不重建座位。
- 自定义颜色存在 `localStorage["dsh-thinking-slider:colors"]`，JSON 形如
  `{"codex":{"fill":"#ff3366"}}`；只存改过的槽，未改的槽继续走各模式的默认。
- **冷启动竞态**：宿主的 `ModelDirectoryResolver` 在 `remote.session` 就绪前会抛 `cannot get property "remote.session" without inject`，本条目比原生早渲染几毫秒，会被错误边界退役。插件在退役后 300ms 自动换一条新条目重注册（最多 3 次），所以启动时可能先看到原生菜单不到半秒；根因在宿主 `ui-model-selection`，值得向上游报。

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
- **平滑只改手感**：宿主契约里推理强度是离散 id，平滑拖动不会产生中间档，也不会把拖动百分比
  换算成中间强度提交；松手提交的仍是某一档。拖动百分比只驱动滑条位置和满档特效的强度。
- **Claude 的暖色是固定值**：轨道 / 填充 / 陶土刻度不跟四套主题取色，深色单独一套；Codex 的轨道、
  刻度和拇指边框走宿主令牌，能跟着主题与深浅走。Claude 的深色切换钉在
  `html:has(body[data-ds-dark-theme])` 上，宿主改这个标记时要回来补。
- **自定义颜色深浅共用**：同一套 override 同时作用于浅色和深色；只有没改的槽会按模式取默认。
  要浅色 / 深色分别配，需要再加一层按 mode 存储的结构（目前没做）。
- **紧凑的颜色默认值随主题**：设置里的色块是浅色近似值，不是宿主令牌的实时解析；不动它就不会覆盖。

## 样式

三种外观，全部在「设置 → 思考强度 → 外观」里切：

| 外观 | 轨道 | 拇指 | 刻度 | 记忆点 |
|---|---|---|---|---|
| 紧凑 | 20px 命中区 / 2px 细轨 | 12px 描边圆点 | 档位名，可点 | 原来的默认样子 |
| Claude | 28px 暖灰哑光 | 24×28 / r8 圆角方 | `Faster / Smarter` 两端字 | 陶土色末档、双层柔影 |
| Codex | 28px 命中区 / 24px 胶囊 | 28px 白圆 | 4px 点，选中变白 | `#3a83f7` 蓝色进度、满档流光 + 横穿粒子 |

- **一套骨架**：Claude 与 Codex 共用 `pad 14px`、`thumb 盒高 28px`、`track 28px` 的交互几何；
  只有拇指轮廓和轨道截面不同。紧凑保留原来的 `pad 6px / thumb 12px / track 20px`。
- 几何的唯一来源是 `src/client.js` 的 `SLIDER_GEOMETRY`；它通过 inline `--dts-pad / --dts-thumb-w /
  --dts-thumb-h / --dts-track-h` 传给 CSS。`indexAt()`、fill 宽度、刻度和拇指位置都从同一组值算，
  不再在两处手抄 6px / 12px。
- **Claude 的 Faster / Smarter 在滑条下方**，和紧凑 / Codex 的档位名同一行高、同一左右端距；
  这一套不渲染逐档文字按钮，档位仍由点按轨道、拖动和键盘切换，当前档看标题右侧。
- Codex 的满档特效在**蓝色填充内部**：一条 3.4s 的斜向流光，加上 8 个 3px 白点从右往左横穿；
  纯 CSS，不建 canvas。粒子层裁在填充的圆角里，不越出滑条；拇指外不再有爆发粒子。
- 满档特效不是硬切：**平滑**拖动时，从指针跨过「次高档 / 最高档」的中线开始，强度随拇指靠近右端
  连续升高（缓入缓出），到最右端才满；**逐档**、点刻度或键盘切换时只给 0 / 1，用 0.24s 的
  `opacity` 过渡淡入淡出。特效层在 Codex 外观下不随满档挂载 / 卸载（强度 0 时透明、不接管指针），
  所以离开满档也有淡出；`prefers-reduced-motion` 下不做这段过渡。
- 拇指不被轨道裁切：轨道本身不设 `overflow:hidden`，可见的 24px 胶囊只用上下 2px 内缩画出来。
- 平滑松手时拇指和填充按各自外观的缓动滑回刻度（填充补了 `width` 过渡）；拖动中两者都关掉过渡，
  所以跟手没有延迟。满档特效强度在拖动中直接跟手，松手才交回 0.24s 的 `opacity` 过渡。
- 类名统一 `dts-*`；默认色 Claude 用暖灰 / 陶土，Codex 的轨道、刻度和拇指边框走宿主令牌，
  紧凑则完全取宿主令牌。三套都能在设置里按槽覆盖；未改的槽仍按浅色 / 深色各自的默认走。
- 档位名来自适配器，只读；想做中文别名或每档描述，需要在组件里加映射。

## 颜色

三种外观都能调。紧凑的默认值仍取宿主主题，只有改过的槽会覆盖；
Claude / Codex 有各自的固定默认。

设置 → 思考强度 → 颜色：

- 主色 4 项：轨道 / 进度 / 拇指 / 强调。
- **详细配置**（默认收起）3 项：刻度 / 文字 / 粒子；只有 Codex 有粒子项，Claude / 紧凑没有。
- 「恢复默认」清掉当前外观的自定义，回到浅色 / 深色各自的默认；紧凑回到宿主主题。
- 自定义颜色**深浅共用**；没改的槽仍按当前模式取默认，所以暗色下不会因为改了一个浅色轨道而整块变亮。
- 紧凑的默认值按宿主主题走；设置里显示的是浅色近似值，只有你动过的槽才会写成固定色。
- 变量：`--dts-track-color` / `--dts-fill-color` / `--dts-thumb-color` / `--dts-accent-color` /
  `--dts-tick-color` / `--dts-text-color` / `--dts-particle-color`。菜单上的 inline 变量覆盖 CSS 默认。
- 强调色管：Claude 的激活 / 末档刻度与焦点环；Codex 的激活刻度文字、焦点环和流光。
- 「文字」只管读数、刻度 / 轴标签，不动「推理强度」标题，避免一个低对比色把标题也压掉。
- Codex 的粒子色走「粒子」，流光另一色走「强调」；改填充色不会自动改粒子色，这是故意的，方便单独调。

## 开发

```powershell
node scripts/build.mjs     # src/client.js + src/style.css -> lib/client.js（内联样式）
node scripts/selftest.mjs  # 极小 React 垫片里真跑座位：打开 / 选模型 / 键盘换档 / 平滑跟手与吸附 / Codex 特效渐变 / 钳制 / 失败回滚 / 无推理 / subagent / 三种外观 / 颜色覆盖
```

- [`src/client.js`](src/client.js)：座位组件、注册函数、设置分区与插件 apply。构建时把
  `__CSS__` 换成样式表 JSON。
- [`src/style.css`](src/style.css)：`dts-*` 全部样式（座位 + 设置页）。
- 与主题的关系：`dsh-theme-averita` 的「配套插件」之一，互不依赖；主题不再内联这个座位。
