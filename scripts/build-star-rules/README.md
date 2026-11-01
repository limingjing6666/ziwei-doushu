# 第 2 层：结构化精确键短句

来源：[紫微斗数开源解读数据集 v4.0](https://github.com/Renhuai123/ziwei-doushu/releases/tag/v4.0-13d)，王多鱼AI，[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。已修改：抽取、过滤、明确映射改写、去重、按条件分组后频次排序。仓库 MIT 与现有 DATASET-LICENSE 归属不变。

## 重建

Python 3 + zstandard，单进程逐行读取（`max_window_size=2**31`，不预分配此大小），不下载、不访问模型：

```sh
/workspace/tianjipan/venv/bin/python scripts/build-star-rules/build.py \
  /workspace/tianjipan/dataset/year-*.clean.jsonl.zst
/workspace/tianjipan/venv/bin/python -m unittest discover -s scripts/build-star-rules -p 'test_*.py'
```

输出 `lib/ziwei/star-rules.generated.json` 与本目录 `stats.json`。全部输入按文件名排序；记录年份、SHA256、逐年新增候选数、过滤句次、精确改写命中，以及 `weak_excluded` 原句、排除原因与句次。无随机/时间戳。512 项 section 缓存有界；不保存整年或出生日期索引。

## 范围与格式

- `aux`：三方四正逐宫行中的八辅星，允许空宫，标签注明“本宫实坐”；`sihua`：四化路径中明确星名、落宫与生年标记，仍要求本宫有主星；`pair`：实坐主星段落的“主星+辅/煞星”小标题。
- 新增 `bpair|宫|借星|本宫实坐辅煞|`：仅从 `本宫主星` 行明确含“空宫”的主辅煞小标题抽取；与 pair 走同一套过滤。另整句丢弃含“坐/同宫/入命/本宫”等实坐式措辞，不在运行时改写。标签固定说明“空宫，借对宫某星参照；本宫实坐某星”。
- `meta.version=2`，旧键含义不变；关系由 `meta.relation` 分类型标明。运行时 bpair 仅限无任何主星的宫，按引擎既有 `oppositeBranch`（地支+6）查对宫**实际主星**，辅煞只认本宫实坐。缺键直接 miss，不采用便利字段里的借星名替代事实。未知时辰关闭；不启用 major/combination/大限或流年四化。
- `index` 键为 `类型|规范宫名|星名|另一星名或空|生年四化或空`，值为稳定规则 ID。`rules[id]` 为 `[文本池ID, 亮度条件数组, 附加生年四化条件数组]`。亮度条件为 `[条件星, 原始亮度词, 允许的本站细档列表]`，四化条件为 `[星名, 标记]`；全局 `meta` 固定各类型的实坐/借照关系、本命来源。空条件数组代表无该断言，不是未知条件。完整谓词由索引键、规则条件及 meta 共同组成。
- 同键先拆分条件，条件内选最高频**完整短句**，同频按文本排序；不混拼、不近似。文本池跨表去重。
- 沿用旧 RESTRICTED/UNSAFE/OVERLAY 和保护引号的句切分；新增内部标记、恐吓/宿命、疾病/器官、无法绑定的男女/他星/会照等附加条件过滤。忌仅保留明确温和整条，不能从恐吓条目里捞后半句。`REWRITES` 只做可审计的精确整句映射；疾病句不改写救回。
- `WEAK_EXCLUSIONS` 显式分类排除拖延/懒等贬义标签、绝对财富地位许诺、过细职业名单与跨话题才艺句（含天同+陀罗、天同+文曲）；不加复杂话题逻辑。逐句审查与原句/原因保存在 stats 和本轮报告，不用运行时过滤救回。
- 亮度不改本站流派；庙旺只对应庙/旺，落陷只对应陷，不亮/不得地不猜。多主体或条件不清的句子丢弃；运行时 raw 优先，粗档只有全部可能细档都满足时才接受。bpair 的借星亮度取对宫实际主星，本宫辅煞亮度取本宫实际星，缺失或无法对应均不命中。

每次 0–6 条、≤800 字（目标 3–6，稀疏不凑数），合盘共享；method → 新层 → 旧层，6000 字内整条选取。这里只是 user `references` 措辞参考，不写 system、不修改盘面事实。本轮另按批准仅在既有 system 安全句后追加一小句反宿命措辞要求，不改变其它提示规则。
