"use client";

import { useEffect, useRef, useState } from "react";
import type { Palace, ZiweiChart } from "@/lib/ziwei/types";
import type { TimeView } from "./TimeNav";
import { consumeAiResponse } from "@/lib/ai/client";
import { AiProse } from "@/components/ui/AiProse";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Skeleton";
import { cn } from "@/lib/ui/cn";

interface Message {
  role: "user" | "assistant";
  content: string;
  /** 自动/主题请求产生的隐藏用户消息，不显示气泡 */
  hidden?: boolean;
  /** 该条 assistant 消息是错误提示，用朱砂色单独呈现 */
  error?: boolean;
}

interface SelectedSiHua {
  starName: string;
  siHua: string;
  view: TimeView;
}

export interface InsightPanelProps {
  chart: ZiweiChart;
  selectedPalace?: Palace | null;
  selectedSiHua?: SelectedSiHua | null;
  className?: string;
}

const TOPICS = [
  { key: "overview", label: "命格" },
  { key: "love", label: "感情" },
  { key: "career", label: "事业" },
  { key: "wealth", label: "财运" },
  { key: "health", label: "健康" },
  { key: "personality", label: "性格" },
] as const;

const TOPIC_PROMPTS: Record<string, string> = {
  overview: `请生成命格总览，按以下结构输出：

**【命格定性】**
用一句话概括这个命盘的核心格局与命主气质。

**【主星解读】**
命宫主星的核心特质，用自己的语言说明星性依据。

**【三方四正】**
财、官、迁三宫的联动分析及整体格局。

**【当前大限】**
当下大限运势方向与最值得关注的事项。

**【优势与注意】**
命盘天赋优势，以及需要注意的风险或功课。`,

  love: `请深度分析感情婚姻运，按以下结构输出：

**【感情格局】**
一句话定性感情命格。

**【夫妻宫分析】**
夫妻宫主星、四化，结合福德宫具体推导。

**【三方联动】**
相关宫位对感情的影响。

**【当前大限感情运】**
当下10年感情走向与关键节点。

**【实际建议】**
具体可行的感情建议。`,

  career: `请深度分析事业运，按以下结构输出：

**【事业格局】**
一句话定性事业命格，宜任职或宜创业。

**【官禄宫分析】**
官禄宫主星、四化，说明这种配置的推导依据。

**【财帛宫联动】**
财运与事业的关系，财路来源分析。

**【当前大限事业运】**
当下10年事业走向。

**【实际建议】**
适合的方向、行业与策略。`,

  wealth: `请深度分析财运，按以下结构输出：

**【财运格局】**
一句话定性财运模式，是主动财还是被动财。

**【财帛宫分析】**
财帛宫主星、四化，财富来源与流动模式。

**【田宅宫（财库）】**
积蓄能力与不动产运势分析。

**【当前大限财运】**
当下财运走向与注意事项。

**【理财建议】**
具体的财务建议。`,

  health: `请分析健康运势，按以下结构输出：

**【疾厄宫主星】**
疾厄宫星曜与健康含义。

**【主要风险】**
只给一般作息与压力管理建议，不凭星曜诊断疾病；身体不适应就医。

**【大限健康走势】**
当下健康趋势与关键时间段。

**【预防建议】**
具体注意事项与养生方向。`,

  personality: `请深度解析性格特质，按以下结构输出：

**【命宫主星性格】**
命宫主星的核心性格特质，用自己的话解释依据。

**【三方性格综合】**
财、官、迁三宫对性格的影响，全貌描绘。

**【人际关系模式】**
与他人互动方式、待人处世风格。

**【优势与人生课题】**
天赋优势，以及需要面对的人生功课。`,
};

const PALACE_ROLES: Record<string, string> = {
  '命宫':   '自我、性格、先天格局',
  '兄弟宫': '兄弟关系、合伙人',
  '夫妻宫': '感情关系、婚姻状态',
  '子女宫': '子女缘分、下属关系',
  '财帛宫': '财运来源、收入方式',
  '疾厄宫': '身体健康、意外',
  '迁移宫': '外出机遇、人际格局',
  '交友宫': '朋友圈、贵人、小人',
  '官禄宫': '事业成就、社会地位',
  '田宅宫': '不动产、家庭环境',
  '福德宫': '精神享受、内心福分',
  '父母宫': '父母关系、文书契约',
};

/**
 * AI 解读面板：保留原有数据流（挂载自动请求命格总览、选中宫位自动分析、
 * 6 个主题、追问、SSE 流式、错误作为消息展示），只重做外观。
 */
export default function InsightPanel({
  chart,
  selectedPalace,
  selectedSiHua,
  className,
}: InsightPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string>("overview");
  const messagesRef = useRef<Message[]>([]); // always-current copy for closures
  const loadingRef = useRef(false);
  const autoLoaded = useRef(false);
  const lastPalaceBranch = useRef<number | undefined>(undefined);
  const lastSiHuaKey = useRef<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  // Keep refs in sync
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-generate 命格总览 on mount
  useEffect(() => {
    if (autoLoaded.current) return;
    autoLoaded.current = true;
    sendMessage(TOPIC_PROMPTS.overview, true);
    return () => {
      requestRef.current?.abort();
      autoLoaded.current = false;
      loadingRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Inject palace analysis when palace selected
  useEffect(() => {
    if (!selectedPalace || selectedPalace.branch === lastPalaceBranch.current) return;
    lastPalaceBranch.current = selectedPalace.branch;

    const majorStars = selectedPalace.stars.filter((star) => star.type === "major");
    const starDesc =
      majorStars.length > 0
        ? majorStars.map((star) => `${star.name}${star.siHua ? "化" + star.siHua : ""}`).join("、")
        : "空宫（借对宫）";
    const role = PALACE_ROLES[selectedPalace.name] ?? "";

    const prompt = `请重点分析【${selectedPalace.name}】（主管：${role}），该宫主星为${starDesc}，按以下结构输出：

**【宫位定性】**
${selectedPalace.name}在命盘中的意义，以及这种星曜配置的整体判断。

**【主星解读】**
主星在此宫的三合与四化解读，用自己的话说明具体依据。

**【三方四正联动】**
三方四正宫位对此宫的影响。

**【实际建议】**
基于此宫的具体建议。`;

    sendMessage(prompt, true);
  }, [selectedPalace]); // eslint-disable-line react-hooks/exhaustive-deps

  // 注入四化飞化分析
  useEffect(() => {
    if (!selectedSiHua) return;
    const key = `${selectedSiHua.starName}-${selectedSiHua.siHua}-${selectedSiHua.view}`;
    if (key === lastSiHuaKey.current) return;
    lastSiHuaKey.current = key;

    const palaceOfStar = chart.palaces.find((palace) =>
      palace.stars.some((star) => star.name === selectedSiHua.starName),
    );
    const palaceName = palaceOfStar?.name ?? "未知宫位";
    const viewLabel = selectedSiHua.view === "daxian" ? "大限" : "流年";

    const prompt = `请分析【${viewLabel}${selectedSiHua.starName}化${selectedSiHua.siHua}】的飞化影响，按以下结构输出：

**【化${selectedSiHua.siHua}基本含义】**
化${selectedSiHua.siHua}的核心含义，以及${selectedSiHua.starName}化${selectedSiHua.siHua}的特殊含义。

**【落宫影响】**
${selectedSiHua.starName}化${selectedSiHua.siHua}落在【${palaceName}】，该宫主管的领域受到何种影响，请说明推导。

**【三方四正飞化路径】**
化${selectedSiHua.siHua}入${palaceName}后，对其三方四正（对宫、两个三合宫）的联动影响。

**【当前运势影响】**
在${viewLabel}时间维度下，此化${selectedSiHua.siHua}对命主近期运势的具体影响。

**【实际建议】**
基于此四化的具体可操作建议。`;

    sendMessage(prompt, true);
  }, [selectedSiHua]); // eslint-disable-line react-hooks/exhaustive-deps

  const streamResponse = async (apiMessages: { role: "user" | "assistant"; content: string }[]) => {
    const abort = new AbortController();
    requestRef.current = abort;
    try {
      const res = await fetch("/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chart, messages: apiMessages }),
        signal: abort.signal,
      });
      if (abort.signal.aborted) return;
      if (res.ok) setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      await consumeAiResponse(res, (text) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: text };
          return updated;
        });
      });
    } catch (error) {
      if (abort.signal.aborted) return;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "解读失败，请稍后重试。",
          error: true,
        },
      ]);
    } finally {
      if (requestRef.current === abort && !abort.signal.aborted) {
        requestRef.current = null;
        setLoading(false);
        loadingRef.current = false;
      }
    }
  };

  const sendMessage = (text: string, hidden = false) => {
    if (!text.trim() || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    const userMsg: Message = { role: "user", content: text, hidden };
    // Capture current messages synchronously via ref (avoids stale closure)
    const apiMessages = [...messagesRef.current, userMsg].map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    streamResponse(apiMessages);
  };

  const handleTopicClick = (topicKey: string) => {
    if (loadingRef.current) return;
    setActiveTopic(topicKey);
    sendMessage(TOPIC_PROMPTS[topicKey], true);
  };

  const handleSend = () => {
    sendMessage(input);
  };

  const visibleMessages = messages.filter((message) => !(message.role === "user" && message.hidden));
  const waitingForFirstToken = loading && messages[messages.length - 1]?.role !== "assistant";

  return (
    <Card className={cn("flex min-h-0 flex-col overflow-hidden", className)}>
      <p role="status" aria-live="polite" className="sr-only">
        {loading ? "AI 解读生成中" : "AI 解读已就绪"}
      </p>

      {/* 标题 + 免责提示 */}
      <div className="shrink-0 border-b border-line/12 px-3 pb-2.5 pt-3 sm:px-4">
        <h2 className="font-serif text-[16px] font-semibold tracking-[0.02em] text-ink">
          AI 解读
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-3">
          内容由 AI 生成，仅供参考，不构成医疗、投资或法律建议。
        </p>
      </div>

      {/* 主题 chips */}
      <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-line/12 px-3 py-2 sm:px-4">
        {TOPICS.map((topic) => {
          const isActive = activeTopic === topic.key;
          return (
            <button
              key={topic.key}
              type="button"
              onClick={() => handleTopicClick(topic.key)}
              disabled={loading}
              aria-pressed={isActive}
              className={cn(
                "inline-flex h-9 items-center rounded-sm border px-2.5 text-[12px] transition-colors duration-150 disabled:opacity-45",
                isActive
                  ? "border-cinnabar/35 bg-cinnabar/8 font-medium text-cinnabar"
                  : "border-line/20 text-ink-2 hover:border-line/35 hover:bg-surface-2",
              )}
            >
              {topic.label}
            </button>
          );
        })}
      </div>

      {/* 消息区 */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3 sm:px-4">
        {visibleMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            {loading ? (
              <>
                <Spinner label="解读生成中" />
                <p className="text-[13px] text-ink-3">正在生成命格总览…</p>
              </>
            ) : (
              <p className="text-[13px] text-ink-3">选择上方主题，或点选命盘中的宫位开始解读。</p>
            )}
          </div>
        ) : null}

        {visibleMessages.map((message, index) => {
          const isLastMessage = message === messages[messages.length - 1];
          if (message.role === "user") {
            return (
              <div key={`user-${index}`} className="flex justify-end">
                <p className="max-w-[85%] rounded-sm border border-line/20 bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-ink-2">
                  {message.content}
                </p>
              </div>
            );
          }
          return (
            <div key={`assistant-${index}`} className="animate-fade-in">
              <div className="mb-1.5 flex items-center gap-2 text-[12px] text-ink-3">
                <span aria-hidden="true" className="h-px w-4 bg-line/25" />
                <span>命理解读</span>
              </div>
              {message.error ? (
                <p
                  role="alert"
                  className="rounded-sm border border-cinnabar/25 bg-cinnabar/5 px-3 py-2 text-[13px] leading-relaxed text-cinnabar"
                >
                  {message.content}
                </p>
              ) : (
                <AiProse text={message.content} streaming={loading && isLastMessage} />
              )}
            </div>
          );
        })}

        {waitingForFirstToken && visibleMessages.length > 0 ? (
          <div className="flex items-center gap-2 text-[12px] text-ink-3">
            <Spinner label="解读生成中" />
            <span>正在解读…</span>
          </div>
        ) : null}
      </div>

      {/* 追问输入 */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleSend();
        }}
        className="shrink-0 border-t border-line/12 px-3 py-2.5 sm:px-4"
      >
        <div className="flex items-center gap-2">
          <label htmlFor="insight-input" className="sr-only">
            追问内容
          </label>
          <Input
            id="insight-input"
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="继续追问，如：今年适合换工作吗？"
            disabled={loading}
            autoComplete="off"
          />
          <Button
            type="submit"
            variant="secondary"
            size="md"
            disabled={loading || !input.trim()}
            className="shrink-0"
          >
            {loading ? "生成中" : "追问"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
