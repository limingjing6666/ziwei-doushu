"use client";

/**
 * global-error 会替换根 layout，Tailwind 样式不保证可用，
 * 因此这里只用最小内联样式保证可读。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#F5F0E6",
          color: "#1C1A16",
          fontFamily:
            '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif',
          padding: 24,
        }}
      >
        <main style={{ maxWidth: 480, textAlign: "center" }}>
          <p style={{ fontSize: 12, letterSpacing: "0.18em", color: "#A6402E" }}>
            天机盘
          </p>
          <h1 style={{ fontFamily: "serif", fontSize: 26, margin: "12px 0" }}>
            站点暂时无法加载
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: "#4A443B" }}>
            发生了未预期的错误。请刷新重试；若持续出现，请稍后再访问。
          </p>
          <p style={{ fontSize: 12, color: "#6E675B" }}>{error?.digest}</p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              height: 40,
              padding: "0 20px",
              border: "none",
              borderRadius: 4,
              background: "#A6402E",
              color: "#F5F0E6",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            重试
          </button>
        </main>
      </body>
    </html>
  );
}
