import { pageMetadata } from '@/lib/brand';

export const metadata = pageMetadata('服务条款', '本站服务条款与用户协议。', '/terms');

export default function TermsPage() {
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
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>服务条款</h1>
        <p style={{ fontSize: 12, color: 'var(--tx-3)', marginBottom: 32 }}>最后更新：2026年10月</p>

      <h2 style={{ fontSize: 18, marginTop: 32, marginBottom: 12 }}>1. 服务概述</h2>
      <p>天机盘（以下简称"本平台"）基于传统三合派紫微斗数，结合四化飞星提供命盘排盘与解读服务。本平台所有命理内容仅供参考，<strong>不构成任何医疗、投资、法律、心理咨询或人生重大决策建议</strong>。</p>

      <h2 style={{ fontSize: 18, marginTop: 32, marginBottom: 12 }}>2. 用户行为规范</h2>
      <p>使用本平台即表示您同意：</p>
      <ul style={{ paddingLeft: 24 }}>
        <li>仅出于合法、个人参考目的使用本平台</li>
        <li>使用第三方数据和公版摘录时遵循其许可，不冒称获得本站或他人背书</li>
        <li>不进行扰乱平台正常运行的行为</li>
        <li>提交的出生信息真实有效；本平台对错误信息导致的解读偏差不承担责任</li>
      </ul>

      <h2 style={{ fontSize: 18, marginTop: 32, marginBottom: 12 }}>3. 知识产权、许可与服务安全</h2>
      <p style={{ background: 'rgba(168,50,40,0.06)', border: '1px solid rgba(168,50,40,0.2)', padding: 16, borderRadius: 8 }}>
        <strong>本站包含独立编写的现代说明、传统文献主题整理及按许可使用的第三方数据，各部分权利分别适用。</strong><br/><br/>
        部分断语来自紫微斗数开源解读数据集 v4.0，作者王多鱼AI，适用 CC BY 4.0；本站已提取、去重并过滤受限引文。公版范围不涵盖现代注本，数据许可也不涵盖第三方作品。<br/>
        开源代码按 MIT 许可使用，不因本站收费而撤回既有许可。传统判断方法本身不作为本站专有表达。<br/>
        请勿绕过鉴权、限额或其他安全措施，不得通过批量请求干扰服务。具体使用限制不减损依法享有的权利或第三方许可。<br/><br/>
        本站不宣称生成文本带有追溯水印，也不保证 AI 输出构成受版权保护的作品。收费项目的价格、交付和退款条件须在购买前明确展示。
      </p>

      <h2 style={{ fontSize: 18, marginTop: 32, marginBottom: 12 }}>4. 免责声明</h2>
      <p>本平台命理内容基于传统星宫规则的独立整理，<strong>不保证 100% 准确</strong>。个人经历受到环境、资源和选择等多种因素影响，使用者应理性看待，不应过度依赖任何单一命理判断。</p>
      <p>因使用本平台内容产生的任何后果（包括但不限于决策失误、心理影响、关系变化等），本平台不承担法律责任。</p>

      <h2 style={{ fontSize: 18, marginTop: 32, marginBottom: 12 }}>5. 服务变更与终止</h2>
      <p>本平台保留随时调整、暂停或终止部分或全部服务的权利。重大变更将在站内说明。</p>

      <h2 style={{ fontSize: 18, marginTop: 32, marginBottom: 12 }}>6. 法律适用与争议解决</h2>
      <p>本条款适用中华人民共和国法律。若发生争议，双方应友好协商；协商不成的，提交本平台运营主体所在地有管辖权的人民法院诉讼解决。</p>


        <p style={{ marginTop: 48, fontSize: 12, color: 'var(--tx-3)' }}>
          <a href="/privacy" style={{ color: 'var(--ac)' }}>隐私政策</a> · <a href="/" style={{ color: 'var(--ac)' }}>返回首页</a>
        </p>
      </main>
    </>
  );
}
