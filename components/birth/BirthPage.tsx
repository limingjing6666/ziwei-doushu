"use client";

import type { BirthInfo } from "@/lib/ziwei/types";
import { Card } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";
import { IconInfo } from "@/components/icons";
import BirthForm, { type BirthFormState } from "./BirthForm";

const STEPS = [
  {
    title: "出生日期",
    detail: "按公历或农历填写年、月、日，日期会与时辰一起决定命宫位置。",
  },
  {
    title: "时刻与地点",
    detail: "填北京时间与出生城市，系统按经度换算真太阳时后再定时辰。",
  },
  {
    title: "复核与排盘",
    detail: "确认性别与复核摘要后起盘，随后可查看十二宫、四化与大限。",
  },
];

const FAQS = [
  {
    question: "不知道出生时辰怎么办？",
    answer:
      "在出生时间下方勾选「不知道出生时间」，系统会按子时（23:00–01:00）起盘，并在命盘中标注时辰不详。",
  },
  {
    question: "出生时间填北京时间还是当地时间？",
    answer:
      "填出生时的北京时间（东八区标准时）。系统再按出生地经度换算真太阳时，换算结果会在填写时实时显示。",
  },
  {
    question: "出生地不填可以吗？",
    answer:
      "可以。不填出生地时不校正经度，按北京时间对应时辰起盘；填了会按经度换算真太阳时（经度每差 1° 约差 4 分钟）。",
  },
];

export interface BirthPageProps {
  onStart: (info: BirthInfo) => void;
  initialData?: Partial<BirthFormState>;
  onFormSave?: (form: BirthFormState) => void;
}

/**
 * 起盘信息填写页：桌面左栏说明 + 右栏表单，移动端单列且表单在前。
 * 页面级 header / footer 由 app/layout.tsx 的 AppShell 提供，这里不重复渲染。
 */
export default function BirthPage({ onStart, initialData, onFormSave }: BirthPageProps) {
  return (
    <section aria-labelledby="birth-page-title" className="bg-paper">
      <div className="container-page py-8 md:py-12 lg:py-14">
        <div className="grid items-start gap-8 md:gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14 xl:gap-16">
          {/* 左栏：说明、步骤、隐私、FAQ（桌面 sticky；移动端排在表单之后） */}
          <div className="order-2 min-w-0 lg:order-1 lg:sticky lg:top-[calc(var(--header-h)_+_2.5rem)]">
            <div className="hidden lg:block">
              <p className="eyebrow">起盘</p>
            </div>
            <h1
              id="birth-page-title"
              className="mt-3 font-serif text-[clamp(26px,3.4vw,38px)] font-semibold leading-[1.25] tracking-[0.02em] text-ink"
            >
              先补齐生辰，再读命盘
            </h1>
            <p className="mt-4 max-w-[40ch] text-[15px] leading-[1.85] text-ink-2">
              填写公历或农历出生日期、北京时间与出生地点，按三合四化起盘，并按经度换算真太阳时。
            </p>

            <div className="mt-8">
              <h2 className="text-[12px] font-medium tracking-[0.16em] text-ink-3">
                填写顺序
              </h2>
              <ol className="mt-2 divide-y divide-line/12 border-y border-line/12">
                {STEPS.map((step, index) => (
                  <li key={step.title} className="flex gap-4 py-3">
                    <span
                      aria-hidden="true"
                      className="w-5 shrink-0 font-mono text-[12px] leading-6 tabular-nums text-ink-3"
                    >
                      0{index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-ink">
                        {step.title}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">
                        {step.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-6 flex items-start gap-2.5 rounded-sm border border-line/12 bg-surface px-3.5 py-3">
              <IconInfo size={16} className="mt-0.5 shrink-0 text-ink-3" />
              <p className="text-[12.5px] leading-[1.75] text-ink-2">
                在本机完成排盘，姓名与城市不会发送给 AI。
              </p>
            </div>

            <div className="mt-8">
              <h2 className="text-[12px] font-medium tracking-[0.16em] text-ink-3">
                常见问题
              </h2>
              <div className="mt-1 border-t border-line/12">
                {FAQS.map((faq) => (
                  <Disclosure key={faq.question} title={faq.question}>
                    {faq.answer}
                  </Disclosure>
                ))}
              </div>
            </div>
          </div>

          {/* 右栏：表单卡（移动端排在最前） */}
          <div className="order-1 min-w-0 lg:order-2">
            <div className="mb-3 lg:hidden">
              <p className="eyebrow">起盘</p>
            </div>
            <Card className="p-4 sm:p-6 lg:p-7">
              <div className="mb-5 flex items-baseline justify-between gap-4 border-b border-line/12 pb-4">
                <h2 className="font-serif text-[18px] font-semibold tracking-[0.01em] text-ink">
                  出生信息
                </h2>
                <span className="shrink-0 text-[12px] text-ink-3">
                  双历 · 北京时间
                </span>
              </div>
              <BirthForm onSubmit={onStart} initialData={initialData} onFormSave={onFormSave} />
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
