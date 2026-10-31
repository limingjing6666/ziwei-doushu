"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/ui/cn";
import {
  IconBook,
  IconChart,
  IconCompatibility,
  IconStar,
} from "@/components/icons";

const ITEMS = [
  { href: "/chart", label: "排盘", icon: IconChart },
  { href: "/heming", label: "合盘", icon: IconCompatibility },
  { href: "/knowledge", label: "知识", icon: IconStar },
  { href: "/library", label: "古籍", icon: IconBook },
];

/** 移动端底部主导航（md 以上隐藏）。 */
export function MobileTabBar() {
  const pathname = usePathname() || "/";

  return (
    <nav
      aria-label="快捷导航"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/12 bg-paper/95 backdrop-blur md:hidden print:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-4">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[11px] transition-colors",
                active ? "text-cinnabar" : "text-ink-3",
              )}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
