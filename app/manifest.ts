import type { MetadataRoute } from "next";
import { SITE_TITLE, SITE_SLOGAN } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_TITLE,
    short_name: "天机盘",
    description: SITE_SLOGAN,
    lang: "zh-CN",
    start_url: "/",
    display: "browser",
    background_color: "#F5F0E6",
    theme_color: "#F5F0E6",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
