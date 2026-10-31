# experiments · 归档区

这里存放的是**不参与生产构建**的实验性 / 未接线的实现。UI 重构阶段（2026-10）从生产目录移出，
保留源码以备将来评估，不进入 `app/` 路由、不被任何生产组件 import、也不参与 `tsc`（见 `tsconfig.json` 的 exclude）。

| 文件 | 原位置 | 说明 |
|---|---|---|
| `app-preview-page.tsx` | `app/preview/page.tsx` | 卷轴开场动画的预览页，含开发对话残留文案；原路由已删除 |
| `ScrollIntro.tsx` | `components/ScrollIntro.tsx` | 4.2 秒全屏卷轴开场动画（未接入首页） |
| `FamousPersonCard.tsx` | `components/FamousPersonCard.tsx` | 名人命盘卡（含真实公众人物估算生辰，权利风险，未接线） |
| `famous.ts` | `lib/ziwei/famous.ts` | 名人命盘数据（同上） |
| `ChatPanel.tsx` | `components/ChatPanel.tsx` | 与 InsightPanel 重复的 AI 聊天实现（未接线） |
| `PatternsCard.tsx` | `components/PatternsCard.tsx` | 格局识别卡（未接线） |
| `ShareModal.tsx` / `ShareCardCanvas.tsx` | `components/` | 命盘分享弹窗与分享卡截图（未接线） |

`ChartSummary.tsx` 与 `StarDetailPanel.tsx` 已移回 `components/`，使用宣纸设计系统，并在 `components/chart/ResultPage.tsx` 接线、纳入生产类型检查。

## 恢复方式

`git mv experiments/<file> <原路径>` 即可；若需要重新纳入类型检查，从 `tsconfig.json` 的 `exclude` 中移除 `experiments`。
