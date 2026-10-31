# 天机盘 · AI 紫微命盘

**三合四化 · 古法排盘 · AI 解读**

基于传统三合派紫微斗数，结合四化飞星的 Next.js 16 站点。包含排盘、运限视图、AI 解读、双盘比较、星宫知识库和古籍阅读。本站独立整理方法，不代表任何个人或机构授权、传承或背书。传统术数仅供文化学习与自我观察，不是科学预测或专业建议。

## 本地开发与验证

```sh
npm ci
npm run dev
npm run typecheck
npm test
env -u DEEPSEEK_API_KEY npm run build
npm run start
```

密钥仅运行时从环境注入；不要写入源码、命令参数、日志或构建缓存。其他敏感运行时变量同样应与构建隔离。配置示意见 `.env.example`。

- `DEEPSEEK_API_KEY`：服务端必填，默认模型 `deepseek-flash`，显式关闭推理模式以保留可见输出预算；可由 `DEEPSEEK_MODEL` 覆盖，其他模型不强改其模式。
- `AI_MINUTE_LIMIT` / `AI_DAILY_LIMIT`：默认每 IP 分钟 5 次、UTC 日 30 次。
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`：生产应同时配置；否则内存限流不跨实例。
- `AI_ALLOWED_ORIGINS`：生产应收紧白名单；来源检查不是鉴权。
- `NEXT_PUBLIC_SITE_URL`：站点 canonical、robots、sitemap 基址，默认 https://tianjipan.tech。

本地接口：`POST /api/interpret` 接收 `{chart,messages:[{role,content}]}`；`POST /api/heming` 接收 `{chartA,chartB,question?}`。返回 SSE `data: {"delta":{"text":"…"}}`，以 `[DONE]` 结束，错误使用中文 JSON 或 SSE error 帧。最多 200KiB 输入，仅保留必要的命盘字段；不主动发送姓名、城市或经度。用户自由输入可能含个人信息，请自行避免。

## 知识与方法

- `lib/ziwei/method/`：核心模型、步骤、风格维度、边界与带来源 ID 的规则。内部置信只说明证据复现程度，不是预测准确率。
- `lib/ai/prompts.ts`：融入分层解盘流程、安全与版权边界。
- `lib/ai/knowledge.ts`：按星、宫、格局、四化检索，连同旧库总参考上限 6000 字。
- `scripts/distill-method.py`：可选主题抽取工具，原始材料只从外部只读路径读取，候选输出须放仓库外并人工复核。
- `scripts/copyright/`：连续字串及 8-gram 检测、回归与 CI 哈希基线。`npm test` 必须运行。

不保存、展示或传入受保护的现代讲课原文与近似表达。历史字幕目录已移除并忽略。古籍摘录与现代释义需分别理解，现代提示不冒充原典。

## 数据署名与重建

**本站部分断语来自 紫微斗数开源解读数据集 v4.0（[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)），来源 https://github.com/Renhuai123/ziwei-doushu ，作者：王多鱼AI。** 本分支进行段落提取、去重、受限引文过滤与逐字复核，修改不代表上游作者认可。数据许可不能覆盖第三方作品。

当前星组库来自五个年份共 43,824 张盘，包含 50 星组 × 13 专题共 650 组，14 单星的命、夫妻、财帛、官禄四个核心维度全覆盖。重建工具与统计见 `scripts/build-star-db/`，原始数据不入库。发布前还须进行人工内容与权利审查，自动检测不是法律意见。

## 收费与上线边界

本站面向收费服务；此分支不新增支付、账户或订阅功能，也不宣称这些能力已完成。上线前需补齐鉴权、支付权限、费用告警、真实 Redis 验证与个人信息合规流程。现有前端未向后端完整发送所选运限年份，缺资料时不能推断具体应期。

## 许可

代码 MIT（`LICENSE`）；上游数据 CC BY 4.0（`DATASET-LICENSE`，保留王多鱼AI署名）；清代及以前的古籍原文为公版，不自动涵盖现代注本。本项目的方法表述为独立整理。方法提炼参考 [nuwa-skill](https://github.com/alchaincyf/nuwa-skill) 的抽取框架（MIT），采用主题工具箱而非人物模仿，见 `lib/ziwei/method/README.md`。
