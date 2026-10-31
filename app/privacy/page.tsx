import { pageMetadata } from '@/lib/brand';

export const metadata = pageMetadata('隐私政策', '本站数据处理与隐私说明。', '/privacy');

export default function PrivacyPage() {
  return (
    <>
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg-0)', borderBottom: '1px solid var(--bdr)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--tx-3)', textDecoration: 'none' }}>
          <span style={{ fontSize: '16px' }}>‹</span>
          <span>返回首页</span>
        </a>
        <div style={{ width: '1px', height: '20px', background: 'var(--bdr-med)' }} />
        <span style={{ fontSize: '12px', color: 'var(--ac)', letterSpacing: '0.2em' }}>天机盘</span>
      </header>
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '60px 24px 80px', color: 'var(--tx-1)', lineHeight: 1.8 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>隐私政策</h1>
        <p style={{ fontSize: 12, color: 'var(--tx-3)', marginBottom: 32 }}>最后更新：2026年10月</p>

      <h2 style={{ fontSize: 18, marginTop: 32, marginBottom: 12 }}>1. 我们收集的信息</h2>
      <p>为提供天机盘排盘与解读服务，我们可能收集以下信息：</p>
      <ul style={{ paddingLeft: 24 }}>
        <li><strong>命盘必要信息</strong>：姓名（选填）、出生公历年月日、出生时辰、性别、出生地经度</li>
        <li><strong>账号信息</strong>：当前版本未提供注册与会员账户，若将来开放，会另行说明所需信息</li>
        <li><strong>交互信息</strong>：你在站内的点击、浏览、命盘历史记录</li>
        <li><strong>反馈信息</strong>：你对解读内容的"准 / 不准"打分与文字反馈</li>
        <li><strong>支付信息</strong>：当前版本未接入支付；收费功能上线前将补充支付服务商及订单处理说明</li>
      </ul>

      <h2 style={{ fontSize: 18, marginTop: 32, marginBottom: 12 }}>2. 我们如何使用信息</h2>
      <ul style={{ paddingLeft: 24 }}>
        <li>命盘信息用于本次起盘与解读，最近命盘可能保存在浏览器本地</li>
        <li>当前版本不收集用于注册或订单通知的手机号</li>
        <li>反馈信息用于持续改进命理内容质量（脱敏后聚合分析）</li>
        <li>聚合数据可能用于行业研究与平台优化</li>
      </ul>

      <h2 style={{ fontSize: 18, marginTop: 32, marginBottom: 12 }}>3. 信息共享与第三方</h2>
      <p>除以下情形外，我们不会向第三方共享你的个人信息：</p>
      <ul style={{ paddingLeft: 24 }}>
        <li>当前未对接支付或短信服务商；新增服务前会更新说明</li>
        <li>云服务商（如 Vercel / Cloudflare / 阿里云）：技术承载</li>
        <li>AI 解读服务（DeepSeek）：仅在请求 AI 解读或合盘时，发送必要出生信息、星曜宫位与最近对话用于生成回复；服务端不会主动发送姓名、出生城市或经度。请勿在问题中填写姓名、联系方式等敏感信息。本站 AI 接口不持久保存命盘或对话；第三方处理规则请参阅 DeepSeek 隐私政策。</li>
        <li>防刷服务（如配置 Upstash）：仅保存 IP 的哈希与短期计数，不向其发送出生信息或对话。</li>
        <li>司法机关或政府部门基于法律法规的合法要求</li>
      </ul>

      <h2 style={{ fontSize: 18, marginTop: 32, marginBottom: 12 }}>4. 信息安全</h2>
      <p>生产环境应使用 HTTPS，凭据仅放服务端，接口限制输入与访问频率。当前 AI 接口不持久保存命盘及对话，不宣称已提供加密历史数据库；网络传输仍有风险。</p>

      <h2 style={{ fontSize: 18, marginTop: 32, marginBottom: 12 }}>5. 你的权利</h2>
      <ul style={{ paddingLeft: 24 }}>
        <li><strong>查询</strong>：当前没有账号中心或订单记录</li>
        <li><strong>删除</strong>：可清理浏览器中的本站数据；其他信息处理疑问可联系运营方</li>
        <li><strong>导出</strong>：可申请导出你的全部个人数据</li>
      </ul>

      <h2 style={{ fontSize: 18, marginTop: 32, marginBottom: 12 }}>6. Cookie 与本地存储</h2>
      <p>本站使用 cookie / localStorage 用于：保存主题偏好和最近命盘；当前没有会员登录状态。你可在浏览器设置中关闭，但部分功能可能受影响。</p>

      <h2 style={{ fontSize: 18, marginTop: 32, marginBottom: 12 }}>7. 未成年人</h2>
      <p>本平台命理内容面向 18 岁以上成年用户。未成年人请在监护人同意下使用，并不得将解读用于重大人生决策。</p>

      <h2 style={{ fontSize: 18, marginTop: 32, marginBottom: 12 }}>8. 政策变更</h2>
      <p>本政策可能不定期更新。重大变更将以显著方式通知。继续使用即表示同意更新后的版本。</p>

        <p style={{ marginTop: 48, fontSize: 12, color: 'var(--tx-3)' }}>
          <a href="/terms" style={{ color: 'var(--ac)' }}>服务条款</a> · <a href="/" style={{ color: 'var(--ac)' }}>返回首页</a>
        </p>
      </main>
    </>
  );
}
