import { LegalLayout } from "@/components/content/LegalLayout";
import type { LegalSection } from "@/components/content/LegalLayout";
import { pageMetadata } from "@/lib/brand";

export const metadata = pageMetadata("服务条款", "本站服务条款与用户协议。", "/terms");

const SECTIONS: LegalSection[] = [
  { id: "overview", title: "1. 服务概述" },
  { id: "conduct", title: "2. 用户行为规范" },
  { id: "ip", title: "3. 知识产权、许可与服务安全" },
  { id: "disclaimer", title: "4. 免责声明" },
  { id: "changes", title: "5. 服务变更与终止" },
  { id: "law", title: "6. 法律适用与争议解决" },
  { id: "contact", title: "7. 联系方式" },
];

export default function TermsPage() {
  return (
    <LegalLayout
      title="服务条款"
      updated="2026年10月"
      sections={SECTIONS}
      other={{ href: "/privacy", label: "隐私政策" }}
    >
      <h2 id="overview" className="scroll-mt-24">
        1. 服务概述
      </h2>
      <p>
        天机盘（以下简称&quot;本平台&quot;）基于传统三合派紫微斗数，结合四化飞星提供命盘排盘与解读服务。本平台所有命理内容仅供参考，
        <strong>
          不构成任何医疗、投资、法律、心理咨询或人生重大决策建议
        </strong>
        。
      </p>

      <h2 id="conduct" className="scroll-mt-24">
        2. 用户行为规范
      </h2>
      <p>使用本平台即表示您同意：</p>
      <ul className="list-disc marker:text-ink-3">
        <li>仅出于合法、个人参考目的使用本平台</li>
        <li>使用第三方数据和公版摘录时遵循其许可，不冒称获得本站或他人背书</li>
        <li>不进行扰乱平台正常运行的行为</li>
        <li>提交的出生信息真实有效；本平台对错误信息导致的解读偏差不承担责任</li>
      </ul>

      <h2 id="ip" className="scroll-mt-24">
        3. 知识产权、许可与服务安全
      </h2>
      <div className="rounded-sm border border-cinnabar/20 bg-cinnabar/5 p-4">
        <p>
          <strong>
            本站包含独立编写的现代说明、传统文献主题整理及按许可使用的第三方数据，各部分权利分别适用。
          </strong>
        </p>
        <p>
          部分断语来自紫微斗数开源解读数据集 v4.0，作者王多鱼AI，适用 CC BY
          4.0；本站已提取、去重并过滤受限引文。公版范围不涵盖现代注本，数据许可也不涵盖第三方作品。
        </p>
        <p>
          开源代码按 MIT
          许可使用，不因本站收费而撤回既有许可。传统判断方法本身不作为本站专有表达。
        </p>
        <p>
          请勿绕过鉴权、限额或其他安全措施，不得通过批量请求干扰服务。具体使用限制不减损依法享有的权利或第三方许可。
        </p>
        <p>
          本站不宣称生成文本带有追溯水印，也不保证 AI
          输出构成受版权保护的作品。收费项目的价格、交付和退款条件须在购买前明确展示。
        </p>
      </div>

      <h2 id="disclaimer" className="scroll-mt-24">
        4. 免责声明
      </h2>
      <p>
        本平台命理内容基于传统星宫规则的独立整理，
        <strong>不保证 100% 准确</strong>
        。命运受天、地、人三才共同影响，本平台输出仅作为认识自我的参考，使用者应理性看待，不应过度依赖任何单一命理判断。
      </p>
      <p>
        因使用本平台内容产生的任何后果（包括但不限于决策失误、心理影响、关系变化等），本平台不承担法律责任。
      </p>

      <h2 id="changes" className="scroll-mt-24">
        5. 服务变更与终止
      </h2>
      <p>
        本平台保留随时调整、暂停或终止部分或全部服务的权利。重大变更将以站内公告或邮件方式通知用户。
      </p>

      <h2 id="law" className="scroll-mt-24">
        6. 法律适用与争议解决
      </h2>
      <p>
        本条款适用中华人民共和国法律。若发生争议，双方应友好协商；协商不成的，提交本平台运营主体所在地有管辖权的人民法院诉讼解决。
      </p>

      <h2 id="contact" className="scroll-mt-24">
        7. 联系方式
      </h2>
      <p>如有疑问，请通过本平台公布的客服微信 / 邮箱联系。</p>
    </LegalLayout>
  );
}
