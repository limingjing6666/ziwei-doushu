import Link from "next/link";
import { SampleChart, SAMPLE_CHART_META, SAMPLE_SI_HUA, SAMPLE_STRUCTURE } from "@/components/home/SampleChart";
import { Card, Disclosure, SectionHeading } from "@/components/ui";
import { SiHuaBadge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { IconArrowRight, IconBook, IconStar } from "@/components/icons";
import { ALL_BOOKS, TOTAL_PARAGRAPHS } from "@/lib/classics";
import { getAllKnowledgeRoutes } from "@/lib/seo/knowledge";

/** 真实数量，不写死、不夸大 */
const KNOWLEDGE_ARTICLE_COUNT = getAllKnowledgeRoutes().length;
const BOOK_COUNT = ALL_BOOKS.length;
const PARAGRAPH_COUNT = TOTAL_PARAGRAPHS;

const STEPS = [
  {
    no: "01",
    title: "补生辰",
    body: "公历或农历生日、出生时刻与出生地。时刻与地点决定命宫、身宫和部分星曜的位置，是整张盘的基础。",
  },
  {
    no: "02",
    title: "校真太阳时",
    body: "按出生地经度与东经 120° 的差值换算真太阳时，再确认落在哪一个时辰，避免在时辰边界上排出两张不同的盘。",
  },
  {
    no: "03",
    title: "读星宫结构与依据",
    body: "先看命宫与三方四正，再追踪四化落点，最后对照大限与流年所在。每条判断都应能指回具体的宫位与星曜。",
  },
];

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "出生信息会被保存吗？",
    a: "排盘在当前浏览器内完成，站点没有注册账号，也不保存命盘记录。只有在请求 AI 解读时，才会把盘面必要字段发送给推理服务（不含姓名、出生城市与经度），接口不持久保存命盘或对话。",
  },
  {
    q: "不知道出生时辰怎么办？",
    a: "可以在起盘页勾选「不知道出生时间」，系统按子时（23:00–01:00）起盘，并在页面注明时辰不详。时辰会影响命宫、身宫与部分星曜的落宫，这样的盘只作结构参考。",
  },
  {
    q: "为什么同一生辰在不同软件排出的盘不一样？",
    a: "紫微斗数在晚子时是否换日、闰月归本月还是下月、是否做真太阳时校正上都有流派差异，同一生辰可能排出不同的盘。对照其他软件时，先核对这三项口径，再比较星曜位置。",
  },
  {
    q: "AI 解读可靠吗？",
    a: "AI 部分是对已经排出的盘面做文字整理，可能出错，也不构成预测。星曜位置、宫位关系与四化落点由本地规则计算，可以逐条核对；AI 可按事业方向、感情婚姻、财运、健康、家庭与沟通等话题解读；段落只作阅读辅助，重要决定请回到现实信息。",
  },
  {
    q: "站上的内容来自哪里？",
    a: "星曜知识与古籍库是静态数据；部分断语整理自紫微斗数开源解读数据集 v4.0（CC BY 4.0，作者王多鱼AI），修改后的表述不代表原作者认可。",
  },
];

export default function HomePage() {
  return (
    <div>
      {/* ── 首屏：左文右盘 ───────────────────────────────── */}
      <section className="border-b border-line/12">
        <div className="container-page grid items-center gap-12 py-14 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)] lg:gap-12 lg:py-24">
          <div>
            <p className="eyebrow">三合四化 · 古法排盘</p>
            <h1 className="mt-4 font-serif text-[clamp(30px,4.2vw,50px)] font-semibold leading-[1.2] tracking-[0.01em] text-ink">
              把命盘读成一份
              <br />
              可以核对的说明书
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-[1.9] text-ink-2 sm:text-base">
              填入出生日期、时刻与出生地，排出十二宫、十四主星与生年四化，标出四化落点和大限所在。
            </p>
            <p className="mt-2 max-w-xl text-[15px] leading-[1.9] text-ink-2 sm:text-base">
              先看盘面事实，再读解释。星曜位置、四化落点与运限层级由本地规则排出，可以在盘面上逐条核对。
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/chart" className={buttonClasses("primary", "lg")}>
                排一张盘
                <IconArrowRight size={16} />
              </Link>
              <Link href="#sample-chart" className={buttonClasses("secondary", "lg")}>
                看示例盘
              </Link>
            </div>

            <p className="mt-6 text-[13px] leading-relaxed text-ink-3">
              无需注册 · 不保存出生信息 · 仅供文化学习参考
            </p>
          </div>

          <div className="mx-auto w-full max-w-[500px] lg:mx-0">
            <SampleChart />
          </div>
        </div>
      </section>

      {/* ── 三步使用说明 ─────────────────────────────────── */}
      <section className="section border-b border-line/12">
        <div className="container-page">
          <SectionHeading eyebrow="使用方式" title="三步，从生辰到一张能读的盘" />

          <ol className="mt-9 grid gap-px border-y border-line/20 bg-line/15 md:grid-cols-3">
            {STEPS.map((step) => (
              <li
                key={step.no}
                className="bg-paper py-7 md:px-6 md:py-8 md:first:pl-0 md:last:pr-0"
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[12px] tracking-[0.08em] text-ink-3">
                    {step.no}
                  </span>
                  <h3 className="font-serif text-[17px] font-semibold text-ink sm:text-[18px]">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-2.5 text-[14px] leading-[1.85] text-ink-2">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 命盘能力：本命 / 四化 / 运限 ─────────────────── */}
      <section className="section border-b border-line/12">
        <div className="container-page">
          <SectionHeading
            eyebrow="盘面能力"
            title="一张盘，三层读法"
            description="本命看结构，四化看资源与压力落在哪里，运限看阶段与年份。三层分开读，不把一年的事说成一生的定论。"
            action={
              <Link
                href="/chart"
                className="inline-flex items-center gap-1.5 text-[13px] text-cinnabar underline-offset-4 hover:underline"
              >
                排一张盘看完整结构
                <IconArrowRight size={14} />
              </Link>
            }
          />

          <div className="mt-9 grid gap-px border-y border-line/20 bg-line/15 md:grid-cols-3">
            <div className="bg-paper py-7 md:px-6 md:py-8 md:first:pl-0 md:last:pr-0">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[12px] text-ink-3">01</span>
                <h3 className="font-serif text-[18px] font-semibold text-ink">本命结构</h3>
              </div>
              <p className="mt-2.5 text-[14px] leading-[1.85] text-ink-2">
                十二宫按地支排布，十四主星与辅煞同盘显示，主星标注庙、旺、得、利、平、不、闲、陷。先看命宫与三方四正的关系，再看单宫。
              </p>
              <dl className="mt-4 border-t border-line/12 text-[13px]">
                {SAMPLE_STRUCTURE.map((row) => (
                  <div
                    key={row.palace}
                    className="flex items-baseline justify-between gap-3 border-b border-line/12 py-2"
                  >
                    <dt className="text-ink-3">{row.palace}</dt>
                    <dd className="font-serif font-semibold text-ink">{row.stars}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="bg-paper py-7 md:px-6 md:py-8 md:first:pl-0 md:last:pr-0">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[12px] text-ink-3">02</span>
                <h3 className="font-serif text-[18px] font-semibold text-ink">四化飞星</h3>
              </div>
              <p className="mt-2.5 text-[14px] leading-[1.85] text-ink-2">
                生年四化标出禄、权、科、忌四颗星及其落宫。四化描述资源、责任、名誉与牵挂的落点，需要和星曜、宫位一起读，不能单看一个标记。
              </p>
              <ul className="mt-4 grid grid-cols-1 gap-x-3 gap-y-1.5 border-t border-line/12 pt-3 text-[13px] sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                {SAMPLE_SI_HUA.map((item) => (
                  <li key={item.hua} className="flex items-center gap-1.5">
                    <SiHuaBadge siHua={item.hua} />
                    <span className="text-ink-2">{item.star}</span>
                    <span className="text-ink-3">· {item.palace}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-paper py-7 md:px-6 md:py-8 md:first:pl-0 md:last:pr-0">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[12px] text-ink-3">03</span>
                <h3 className="font-serif text-[18px] font-semibold text-ink">运限三层</h3>
              </div>
              <p className="mt-2.5 text-[14px] leading-[1.85] text-ink-2">
                本命为底图，大限十年一换，流年按年份切换。先看阶段背景，再看年度差异；两层不一致时，先说明分歧。
              </p>
              <dl className="mt-4 border-t border-line/12 text-[13px]">
                {[
                  { label: "本命", detail: "十二宫底图，看长期结构" },
                  { label: "大限", detail: "十年一换，看阶段重点" },
                  { label: "流年", detail: "按年份切换，看四化叠加" },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-baseline justify-between gap-3 border-b border-line/12 py-2"
                  >
                    <dt className="shrink-0 text-ink-3">{row.label}</dt>
                    <dd className="text-right text-ink-2">{row.detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <p className="mt-4 text-[12px] leading-relaxed text-ink-3">
            以上小样本取自本页示例盘（公历 {SAMPLE_CHART_META.solar}，{SAMPLE_CHART_META.gender}），只说明呈现方式。
          </p>
        </div>
      </section>

      {/* ── 古籍与依据 ───────────────────────────────────── */}
      <section className="section border-b border-line/12 bg-surface/50">
        <div className="container-page grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-14">
          <div>
            <SectionHeading eyebrow="古籍与依据" title="先看原文，再看解释" />

            <blockquote className="mt-8 border-l-2 border-ochre/60 pl-5 sm:pl-6">
              <p className="font-serif text-[clamp(17px,2.2vw,22px)] leading-[1.9] text-ink">
                看命之要，先看命宫。命宫主星定其格局，三方四正定其用武。次看身宫，身宫定其晚景与依归。再看大限流年，定其一生进退之节。
              </p>
              <cite className="mt-3 block text-[12px] not-italic text-ink-3">
                ——《骨髓赋·总论篇》
              </cite>
            </blockquote>

            <p className="mt-6 max-w-2xl text-[14px] leading-[1.9] text-ink-2">
              方法说明：古籍原文、现代整理与 AI 生成分开标注。本库收录的赋文含现代整理，未逐字校勘，阅读时以原文为先，解释只作参照。
            </p>
          </div>

          <aside className="lg:border-l lg:border-line/12 lg:pl-8">
            <h3 className="eyebrow">本库收录</h3>
            <ul className="mt-3 border-t border-line/12 text-[13px]">
              {ALL_BOOKS.map((book) => (
                <li
                  key={book.slug}
                  className="flex items-baseline justify-between gap-3 border-b border-line/12 py-2.5"
                >
                  <Link
                    href={`/library/${book.slug}`}
                    className="font-serif font-semibold text-ink underline-offset-4 hover:text-cinnabar hover:underline"
                  >
                    {book.title}
                  </Link>
                  <span className="font-mono text-[12px] text-ink-3">
                    {book.chapters.length} 章
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/library"
              className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-cinnabar underline-offset-4 hover:underline"
            >
              原典对读
              <IconArrowRight size={14} />
            </Link>
          </aside>
        </div>
      </section>

      {/* ── 双入口：星曜知识库 / 古籍对读库 ───────────────── */}
      <section className="section border-b border-line/12">
        <div className="container-page">
          <SectionHeading
            eyebrow="资料库"
            title="排盘之外，还有可以慢慢读的部分"
            description="专题页按星曜与宫位组织，古籍库保留原文与整理说明，两者都可以单独阅读。"
          />

          <div className="mt-9 grid gap-4 md:grid-cols-2">
            <Link href="/knowledge" className="group block">
              <Card className="flex h-full flex-col justify-between gap-6 p-6 transition-colors group-hover:border-line/30 group-hover:bg-surface-2/40 sm:p-7">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="eyebrow">星曜知识库</h3>
                    <IconStar size={18} className="text-ink-3" />
                  </div>
                  <p className="mt-3 font-serif text-[20px] font-semibold text-ink">
                    十四主星 × 十三宫位
                  </p>
                  <p className="mt-2 text-[14px] leading-[1.85] text-ink-2">
                    按星曜与宫位交叉整理的专题，先读星性，再对照它在命盘中的落宫。
                  </p>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-line/12 pt-4">
                  <span className="font-mono text-[13px] text-ink-2">
                    {KNOWLEDGE_ARTICLE_COUNT} 篇专题
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-cinnabar">
                    进入知识库
                    <IconArrowRight size={14} />
                  </span>
                </div>
              </Card>
            </Link>

            <Link href="/library" className="group block">
              <Card className="flex h-full flex-col justify-between gap-6 p-6 transition-colors group-hover:border-line/30 group-hover:bg-surface-2/40 sm:p-7">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="eyebrow">古籍对读库</h3>
                    <IconBook size={18} className="text-ink-3" />
                  </div>
                  <p className="mt-3 font-serif text-[20px] font-semibold text-ink">
                    原文、整理与出处
                  </p>
                  <p className="mt-2 text-[14px] leading-[1.85] text-ink-2">
                    按书与章节阅读传统赋文，现代整理单独标注，方便与原文逐段对照。
                  </p>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-line/12 pt-4">
                  <span className="font-mono text-[13px] text-ink-2">
                    {BOOK_COUNT} 部 · {PARAGRAPH_COUNT} 段
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-cinnabar">
                    进入古籍库
                    <IconArrowRight size={14} />
                  </span>
                </div>
              </Card>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 常见问题 + 数据署名 + 免责声明 ────────────────── */}
      <section className="section">
        <div className="container-page">
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-14">
            <SectionHeading eyebrow="常见问题" title="开始之前" />
            <div className="border-t border-line/12">
              {FAQS.map((faq) => (
                <Disclosure key={faq.q} title={faq.q}>
                  {faq.a}
                </Disclosure>
              ))}
            </div>
          </div>

          <div className="mt-12 border-t border-line/20 pt-6">
            <p className="text-[12px] leading-[1.9] text-ink-3">
              数据署名：部分断语整理自紫微斗数开源解读数据集 v4.0（CC BY 4.0），作者王多鱼AI；修改后的表述不代表上游作者认可。古籍库文本含现代整理，未逐字校勘。
            </p>
            <p className="mt-2 text-[12px] leading-[1.9] text-ink-3">
              免责声明：传统术数与 AI 生成内容仅供文化学习与自我观察，不构成医疗、投资、法律或人生重大决策建议。完整说明见{" "}
              <Link
                href="/terms"
                className="text-ink-2 underline underline-offset-2 hover:text-cinnabar"
              >
                服务条款
              </Link>{" "}
              与{" "}
              <Link
                href="/privacy"
                className="text-ink-2 underline underline-offset-2 hover:text-cinnabar"
              >
                隐私政策
              </Link>
              。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
