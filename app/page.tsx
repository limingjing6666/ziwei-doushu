'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import StarField from '@/components/StarField';
import { useTheme, type Theme } from '@/components/ThemeProvider';

// ─── 滚动入场 wrapper ────────────────────────────────────
function FadeIn({
  children, delay = 0, y = 28, className = '',
}: {
  children: React.ReactNode; delay?: number; y?: number; className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function WeakBoundary({ line }: { line: string }) {
  // 之前的版本有 1px 实线 + 12px 渐变阴影，主题切换时形成清晰横线很硬。
  // 改为更柔和的 24px 渐变 + 低 opacity，section 衔接更自然。
  return (
    <div className="absolute top-0 left-0 right-0 h-16 pointer-events-none"
      style={{ background: `linear-gradient(to bottom, ${line}, transparent)`, opacity: 0.45 }} />
  );
}

// ─── 主题切换按钮 ────────────────────────────────────────
function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return (
    <motion.button
      onClick={toggle}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.93 }}
      aria-label={isDark ? '切换亮色主题' : '切换暗色主题'}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
      style={{
        borderColor: isDark ? 'rgba(212,168,67,0.3)' : 'rgba(140,100,20,0.35)',
        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,252,242,0.85)',
        transition: 'background 0.35s ease, border-color 0.35s ease',
      }}
    >
      <div className="relative w-10 h-5 rounded-full flex-shrink-0"
        style={{
          background: isDark ? 'rgba(12,24,64,0.95)' : 'rgba(230,195,80,0.55)',
          transition: 'background 0.35s ease',
        }}>
        <motion.div
          animate={{ x: isDark ? 2 : 22 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="absolute top-1 w-3.5 h-3.5 rounded-full"
          style={{
            background: isDark
              ? 'linear-gradient(135deg, #b8a050, #e8d090)'
              : 'linear-gradient(135deg, #e89010, #f8d050)',
          }}
        />
      </div>
      <span className="text-[11px] font-medium tracking-wide select-none"
        style={{
          color: isDark ? 'rgba(212,180,100,0.85)' : 'rgba(110,72,8,0.8)',
          transition: 'color 0.35s ease',
        }}>
        {isDark ? '暗色' : '亮色'}
      </span>
    </motion.button>
  );
}

// ─── 主星数据 ────────────────────────────────────────────
const STARS = [
  { name: '紫微' }, { name: '天机' }, { name: '太阳' }, { name: '武曲' },
  { name: '天同' }, { name: '廉贞' }, { name: '天府' }, { name: '太阴' },
  { name: '贪狼' }, { name: '巨门' }, { name: '天相' }, { name: '天梁' },
  { name: '七杀' }, { name: '破军' },
];

// ─── 功能模块 ────────────────────────────────────────────
const FEATURES = [
  {
    tag: '排盘体系',
    title: '传统三合\n紫微斗数',
    subtitle: '以传统三合为基础，结合四化飞星',
    points: [
      '纳音五行局起盘，不采用网络简化算法',
      '命宫逆数生时、身宫顺数生时，严格对齐教学规则',
      '十四主星与四化飞星按原法推演，结构完整可复核',
    ],
  },
  {
    tag: '命盘呈现',
    title: '完整十四主星\n四化飞星',
    subtitle: '结构清晰，一眼看懂主轴与重点',
    points: [
      '十四主星完整入宫，主星关系清楚可读',
      '辅星与煞星同屏呈现，避免关键信息缺失',
      '庙旺利陷亮度分级，快速识别强弱',
      '点击主星查看星性、组合条件与阅读提示',
    ],
  },
  {
    tag: 'AI 解读',
    title: '深度解盘\n不止于算',
    subtitle: '传统星宫知识库 × AI 分析',
    points: [
      '命格分析：从命宫主星出发，结合三方四正，给出全面的性格与人生格局判断',
      '六大维度解读：事业方向、感情婚姻、财运模式、健康注意、家庭关系、子女缘分',
      '大限流年追踪：当前10年大限重点、今年流年宫位的具体提示与行动建议',
      '自由追问：针对你的命盘直接提问，「今年能换工作吗」「什么时候结婚运最好」',
    ],
  },
  {
    tag: '格局识别',
    title: '自动检测\n命盘格局',
    subtitle: '从组合条件理解倾向与限制',
    points: [
      '自动识别11种经典格局：紫府同宫、杀破狼格、机月同梁、廉相格、武曲七杀等',
      '识别辅弼、日月等组合，说明成立条件与参考范围',
      '四化入命宫迁移宫的特殊状况自动标注，提示需关注的人生议题',
      '格局按吉凶等级分层展示，让你一目了然自己命盘中的优势与挑战',
    ],
  },
];

// ─── 传统方法论 ──────────────────────────────────────────
const METHOD_TEACHINGS = [
  { title: '从个人到处境', body: '先读命宫的行为偏好，再把收入、工作与外部机会放在同一张关系图中。单颗星只能提出线索，不能独立决定结论。' },
  { title: '空宫仍有关系', body: '没有主星不表示这个领域空白。可参考对宫的配置，但要区分参照与实际坐星，同时检查本宫辅曜及会照条件。' },
  { title: '星性与四化合读', body: '星曜提供主题，禄权科忌提示资源、责任、认可与牵挂。落点和时间层都要明确，不能看到一个标记就推断整段人生。' },
  { title: '先长周期，再看年份', body: '本命描述底层倾向，大限提供阶段背景，流年只补充年度线索。长短周期不一致时先交代分歧，不把一年的压力放大成终身结论。' },
];

// ─── 主题色彩 helper ─────────────────────────────────────
function useColors(theme: Theme) {
  const d = theme === 'dark';
  return {
    bgBase:       d ? '#020810'                                : '#f5efe0',
    // nav 用与 bgBase 完全相同的不透明色，避免半透明叠加产生色差带
    navBg:        d ? '#020810'                                : '#f5efe0',
    navBorder:    d ? 'rgba(255,255,255,0.05)'                : 'rgba(160,120,30,0.15)',
    goldGrad:     d ? 'linear-gradient(160deg,#c8993a 0%,#f0d070 40%,#c8993a 70%,#f0c755 100%)'
                    : 'linear-gradient(160deg,#6a4206 0%,#9a6a10 40%,#6a4206 70%,#885010 100%)',
    goldSolid:    d ? '#d4a843'                               : '#8b6410',
    goldLine:     d ? 'rgba(212,168,67,0.4)'                  : 'rgba(140,100,20,0.4)',
    tagText:      d ? 'rgba(212,168,67,0.6)'                  : 'rgba(120,80,10,0.65)',
    // 亮色文字用冷灰系（A 方案核心）：暖底 + 冷字 → 视觉不审美疲劳
    textPrimary:  d ? '#e8eef6'                               : '#1a1d24',
    textSecond:   d ? '#b8c6df'                               : '#3a3f4a',
    textMuted:    d ? '#9db0d0'                               : '#5a6275',
    textFaint:    d ? 'rgba(240,246,255,0.56)'                : '#9da4b3',
    // 冷色 accent（B 方案核心）：呼应暗色 quan 蓝；用于装饰性 glow / 链接 / 高亮
    accent:       d ? '#3a78d4'                               : '#3a5a82',
    accentSoft:   d ? 'rgba(58,120,212,0.18)'                 : 'rgba(58,90,130,0.10)',
    cardBg:       d ? 'rgba(255,255,255,0.05)'                : 'rgba(255,255,255,0.88)',
    cardBorder:   d ? 'rgba(255,255,255,0.10)'                : 'rgba(200,160,60,0.25)',
    cardShadow:   d ? '0 4px 32px rgba(0,0,0,0.5)'           : '0 4px 24px rgba(140,100,20,0.12)',
    featureBg:    d ? 'rgba(255,255,255,0.04)'                : 'rgba(255,255,255,0.75)',
    featureBord:  d ? 'rgba(255,255,255,0.08)'                : 'rgba(200,160,60,0.2)',
    glowTint:     d ? 'rgba(212,168,67,0.07)'                 : 'rgba(180,140,40,0.06)',
    // 亮色 glow 真用蓝/紫——给整体氛围加冷色点缀
    glowBlue:     d ? 'rgba(40,80,160,0.12)'                  : 'rgba(58,90,130,0.06)',
    glowPurple:   d ? 'rgba(120,50,180,0.08)'                 : 'rgba(96,80,140,0.04)',
    niBg:         d ? 'rgba(255,255,255,0.04)'                : 'rgba(255,255,255,0.8)',
    niBorder:     d ? 'rgba(212,168,67,0.2)'                  : 'rgba(180,130,40,0.25)',
    niDivider:    d ? 'rgba(255,255,255,0.08)'                : 'rgba(180,130,40,0.12)',
    niCardBg:     d ? 'rgba(255,255,255,0.04)'                : 'rgba(255,255,255,0.9)',
    niCardBord:   d ? 'rgba(255,255,255,0.08)'                : 'rgba(200,160,60,0.2)',
    niCardShadow: d ? '0 2px 20px rgba(0,0,0,0.4)'           : '0 2px 16px rgba(140,100,20,0.1)',
    starBg:       d ? 'rgba(255,255,255,0.04)'                : 'rgba(255,255,255,0.7)',
    starBorder:   d ? 'rgba(212,168,67,0.22)'                 : 'rgba(160,120,30,0.3)',
    starText:     d ? 'rgba(212,168,67,0.7)'                  : 'rgba(120,80,10,0.7)',
    ctaBg:        d ? 'linear-gradient(135deg,#b8892a,#f0d070,#b8892a)'
                    : 'linear-gradient(135deg,#6a4206,#9a6810,#6a4206)',
    ctaText:      d ? '#08080a'                               : '#f8f3e8',
    footerText:   d ? 'rgba(255,255,255,0.08)'                : '#d0b878',
    scrollLine:   d ? 'rgba(212,168,67,0.3)'                  : 'rgba(140,100,20,0.3)',
    scrollText:   d ? 'rgba(255,255,255,0.12)'                : '#c0a870',
    altSection:   d ? 'rgba(255,255,255,0.02)'                : 'rgba(255,255,255,0.4)',
    quoteBg:      d ? 'rgba(212,168,67,0.04)'                 : 'rgba(255,255,255,0.9)',
  };
}

// ─── 四化简介数据 ─────────────────────────────────────────
const SIHUA_BRIEF: Record<string, { attr: string; brief: string }> = {
  '化禄': { attr: '吉化·增益', brief: '福星到宫，主财运与福气增益。所在宫位事物顺遂，能力增强，是命盘中最受欢迎的化星。' },
  '化权': { attr: '吉化·权威', brief: '权力星到宫，主掌控与领导力。所在宫位主强势与决断，喜入官禄宫与命宫，主事业上的实权。' },
  '化科': { attr: '吉化·名誉', brief: '科名星到宫，主声誉与贵人缘。所在宫位主文名与考运，有贵人扶持，宜学术、考试与公开场合。' },
  '化忌': { attr: '凶化·阻碍', brief: '劫数星到宫，主执念与阻碍。所在宫位需特别关注，该宫人生课题将成为重要考验。' },
};

// ─── 主星简介数据 ─────────────────────────────────────────
const STAR_BRIEF: Record<string, { attr: string; brief: string }> = {
  '紫微': { attr: '土·帝王星', brief: '天皇贵星，统御众星。坐命者有孤傲之气，主权威显达，天生具备领导气质，适合独当一面的领导岗位。' },
  '天机': { attr: '木·智慧星', brief: '益寿星，主智谋与变动。聪慧机灵，善于筹谋，心思细腻，宜从事策划、顾问、技术类工作。' },
  '太阳': { attr: '火·官禄主', brief: '官禄主星，主声誉与名望。慷慨大度，重视公众形象，利官场与公职，男命力强，入庙时光明磊落。' },
  '武曲': { attr: '金·财帛主', brief: '财帛主星，主财务与决断。意志坚定，行动果敢，适合财务、金融、军警类职业，孤克之星，利晚婚。' },
  '天同': { attr: '水·福星', brief: '福德主星，主享乐与人缘。性情温和，人缘极好，注重生活品质，感情细腻，晚年运势佳。' },
  '廉贞': { attr: '火·才艺星', brief: '次桃花星，主才艺与情欲。才华出众，感情丰富，适合艺术、政界，多才多艺但需防桃花是非。' },
  '天府': { attr: '土·财库星', brief: '南斗主星，主财库与积蓄。稳重保守，理财能力强，是命盘的稳定力量，适合管理财务与行政。' },
  '太阴': { attr: '水·田宅主', brief: '田宅主星，主财富与阴柔。细腻温柔，感受力强，女命尤佳，利不动产与积蓄，适合文艺或服务业。' },
  '贪狼': { attr: '木水·桃花', brief: '桃花星，主欲望与才艺。多才多艺，欲望旺盛，社交活跃，宜从事艺术、公关、商业，人缘极好。' },
  '巨门': { attr: '水·是非星', brief: '暗星，主口才与是非。口才出众，思辨能力强，适合律师、教育、媒体，注意口舌是非，以辩才立身。' },
  '天相': { attr: '水·印星', brief: '印星，主辅佐与印绶。善于协调，重视礼节，正直守法，适合幕僚、行政、法律类工作，贵人运佳。' },
  '天梁': { attr: '土·荫星', brief: '荫星，主老成与荫蔽。正直稳重，慈悲心强，老天爷会保佑，适合医疗、社会工作、宗教领域。' },
  '七杀': { attr: '金火·将星', brief: '将星，主刚烈与开创。性格刚毅，行动力强，勇于挑战，适合创业、军警、竞争性行业，逢凶化吉。' },
  '破军': { attr: '水·耗星', brief: '耗星，主变动与开拓。勇于突破，不惧改变，一生变动大但有魄力，适合开拓型工作，走别人没走过的路。' },
};

// ─── 功能视觉装饰 ────────────────────────────────────────
function FeatureVisual({ index, colors: c }: { index: number; colors: ReturnType<typeof useColors> }) {
  if (index === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5">
        <div className="grid grid-cols-4 gap-1.5 w-72 mx-auto">
          {Array.from({ length: 16 }).map((_, i) => {
            const isCenter = [5, 6, 9, 10].includes(i);
            const isActive = [0, 3, 12, 15].includes(i);
            return (
              <motion.div key={i}
                initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="h-14 rounded-sm flex items-center justify-center text-xs transition-all duration-300"
                style={{
                  border: `1px solid ${isActive ? c.goldLine : c.cardBorder}`,
                  background: isCenter ? 'transparent' : isActive ? c.starBg : c.featureBg,
                  color: isActive ? c.goldSolid : c.textFaint,
                  opacity: isCenter ? 0 : 1,
                }}>
                {isActive ? '★' : ''}
              </motion.div>
            );
          })}
        </div>
        <p className="text-[10px] tracking-widest transition-colors duration-300"
          style={{ color: c.textFaint }}>传统三合排盘</p>
      </div>
    );
  }

  if (index === 1) {
    const [sel, setSel] = useState<string | null>(null);
    const selInfo = sel ? (STAR_BRIEF[sel] ?? SIHUA_BRIEF[sel] ?? null) : null;
    return (
      <div className="flex flex-col gap-4 h-full justify-center">
        {[
          { group: '紫微系', stars: ['紫微', '天机', '太阳', '武曲', '天同', '廉贞'] },
          { group: '天府系', stars: ['天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'] },
        ].map(group => (
          <div key={group.group}>
            <div className="text-[11px] tracking-widest mb-2 transition-colors duration-300"
              style={{ color: c.textFaint }}>{group.group}</div>
            <div className="flex flex-wrap gap-1.5">
              {group.stars.map(s => (
                <motion.button key={s}
                  onClick={() => setSel(sel === s ? null : s)}
                  whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.1 }}
                  className="text-xs px-2 py-1 rounded-md cursor-pointer"
                  style={{
                    border: `1px solid ${sel === s ? c.goldSolid : c.goldLine}`,
                    color: c.goldSolid,
                    background: sel === s ? `${c.goldLine}30` : 'transparent',
                    fontWeight: sel === s ? 600 : 400,
                  }}>
                  {s}
                </motion.button>
              ))}
            </div>
          </div>
        ))}
        <div>
          <div className="text-[11px] tracking-widest mb-2 transition-colors duration-300"
            style={{ color: c.textFaint }}>四化飞星</div>
          <div className="flex gap-2 flex-wrap">
            {[['化禄', 'rgba(52,211,153,0.7)'], ['化权', 'rgba(96,165,250,0.7)'], ['化科', 'rgba(250,204,21,0.7)'], ['化忌', 'rgba(248,113,113,0.7)']].map(([label, color]) => (
              <motion.button key={label}
                onClick={() => setSel(sel === label ? null : label)}
                whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.1 }}
                className="text-xs px-2.5 py-1 rounded-md cursor-pointer"
                style={{
                  border: `1px solid ${color}`,
                  color,
                  background: sel === label ? `${color.replace('0.7', '0.15')}` : 'transparent',
                  fontWeight: sel === label ? 600 : 400,
                }}>
                {label}
              </motion.button>
            ))}
          </div>
        </div>
        <AnimatePresence mode="wait">
          {selInfo && (
            <motion.div key={sel}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="rounded-xl p-4 mt-1.5"
              style={{ border: `1px solid ${c.goldLine}`, background: c.featureBg }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-semibold" style={{ color: c.goldSolid }}>{sel}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ color: c.tagText, border: `1px solid ${c.goldLine}` }}>{selInfo.attr}</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: c.textSecond }}>{selInfo.brief}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (index === 2) {
    const msgs = [
      { role: 'user', text: '我今年的事业运势如何？' },
      { role: 'ai', text: '命宫天机化禄，今年大限走官禄宫，三方有左辅相助，事业有贵人提携，适合主动拓展…' },
      { role: 'user', text: '什么时候感情运最好？' },
    ];
    return (
      <div className="flex flex-col gap-2 h-full justify-center">
        {msgs.map((m, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, x: m.role === 'user' ? 10 : -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 }}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%] text-[11px] px-3 py-2 rounded-lg leading-relaxed"
              style={{
                border: `1px solid ${m.role === 'user' ? c.goldLine : c.cardBorder}`,
                background: m.role === 'user' ? c.starBg : c.featureBg,
                color: m.role === 'user' ? c.goldSolid : c.textSecond,
              }}>
              {m.text}
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  if (index === 3) {
    const patterns = [
      { name: '杀破狼格', desc: '开创进取之命', ok: true },
      { name: '廉相格',   desc: '行政印绶之格', ok: true },
      { name: '化忌入命', desc: '需关注心理课题', ok: false },
    ];
    return (
      <div className="flex flex-col gap-3 h-full justify-center">
        {patterns.map((p, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.12 }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
            style={{
              border: `1px solid ${p.ok ? 'rgba(96,165,250,0.25)' : 'rgba(251,146,60,0.25)'}`,
              background: p.ok ? 'rgba(96,165,250,0.05)' : 'rgba(251,146,60,0.05)',
            }}>
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: p.ok ? 'rgba(96,165,250,0.6)' : 'rgba(251,146,60,0.6)' }} />
            <div>
              <div className="text-[11px] font-medium"
                style={{ color: p.ok ? 'rgba(147,197,253,0.8)' : 'rgba(253,186,116,0.8)' }}>{p.name}</div>
              <div className="text-[10px]" style={{ color: c.textMuted }}>{p.desc}</div>
            </div>
          </motion.div>
        ))}
        <div className="text-[9px] mt-2 tracking-wider text-center" style={{ color: c.textFaint }}>
          自动识别 11 种经典格局
        </div>
      </div>
    );
  }

  return null;
}

// ─── 主页 ─────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = useColors(theme);

  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '28%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);

  // 把 body / html 背景同步到 home 主题色，消除半透明 nav 透出 #fafaf9 的色差
  // useLayoutEffect 保证在浏览器绘制前同步更新，避免与根 div 的 transition 不同步
  useLayoutEffect(() => {
    document.documentElement.style.background = c.bgBase;
    document.body.style.background = c.bgBase;
    return () => {
      document.documentElement.style.background = '';
      document.body.style.background = '';
    };
  }, [c.bgBase]);

  return (
    <div style={{ background: c.bgBase, transition: 'background 0.35s ease' }} className="overflow-x-hidden">
      <StarField />

      {/* 全局光晕 */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full"
          style={{ background: `radial-gradient(ellipse, ${c.glowTint} 0%, transparent 70%)` }} />
        <div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full"
          style={{ background: `radial-gradient(ellipse, ${c.glowBlue} 0%, transparent 70%)` }} />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full"
          style={{ background: `radial-gradient(ellipse, ${c.glowPurple} 0%, transparent 70%)` }} />
      </div>

      {/* ── 顶部导航 ── nav 与 hero 同色（c.bgBase），无 blur 无 border，彻底无色差带 */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-8 py-3 sm:py-4 gap-2"
        style={{
          background: c.navBg,
        }}>
        <div className="text-[11px] sm:text-xs tracking-[0.3em] sm:tracking-[0.4em] font-medium transition-colors duration-300 flex-shrink-0"
          style={{ color: c.goldSolid }}>
          天机盘
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          <ThemeToggle />
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => router.push('/heming')}
            className="text-[11px] sm:text-xs px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full transition-all duration-300"
            style={{ border: `1px solid ${c.navBorder}`, color: c.textMuted }}>
            合盘
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => router.push('/chart')}
            className="text-[11px] sm:text-xs px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full transition-all duration-300"
            style={{ border: `1px solid ${c.goldLine}`, color: c.goldSolid }}>
            立即起盘
          </motion.button>
        </div>
      </nav>

      {/* ══ HERO ══════════════════════════════════════════ */}
      <section ref={heroRef} className="relative min-h-[82svh] lg:min-h-[92vh] flex flex-col items-center justify-center px-6 z-10 pb-24 pt-10">
        <motion.div style={{ y: heroY, opacity: heroOpacity, maxWidth: '960px' }} className="text-center w-full mx-auto mt-10">
          {/* 标签行 */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex items-center justify-center gap-3 mb-8">
            <div className="h-px w-12" style={{ background: `linear-gradient(to right, transparent, ${c.goldLine})` }} />
            <span className="text-[11px] tracking-[0.45em] transition-colors duration-300" style={{ color: c.tagText }}>
              天机盘 · AI 紫微命盘
            </span>
            <div className="h-px w-12" style={{ background: `linear-gradient(to left, transparent, ${c.goldLine})` }} />
          </motion.div>

          {/* 主标题 */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            style={{ position: 'relative', display: 'inline-block' }}>
            <h1
              className={`grad-text ${theme === 'dark' ? 'grad-text-dark' : 'grad-text-light'} font-bold leading-none mb-5`}
              style={{
                fontSize: 'clamp(56px, 10vw, 124px)',
                letterSpacing: '0.07em',
              }}>
              天机盘
            </h1>
          </motion.div>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="text-base md:text-lg tracking-[0.18em] mb-2"
            style={{ color: c.textSecond, fontWeight: 500 }}>
            三合四化 · 古法排盘 · AI 解读
          </motion.p>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.55 }}
            className="text-xs md:text-sm tracking-[0.3em] mb-6"
            style={{ color: c.textMuted, opacity: 0.85 }}>
            AI 答疑 · 知行合一
          </motion.p>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.65 }}
            className="text-sm max-w-xl mx-auto leading-relaxed mb-10"
            style={{ color: c.textMuted }}>
            填写出生信息，查看星宫结构与阶段主题，让每一条解读都有可核对的依据。
          </motion.p>

          {/* CTA */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.85 }}
            className="flex flex-col items-center gap-4">
            <motion.button
              whileHover={{ y: -2, filter: 'brightness(1.06)' }} whileTap={{ scale: 0.97 }}
              onClick={() => router.push('/chart')}
              className="px-12 py-4 font-semibold text-base tracking-widest rounded-full"
              style={{ background: c.ctaBg, color: c.ctaText }}>
              立即起盘
            </motion.button>
          </motion.div>

          {/* 十四主星 */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 1.05, duration: 0.8 }}
            className="mt-12 grid grid-cols-7 gap-1.5 max-w-[540px] mx-auto">
            {STARS.map((star, i) => (
              <motion.div key={star.name}
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.05 + i * 0.03, duration: 0.35 }}
                className="flex items-center justify-center px-2 py-1 rounded-full"
                style={{ background: c.starBg, border: `1px solid ${c.starBorder}` }}>
                <span className="text-[11px] tracking-wide" style={{ color: c.starText }}>{star.name}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* 滚动提示（绝对定位，不影响 hero opacity 计算） */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-2 pointer-events-none">
          <span className="text-[9px] tracking-[0.4em] uppercase" style={{ color: c.scrollText }}>探索更多</span>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            className="w-px h-8" style={{ background: `linear-gradient(to bottom, ${c.scrollLine}, transparent)` }} />
        </motion.div>
      </section>

      {/* ══ 哲学引言 ══════════════════════════════════════ */}
      <section className="relative z-10 overflow-hidden min-h-[82svh] lg:min-h-[92vh] flex items-center" style={{ padding: '72px 24px' }}>
        <WeakBoundary line={c.navBorder} />
        <div className="absolute inset-0"
          style={{
            background: theme === 'dark'
              ? 'linear-gradient(to bottom, #020810 0%, #020810 6%, #030a18 22%, #0d0820 40%, #0a0618 68%, #030a18 86%, #020810 100%)'
              : 'linear-gradient(to bottom, #f5efe0 0%, #f5efe0 6%, #c08055 18%, #6a2810 32%, #1e0a02 50%, #1e0a02 70%, #6a2810 84%, #f5efe0 100%)',
            transition: 'background 0.4s ease',
          }} />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <span className="font-bold" style={{ fontSize: 'clamp(220px, 38vw, 460px)', color: 'rgba(212,168,67,0.012)', lineHeight: 1, fontFamily: 'serif' }}>命</span>
        </div>
        <FadeIn className="relative mx-auto text-center w-full" y={20}>
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="h-px w-16" style={{ background: 'linear-gradient(to right, transparent, rgba(212,168,67,0.45))' }} />
            <span className="text-[10px] tracking-[0.55em] uppercase" style={{ color: 'rgba(212,168,67,0.5)' }}>命 · 运 · 观</span>
            <div className="h-px w-16" style={{ background: 'linear-gradient(to left, transparent, rgba(212,168,67,0.45))' }} />
          </div>
          <div className="space-y-3" style={{ maxWidth: '840px', margin: '0 auto' }}>
            {[
              { text: '提前窥探命运的意义', size: 'clamp(17px, 2.2vw, 28px)', color: 'rgba(215,228,252,0.72)', delay: 0.1 },
              { text: '不在于预知未来', size: 'clamp(21px, 2.6vw, 32px)', color: 'rgba(220,232,250,0.74)', delay: 0.25 },
              { text: '而在于不断认识自己', size: 'clamp(24px, 3vw, 40px)', color: 'rgba(218,230,248,0.8)', delay: 0.34 },
            ].map((line, i) => (
              <motion.p key={i}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: line.delay }}
                className="tracking-wider" style={{ fontSize: line.size, color: line.color, fontWeight: 400 }}>
                {line.text}
              </motion.p>
            ))}
            <motion.p
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.45 }}
              className={`grad-text ${theme === 'dark' ? 'grad-text-dark' : 'grad-text-light'} font-bold`}
              style={{ fontSize: 'clamp(24px, 3.4vw, 48px)', letterSpacing: '0.05em', lineHeight: 1.35 }}>
              最终书写属于自己的人生剧本
            </motion.p>
          </div>
        </FadeIn>
      </section>

      {/* ══ 功能详解 ══════════════════════════════════════ */}
      <section className="relative z-10">
        {FEATURES.map((feature, i) => (
          <div key={i}
            className={`flex items-center px-6 md:px-10 lg:px-14 py-20 md:py-24 ${i <= 2 ? 'min-h-[82svh] lg:min-h-[92vh]' : ''}`}
            style={{ background: i % 2 === 1 ? c.altSection : 'transparent' }}>
            <div className="mx-auto w-full" style={{ maxWidth: '1280px' }}>
              <div className={`grid grid-cols-1 ${i % 2 === 0 ? 'lg:grid-cols-[0.45fr_0.55fr]' : 'lg:grid-cols-[0.55fr_0.45fr]'} gap-10 lg:gap-16 items-start ${i % 2 === 1 ? 'lg:grid-flow-dense' : ''}`}>
                {/* 文字区 */}
                <div className={i % 2 === 1 ? 'lg:col-start-2' : ''}>
                  <FadeIn delay={0}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="h-px w-8" style={{ background: c.goldLine }} />
                      <span className="text-[10px] tracking-[0.5em] uppercase" style={{ color: c.tagText }}>{feature.tag}</span>
                    </div>
                  </FadeIn>
                  <FadeIn delay={0.1}>
                    <h2 className={`grad-text ${theme === 'dark' ? 'grad-text-dark' : 'grad-text-light'} font-bold leading-tight mb-5 tracking-tight`}
                      style={{
                        fontSize: i < 2 ? 'clamp(36px, 4vw, 56px)' : 'clamp(30px, 3.5vw, 48px)',
                        whiteSpace: 'pre-line',
                      }}>
                      {feature.title}
                    </h2>
                  </FadeIn>
                  <FadeIn delay={0.2}>
                    <p className="text-base mb-8 leading-relaxed" style={{ color: c.textSecond }}>{feature.subtitle}</p>
                  </FadeIn>
                  <div className="space-y-4">
                    {feature.points.map((point, j) => (
                      <FadeIn key={j} delay={0.25 + j * 0.08}>
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 mt-2 w-1 h-1 rounded-full" style={{ background: c.goldSolid, opacity: 0.6 }} />
                          <p className="text-sm leading-relaxed" style={{ color: c.textMuted }}>{point}</p>
                        </div>
                      </FadeIn>
                    ))}
                  </div>
                </div>
                {/* 视觉装饰区 */}
                <div className={i % 2 === 1 ? 'lg:col-start-1 lg:row-start-1' : ''}>
                  <FadeIn delay={0.15}>
                    <div className="relative rounded-2xl overflow-hidden p-8 md:p-12"
                      style={{
                        border: `1px solid ${c.featureBord}`,
                        background: c.featureBg,
                        minHeight: i <= 1 ? '540px' : i === 2 ? '460px' : '320px',
                        boxShadow: c.cardShadow,
                      }}>
                      <FeatureVisual index={i} colors={c} />
                    </div>
                  </FadeIn>
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* ══ 天·地·人 三分理论 ════════════════════════════ */}
      <section className="relative z-10 flex items-center px-6 md:px-10 lg:px-14 py-20"
        style={{ background: c.altSection, minHeight: '82svh' }}>
        <WeakBoundary line={c.navBorder} />
        <div className="mx-auto w-full" style={{ maxWidth: '1280px' }}>
          <FadeIn>
            <div className="text-center mb-10">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="h-px w-12" style={{ background: `linear-gradient(to right, transparent, ${c.goldLine})` }} />
                <span className="text-[10px] tracking-[0.5em] uppercase" style={{ color: c.tagText }}>Perspective · Choice</span>
                <div className="h-px w-12" style={{ background: `linear-gradient(to left, transparent, ${c.goldLine})` }} />
              </div>
              <h2 className={`grad-text ${theme === 'dark' ? 'grad-text-dark' : 'grad-text-light'} font-bold mb-5 tracking-tight`}
                style={{ fontSize: 'clamp(32px, 4vw, 48px)' }}>
                天 · 地 · 人
              </h2>
              <p className="max-w-2xl mx-auto text-sm leading-relaxed" style={{ color: c.textSecond }}>
                命盘提供观察角度，但不能替你做决定。<br />
                阅读时兼顾个人起点、现实环境与选择，不为三者分配固定权重。
              </p>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {[
              { glyph: '天', label: '先天命运', pct: '参考', color: c.goldSolid, borderColor: c.goldLine, desc: '起盘把出生信息转换为传统星宫符号。这些符号适合讨论偏好，不是个人价值的评分，不能替代真实经历。', sub: '命盘 · 星曜 · 五行' },
              { glyph: '地', label: '地理环境', pct: '参考', color: 'rgba(96,165,250,0.9)', borderColor: 'rgba(96,165,250,0.3)', desc: '家庭资源、社会条件与工作环境都会影响机会。阅读命盘时，应补充现实背景，避免把环境差异归结为个人命数。', sub: '地域 · 风水 · 环境' },
              { glyph: '人', label: '人心意念', pct: '参考', color: 'rgba(100,216,139,0.9)', borderColor: 'rgba(100,216,139,0.3)', desc: '把解读变成一个可尝试的小行动：约一次沟通、学习一项技能或调整资源安排。结果要回到生活中检验，不必服从星曜标签。', sub: '意志 · 选择 · 行动' },
            ].map((item, i) => (
              <FadeIn key={item.glyph} delay={0.1 + i * 0.12}>
                <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.1 }}
                  className="rounded-2xl p-7 h-full flex flex-col"
                  style={{ background: c.cardBg, border: `1px solid ${item.borderColor}`, boxShadow: c.cardShadow }}>
                  <div className="flex items-start justify-between mb-5">
                    <div className="text-5xl font-bold leading-none" style={{ color: item.color }}>{item.glyph}</div>
                    <div className="text-right">
                      <div className="text-2xl font-bold" style={{ color: item.color }}>{item.pct}</div>
                      <div className="text-[9px] mt-0.5 tracking-widest" style={{ color: c.textMuted }}>perspective</div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="text-sm font-medium mb-0.5" style={{ color: item.color }}>{item.label}</div>
                    <div className="text-[10px] tracking-wider" style={{ color: c.textMuted }}>{item.sub}</div>
                  </div>
                  <div className="h-px mb-4" style={{ background: item.borderColor }} />
                  <p className="text-xs leading-relaxed flex-1" style={{ color: c.textSecond }}>{item.desc}</p>
                </motion.div>
              </FadeIn>
            ))}
          </div>
          <FadeIn delay={0.3}>
            <div className="mt-10 text-center">
              <p className="text-sm leading-relaxed" style={{ color: c.textSecond }}>
                把注意力放回今天能调整的一件事，比等待一个预言更有帮助。
              </p>
              <p className="mt-2 text-[10px] tracking-widest" style={{ color: c.tagText }}>— 天机盘 · 阅读提示</p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══ 方法论介绍 ════════════════════════════════════ */}
      <section className="relative z-10 flex items-center px-6 md:px-10 lg:px-14 py-20" style={{ minHeight: '82svh' }}>
        <WeakBoundary line={c.navBorder} />
        <div className="mx-auto w-full" style={{ maxWidth: '1280px' }}>
          <FadeIn>
            <div className="text-center mb-10">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="h-px w-12" style={{ background: `linear-gradient(to right, transparent, ${c.goldLine})` }} />
                <span className="text-[10px] tracking-[0.5em] uppercase" style={{ color: c.tagText }}>Method · Evidence</span>
                <div className="h-px w-12" style={{ background: `linear-gradient(to left, transparent, ${c.goldLine})` }} />
              </div>
              <h2 className={`grad-text ${theme === 'dark' ? 'grad-text-dark' : 'grad-text-light'} font-bold mb-6 tracking-tight`}
                style={{ fontSize: 'clamp(32px, 4vw, 48px)' }}>
                传统紫微斗数方法论
              </h2>
              <p className="max-w-2xl mx-auto leading-relaxed text-sm" style={{ color: c.textSecond }}>
                先提出可核对的判断，再说明支持与限制<br />
                以三合结构为基础，把四化与运限作为分层线索
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="rounded-2xl p-8 md:p-10 mb-8"
              style={{ border: `1px solid ${c.niBorder}`, background: c.niBg, boxShadow: c.cardShadow }}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {[
                  { label: '结构', value: '三合', sub: '命财官迁联读' },
                  { label: '变化', value: '四化', sub: '资源与压力落点' },
                  { label: '节奏', value: '运限', sub: '阶段优先 · 年度补充' },
                ].map(item => (
                  <div key={item.label} className="text-center rounded-xl px-4 py-3"
                    style={{ border: `1px solid ${c.niDivider}`, background: 'rgba(255,255,255,0.02)' }}>
                    <div className="text-[10px] tracking-[0.3em] mb-1" style={{ color: c.textFaint }}>{item.label}</div>
                    <div className="text-2xl font-semibold mb-0.5" style={{ color: c.goldSolid }}>{item.value}</div>
                    <div className="text-[11px]" style={{ color: c.textMuted }}>{item.sub}</div>
                  </div>
                ))}
              </div>
              <div className="h-px mb-8" style={{ background: c.niDivider }} />
              <div className="space-y-4 text-sm leading-relaxed max-w-3xl mx-auto" style={{ color: c.textSecond }}>
                <p>
                  <strong style={{ color: c.goldSolid }}>阅读起点</strong>：
                  先整理主星、亮度与辅助配置，再确定问题涉及的宫位。双星组合先看组合，不把单星结论机械相加。
                </p>
                <p>
                  <strong style={{ color: c.goldSolid }}>关联结构</strong>：
                  对照目标宫与三合、对宫，分清支持和压力来自哪里。空宫借星属于参照，不是把星移到本宫。
                </p>
                <p>
                  <strong style={{ color: c.goldSolid }}>时间层次</strong>：
                  大限优先提供阶段背景，再讨论年度差异。缺少所选年份或运限信息，就保留空白。
                </p>
                <p>
                  <strong style={{ color: c.goldSolid }}>依据核对</strong>：
                  在多个主题中复现的方法才提高内部置信；单处经验必须标明限制。内部置信不代表现实预测概率。
                </p>
                <p>
                  <strong style={{ color: c.goldSolid }}>表达方式</strong>：
                  先说最值得关注的一点，再展示命盘推导，最后列出可执行的选择。不用术语堆砌制造神秘感。
                </p>
                <p style={{ fontSize: '11px', color: c.textMuted, fontStyle: 'italic', marginTop: '12px' }}>
                  本站独立整理传统规则，不代表任何讲授者授权或背书。传统术数不等于科学测量，不能代替专业意见。
                </p>
              </div>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {METHOD_TEACHINGS.map((teaching, i) => (
              <FadeIn key={i} delay={0.1 + i * 0.08}>
                <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.1 }}
                  className="rounded-xl p-6 h-full"
                  style={{ border: `1px solid ${c.niCardBord}`, background: c.niCardBg, boxShadow: c.niCardShadow }}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center mt-0.5"
                      style={{ borderColor: c.goldLine }}>
                      <span className="text-[9px]" style={{ color: c.goldSolid }}>{i + 1}</span>
                    </div>
                    <h3 className="text-sm font-medium leading-relaxed" style={{ color: c.goldSolid }}>{teaching.title}</h3>
                  </div>
                  <p className="text-xs leading-relaxed pl-8" style={{ color: c.textSecond }}>{teaching.body}</p>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 合盘入口 ══════════════════════════════════════ */}
      <section className="relative z-10 px-6 md:px-10 lg:px-14 py-20">
        <div className="mx-auto" style={{ maxWidth: '1280px' }}>
          <div className="rounded-2xl p-10 md:p-14 text-center"
            style={{
              background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.8)',
              border: `1px solid ${c.cardBorder}`,
              boxShadow: c.cardShadow,
            }}>
            <FadeIn>
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="h-px w-8" style={{ background: c.goldLine }} />
                <span className="text-[10px] tracking-[0.5em] uppercase" style={{ color: c.tagText }}>Compatibility · Analysis</span>
                <div className="h-px w-8" style={{ background: c.goldLine }} />
              </div>
              <h2 className={`grad-text ${theme === 'dark' ? 'grad-text-dark' : 'grad-text-light'} font-bold mb-4 tracking-tight`}
                style={{ fontSize: 'clamp(26px, 3.5vw, 40px)' }}>
                紫微合盘
              </h2>
              <p className="text-sm leading-relaxed mb-8 max-w-lg mx-auto" style={{ color: c.textSecond }}>
                输入两个人的出生信息，AI 对照双方的关系期待、行动偏好和三合结构，<br className="hidden md:block" />
                给出感情匹配度、合伙可行性与最佳相处建议。
              </p>
              <div className="flex justify-center gap-3 flex-wrap mb-6">
                {['感情匹配度分析', '合伙创业评估', '亲子缘分解读', '婚前相性评估'].map(item => (
                  <span key={item} style={{
                    fontSize: '12px', padding: '5px 14px', borderRadius: '20px',
                    background: theme === 'dark' ? 'rgba(212,168,67,0.08)' : 'rgba(212,168,67,0.12)',
                    border: `1px solid ${c.goldLine}`,
                    color: c.goldSolid,
                  }}>
                    {item}
                  </span>
                ))}
              </div>
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => router.push('/heming')}
                className="px-10 py-3 font-medium text-sm tracking-widest rounded-full"
                style={{
                  background: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(140,100,20,0.1)',
                  border: `1px solid ${c.goldLine}`,
                  color: c.goldSolid,
                  cursor: 'pointer',
                }}>
                开始合盘分析
              </motion.button>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ══ 最终 CTA ══════════════════════════════════════ */}
      <section className="relative z-10 py-40 px-6 text-center" style={{ background: c.altSection }}>
        <FadeIn>
          <p className="text-[10px] tracking-[0.6em] uppercase mb-6" style={{ color: c.tagText }}>开始你的命盘之旅</p>
          <h2 className={`grad-text ${theme === 'dark' ? 'grad-text-dark' : 'grad-text-light'} font-bold mb-8 tracking-tight leading-tight`}
            style={{ fontSize: 'clamp(32px, 5vw, 60px)' }}>
            你的紫微命盘<br />等你解读
          </h2>
          <p className="text-sm mb-10 max-w-md mx-auto leading-relaxed" style={{ color: c.textSecond }}>
            输入出生年月日时，在几秒内生成你的专属命盘<br />
            再由 AI 分层说明星宫依据与行动建议
          </p>
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => router.push('/chart')}
            className="px-14 py-4 font-semibold text-base tracking-widest rounded-full"
            style={{ background: c.ctaBg, color: c.ctaText }}>
            立即起盘
          </motion.button>
          <div className="mt-4 flex flex-wrap gap-3 justify-center">
            <motion.a
              href="/knowledge"
              whileHover={{ scale: 1.02 }}
              className="text-xs tracking-[0.2em] inline-flex items-center gap-2 px-4 py-2 rounded-full"
              style={{
                color: c.goldSolid,
                border: `1px solid ${c.goldLine}`,
                background: 'transparent',
                textDecoration: 'none',
              }}>
              ✦ 紫微斗数知识库 →
            </motion.a>
            <motion.a
              href="/library"
              whileHover={{ scale: 1.02 }}
              className="text-xs tracking-[0.2em] inline-flex items-center gap-2 px-4 py-2 rounded-full"
              style={{
                color: c.goldSolid,
                border: `1px solid ${c.goldLine}`,
                background: 'transparent',
                textDecoration: 'none',
              }}>
              📜 古籍对读库 →
            </motion.a>
          </div>
        </FadeIn>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-10 px-6"
        style={{ borderTop: `1px solid ${c.niCardBord}` }}>

        <div className="text-center">
          <p className="text-[10px] tracking-wider mb-3" style={{ color: c.footerText }}>
            天机盘 · AI 紫微命盘 · 三合四化 · 古法排盘 · AI 解读
          </p>
          <p className="text-[10px] tracking-wider mb-3 max-w-2xl mx-auto leading-relaxed"
            style={{ color: c.footerText, opacity: 0.85 }}>
            本平台基于中国传统文化研究，仅提供学习参考。<br className="sm:hidden" />
            不构成任何医疗、投资、法律或重大决策建议。
          </p>
          <p className="text-[10px] mb-3 leading-relaxed" style={{ color: c.footerText }}>
            本站部分断语来自 <a href="https://github.com/Renhuai123/ziwei-doushu" style={{ textDecoration: 'underline' }}>紫微斗数开源解读数据集 v4.0</a>（CC BY 4.0），作者：王多鱼AI。已提取、去重并过滤引文。
          </p>
          <p className="text-[10px] tracking-wider" style={{ color: c.footerText }}>
            <a href="/terms" style={{ color: c.footerText, textDecoration: 'underline' }}>服务条款</a>
            {' · '}
            <a href="/privacy" style={{ color: c.footerText, textDecoration: 'underline' }}>隐私政策</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
