import Link from "next/link";
import { Seal } from "@/components/brand";
import { buttonClasses } from "@/components/ui/Button";
import { IconArrowRight } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[62vh] flex-col items-center justify-center py-24 text-center">
      <Seal size={44} label="空" />
      <p className="eyebrow mt-6">404</p>
      <h1 className="mt-3 font-serif text-[clamp(26px,4vw,38px)] font-semibold text-ink">
        这一页不在命盘里
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-2">
        链接可能已经失效，或者地址写错了。可以回到首页重新开始，也可以直接排一张盘。
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className={buttonClasses("primary", "md")}>
          回到首页
        </Link>
        <Link href="/chart" className={buttonClasses("secondary", "md")}>
          排一张盘
          <IconArrowRight size={16} />
        </Link>
      </div>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-5 text-[13px] text-ink-3">
        <Link href="/knowledge" className="transition-colors hover:text-cinnabar">
          星曜知识
        </Link>
        <Link href="/library" className="transition-colors hover:text-cinnabar">
          古籍对读
        </Link>
      </div>
    </div>
  );
}
