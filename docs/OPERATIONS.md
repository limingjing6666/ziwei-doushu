# 运维：访问统计与系统日志

## 接入数据库

Vercel 项目 → Storage → Neon → Connect to project，勾选 Production 和 Preview，确认注入 `DATABASE_URL`（也兼容 `POSTGRES_URL`）。连接串沿用 Neon 提供的 `sslmode=require`，不要去掉。环境变量在项目 Settings → Environment Variables 设置；修改后需重新部署生效。请注意：若 Production 与 Preview 共用数据库，预览访问也会计入统计，正式统计建议分库。

表和索引在实例首次使用时自动创建。未接数据库时静默关闭访问记录，不影响页面、排盘和 AI，只输出一次 `visit.disabled`。建表或写入故障输出 `visit.write_error`（每实例每分钟最多一次），不阻断请求；管理查询故障返回 503。

## 环境变量

- `DATABASE_URL`：Neon 连接串；仅服务端使用。
- `STATS_ADMIN_TOKEN`：自行运行 `openssl rand -hex 24` 生成，再填入 Vercel 环境变量。管理接口使用 Bearer 鉴权，未配置也返回 401。
- `CRON_SECRET`：同样生成独立随机值并手动设置此环境变量。Vercel 每日 cron 自动附带 `Authorization: Bearer <CRON_SECRET>`。
- `STATS_EXCLUDE_IPS`：可选，逗号分隔的测试 IP，命中后不记录；不要提交真实 IP 到仓库。
- `STATS_URL`：本地 CLI 使用的站点 origin，如 `https://tianjipan.tech`。

不要使用 `NEXT_PUBLIC_` 前缀，不要把 token、数据库连接串写入命令示例、截图或日志。CLI 推荐从环境变量读取 token，避免 shell history 留下明文。

## 查看统计

```sh
export STATS_URL=https://tianjipan.tech
export STATS_ADMIN_TOKEN='<管理员令牌>'
curl -H "Authorization: Bearer $STATS_ADMIN_TOKEN" "$STATS_URL/api/admin/stats?days=7"
curl -H "Authorization: Bearer $STATS_ADMIN_TOKEN" "$STATS_URL/api/admin/stats?days=7&format=text"
node scripts/visit-stats.mjs --days 7
# 也支持 --url https://example.com --token '<管理员令牌>'
```

默认 7 天，最多 90 天，但数据库只保留最近 30 天。以香港时区分日；PV 为页面 GET，UV 为页面访问去重 IP（总 UV 对整个窗口去重）；AI 调用按 POST 入口计数，含校验失败的调用。默认排除机器人，`bots=1` 可包含。预取、RSC、静态资源、HEAD、管理和 cron 不计入。IP 不等于真实人数。来源只聚合 host，自身来源不列入。管理响应禁止缓存与索引，含 IP，切勿公开转发。

## 查看系统日志

在已关联项目的目录，登录 Vercel CLI 后：

```sh
vercel logs --follow
vercel logs --query "ai.done"
vercel logs --level error
```

也可在 Vercel 控制台项目 Logs 页选择环境、时间范围，搜索 `ai.done`、`visit.write_error` 或报障时的 `requestId`，按 Level 选择 Error。`ai.request` 记录路由、意图和时辰是否已知；`ai.done` 汇总耗时、首 token 时间、用量、缓存用量、输出字符数、修复及截断标记。`ai.ratelimit`、`ai.invalid_input`、`ai.upstream_error`、`ai.error` 和 `server.error` 用于定位故障。AI 成功与错误响应均有 `x-request-id`。

应用系统日志只允许白名单状态与指标，不写 IP、UA、输入、生辰、问题、AI 文本、请求体、完整 URL、密钥或 Authorization。任意异常消息可能携带用户输入，因此实际捕获点只记录固定错误类别及安全提示，不透传原始异常文本。访问记录单独存于 Neon，不混入系统日志。Vercel 自身的请求日志与 Analytics 是第三方功能，平台可能另行处理网络信息。

查证日期：**2026-10-31**。官方 [Runtime Logs](https://vercel.com/docs/logs/runtime) 与 [Limits](https://vercel.com/docs/limits) 当前说明：Hobby 保留运行时日志 1 小时，Pro 1 天，Enterprise 3 天；Pro/Enterprise 的 Observability Plus 保留 30 天（在 30 天窗口内一次最多查看连续 14 天）。[Drains](https://vercel.com/docs/drains) 当前对 Pro 和 Enterprise 开放，Hobby 不支持。若需长期系统日志，应另行评估付费 Drains 与接收端，当前实现不添加此类依赖。平台政策变化以官方为准。

## 保留与删除

访问记录保留期来自 `lib/visit-policy.ts`，隐私页与清理逻辑共用 30 天常量。`vercel.json` 每天 UTC 20:00（香港次日凌晨 4 点）调用 `/api/cron/prune-visits`，删除超过 30 天的行并输出 `visit.prune`（只含删除行数）。因此超期到实际清理之间最多约一天；请监控 cron 是否成功。Hobby 支持每天一次 cron。

需要提前删除特定 IP 时，在 Neon SQL Editor 用参数化客户端执行 `DELETE FROM visit_log WHERE ip = $1`（不要把真实 IP 放进系统日志），或直接在受控数据库管理工具中删除。清空全部访问记录可执行 `TRUNCATE visit_log`。备份与第三方日志保留另按平台设置管理。隐私页无既有联系方式，因此未新增虚构的删除联系渠道。

## 本地验证

```sh
node scripts/dev-pg.mjs
# 另一个终端，使用上一步输出的本地 DATABASE_URL
export DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres
export STATS_ADMIN_TOKEN='<本地测试令牌>'
npm run build
npx next start -p 3111
# 第三个终端设置同一 STATS_ADMIN_TOKEN 后
node scripts/visit-stats.mjs --url http://localhost:3111 --days 7
```

本地 PGlite 仅监听 loopback、使用内存数据库，退出即清空，不用于生产；不要启用协议调试（它可能打印 SQL 参数）。生产使用 Neon 与 pg 池（每实例最多 1 个连接，空闲 10 秒释放，连接/语句超时 3 秒）。
