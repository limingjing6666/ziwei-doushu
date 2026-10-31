import { pageMetadata } from '@/lib/brand';
export const metadata = pageMetadata('隐私政策', '本站实际数据处理与隐私说明。', '/privacy');
export default function PrivacyPage() {
  return <main className="max-w-3xl mx-auto px-5 py-12 leading-8"><a href="/" className="underline">← 返回首页</a><h1 className="text-2xl my-5">隐私政策</h1><p className="text-sm mb-6">最后更新：2026年10月31日</p>
    <h2 className="text-lg mt-6 mb-2">1. 出生信息与对话</h2>
    <p>个人排盘与双方合盘的排盘计算在浏览器中完成。出生日期、时间、性别、选填称呼及地点保留在当前页面内存中；本站没有账号、支付、评分反馈或命盘历史记录功能，也不会将本次命盘或对话写入 localStorage。刷新或离开页面后不能恢复报告。请勿输入不必要的身份、联系方式等敏感信息。</p>
    <h2 className="text-lg mt-6 mb-2">2. 请求 AI 时发送什么</h2>
    <p>只有明确点击 AI 解读话题、解读按钮、提问或开始合盘分析时，浏览器才向本站 AI 接口提交命盘与问题；点击宫位和星曜查看本地简介不会调用 AI。本站服务端整理出生日期、性别、时辰及其是否已知、星曜宫位、所选年份与大限、最近对话为文本，发送给 DeepSeek 生成回复。合盘追问还会带上原报告摘要。服务端不主动将称呼、出生城市或经度发给 DeepSeek；但你在问题中写出的个人信息可能随对话发送。</p>
    <p>本站 AI 接口没有将命盘及对话持久存入数据库的实现。第三方 AI 服务商可能依其自身政策处理请求，请参阅 <a className="underline" href="https://cdn.deepseek.com/policies/zh-CN/deepseek-privacy-policy.html" rel="noopener noreferrer">DeepSeek 隐私政策</a>。浏览器仅在内存中缓存最近成功的回答，避免同一问题重复请求；关闭页面后清除。</p>
    <h2 className="text-lg mt-6 mb-2">3. 访问统计、日志与限流</h2>
    <p>页面加载 Vercel Analytics 与 Speed Insights，用于访问统计和性能测量，可能处理页面路径、设备/浏览器及性能数据。托管平台还可能按其配置处理网络请求日志（包括 IP、路径、状态码等）。本站应用未主动记录命盘或对话日志，无法据此承诺第三方日志的具体保存期限。</p>
    <p>为防止滥用，AI 接口以请求 IP 的 SHA-256 摘要进行每分钟、每日计数。配置 Upstash Redis 时将摘要键与短期计数发送给 Upstash，不发送命盘和对话；未配置时只作服务器实例内存计数。计数按短期窗口过期。</p>
    <h2 className="text-lg mt-6 mb-2">4. 浏览器存储与清理</h2>
    <p>当前页面使用 localStorage 保存主题偏好（ziwei-theme）及是否关闭首次阅读引导（tianjipan-result-guide-v1）。没有用于登录或保存命盘的本站 cookie。旧版本使用者可能有残留数据；可以在浏览器设置中清除本站存储。禁止本地存储不影响本次排盘，但主题和引导偏好可能不能记住。</p>
    <h2 className="text-lg mt-6 mb-2">5. 安全与使用范围</h2>
    <p>生产环境应使用 HTTPS；AI 密钥仅留在服务端，接口限制输入大小、来源与频率。任何网络传输都存在风险，请仅在获得对方同意后提交其出生信息。本站面向成年用户；未成年人应在监护人同意下使用。</p>
    <h2 className="text-lg mt-6 mb-2">6. 政策更新</h2><p>数据处理方式变化时将在此页更新说明。本站目前没有个人数据导出或账号删除入口，请通过清理浏览器数据移除本地偏好。</p>
    <p className="mt-8"><a className="underline" href="/terms">服务条款</a> · <a className="underline" href="/">返回首页</a></p>
  </main>;
}
