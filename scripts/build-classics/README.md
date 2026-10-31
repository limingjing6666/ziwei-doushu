# 《紫微斗数全书》数据生成

运行 `python3 scripts/build-classics/gen.py`，使用环境中已有的 Python `opencc`（t2s），不涉及 npm 或前端依赖。运行 `python3 -m unittest discover -s scripts/build-classics` 检查转换与抽样。

输入：`wikisource/q_卷{一,二,三}.txt`，用户提供的中文维基文库 wikitext 快照。来源：https://zh.wikisource.org/wiki/紫微斗數全書 （分卷页面 `/卷一`、`/卷二`、`/卷三`）。通行三卷本，底本未标明；快照未附 revision ID，不宣称是权威校勘本。

授权署名：维基文库整理，CC BY-SA 4.0（https://creativecommons.org/licenses/by-sa/4.0/）；本站仅去维基标记、繁转简、分段。原文无润色或勘改；诗句次序、混用简体及原有疑字照录。九幅 ASCII 图表暂以占位说明替代，具体位置见 `audit.json`。

输出：
- `quanshu-simplified.json`：89 章的中间数据。
- `../../lib/classics/data/quanshu.ts`：静态 TypeScript Book；运行时无需读 JSON。
- `audit.json`：输入 SHA-256、15 处固定随机样本（每卷 5 处）、全书术语计数、繁简歧义、表格位置及章段统计。

段落 id 为 `qs-<1 起章序>-<1 起段序>`，章节 URL 仍为 0 起下标。`wordCount` 按正文汉字数计，不含标点、空白、章名、图表占位说明；不是含标点的字符串长度。章节分段在去空白后逐字校验一致，转换修正表为空（本次未发现需要强制修正的误转）。
