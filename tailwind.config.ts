import type { Config } from "tailwindcss";

/**
 * 天机盘 · Tailwind 主题
 *
 * 颜色只允许来自语义 token（CSS 变量），业务代码不写死 hex。
 * 命名约定：bg-paper / bg-surface / text-ink / text-ink-2 / border-line / text-cinnabar …
 */
const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "rgb(var(--paper) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          2: "rgb(var(--surface-2) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          2: "rgb(var(--ink-2) / <alpha-value>)",
          3: "rgb(var(--ink-3) / <alpha-value>)",
        },
        line: "rgb(var(--line) / <alpha-value>)",
        cinnabar: {
          DEFAULT: "rgb(var(--cinnabar) / <alpha-value>)",
          deep: "rgb(var(--cinnabar-deep) / <alpha-value>)",
          fill: "rgb(var(--cinnabar-fill) / <alpha-value>)",
        },
        indigo: "rgb(var(--indigo) / <alpha-value>)",
        jade: "rgb(var(--jade) / <alpha-value>)",
        ochre: "rgb(var(--ochre) / <alpha-value>)",
        gold: "rgb(var(--gold) / <alpha-value>)",
        "paper-fixed": "rgb(var(--paper-fixed) / <alpha-value>)",
        "ink-fixed": "rgb(var(--ink-fixed) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      maxWidth: {
        container: "var(--container)",
        "container-wide": "var(--container-wide)",
        reading: "var(--reading)",
      },
      borderRadius: {
        xs: "var(--r-xs)",
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
      },
      boxShadow: {
        pop: "var(--shadow-pop)",
        dialog: "var(--shadow-dialog)",
      },
      spacing: {
        header: "var(--header-h)",
      },
      transitionTimingFunction: {
        editorial: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      // Tailwind 默认 opacity 刻度只有 5 的倍数；设计系统用到 8/12/15/18/22/24/28/32/35 等细线透明度，需要显式扩展。
      opacity: {
        4: "0.04",
        6: "0.06",
        8: "0.08",
        12: "0.12",
        14: "0.14",
        15: "0.15",
        16: "0.16",
        18: "0.18",
        22: "0.22",
        24: "0.24",
        28: "0.28",
        32: "0.32",
        35: "0.35",
        45: "0.45",
        55: "0.55",
        65: "0.65",
        85: "0.85",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "rise-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out both",
        "rise-in": "rise-in 0.25s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
