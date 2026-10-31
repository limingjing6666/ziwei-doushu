# 天机盘 · 前端 UI 全站重构规划

> 状态：规划稿 v1（未动代码）
> 范围：`app/` 全部路由 + `components/` 全部组件 + `globals.css` / `tailwind.config.ts`
> 不改：排盘算法（`lib/ziwei/algorithm.ts` 等）、AI 服务端逻辑、数据内容、URL 主体结构

---

## 0. 一句话方向

**把「一个会发光的玄学 App」改造成「一本可以翻阅的命书」。**

- 视觉语言：**宣纸 · 墨线 · 朱砂**（纸感底色 + 墨色文字 + 朱砂强调 + 极细分割线 + 宋体标题）
- 暗色版：**玄夜**（暖黑纸 + 纸白字 + 同一套朱砂/四化色）
- 交互原则：命盘本体是主角，AI 是增强；默认给结构化事实，长解读按需展开；所有承诺可核对。
- 三条铁律：**只保留一套设计 token**、**所有页面共用一个 AppShell**、**移动端从 360px 开始设计**。

---

## 1. 现状诊断（为什么必须重构，而不是换皮）

并行做了两轮只读审计。核心事实：

### 1.1 现在是 5 套视觉系统拼在一起

| 来源 | 表现 | 证据 |
|---|---|---|
| `globals.css` 的「2.0 token」 | `--bg-0 #FAFAF9`、`--ac #B8922A`，33 个自定义类只有 4 个被使用 | UI 审计 §3.2 |
| 首页 `useColors()` | 39 个键 × 2 主题，亮色 `#f5efe0`、暗色 `#020810`，与 token 都不同 | `app/page.tsx:145-192` |
| Tailwind 调色板 | 命盘/图例混用 `amber / purple / sky / emerald` | `PalaceCell.tsx:22-27`、`ChartBoard.tsx:172-177` |
| `BirthForm` 自算色板 | 49 处 rgba、14 个 hex | `BirthForm.tsx:152-167` |
| 卷轴/分享卡固定纸色 | 36 个一次性 hex | `ScrollIntro.tsx`、`ShareCardCanvas.tsx` |

量化：`style={{}}` **614 处**、硬编码 hex **184 处 / 89 种**、`rgba()` **297 处 / 182 种**；9 档圆角、10 种阴影并存。

### 1.2 命盘工作台的设计系统在开源版里丢了

`ChartBoard / PalaceCell / TimeNav / InsightPanel` 等 10 个组件引用 `var(--t-*)` 与 `.card-glass / .card-inner`，**全站没有任何定义**。结果是起盘后：宫格无边框、无底色、面板透明、输入框透明——用户看到的「丑」，一半是设计系统缺文件导致的回退渲染。

### 1.3 `/chart` 是未完成的 demo，且有硬伤

- 页面上直接写着「本页为引擎 Demo，完整商业版界面不在开源范围」（`app/chart/page.tsx:31-35`）。
- **双 TimeNav**：页面级一个、ChartBoard 内部又一个；顶部那个切了没反应（状态没下发）。
- 固定 380px 右栏、内部组件 0 断点、`globals.css` 里写好的移动端规则因为 class 没挂而全部失效 → **手机不可用**。
- 星曜点击、四化徽章点击是死交互；`StarDetailPanel / ChartSummary / PatternsCard / ShareModal / ShareCardCanvas` 等 **7 个已完成组件从未被 import**。
- `history.ts`（最近命盘）、`share.ts`（URL 分享）、`yunxian-context.ts`（童限/流月流日流时）、`true-solar-time.ts`（均时差）、`dst-cn.ts`（1986–1991 夏令时）全部是死代码，能力没接到界面。

### 1.4 核心体验断点

| 问题 | 后果 |
|---|---|
| 性别默认「男」、时间默认 08:00，无复核页 | 用户不改直接提交 = 错盘，且看起来正常 |
| 刷新/后退即丢盘；无最近命盘；URL 不可分享 | 关掉页面就一切重来 |
| 进盘自动请求 AI；点宫位再请求；限流 5 次/分 | 看 5 个宫位就开始 429，且无法停止/重试 |
| 晚子时：`/chart` 不换日，`/heming` 换日 | 同一生日两个页面出两张不同的盘 |
| 无全局导航/页脚；主题切换器只在首页 | 11 条路由不能切主题，导航各自手写 10 套 |
| 深色模式局部失效 | 知识库详情白底 + 近白字（≈1.05:1）、首页页脚 0.08 白（≈1.1:1） |
| 字号 7–10px 有 90+ 处；全站 1 个 aria-label；0 个 focus-visible；0 个 skeleton/error 页 | 可访问性与状态感全面缺失 |
| `/preview` 含开发对话残留文案，`/preview` 可被抓取 | 生产站露出实验页 |

### 1.5 工程约束（必须遵守）

- CI 会跑：`npm run typecheck` → `npm test`（含排盘回归 + **文案版权 8-gram 检测**）→ 无 AI 密钥 `npm run build` → `copyright:check -- --extra .next/`。
- 版权检测里有一条硬断言：`app/page.tsx` 必须仍包含「三合四化」字样（`scripts/copyright/guard.test.ts:19`）——重构文案时要保留这句品牌语。
- **仓库当前没有 git**。全站重写前必须先 `git init` + 提交基线，否则无法回滚。

---

## 2. 设计方向：宣纸 · 墨线 · 朱砂

### 2.1 为什么是这个方向

紫微斗数产品的气质应该来自**书、星图、批注**，而不是霓虹渐变。当前首页的问题不是「不够炫」，是「炫错了」：渐变文字、光晕、星空 canvas、全屏留白、英文小标题、0.012 透明度的巨型「命」字——这些是典型的「AI 生成的玄学官网」套路。新方向反其道而行：

- **纸**：暖白/暖黑纸底，低饱和，像书页。
- **墨**：文字用近黑（或纸白），层级靠墨色深浅与字重，不靠彩色。
- **朱砂**：全站唯一的强调色，用于主按钮、选中、印章、关键数字；克制到「一屏最多三处」。
- **线**：1px 极细分割线取代卡片阴影；命盘像一张印刷表格，不像一排玻璃卡片。
- **宋体**：标题/宫名/星名/引文用宋体，正文用黑体；数字用等宽。中文排版本身成为视觉识别。
- **动效**：只用来反馈状态（120–220ms），不做滚动入场、不做无限循环。

### 2.2 反「AI 味」清单（硬性）

**禁用**
- 紫色/蓝色霓虹渐变、渐变文字、发光 orb、glassmorphism 毛玻璃、彩色光晕
- emoji 当图标（当前有 ✦ ◉ ☯ 📜 ♂ ♀ ⬇ 🔗 ✕ ✧）
- 全大写英文 kicker（`KNOWLEDGE BASE / METHOD · EVIDENCE / HEMING`）
- 每段 fade-up 入场、视差、无限循环动画、4.2s 强制开场
- 16–24px 大圆角卡片 + 大阴影的「SaaS 卡堆」
- 「解命运密码 / 深度解盘 / 提前窥探命运 / 几秒生成」式营销文案
- 无二维码却写「扫码」、无功能却写「自动识别 11 种格局」

**采用**
- 真实命盘 / 真实数据作为视觉主角（示例盘直接静态渲染，不用假 UI 截图）
- 宋体标题 + 黑体正文 + 等宽数字的三层字体结构
- 朱砂印章作为品牌符号，全站每屏最多 1 次
- 大留白 + 严格 4/8pt 间距节奏
- 图标统一 1.5px 线性 SVG（自绘 20 个）
- 文案具体、可核对：写清「公历/农历」「北京时间/真太阳时」「虚岁/周岁」

---

## 3. 设计系统（Design Tokens）

### 3.1 配色

**亮色「宣纸」**（默认）

| Token | 值 | 用途 | 对比度 |
|---|---|---|---|
| `--paper` | `#F5F0E6` | 页面底色 | — |
| `--surface` | `#FBF8F1` | 卡片/浮层 | — |
| `--surface-2` | `#EDE7DA` | 次级底（表头/选中底） | — |
| `--ink` | `#1C1A16` | 主文字/标题 | 15.3:1 on paper ✅AAA |
| `--ink-2` | `#4A443B` | 正文 | 10.1:1 ✅AAA |
| `--ink-3` | `#6E675B` | 辅助文字 | 5.15:1 ✅AA |
| `--line` | `rgba(28,26,22,.12)` | 分割线/描边 | — |
| `--cinnabar` | `#A6402E` | 主按钮/选中/链接/印章 | 5.45:1 ✅AA |
| `--cinnabar-deep` | `#8C3324` | 按钮 hover/pressed | — |
| `--indigo` | `#2F4B73` | 次要信息链接/权 | 7.79:1 ✅AAA |
| `--jade` | `#3D6B52` | 四化禄/正向 | 5.40:1 ✅AA |
| `--ochre` | `#7C5E26` | 四化科/古籍引用 | 5.30:1 ✅AA |
| `--gold` | `#9C7B3C` | 星曜装饰/细线（**不用于正文**） | 3.48:1 ✅仅大字 |

四化语义色只有一组，全站共用：**禄 jade / 权 indigo / 科 ochre / 忌 cinnabar**；并且每处都带「禄/权/科/忌」文字，不单靠颜色区分（色盲可用）。

**暗色「玄夜」**

| Token | 值 | 用途 | 对比度 |
|---|---|---|---|
| `--paper` | `#11100E` | 页面底色 | — |
| `--surface` | `#191713` | 卡片 | — |
| `--surface-2` | `#221F19` | 次级底 | — |
| `--ink` | `#EDE6D6` | 主文字 | 15.3:1 ✅AAA |
| `--ink-2` | `#C4BBA8` | 正文 | 8.71:1 on surface ✅AAA |
| `--ink-3` | `#9A9182` | 辅助 | 5.75:1 on surface ✅AA |
| `--line` | `rgba(237,230,214,.12)` | 分割线 | — |
| `--cinnabar` | `#D06A52` | 链接/文字强调 | 5.31:1 ✅AA |
| `--cinnabar-fill` | `#B34E38` | 实心按钮底（配纸白字 4.55:1） | 3.68:1 vs 页面 ✅UI |
| `--indigo` | `#7FA0C9` | 权 | 7.04:1 ✅AAA |
| `--jade` | `#6FA787` | 禄 | 6.84:1 ✅AA |
| `--ochre` | `#D0B06A` | 科 | 9.15:1 ✅AAA |
| `--gold` | `#C9A45C` | 星曜装饰 | 8.10:1 ✅AAA |

**主题策略**：首次访问跟随 `prefers-color-scheme`，用户切换后写 `localStorage`；全站 header 都有切换器；`<html>` 内联脚本在首帧前定主题，避免闪白。默认意图是**亮色宣纸**（内容型站点、阅读为主），暗色是完整对等实现，不是补丁。

### 3.2 字体

```css
--font-serif: "Songti SC", "STSong", "Source Han Serif SC", "Noto Serif CJK SC", "SimSun", serif;
--font-sans:  "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
--font-mono:  ui-monospace, "SF Mono", "Cascadia Mono", "Roboto Mono", monospace;
```

- **不加载中文 webfont**：一个中文字体包 3–5MB，会毁掉 LCP。用系统字体栈 + 排版技巧（字号、字距、行高、粗细）做出书卷气。
- 标题/星名/宫名：宋体 600，字距 0.02–0.06em。
- 正文：黑体 400，16px/1.8；阅读页 17px/1.95。
- 干支/年龄/年份：等宽 + `font-variant-numeric: tabular-nums`。
- 字号阶：`12 / 13 / 14 / 16 / 18 / 22 / 28 / 36 / 48 / 64`；**正文最小 12px**（当前 7–10px 全部消灭）。

### 3.3 布局与形状

- 容器：`--container: 1200px`；阅读宽度 `680px`；工作台宽 `1440px`。
- 栅格：12 列；gutter 24/32。
- 间距：4px 基准；section 上下 `clamp(72px, 8vw, 112px)`。
- 圆角：标签 2px / 输入与按钮 4px / 卡片 6px / 弹层 8px；**命盘外框 0**（印刷表格感）；胶囊只用于状态标签。
- 描边：1px `--line`；重点区域用「双线」（标题下的 1px + 3px 双rule）替代阴影。
- 阴影：静态元素一律无阴影；只有弹层/下拉使用 `--shadow-pop: 0 12px 32px rgba(20,16,10,.12)`。
- 动效：hover 120ms、面板 200ms、`ease-out`；命盘首次挂载可做一次 12 格 12ms 的淡入；`prefers-reduced-motion: reduce` 时全部关闭；不使用 framer-motion（用 CSS transition + `<dialog>`）。

### 3.4 图标与品牌

- 自绘 20 个线性图标（1.5px stroke、20px、`currentColor`）：排盘/合盘/星曜/古籍/主题(日/月)/分享/下载/搜索/复制/停止/重试/关闭/勾选/箭头/菜单/定位/时钟/日历/信息/更多。
- 品牌：宋体「天机盘」+ 一枚朱砂方印（印文「天」）；favicon、manifest 图标、分享卡统一使用方印。
- SEO 标题保留 `天机盘 · AI 紫微命盘`，但界面内不重复喊 AI。

---

## 4. 信息架构与全局框架

### 4.1 路由结构

```
/                          首页
/chart                     起盘（信息填写页，两栏）
/chart/result?y=&m=&d=&h=&mi=&g=&p=&c=&lo=&v=&dx=&ly=
                           命盘结果（可刷新、可分享、noindex）
/heming                    合盘（两栏表单 → 结果）
/knowledge                 知识库索引
/knowledge/[star]/[topic]  182 篇星曜×宫位文章（保留原有 URL）
/library                   古籍库索引
/library/[book]            书目
/library/[book]/[chapter]  阅读器
/library/search?q=         全文检索
/terms  /privacy           法务（共用 LegalLayout）
not-found / error / loading / global-error（新增）
删除 /preview（连同 ScrollIntro）
```

- `/chart` 拆成「表单页」与「结果页」两条路由：刷新不丢、浏览器后退自然、链接可分享；结果页 `robots: noindex`（链接内含生辰，不应被搜索引擎收录）。
- URL 参数沿用 `lib/ziwei/share.ts` 的短参数方案（`y/m/d/h/mi/g/p/c/lo`）+ 视图状态 `v`（mingpan/daxian/liunian）、`dx`（大限索引）、`ly`（流年）。**姓名不写入 URL**（只在本地）
- AI 结果不落 URL、不落 localStorage（隐私 + 成本），只在当前会话内缓存。

### 4.2 AppShell

```
┌────────────────────────────────────────────────────────────────────┐
│ 印 天机盘     排盘   合盘   星曜知识   古籍对读        ◐ 主题   [排盘] │ 64px，sticky
├────────────────────────────────────────────────────────────────────┤
│ 内容区（每页用自己的 PageHeader / ChartMetaBar）                      │
├────────────────────────────────────────────────────────────────────┤
│ 页脚：品牌 / 数据署名（CC BY 4.0）/ MIT / 免责声明 / 条款 / 隐私        │
└────────────────────────────────────────────────────────────────────┘
移动端：header 收为「印 + 菜单」；底部 4 项 Tab（排盘/合盘/知识/古籍），
        滚动时显示，键盘弹出时隐藏；主 CTA 不常驻遮挡内容。
```

- 导航项：**排盘 / 合盘 / 星曜知识 / 古籍对读**，当前项用朱砂下划线；右侧主题切换 + 主 CTA「排盘」。
- 页脚唯一实现；版权署名与免责声明必须保留（检测与合规要求）。
- 新增：skip link、`<main>` landmark、自绘 404/error/loading、全局 Toast。
- 删除：首页私有 nav、10 套手写 header、2 套 footer、`StarField`、`ScrollIntro`、`/preview`。

---

## 5. 逐页重构方案

### 5.1 首页 `/`

**目标**：3 秒说清「这是什么/怎么用/可信吗」，不再是 7 屏 82svh 的玄学长卷。

```
┌ AppShell ──────────────────────────────────────────────────────────┐
│ Hero（约 1 屏，左文右盘）                                          │
│  左：眉题「三合四化 · 古法排盘」                                    │
│      h1「把命盘读成一份可以核对的说明书」                             │
│      副文一句 + CTA[排一张盘] [看示例盘] + 信任行                     │
│  右：真实命盘组件静态渲染（示例盘，非截图、无浏览器外框）              │
├────────────────────────────────────────────────────────────────────┤
│ 三步：01 补生辰 → 02 校真太阳时 → 03 读星宫结构与依据   （细线编号）   │
├────────────────────────────────────────────────────────────────────┤
│ 命盘样本：本命 / 大限 / 流年 三态说明（真实组件 + 短注释）             │
├────────────────────────────────────────────────────────────────────┤
│ 古籍与依据：一段引文（宋体，左侧细线）+ 来源 + 「原典对读」            │
├────────────────────────────────────────────────────────────────────┤
│ 双入口：星曜知识库（182 篇） / 古籍对读库（3 部）                     │
├────────────────────────────────────────────────────────────────────┤
│ FAQ（5 条，details 手风琴）：数据保存？AI 可靠？不知道时辰？收费？      │
├────────────────────────────────────────────────────────────────────┤
│ Footer（署名 + 免责）                                               │
└────────────────────────────────────────────────────────────────────┘
```

- 从 client 912 行改为 **server component**；只有主题切换/FAQ 是 client 小岛。
- 删除：31 个 motion、星空 canvas、光晕、渐变文字、巨型「命」水印、英文 kicker、7 屏满高 section。
- 文案保留「三合四化」四字（版权测试断言），去掉「解命运密码」类承诺。
- 链接全部用 `<Link>`（保留新开标签能力），不再 `router.push` 假装按钮。

### 5.2 起盘页 `/chart`（信息填写页，两栏）

**布局**：桌面 `左右两栏（约 0.9 : 1.1，gap 64px）`，左栏 sticky，右栏表单；移动端单列，表单优先，底部 sticky 提交条。

```
┌ AppShell ──────────────────────────────────────────────────────────┐
│ 左栏（sticky, 40%）                │ 右栏（表单, 60%）              │
│                                    │ ┌────────────────────────────┐ │
│ 眉题：起盘                          │ │ 01 性别 / 姓名（选填）      │ │
│ h1：先补齐生辰，再读命盘             │ │    [男] [女]  姓名________  │ │
│ 说明：三合四化起盘，真太阳时校正       │ │ 02 出生日期                 │ │
│                                    │ │    公历/农历*  年 月 日      │ │
│ 01 出生日期 → 02 时刻与地点 → 03 复核│ │    日数随月/闰年联动         │ │
│                                    │ │ 03 出生时间                 │ │
│ [示例盘缩略图 / 看示例盘]            │ │    时辰快选：子 丑 寅 … 亥   │ │
│                                    │ │    [精确到分钟 ▾]           │ │
│ 最近命盘（本地，最多 5 条，可回填/删除）│ │    真太阳时：07:46 · 辰时    │ │
│                                    │ │    （北京 116.4°E，-14 分）  │ │
│ 隐私：仅存本机，不上传姓名/城市        │ │    ☐ 不知道时辰              │ │
│ FAQ（3 条折叠）                     │ │ 04 出生地点                 │ │
│                                    │ │    城市搜索（省/市/港澳台）   │ │
│                                    │ │    ☐ 不记得 / 海外（手填经度）│ │
│                                    │ │ 05 复核摘要                 │ │
│                                    │ │    男 · 1990-05-09 · 辰时 · 北京│
│                                    │ │    注：23:55 晚子时，按次日排盘│
│                                    │ │    [ 排 盘 ]                │ │
│                                    │ └────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

**关键改动**

1. **防错盘**：性别不再默认「男」；出生时刻不再默认 08:00；两者未选时主按钮禁用并给出原因。提交前出现「复核摘要」区，列出最终采用的参数与所有修正（晚子时换日、真太阳时、经度、未知时辰）。
2. **时辰快选**：12 个时辰 chip（显示时段范围），点选后自动填代表时刻；需要精确到分钟再展开两个选择器。降低 9–10 次原生下拉操作。
3. **日期联动**：日数随月份/闰年变化；年/月/日升为可搜索列表，键盘可操作。
4. **地点**：一个可搜索 combobox（支持汉字/拼音），按省分组，替代「省 + 市」两个原生 select；提供「不记得/海外」分支（手填经度或跳过校正），并在摘要里说明「未校正」。
5. **真太阳时**：接 `lib/ziwei/true-solar-time.ts`（含均时差）与 `dst-cn.ts`（1986–1991 夏令时提示 + 一键「不加 1 小时」），替换当前「(经度-120)*4」的近似公式；同时保留「按北京时间、不校正」开关。
6. **农历输入（P1）**：公历/农历切换，闰月选择，用 `lunar-javascript` 转公历；转换结果在摘要里回显。
7. **本地状态**：草稿自动存 `localStorage`；「最近命盘」接 `history.ts`（最多 10 条，可回填/删除）；姓名只存本机。
8. **提交**：走唯一入口 `formToBirthInfo`（/chart 与 /heming 共用，修掉晚子时两页不一致），成功后 `router.push('/chart/result?...')`。
9. **可访问性**：每个分区 `fieldset/legend`；label 全部 `htmlFor`；错误 `aria-invalid + aria-describedby + role=alert`；性别 `radiogroup`；摘要 `aria-live`。

### 5.3 命盘结果页 `/chart/result`（两栏 / 三栏）

**布局分档**

- **≥1440px：三栏**「盘 / 读 / 索」
- **1024–1439px：两栏**「盘 / 读」，索栏收进右侧抽屉
- **<1024px：单列**：运限条 → 命盘 → Tab（导读/宫位/AI）→ 底部操作条；宫位详情用 bottom sheet

```
┌ AppShell ──────────────────────────────────────────────────────────────┐
│ 命盘信息条（sticky）：张三 · 男 · 1990-05-09 08:00 → 辰时 · 北京        │
│   金四局 · 命主贪狼 · 身主天梁 · 当前大限 32–41        [分享] [打印] [⋯] │
├──────────────────────┬───────────────────────────────┬─────────────────┤
│ 运限 Segmented        │ [导读] [宫位] [AI 解读]        │ 索引（≥1440）    │
│ 本命 | 大限 | 流年    │                               │ 十二宫           │
│ 大限时间轴（12 段）    │  ┌ 导读 ────────────────────┐ │  命宫 紫微天相   │
│ ┌──────────────────┐ │  │ 命宫 · 紫微天相（庙）      │ │  兄弟宫 …        │
│ │  巳   午   未  申 │ │  │ 一句话结构摘要（本地生成） │ │ 四化索引         │
│ │  ┌────────────┐  │ │  │ 三方四正 / 四化落点        │ │  禄 贪狼→子女    │
│ │  │  中央信息区  │  │ │  │ 十二宫导读（可点）         │ │  权 太阴→夫妻    │
│ │  └────────────┘  │ │  │ 格局识别（本地规则）        │ │  ...            │
│ │  酉       戌  ... │ │  └──────────────────────────┘ │ 分享卡预览       │
│ └──────────────────┘ │  AI 解读区（默认收起，可按需展开）│ 免责说明         │
│ 图例 + 三方四正提示    │                               │                 │
└──────────────────────┴───────────────────────────────┴─────────────────┘
```

**核心交互**

1. **单一运限状态**：`view / liunianYear / daXianIndex` 提升到页面级并写进 URL；`TimeNav` 只渲染一次（受控组件）；AI 请求也带运限上下文。
2. **大限可切换**：图下方显示 12 段大限时间轴（年龄 + 宫位名），点击切换；当前大限高亮；流年视图联动到该年所属大限；年份选择用下拉或步进（含「今年」）。
3. **宫位点击 = 本地结构化详情**：先渲染宫名/干支/主星与亮度（庙旺利陷 9 档）/辅煞/四化/宫干自化/借宫/对宫/三方四正/大限年龄，**不消耗 AI**；「AI 解读此宫」是按钮而不是自动请求。
4. **星曜点击 = 星曜抽屉**：星性、亮度、四化、古籍引文、阅读提示、在盘中的落点；Esc / 点击遮罩关闭；焦点管理正确。接回 `StarDetailPanel` 的数据与 `star-db`。
5. **四化钻取**：点徽章高亮对应星与宫，并在索引栏展示「禄/权/科/忌」落点清单。
6. **导览式阅读**：「先看命宫 → 再看三方四正 → 最后看大限」的 3 步入口（P1）。
7. **AI 解读**：
   - 空态是「开始解读」按钮 + 6 个主题（命格/感情/事业/财运/健康/性格）+ 当前运限提示，**不再进盘自动请求**。
   - 流式输出带 **停止 / 重试 / 重新生成 / 复制**；按 `chart+view+year+topic` 缓存，切回不重复请求。
   - 错误与 AI 正文视觉分离；429 显示「今日额度/每分钟限制」人话说明 + 倒计时。
   - 输出按「解读稿」排版（小标题 + 细线 + 段落 + 引文），不是聊天气泡墙；追问才用气泡。
   - 每条结论附「定位」按钮：跳到对应宫位并高亮（P1）。
8. **分享**：dialog（`<dialog>` 语义 + 焦点陷阱 + Esc）；可切换「隐藏出生时刻/城市」；可复制链接、下载 PNG（竖版 3:4 / 方版 1:1）；链接参数不含姓名；提示「链接含生辰信息，请谨慎转发」。
9. **打印**：A4 横向，只印信息条 + 命盘 + 摘要 + 免责声明；隐藏导航/AI/操作条。
10. **键盘**：宫格方向键导航 + Enter 打开、Tab 顺序合理、Esc 关闭抽屉、`1/2/3` 切 Tab（P2）。
11. **移动端**：命盘全宽（格内 12px 起的精简信息）、点击宫位弹 bottom sheet、底部固定「AI 解读 / 分享」；顶栏吸顶只留标题与运限。

**视觉细节**

- 宫格：去掉 16px 圆角与阴影，改 1px 细线外框 + 内部分隔线；选中宫用朱砂 2px 内描边 + 极浅底；三方四正用朱砂虚线并标注「财帛/官禄/迁移」；中央区放命宫/身宫/五行局/四柱/农历，不再放 ☯ 大符号。
- 四化徽章：2px 圆角小方章 + 色 + 字（禄权科忌），生年实心、运限虚线；图例一处定义。
- 星曜亮度：用字重 + 墨色深浅 + 「庙/旺/得/利/平/不/闲/陷」小字，不再用 amber/red 彩色。

### 5.4 合盘 `/heming`

```
阶段一：填写
┌ h1 合盘 · 两个人的命盘放在一起读 ───────────────────────────────────┐
│ 关系类型 [恋人] [夫妻] [合伙] [亲子] [朋友]   （决定解读侧重）          │
│ ┌ A 卡 ──────────────┐   ┌ 合 ┐   ┌ B 卡 ──────────────┐            │
│ │ 性别/日期/时间/地点  │   │ 印 │   │ 性别/日期/时间/地点  │            │
│ │ 完成度提示           │   │    │   │ 完成度提示           │            │
│ └────────────────────┘   └────┘   └────────────────────┘            │
│ 缺失项提示（明确指出 A/B 缺什么）           [开始合盘]  [用示例数据]     │
└──────────────────────────────────────────────────────────────────────┘
阶段二：结果
┌ 双盘信息条（A / B 姓名·日期·命宫主星） ─────────────────────────────┐
│ 左：A 盘 + B 盘（并排 / 移动端 Tab）│ 右：AI 合盘解读（分段 + 追问）    │
│ 本地速览：双方命宫/夫妻/福德/沟通要点 │ 关系基调 / 吸引力 / 冲突点 / 建议  │
└──────────────────────────────────────────────────────────────────────┘
```

- 两张 birth 表单拆成可复用 `BirthForm` 的紧凑变体（`variant="compact"`），去掉双层卡片嵌套。
- 校验按人分侧（A/B 各自的字段级错误），不再只给一句「请先填写双方信息」。
- 追问保留上下文（当前每次追问都清空重生成，没有对话记忆）；「重新生成」与「继续追问」分开。
- 刷新不丢：双方表单与结果视图写进 URL / sessionStorage（P1）。

### 5.5 知识库 `/knowledge` + `[star]/[topic]`

**索引页**：h1 + 一句说明 → 搜索/筛选（14 星 × 13 主题，client 过滤）→ 十四主星印章卡（星名 + 属性 + 一句星性）→ 十三宫位 chips → 热门主题 6 个 → 古籍入口。删除当前重复展示的两遍 14 星列表。

**详情页（182 个 SEO 落地页，URL 不变）**

```
┌ AppShell ───────────────────────────────────────────────────────────┐
│ 面包屑：首页 / 星曜知识 / 紫微 / 命宫                                  │
├──────────────┬──────────────────────────────────┬───────────────────┤
│ 左 TOC 240px  │ 正文 max 680px                    │ 右 280px          │
│ 十四主星       │ 眉题：紫微入命宫 · 命格总览         │ 在你命盘中看这颗星  │
│  紫微 ← 当前   │ h1（宋体）                        │ [排一张盘]         │
│  ...          │ 定调（大字号引文块）                │ 相关主题           │
│ 本文目录       │ 核心论断 / 命盘依据 / 经典出处       │ 数据说明 + 免责     │
│  定调/论断/…   │ 引文用宋体 + 左侧细线 + 出处         │                   │
│ 同主题其他星    │ 内链：同星其他宫 / 同宫其他星        │                   │
└──────────────┴──────────────────────────────────┴───────────────────┘
```

- 修复深色白底卡（`background:'white'` 处）与低对比金色；JSON-LD、metadata、canonical 全部保留。
- 阅读排版：16–17px / 1.95，段落间距 1em，引文宋体，标题下细线；`max-w` 统一。
- 移动端：TOC 折叠为顶部 `details`，右侧卡片移到文末。

### 5.6 古籍库 `/library` + `[book]` + `[book]/[chapter]` + `/library/search`

**索引**：h1 + 全文搜索框（常驻、提示可搜「七杀朝斗/化忌」）→ 3 部书卡（书名宋体、朝代/作者、章节数/段数）→ 关于本库说明。

**书目**：左侧 sticky 书信息（书名/作者/朝代/阅读进度/开始阅读）；右侧章节目录（编号 + 标题 + 副题 + 段数），当前章高亮。

**阅读器**：左侧 sticky 章节目录 + 阅读进度；中间 680px 正文；顶部细进度条；字号/行距控制（P1）；段落锚点可复制；上一章/下一章卡片；←/→ 键翻章；打印样式。

**搜索**：搜索框预填 q + 清空 + 热门词；结果按书分组，摘录高亮（用朱砂 12% 底 + `--ink` 字，深色同样可读）；空状态给建议词；「共 N 条」+ 数据说明。

```text
┌ 阅读器 3 栏（≥1280） ───────────────────────────────────────────────┐
│ 左：本文章节列表 + 进度   │ 中：章节正文（原文宋体 / 注释黑体小字） │ 右：字号·行距·主题 │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.7 法务 `/terms` `/privacy`

- 共用 `LegalLayout`：左侧 sticky 目录（h2 anchors）+ 右侧 720px 正文 + 最后更新日期 + 返回。
- 修正与实际不符的表述（隐私页当前声称有「历史记录/准不准打分/最近命盘」，代码里并不存在；重构后若接上最近命盘则保留，评分功能删除相关文案）。
- 保留数据署名、AI 免责、第三方传输说明（进盘自动请求改为用户显式触发后，隐私说明同步更新）。

### 5.8 新增/删除

| 动作 | 内容 |
|---|---|
| 新增 | `not-found.tsx`（中文 404 + 返回/搜索）、`error.tsx`、`global-error.tsx`、`loading.tsx`、`opengraph-image`（可选） |
| 删除 | `/preview`、`ScrollIntro`、`StarField`、`FamousPersonCard`（名人盘有权利风险，且无入口） |
| 合并 | `ChatPanel` → `InsightPanel`/新 AiReading；`PatternsCard` → 导读内格局段；两处 `AiContent` → 一个 `Prose` 渲染器 |
| 更新 | `manifest` 主题色、favicon/icon 改为方印、`robots` 移除 preview 相关、`sitemap` 保持 |

---

## 6. 组件体系

### 6.1 目录（建议）

```
components/
  shell/    SiteHeader, SiteFooter, MobileTabBar, ThemeToggle, SkipLink
  brand/    Seal, Wordmark
  icons/    20 个线性图标
  ui/       Button, IconButton, Input, Select, Combobox, Checkbox,
            SegmentedControl, Tabs, Badge, Tag, Card, Dialog, Sheet,
            Tooltip, Popover, Accordion, EmptyState, Skeleton, Spinner,
            Toast, Field, Stepper, Breadcrumb, PageHeader, Prose, Kbd
  chart/    ChartBoard, PalaceCell, CenterTile, TimeNav, DaXianTimeline,
            PalaceDetail, StarSheet, ChartSummary, PatternList,
            ChartMetaBar, ChartLegend, PrintSheet
  ai/       AiReading, AiComposer, TopicChips, AiError
  birth/    BirthForm, BirthDateFields, BirthTimeFields, BirthLocationFields,
            GenderSegment, BirthSummary
  share/    ShareDialog, ShareCard
hooks/      useChartParams, useRecentCharts, useDraft, useTheme,
            useMediaQuery, useAiReading, useCopy
```

### 6.2 复用/删除对照

| 现状 | 处理 |
|---|---|
| `BirthForm.tsx`（457 行、37 inline） | 拆成 5 个字段组件 + `useBirthForm`，唯一校验入口 |
| `ChartBoard / PalaceCell / TimeNav` | 重写：状态上提、class 化、响应式、a11y |
| `InsightPanel` + `ChatPanel` | 合并为一个 AI 阅读组件（保留流式 + 增加停止/重试/缓存） |
| `ChartSummary` + `PatternsCard` | 合并为「导读」结构化摘要（本地数据，不耗 AI） |
| `StarDetailPanel` | 接回星曜抽屉 |
| `ShareModal` + `ShareCardCanvas` | 重做为带隐私开关、暗色正确、a11y 的分享 dialog（图片能力懒加载） |
| `ChatPanel / FamousPersonCard / StarField / ScrollIntro` | 删除（或移入 `experiments/` 不打包） |
| `ThemeProvider` | 保留 context，删除页面内 `useColors` |
| `globals.css` / `tailwind.config.ts` | 重写：唯一 token 层 + 语义 Tailwind 映射 |

### 6.3 样式纪律

- `app/` `components/` 下 **禁止硬编码 hex/rgba**（四化/主题色只存在于 `globals.css` 的 token 层）；CI 可加 grep 检查。
- `style={{}}` 只允许出现在「运行时几何」：SVG 三方四正坐标、宫格 grid-row/column、进度条百分比。
- 全部断点用 Tailwind `sm/md/lg/xl`，删除页面内 `<style>` 注入。
- 一套卡片/按钮/输入/标签样式，不允许页面级重定义。

---

## 7. UX 新功能清单（按优先级）

### P0（随重构一起上，影响核心流程）

1. 全局 AppShell + 全站主题切换（含系统偏好跟随）。
2. 起盘表单重做：无默认性别/时刻、逐字段校验、提交前「复核摘要」、未知时辰/地点分支。
3. `/chart/result` URL 状态：刷新/后退/分享不丢盘；结果页 noindex。
4. 最近命盘（本地 10 条，回填/删除）。
5. 单一时限状态 + 大限可切换 + 流年「今年」+ 运限进入 AI 上下文。
6. 宫位本地结构化详情 + 星曜抽屉 + 四化钻取（接回死组件）。
7. AI：显式触发 / 停止 / 重试 / 重新生成 / 复制 / 缓存 / 限流友好提示。
8. 分享闭环：链接 + PNG + 隐私开关 + a11y dialog。
9. 移动端完整适配：命盘 + bottom sheet + 底部操作条。
10. 404 / error / loading / 空状态 / Skeleton / Toast。
11. 深色模式全站修复 + 对比度达标。
12. A11y 基线：label/aria、焦点可见、键盘操作、`aria-live`、reduced-motion。

### P1（第二轮，明显提升）

13. 农历生日输入 + 闰月转换（复用 `lunar-javascript`，加回归测试）。
14. 真太阳时接 `true-solar-time.ts`（均时差）+ 夏令时提示/一键修正；「不做校正」开关。
15. 格局识别卡 + 十二宫导读 + 三步导览阅读。
16. 打印 A4 / 导出。
17. 合盘角色化（恋人/夫妻/合伙/亲子/朋友）+ 追问保留上下文 + 双盘并排。
18. 古籍阅读器字号/行距/进度/快捷键；知识库目录侧栏。
19. 全局搜索（⌘K：星曜专题 + 古籍全文）。
20. 分享卡多尺寸 + 二维码（引入轻量 `qrcode`，或删除「扫码」文案）。
21. 匿名示例盘（不涉及真人）。
22. 数据可信度说明：时辰来源、真太阳时修正量、晚子时换日提示。

### P2（锦上添花）

23. 键盘快捷键面板（`?`）。
24. 命盘收藏/备注（本地）。
25. AI 解读导出 Markdown。
26. PWA 安装优化（manifest 已有）。
27. 知识库/古籍阅读进度同步（本地）。

---

## 8. 文案原则（去 AI 味）

- 删掉所有英文 kicker、emoji 图标、装饰性符号（☯ ✦ ◉ ✧）。
- 把承诺句改成事实句：
  - ❌「立即起盘 · 解命运密码」→ ✅「排盘」
  - ❌「提前窥探命运的意义」→ ✅「从星宫结构理解自己的偏好与处境」
  - ❌「AI 智能深度解读」→ ✅「AI 辅助解读（内容仅供参考）」
- Loading 用本领域语言：「正在起局… / 正在安星… / 正在排大限…」（各状态不超过 1 句）。
- 错误文案：原因 + 可执行动作，不卖萌、不神秘。
- 裸事实优先：「公历 1990-05-09 08:00（北京时间）→ 真太阳时 07:46 → 辰时」。
- 所有夸张数字必须有依据（182 篇 = 14×13 可验证）。
- 保留合规文案：数据署名（CC BY 4.0 / 王多鱼AI）、MIT、非医疗投资法律建议、AI 可能出错。
- 新写文案必须能通过 `npm run copyright:check`（8-gram 检测），不得改写受保护材料。

---

## 9. 技术实现要点

### 9.1 Token 与 Tailwind

```css
:root {
  --paper: 245 240 230;      /* rgb 三元组，支持 /alpha */
  --surface: 251 248 241;
  --surface-2: 237 231 218;
  --ink: 28 26 22;
  --ink-2: 74 68 59;
  --ink-3: 110 103 91;
  --line: 28 26 22;          /* 用 .12 alpha 使用 */
  --cinnabar: 166 64 46;
  --indigo: 47 75 115;
  --jade: 61 107 82;
  --ochre: 124 94 38;
}
[data-theme="dark"] { /* 见 §3.1 暗色表 */ }
```

```ts
// tailwind.config.ts
colors: {
  paper: 'rgb(var(--paper) / <alpha-value>)',
  surface: 'rgb(var(--surface) / <alpha-value>)',
  ink: { DEFAULT: 'rgb(var(--ink) / <alpha-value>)', 2: ..., 3: ... },
  line: 'rgb(var(--line) / <alpha-value>)',
  cinnabar: ..., indigo: ..., jade: ..., ochre: ...,
}
```

- 删除 `useColors`、`--t-*`、Tailwind 调色板直用（amber/purple/sky/emerald）、页面内 `<style>`。
- 主题脚本：`localStorage('ziwei-theme')` → 否则 `matchMedia('(prefers-color-scheme: dark)')`；首帧前设置 `data-theme` + `color-scheme`。

### 9.2 状态与数据流

- 结果页：`useSearchParams` → `searchParamsToForm` → `generateChart`（`useMemo`）→ 渲染；解析失败显示友好错误与「重新填写」。
- 视图状态 `v/dx/ly` 与 URL 双向同步（`router.replace` + `scroll:false`），保证分享与后退。
- 表单：`useBirthForm`（字段 + 校验 + `formToBirthInfo` 单一出口）；草稿与最近命盘走 localStorage hook。
- AI：`useAiReading` 管理请求队列（串行，尊重 5/分）、缓存、中止、重试、限流状态；组件卸载 abort。
- 不引入大型状态库；不引入 UI 组件库（避免默认「AI 风」外观），原语自绘，必要交互用原生 `<dialog>` / `<details>`。

### 9.3 字体与性能

- 0 个中文 webfont；系统字体栈；`font-variant-numeric: tabular-nums`。
- 首页转 server component；交互岛（ThemeToggle/FAQ/示例盘交互）单独 client。
- 移除 framer-motion（CSS transition + 原生 dialog）、StarField（canvas/rAF）、html2canvas 改为分享 dialog 内 `dynamic import`。
- 目标：首页 LCP < 2.5s、CLS < 0.1、无长任务；命盘切换 100ms 内响应。

### 9.4 可访问性

- skip link、landmark、单 h1、标题层级。
- 宫格用 `<button>` + roving tabindex + 方向键；每宫 `aria-label` 含宫名/主星/四化。
- Dialog/Sheet：焦点陷阱、Esc、`aria-modal`、打开前记忆焦点。
- 流式 AI：`aria-live="polite"` 按段落节流播报，不逐 token。
- 所有动画尊重 `prefers-reduced-motion`。
- 对比度以 §3.1 的实测值为准。

### 9.5 SEO 与兼容

- 知识库 182 页：URL、metadata、JSON-LD、canonical、内链结构不变。
- 首页保留「三合四化」字样（版权测试断言）。
- 结果页 `robots: { index: false }`；`/chart` 表单页保留索引。
- `next.config.js` 的 `/tianji|diji|renji/* → /knowledge` 重定向不动。
- 删除 `/preview` 后清理 robots/sitemap 引用（sitemap 本就未收录）。
- 打印样式统一 `@media print`。

### 9.6 工程前置

1. `git init` → `git add -A` → baseline commit（当前无版本控制，必须先做）。
2. 记录基线：`npm run typecheck`、`npm test`、`env -u DEEPSEEK_API_KEY npm run build`。
3. 用 Playwright（或等效）对现有 12 条路由 × 360/768/1024/1440 × 亮暗截图存档，作为对照。
4. 所有阶段结束跑同一套：typecheck / test / build / copyright:check。

---

## 10. 分期实施计划

| 阶段 | 内容 | 预估 | 验收 |
|---|---|---|---|
| P0 准备 | git 基线、基线构建、截图存档 | 0.5 天 | 干净基线 + 可回滚 |
| P1 基座 | token/globals/tailwind、字体、图标、AppShell、原语、主题、404/error/loading、删死代码 | 2 天 | 任一页面已用新壳；themecheck 亮暗通过 |
| P2 起盘 | 表单组件化、校验、复核摘要、草稿/最近、`/chart/result` 路由与 URL | 2 天 | 起盘 ≤1 分钟；刷新/后退/分享不丢 |
| P3 命盘 | ChartBoard/PalaceCell/TimeNav/大限轴、宫位详情、星曜抽屉、导读/格局、响应式、打印 | 3 天 | 360–1440 全可用；点宫位不再耗 AI |
| P4 AI 与分享 | AI 阅读器（触发/停止/重试/缓存/限流）、分享 dialog/卡片 | 2 天 | 5 次/分内不误伤；分享链接可复原 |
| P5 首页 | 首页重写（server）、示例盘、FAQ、SEO 文案 | 1.5 天 | ≤5 屏；LCP 达标；无 AI 味素材 |
| P6 合盘 | 两阶段、双侧校验、角色化、追问上下文 | 1.5 天 | 全流程可刷新/可重试 |
| P7 内容页 | 知识库索引/详情、古籍库四页、法务、搜索排版 | 2 天 | 182 页 SEO 不回归；深色可读 |
| P8 领域增强（可选） | 农历、真太阳时/夏令时、示例盘 | 1 天 | 转换有回归测试；提示可核对 |
| P9 验收 | a11y、性能、视觉 QA、测试/构建/版权、文案复审 | 1.5 天 | 验收清单全绿 |

合计约 **16–18 人天**；若用多 agent 并行（基座→并行页面），日历时间可压到 8–10 天。每阶段单独可部署，避免「大爆炸式」上线。

**建议顺序理由**：先修「设计系统 + 壳层」，再修核心链路（表单→命盘→AI→分享），最后做营销页与内容页；内容页（182 SEO 页）改动风险高，放到系统稳定后。

---

## 11. 风险与对策

| 风险 | 对策 |
|---|---|
| **仓库无 git**，重写不可回滚 | 第一步 `git init` + 基线 commit；每阶段一 commit |
| 版权 CI（8-gram/10 字）拦住新文案 | 新文案全部原创；先跑 `npm run copyright:check`；保留「三合四化」与署名 |
| 构建要求无 AI key | AI 面板在无 key/接口错误时有明确禁用态与说明；不在构建期调用 |
| AI 限流 5 次/分、30 次/天 | 显式触发 + 串行队列 + 缓存 + 配额提示；宫位详情本地化 |
| 农历/夏令时改动影响排盘正确性 | 只改「输入 → BirthInfo」一层，加独立回归测试；不确定则拆到 P8 单独上 |
| 182 个 SEO 页回归 | 只改视图层，不重命名路由/metadata/JSON-LD；上线前跑静态参数检查 |
| 中文字体包拖慢 LCP | 系统字体栈，0 webfont |
| 移动端命盘信息密度 | 精简格内信息 + bottom sheet + ≥12px 字号；360px 实测 |
| 深色模式再次局部失效 | 只用 token；禁止硬编码 hex；亮暗截图双检 |
| 范围膨胀（分享/农历/搜索） | P0/P1/P2 分级，先交付 P0；P1 逐项确认 |
| 隐私文案与实现不一致 | 重构后同步修正 privacy 文案；结果页 noindex；分享链接提示含生辰 |

---

## 12. 验收标准

**视觉**
- 全站只有一套 token：`app/`、`components/` 内 grep 不到硬编码 hex/rgba（token 文件除外）。
- 360 / 768 / 1024 / 1440 四档 × 亮暗，无横向滚动、无重叠、无明显空洞。
- 每屏最多 1 处朱砂强调；无渐变文字/光晕/毛玻璃/emoji 图标/无限动画。

**可用性**
- 起盘全流程（含表单填写）≤ 6 次输入动作（不含输入本身）。
- 刷新结果页不丢盘；复制链接在新标签可复原同一张盘；后退回到表单且已填内容保留。
- 点宫位 100ms 内出现本地详情；AI 可停止/重试；429 有可理解提示。
- 手机端可完成「起盘 → 看宫位 → 读 AI → 分享」全流程。

**可访问性**
- 键盘可完成起盘与宫位浏览；焦点可见；Dialog 焦点陷阱；`aria-live` 播报。
- 正文对比度 ≥ 4.5:1，大字 ≥ 3:1；Lighthouse a11y ≥ 95。

**性能**
- 首页 LCP < 2.5s / CLS < 0.1 / 无 rAF 常驻；首页 JS 体积显著下降。

**工程**
- `npm run typecheck`、`npm test`、无 key `npm run build`、`copyright:check` 全绿。
- 无死组件、无死 CSS、无 `/preview`；新增 404/error/loading。
- SEO：知识库 metadata/JSON-LD/URL 不变；结果页 noindex。

**内容**
- 无 AI 味词汇/符号；所有数字与承诺可核对；署名/免责/条款保留且与实现一致。

---

## 13. 已确认的决策（2026-10-31）

1. **主题默认**：亮色「宣纸」为默认；暗色「玄夜」完整对等，跟随系统偏好。
2. **首页长度**：精简到 4–5 屏，删除满高长卷与装饰动画。
3. **本轮范围**：**只做 UI 层面的布局/视觉**。包含设计系统、全局壳层、全部页面布局与响应式、亮暗主题、排版与文案、必要的重复导航清理；**不接入**分享/星曜详情/格局/最近命盘/URL 持久化/AI 停止重试/大限切换/农历/夏令时等新功能与数据流改动，这些留到后续阶段。
4. **实验内容**：确认归档、不打包（`experiments/` 目录，见该目录 README）。

> 后续若要继续 B/C 范围，按 §7 的 P0/P1 清单逐项追加。

---

## 14. 附录：审计证据索引

- 双导航：`app/chart/page.tsx:55-61` vs `components/ChartBoard.tsx:93-99`
- token 缺失：`components/ChartBoard.tsx:107-124`、`TimeNav.tsx:81-114`、`PalaceCell.tsx:84`、`InsightPanel.tsx:343`；`globals.css` 无 `--t-*`/`.card-glass`
- demo 文案：`app/chart/page.tsx:31-35`
- 死组件：`ChatPanel/ChartSummary/PatternsCard/StarDetailPanel/FamousPersonCard/ShareModal/ShareCardCanvas` 全仓 0 import
- 死能力：`lib/ziwei/history.ts`、`lib/ziwei/share.ts:51-89`、`lib/ziwei/yunxian-context.ts`、`lib/ziwei/true-solar-time.ts`、`lib/ziwei/dst-cn.ts` 均无 UI 引用
- 表单默认值与晚子时：`components/BirthForm.tsx:54-66`、`:142-149` vs `lib/ziwei/share.ts:26-34`
- AI 自动请求/限流：`components/InsightPanel.tsx:211-220`、`lib/ai/rate-limit.ts:35-36`
- 深色失效：`app/knowledge/[star]/[topic]/page.tsx:297`（`background:'white'`）、`app/page.tsx:186`（footer 0.08 alpha）
- 无全局壳层：`app/layout.tsx:46-65`；10 套手写 header
- 量化：614 inline / 184 hex / 297 rgba；`text-[9px]` 33 处、`text-[10px]` 50 处
- 版权断言：`scripts/copyright/guard.test.ts:19`（`app/page.tsx` 须含「三合四化」）

---

## 15. 实施记录（2026-10-31，v1 已落地）

### 15.1 已交付

| 模块 | 内容 |
|---|---|
| 设计系统 | `app/globals.css` 唯一 token 层（纸/墨/朱砂/四化语义色 + 字号/圆角/阴影/版式工具 + `prose-cn`）；`tailwind.config.ts` 语义映射 + 细粒度 opacity；`data-theme` 亮暗双主题（默认宣纸、跟随系统、localStorage 记忆）；26 个线性图标；方印品牌符号 |
| 全局壳层 | `SiteHeader`（4 项导航 + 当前项朱砂下划线 + 主题切换 + 排盘 CTA + 移动菜单）、`SiteFooter`（产品/条款/数据署名/免责）、`MobileTabBar`（4 项）、skip link、`not-found` / `error` / `global-error` / `loading` |
| UI 原语 | Button / IconButton / Card / Badge / SiHuaBadge / Field / Input / Select / SegmentedControl / Tabs / Disclosure / Breadcrumb / PageHeader / SectionHeading / EmptyState / Skeleton / Spinner / AiProse / `cn` |
| 首页 | 5 段式（Hero + 静态示例盘 / 三步 / 三层读法 / 古籍引文 / 双入口 + FAQ + 署名），server component，约 4.6 屏；删除星空 canvas、光晕、渐变文字、满高 section、framer-motion |
| 起盘页 | 桌面 40/60 两栏（左 sticky 说明/步骤/隐私/FAQ，右表单卡）+ 移动端单列；表单拆成 5 个子组件；真太阳时换算沿用原逻辑；隐私文案改为「在本机完成排盘，姓名与城市不会发送给 AI」；去掉误导性进度条，改「必填项：出生日期 / 信息已齐全」文字状态 |
| 结果页 | 命盘信息条 + 桌面两栏（4×4 印刷表格命盘 + 右 AI 解读）；宫位为可聚焦 button + 完整 aria-label；选中/三方四正朱砂细线与极浅底；中央信息区；TimeNav 受控单实例；移动端 <640px 隐藏辅煞、信息条压缩至 ~192px |
| 合盘页 | 桌面 A/B 双卡 + 中间竖线「合」印 + 常显分析卡（空态/加载/流式/错误）+ 追问区；移动端单列；原 fetch/abort/追问逻辑保持不变 |
| 知识库 | 索引去重为 14 星印章卡 + 13 宫 chips + 推荐阅读 + 古籍入口；详情页 xl 三栏（左目录 / 中 680 正文 / 右 CTA + 内链 + 数据署名），移动端 details 折叠；182 页 URL/metadata/JSON-LD/内链全部保留；深色白底 bug 消除 |
| 古籍库 | 索引（搜索 + 3 部书卡 + 关于本库）、书目（sticky 书信息 + 章节目录）、阅读器（左章节目录 + 宋体原文 + 段落锚点 + 上下章 + 打印）、搜索（预填 q + mark token + 空状态建议词） |
| 法务 | 共用 `LegalLayout`（sticky 目录 + `prose-cn` 正文）；条款/隐私文字实质保留 |
| 归档 | `/preview` + ScrollIntro、StarField、FamousPersonCard + famous 数据、ChatPanel、ChartSummary、PatternsCard、StarDetailPanel、ShareModal、ShareCardCanvas 移入 `experiments/`（不打包、不参与 tsc） |
| 品牌资产 | 方印 favicon / `icon.svg` / apple-icon / PWA 192/512 图标全部换新；manifest 主题色改宣纸白 |

### 15.2 与规划范围的差异

- 按用户决定，本轮**只做 UI/布局**：未接入分享、星曜详情抽屉、格局卡、最近命盘、URL 状态、AI 停止/重试/缓存、大限时间轴、农历/夏令时等（分别在规划 §7 的 P0/P1 中，留待后续）。
- 因此 `/chart` 仍是「填写 → 本次会话内看结果」的状态流，刷新回到起盘页；结果页未加 noindex（无独立 URL）。
- 星曜/四化点击的后端能力（`onStarSelect` / `onSiHuaClick`）保留在组件契约中但未接线。
- `framer-motion` / `html2canvas` 仍在 `package.json` 依赖里（对应实验组件已归档，不再被打包），可在后续依赖清理阶段移除。

### 15.3 验证结果

- `npx tsc --noEmit`：通过（0 error）
- `env -u DEEPSEEK_API_KEY npm run build`：通过，静态生成 222 页（含 182 知识库页、21 古籍章节页）
- `npm test`：通过（排盘回归 + 版权 8-gram 检测 + 中性命名等；详见最终运行记录）
- `npm run copyright:check -- --extra .next/`：通过
- 无头 Chrome 截图：13 条路由 × 亮/暗 × 360/390/768/1024/1440，无横向溢出；UI QA 脚本见 `scripts/qa/shoot.mjs`
- 可访问性：所有表单 label 关联、错误 `role=alert`、宫位 button + aria-label、skip link、focus-visible、`prefers-reduced-motion`；亮色正文对比度 ≥ 5.15:1、暗色 ≥ 4.5:1（详见 §3.1）

### 15.4 后续建议（下一轮功能阶段）

1. 结果页 URL 化 + 分享（`share.ts` 现成参数）+ 最近命盘（`history.ts`）
2. 宫位本地结构化详情 + 星曜抽屉 + 格局卡（接回 `experiments/` 里的实现并重做视觉）
3. AI 解读：显式触发、停止/重试/缓存、运限上下文、限流提示
4. 大限时间轴与流年十二宫、农历输入、真太阳时均时差与夏令时
5. 移除 `framer-motion` / `html2canvas` 依赖，补充 Playwright 视觉回归到 CI

