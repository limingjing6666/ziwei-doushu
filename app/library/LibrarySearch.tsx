"use client";

/**
 * 古籍库全文检索框 — client component
 *
 * 输入关键词 → 跳转 /library/search?q=xxx
 * 结果页复用同一组件，用 defaultValue 预填查询。
 */

import { useState, type FormEvent, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { IconSearch } from "@/components/icons";

export default function LibrarySearch({
  defaultValue = "",
}: {
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const query = value.trim();

  const submit = (event?: FormEvent<HTMLFormElement>, input = value) => {
    event?.preventDefault();
    const submitted = input.trim();
    if (!submitted) return;
    startTransition(() => {
      router.push(`/library/search?q=${encodeURIComponent(submitted)}`);
    });
  };

  return (
    <form
      role="search"
      aria-label="古籍原文（繁转简）全文检索"
      onSubmit={submit}
      className="surface-card flex items-center gap-2 p-2 focus-within:border-cinnabar/50"
    >
      <IconSearch
        size={18}
        className="ml-1.5 hidden shrink-0 text-ink-3 sm:block"
      />
      <label htmlFor="library-search-input" className="sr-only">
        搜索关键词
      </label>
      <input
        id="library-search-input"
        name="q"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); submit(undefined, event.currentTarget.value); } }}
        placeholder="搜索古籍原文（繁转简），如：七杀朝斗 / 紫微 / 化忌"
        autoComplete="off"
        enterKeyHint="search"
        className="h-10 w-full min-w-0 flex-1 bg-transparent px-2 text-[15px] text-ink placeholder:text-ink-3"
      />
      <Button
        type="submit"
        size="md"
        disabled={isPending || !query}
        className="shrink-0"
      >
        {isPending ? "检索中…" : "全文检索"}
      </Button>
    </form>
  );
}
