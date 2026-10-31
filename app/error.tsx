"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { IconRefresh } from "@/components/icons";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-page flex min-h-[62vh] flex-col items-center justify-center py-24 text-center">
      <p className="eyebrow">出错了</p>
      <h1 className="mt-3 font-serif text-[clamp(24px,3.6vw,34px)] font-semibold text-ink">
        这一页暂时没有排出来
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-2">
        页面加载时遇到异常。可以重试一次；如果反复出现，回到首页从排盘重新开始。
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>
          <IconRefresh size={16} />
          重试
        </Button>
        <a href="/" className="text-sm text-ink-2 underline underline-offset-4 hover:text-cinnabar">
          回到首页
        </a>
      </div>
    </div>
  );
}
