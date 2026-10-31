/**
 * 视觉 QA 截图脚本（仅开发期使用，不参与构建）
 *
 * 依赖：本机 Chrome（headless）+ 已运行的 Next dev server（默认 http://127.0.0.1:3000）
 * 用法：
 *   node scripts/qa/shoot.mjs
 *   BASE_URL=http://127.0.0.1:3000 node scripts/qa/shoot.mjs
 *
 * 输出：qa-screens/<theme>-<name>-<width>.png
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PORT = Number(process.env.CDP_PORT || 9222);
const OUT_DIR = join(process.cwd(), "qa-screens");
const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const CHROME = process.env.CHROME || CHROME_CANDIDATES.find((p) => existsSync(p));
const USER_DATA = join(process.cwd(), ".qa-chrome-profile");

const PAGES = [
  { name: "home", path: "/", widths: [1440, 768, 390] },
  { name: "chart-form", path: "/chart", widths: [1440, 390] },
  {
    name: "chart-result",
    path: "/chart",
    widths: [1440, 1024, 390],
    script: `(() => {
      const setSelect = (el, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
        setter.call(el, value);
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const selects = [...document.querySelectorAll("select")];
      if (selects.length < 3) return "no-selects";
      setSelect(selects[0], "1990");
      setSelect(selects[1], "5");
      setSelect(selects[2], "9");
      const form = document.querySelector("form");
      if (form) form.requestSubmit();
      return "submitted";
    })()`,
  },
  { name: "heming", path: "/heming", widths: [1440, 390] },
  { name: "knowledge", path: "/knowledge", widths: [1440, 390] },
  { name: "knowledge-detail", path: "/knowledge/ziwei/overview", widths: [1440, 390] },
  { name: "library", path: "/library", widths: [1440, 390] },
  { name: "library-book", path: "/library/quanshu", widths: [1440, 390] },
  { name: "library-chapter", path: "/library/quanshu/0", widths: [1440, 390] },
  { name: "library-search", path: "/library/search?q=%E5%8C%96%E5%BF%8C", widths: [1440, 390] },
  { name: "terms", path: "/terms", widths: [1440, 390] },
  { name: "privacy", path: "/privacy", widths: [1440, 390] },
  { name: "not-found", path: "/not-a-real-page", widths: [1440, 390] },
];
const THEMES = ["light", "dark"];

if (!CHROME) {
  console.error("找不到 Chrome/Edge 可执行文件，请设置 CHROME 环境变量。");
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
if (existsSync(USER_DATA)) rmSync(USER_DATA, { recursive: true, force: true });

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForChrome() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await sleep(250);
  }
  throw new Error("Chrome CDP 未在 15s 内就绪");
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function openTarget(url) {
  const res = await fetch(
    `http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`,
    { method: "PUT" },
  );
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const cdp = new Cdp(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  return { cdp, ws, targetId: target.id };
}

async function closeTarget(targetId) {
  await fetch(`http://127.0.0.1:${PORT}/json/close/${targetId}`).catch(() => {});
}

async function waitForLoad(cdp) {
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 15000);
    const handler = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === "Page.loadEventFired") {
        clearTimeout(timer);
        cdp.ws.removeEventListener("message", handler);
        resolve();
      }
    };
    cdp.ws.addEventListener("message", handler);
  });
  await sleep(1200); // 字体/动画/客户端渲染稳定
}

async function shoot({ theme, name, path, width, script, height = 1000 }) {
  const { cdp, ws, targetId } = await openTarget("about:blank");
  try {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
    await cdp.send("Emulation.setEmulatedMedia", {
      media: "",
      features: [{ name: "prefers-color-scheme", value: theme }],
    });
    // 清掉上次页面写入的 localStorage 主题，避免串主题
    await cdp.send("Page.navigate", { url: `${BASE}/` });
    await waitForLoad(cdp);
    await cdp.send("Runtime.evaluate", {
      expression: "try{localStorage.clear()}catch(e){}",
    });
    await cdp.send("Page.navigate", { url: `${BASE}${path}` });
    await waitForLoad(cdp);

    if (script) {
      await cdp.send("Runtime.evaluate", {
        expression: script,
        awaitPromise: true,
      });
      await sleep(2200);
    }

    if (process.env.FULL === "1") {
      const metrics = await cdp.send("Page.getLayoutMetrics");
      const fullHeight = Math.min(
        Math.ceil(metrics.cssContentSize?.height || height),
        20000,
      );
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width,
        height: fullHeight,
        deviceScaleFactor: 1,
        mobile: width < 768,
      });
      await sleep(500);
    }

    const result = await cdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
      fromSurface: true,
    });
    const file = join(OUT_DIR, `${theme}-${name}-${width}.png`);
    writeFileSync(file, Buffer.from(result.data, "base64"));
    console.log(`✓ ${file}`);
  } finally {
    ws.close();
    await closeTarget(targetId);
  }
}

async function main() {
  await waitForChrome();
  const only = process.env.ONLY;
  for (const theme of THEMES) {
    for (const page of PAGES) {
      if (only && !page.name.includes(only)) continue;
      for (const width of page.widths) {
        try {
          await shoot({
            theme,
            name: page.name,
            path: page.path,
            width,
            script: page.script,
          });
        } catch (error) {
          console.error(`✗ ${theme} ${page.name} ${width}:`, error.message);
        }
      }
    }
  }
  console.log(`\n完成，截图目录：${OUT_DIR}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    chrome.kill();
  });
