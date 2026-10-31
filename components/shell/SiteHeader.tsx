"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/brand";
import { IconMenu, IconClose } from "@/components/icons";
import { IconButton } from "@/components/ui/IconButton";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/ui/cn";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/chart", label: "排盘" },
  { href: "/heming", label: "合盘" },
  { href: "/knowledge", label: "星曜知识" },
  { href: "/library", label: "古籍对读" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);

  // 路由变化后收起移动端菜单
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line/12 bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85 print:hidden">
      <div className="container-wide flex h-header items-center justify-between gap-6">
        <Link href="/" aria-label="天机盘首页" className="shrink-0">
          <Wordmark />
        </Link>

        <nav aria-label="主导航" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-sm px-3 py-2 text-[14px] transition-colors after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-transparent",
                  active
                    ? "font-medium text-ink after:bg-cinnabar"
                    : "text-ink-3 hover:text-ink-2",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <ThemeToggle />
          <Link
            href="/chart"
            className={buttonClasses("primary", "sm", "hidden sm:inline-flex")}
          >
            排盘
          </Link>
          <IconButton
            label={open ? "关闭菜单" : "打开菜单"}
            className="md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <IconClose size={18} /> : <IconMenu size={18} />}
          </IconButton>
        </div>
      </div>

      {open ? (
        <div id="mobile-nav" className="border-t border-line/12 bg-paper md:hidden">
          <nav aria-label="移动端导航" className="container-wide grid gap-1 py-3">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-sm px-3 py-2.5 text-[15px] transition-colors",
                    active
                      ? "bg-surface-2 font-medium text-ink"
                      : "text-ink-2 hover:bg-surface-2",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
