# 第 2 层：结构化精确键短句

来源：[紫微斗数开源解读数据集 v4.0](https://github.com/Renhuai123/ziwei-doushu/releases/tag/v4.0-13d)，王多鱼AI，[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。已修改：抽取、过滤、明确映射改写、去重、按条件分组后频次排序。仓库 MIT 与现有 DATASET-LICENSE 归属不变。

## 重建

Python 3 + zstandard，单进程逐行读取（`max_window_size=2**31`，不预分配此大小），不下载、不访问模型：

```sh
/workspace/tianjipan/venv/bin/python scripts/build-star-rules/build.py \
  /workspace/tianjipan/dataset/year-*.clean.jsonl.zst
python3 -m unittest discover -s scripts/build-star-rules -p 'test_*.py'
```

输出 `lib/ziwei/star-rules.generated.json` 与本目录 `stats.json`。全部输入按文件名排序；记录年份、SHA256、逐年新增候选数、过滤句次、精确改写命中。无随机/时间戳。512 项 section 缓存有界；不保存整年或出生日期索引。

## 范围与格式

- `aux`：三方四正逐宫行中的八辅星；`sihua`：四化路径中明确星名、落宫与生年标记；`pair`：实坐主星段落的“主星+辅/煞星”小标题。
- 不抽 major/combination，不抽借星 pair；运行时所有类型均要求本宫确有实坐主星，且每颗条件星真实在宫内。未知时辰关闭。
- `index` 键为 `类型|规范宫名|星名|另一星名或空|生年四化或空`，值为稳定规则 ID。`rules[id]` 为 `[文本池ID, 亮度条件数组, 附加生年四化条件数组]`。亮度条件为 `[条件星, 原始亮度词, 允许的本站细档列表]`，四化条件为 `[星名, 标记]`；全局 `meta` 固定实坐同宫、本命来源。空条件数组代表无该断言，不是未知条件。完整谓词由索引键、规则条件及 meta 共同组成。
- 同键先拆分条件，条件内选最高频**完整短句**，同频按文本排序；不混拼、不近似。文本池跨表去重。
- 沿用旧 RESTRICTED/UNSAFE/OVERLAY 和保护引号的句切分；新增内部标记、恐吓/宿命、疾病/器官、无法绑定的男女/他星/会照等附加条件过滤。忌仅保留明确温和整条，不能从恐吓条目里捞后半句。`REWRITES` 只做可审计的精确整句映射；疾病句不改写救回。
- 亮度不改本站流派；庙旺只对应庙/旺，落陷只对应陷，不亮/不得地不猜。多主体或条件不清的句子丢弃；运行时 raw 优先，粗档只有全部可能细档都满足时才接受。

每次 0–6 条、≤800 字（目标 3–6，稀疏不凑数），合盘共享；method → 新层 → 旧层，6000 字内整条选取。这里只是 user `references` 措辞参考，不写 system、不修改盘面事实。
