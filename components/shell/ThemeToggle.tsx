"use client";
import { useTheme } from "@/components/ThemeProvider";
import { IconMoon, IconSun } from "@/components/icons";
import { IconButton } from "@/components/ui/IconButton";

/** 全站主题切换：图标用 CSS 依据 data-theme 显隐，避免水合闪烁。 */
export function ThemeToggle({ className }: { className?: string }) {
  const { toggle } = useTheme();
  return (
    <IconButton
      label="切换亮色 / 暗色主题"
      onClick={toggle}
      className={className}
    >
      <IconMoon size={18} className="block dark:hidden" />
      <IconSun size={18} className="hidden dark:block" />
    </IconButton>
  );
}
