import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { MobileTabBar } from "@/components/shell/MobileTabBar";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SITE_URL } from "@/lib/site";
import { SITE_TITLE, SITE_SLOGAN } from "@/lib/brand";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description:
    "天机盘 · AI 紫微命盘。三合四化 · 古法排盘 · AI 解读，分层阅读星宫结构与运限主题，仅供文化学习参考。",
  keywords:
    "天机盘, 紫微斗数, 三合四化, 紫微斗数全书, 斗数骨髓赋, 命盘, 命理, 14主星, 12宫位",
  metadataBase: new URL(SITE_URL),
  manifest: "/manifest.webmanifest",
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_SLOGAN,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: SITE_TITLE,
    description:
      "天机盘 · AI 紫微命盘。三合四化 · 古法排盘 · AI 解读，分层阅读星宫结构与运限主题，仅供文化学习参考。",
    url: SITE_URL,
    siteName: SITE_TITLE,
    locale: "zh_CN",
    type: "website",
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || undefined,
    other: {
      "msvalidate.01": process.env.NEXT_PUBLIC_BING_VERIFICATION || "808FFC6023A2C359B375DD860FEDA856",
      "baidu-site-verification": process.env.NEXT_PUBLIC_BAIDU_VERIFICATION || "",
      "360-site-verification": process.env.NEXT_PUBLIC_360_VERIFICATION || "",
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F0E6" },
    { media: "(prefers-color-scheme: dark)", color: "#11100E" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: SITE_TITLE,
              url: SITE_URL,
              description: SITE_SLOGAN,
            }),
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('ziwei-theme');var t=(s==='light'||s==='dark')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:text-ink focus:shadow-pop"
          >
            跳到主要内容
          </a>
          <SiteHeader />
          <div className="min-h-[calc(100vh-var(--header-h))] pb-14 md:pb-0">
            <main id="main">{children}</main>
            <SiteFooter />
          </div>
          <MobileTabBar />
        </ThemeProvider>
        {process.env.VERCEL === '1' && <><Analytics /><SpeedInsights /></>}
      </body>
    </html>
  );
}
