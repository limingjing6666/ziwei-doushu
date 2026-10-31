'use client';
import { motion, AnimatePresence } from 'framer-motion';
import type { Star } from '@/lib/ziwei/types';
import { STAR_DESCRIPTIONS } from '@/lib/ziwei/constants';

interface StarDetailPanelProps {
  star: Star | null;
  palaceName?: string;
  onClose: () => void;
}

// 独立编写的星性阅读提示；不是任何现代注本的引文。
const STAR_DETAIL: Record<string, {
  readingGuide: string;
  classical: string;
  bestPalace: string;
  worstPalace: string;
  career: string;
  relationship: string;
  wealth: string;
  health: string;
}> = {
  '紫微': {
    readingGuide: '紫微的统筹意象需要协作条件才能落地。先查辅弼以及三合的工作与资源线索，再讨论领导倾向，不能把头衔或地位当作必然结果。',
    classical: '可对照《紫微斗数全书》星曜论与《骨髓赋》阅读；这里的现代提示不作为古文引语。',
    bestPalace: '命宫（辰戌）、官禄宫',
    worstPalace: '疾厄宫、夫妻宫',
    career: '政界、管理层、独立创业，天生帝王气质，适合独当一面的领导岗位',
    relationship: '感情被动，自尊心强，需对方主动，有孤独倾向，晚婚则吉',
    wealth: '财运稳定，守成强于进取，辰戌位财官双美，最宜积累型投资',
    health: '星曜不能用于诊断。生活中重视休息与活动，如有不适请咨询正规医疗机构。',
  },
  '天机': {
    readingGuide: '天机偏向构思与调整。阅读时留意想法是否能落实到行动，并对照同宫搭配；有化忌时讨论决策负担，不把思虑多说成注定失败。',
    classical: '可对照《紫微斗数全书》星曜论与《骨髓赋》阅读；这里的现代提示不作为古文引语。',
    bestPalace: '命宫（卯位）、官禄宫',
    worstPalace: '夫妻宫',
    career: '技术专家、谋士、研究员、IT、策划，动脑胜于动手，适合离乡发展',
    relationship: '感情多变，想法太多，难以专一，宜晚婚，婚后需学会放下思虑',
    wealth: '靠智慧与技能赚钱，不擅守财，以专业技术为业则财运稳定',
    health: '星曜不能用于诊断。生活中重视休息与活动，如有不适请咨询正规医疗机构。',
  },
  '太阳': {
    readingGuide: '太阳常用于讨论公开表达与承担责任。庙陷描述的是传统强弱差别，须对照工作环境，不宜按性别评判一个人是否强势。',
    classical: '可对照《紫微斗数全书》星曜论与《骨髓赋》阅读；这里的现代提示不作为古文引语。',
    bestPalace: '命宫（卯至午）、官禄宫',
    worstPalace: '夫妻宫（女命）、疾厄宫',
    career: '公职、政界、管理、公关、教育、传媒，喜欢站在众人面前，适合公众事业',
    relationship: '男命缘佳但花心，女命独立强势，婚姻需磨合，宜找温柔体贴的伴侣',
    wealth: '财运靠努力，慷慨好施，不擅积累；入庙财运旺，落陷财运起伏',
    health: '星曜不能用于诊断。生活中重视休息与活动，如有不适请咨询正规医疗机构。',
  },
  '武曲': {
    readingGuide: '武曲的务实象义可对应预算和执行。对照财帛与官禄的支持，再讨论资源管理方式；关系里则关注任务分工是否挤占情感交流。',
    classical: '可对照《紫微斗数全书》星曜论与《骨髓赋》阅读；这里的现代提示不作为古文引语。',
    bestPalace: '命宫（辰戌丑未）、财帛宫、官禄宫',
    worstPalace: '夫妻宫',
    career: '金融、军警、会计、工程，执行力极强，适合需要魄力与决断力的领域',
    relationship: '感情直来直往，缺乏情趣，需要温柔伴侣互补，忌感情孤克',
    wealth: '财星本命，财运极强，理财能力超群，辰戌位财官双美',
    health: '星曜不能用于诊断。生活中重视休息与活动，如有不适请咨询正规医疗机构。',
  },
  '天同': {
    readingGuide: '天同提示舒适与照顾的需求。遇到资源支持时可讨论生活稳定，遇压力时关注行动节奏，不能简单给人贴上懒惰标签。',
    classical: '可对照《紫微斗数全书》星曜论与《骨髓赋》阅读；这里的现代提示不作为古文引语。',
    bestPalace: '命宫、福德宫',
    worstPalace: '官禄宫',
    career: '服务业、娱乐、餐饮、文艺，轻松愉快的环境最适合，忌高压竞争',
    relationship: '感情温和，不主动，容易被动接受，婚姻较稳定，性格随和可亲',
    wealth: '财运不突出，靠稳定薪资，不擅投机，衣食无忧但难大富',
    health: '星曜不能用于诊断。生活中重视休息与活动，如有不适请咨询正规医疗机构。',
  },
  '廉贞': {
    readingGuide: '廉贞的规则意识与情感投入需要同时考虑。遇到不同搭配时先检查边界与协作成本，不从一颗星跳到诉讼或伤害结论。',
    classical: '可对照《紫微斗数全书》星曜论与《骨髓赋》阅读；这里的现代提示不作为古文引语。',
    bestPalace: '官禄宫（配天相）、命宫（化禄时）',
    worstPalace: '命宫（化忌时）、夫妻宫',
    career: '艺术、娱乐、法律、公职（配天相），才艺出众，宜守正业方能长久',
    relationship: '桃花多，感情复杂，容易遭遇感情纠纷，宜晚婚，选择稳重伴侣',
    wealth: '财运起伏，靠才艺谋财，化忌时防财务纠纷与法律风险',
    health: '星曜不能用于诊断。生活中重视休息与活动，如有不适请咨询正规医疗机构。',
  },
  '天府': {
    readingGuide: '天府的储备意象适合讨论资源安排。能否积累仍要看收入条件与实际预算，星宫配置本身不是财富承诺。',
    classical: '可对照《紫微斗数全书》星曜论与《骨髓赋》阅读；这里的现代提示不作为古文引语。',
    bestPalace: '命宫、财帛宫、田宅宫',
    worstPalace: '迁移宫',
    career: '行政管理、财务、保险、房地产，求稳不冒险，适合守成型职业',
    relationship: '感情稳定，顾家，是好的伴侣，注重家庭安全感与经济保障',
    wealth: '财运极佳，守财能力强，最适合积累型投资与不动产置业',
    health: '星曜不能用于诊断。生活中重视休息与活动，如有不适请咨询正规医疗机构。',
  },
  '太阴': {
    readingGuide: '太阴可用于观察细节感受与安全需求。亮度、同宫组合及四化都可能改变侧重点，不据此推断亲属遭遇或身体状况。',
    classical: '可对照《紫微斗数全书》星曜论与《骨髓赋》阅读；这里的现代提示不作为古文引语。',
    bestPalace: '命宫（亥子）、财帛宫',
    worstPalace: '命宫（午位陷地）',
    career: '财务、金融、房地产、艺术、教育，细腻耐心，适合需要美感与温柔的职业',
    relationship: '感情温柔细腻，重视内心感受，需要有安全感的稳定关系',
    wealth: '入庙财运极旺，落陷则需努力；理财细心，善于积累，不擅冒险',
    health: '星曜不能用于诊断。生活中重视休息与活动，如有不适请咨询正规医疗机构。',
  },
  '贪狼': {
    readingGuide: '贪狼的广泛兴趣可能表现在社交、才艺或项目开拓。先核对实际场景，再谈资源分配，不把人际活跃直接解释为感情失信。',
    classical: '可对照《紫微斗数全书》星曜论与《骨髓赋》阅读；这里的现代提示不作为古文引语。',
    bestPalace: '命宫（化禄）、福德宫、迁移宫',
    worstPalace: '疾厄宫',
    career: '艺术、娱乐、公关、销售、风水五术，靠人脉与才艺，多才多艺型',
    relationship: '桃花极旺，感情多元化，宜晚婚，婚后需克制桃花方能白首偕老',
    wealth: '靠人脉和才艺赚钱，财运中晚年才稳，化禄后财源广进，早年宜稳守',
    health: '星曜不能用于诊断。生活中重视休息与活动，如有不适请咨询正规医疗机构。',
  },
  '巨门': {
    readingGuide: '巨门提示表达、辨析与疑问。是否成为助力要看交流情境与其他支持；紧张时可检查信息是否完整，不宜直接推断官非。',
    classical: '可对照《紫微斗数全书》星曜论与《骨髓赋》阅读；这里的现代提示不作为古文引语。',
    bestPalace: '官禄宫（化禄权）、命宫（子午）',
    worstPalace: '夫妻宫、疾厄宫（化忌）',
    career: '律师、教师、销售、主持人、谈判专家，口才是核心竞争力',
    relationship: '多疑多虑，容易想太多，沟通是婚姻关键，需选有耐心的伴侣',
    wealth: '靠口才和专业技能赚钱，化禄后财运较佳，化忌防财务纠纷口舌连累',
    health: '星曜不能用于诊断。生活中重视休息与活动，如有不适请咨询正规医疗机构。',
  },
  '天相': {
    readingGuide: '天相的协调与秩序意象需放进团队关系中理解。先确认职责和权责安排，再讨论配合方式，不把支持角色理解为没有主见。',
    classical: '可对照《紫微斗数全书》星曜论与《骨髓赋》阅读；这里的现代提示不作为古文引语。',
    bestPalace: '官禄宫、命宫（配廉贞）',
    worstPalace: '财帛宫、命宫（需核对夹宫结构）',
    career: '公职、行政管理、秘书、助理，擅长辅助支持型角色，需要强星引路',
    relationship: '感情稳定，忠厚老实，是好的伴侣，但需要对方主导方向',
    wealth: '财运平稳，靠薪资积累，不适合冒险投资，守成型理财最宜',
    health: '星曜不能用于诊断。生活中重视休息与活动，如有不适请咨询正规医疗机构。',
  },
  '天梁': {
    readingGuide: '天梁可对应照顾、经验与原则。讨论时区分提供帮助和替别人决定，不能凭这颗星预测长辈或健康问题。',
    classical: '可对照《紫微斗数全书》星曜论与《骨髓赋》阅读；这里的现代提示不作为古文引语。',
    bestPalace: '命宫、父母宫、福德宫',
    worstPalace: '需联参财帛条件',
    career: '医疗、宗教、法律、社工、慈善，喜帮助别人，有荫庇众人之心',
    relationship: '感情多与年龄差距较大者，或缘分晚来，需等待耐心方得良缘',
    wealth: '财运靠贵人相助，早年财运不佳，晚年财运才稳固，宜守不宜冲',
    health: '星曜不能用于诊断。生活中重视休息与活动，如有不适请咨询正规医疗机构。',
  },
  '七杀': {
    readingGuide: '七杀的行动意象适合讨论独立承担与快速决策。应同时检查支持资源和退出方案，不能把果决等同孤立或危险。',
    classical: '可对照《紫微斗数全书》星曜论与《骨髓赋》阅读；这里的现代提示不作为古文引语。',
    bestPalace: '命宫（有辅星）、官禄宫',
    worstPalace: '夫妻宫、父母宫',
    career: '军警、创业、金融交易、独当一面的领域，需要快速决断与魄力',
    relationship: '感情孤克，难找合适伴侣，需要能包容强势个性的对象，宜晚婚',
    wealth: '财运波动大，有机会大富，也有大起大落；武曲同宫可成将财格大贵',
    health: '星曜不能用于诊断。生活中重视休息与活动，如有不适请咨询正规医疗机构。',
  },
  '破军': {
    readingGuide: '破军可以作为调整旧安排的观察线索。先问改变需要付出什么成本，再看资源是否跟得上，不将变化解释为关系必然破裂。',
    classical: '可对照《紫微斗数全书》星曜论与《骨髓赋》阅读；这里的现代提示不作为古文引语。',
    bestPalace: '官禄宫（化禄）、迁移宫',
    worstPalace: '夫妻宫、父母宫',
    career: '开创型事业、军警、改革、变革管理，适合不断开拓新领域的先驱型工作',
    relationship: '感情多波折，离合不定，六亲缘薄，需选择独立且包容力强的伴侣',
    wealth: '财运起伏大，化禄后财运转好；守成则财退，需不断开创新局才能积财',
    health: '星曜不能用于诊断。生活中重视休息与活动，如有不适请咨询正规医疗机构。',
  },
};

const levelConfig = {
  major: { label: '主星', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  lucky: { label: '吉星', color: 'text-sky-400 border-sky-500/30 bg-sky-500/10' },
  sha:   { label: '煞星', color: 'text-red-400 border-red-500/30 bg-red-500/10' },
  minor: { label: '杂星', color: 'text-slate-400 border-slate-500/25 bg-slate-500/10' },
};

const siHuaColors: Record<string, string> = {
  '禄': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  '权': 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  '科': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  '忌': 'text-red-400 bg-red-500/10 border-red-500/30',
};

export default function StarDetailPanel({ star, palaceName, onClose }: StarDetailPanelProps) {
  const desc = star ? STAR_DESCRIPTIONS[star.name] : null;
  const detail = star ? STAR_DETAIL[star.name] : null;
  const typeConfig = star ? levelConfig[star.type] : null;

  return (
    <AnimatePresence>
      {star && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="card-glass rounded-xl overflow-hidden"
        >
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--t-border)' }}>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold" style={{ color: 'var(--t-gold)' }}>{star.name}</span>
              {typeConfig && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${typeConfig.color}`}>
                  {typeConfig.label}
                </span>
              )}
              {star.siHua && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${siHuaColors[star.siHua] || ''}`}>
                  化{star.siHua}
                </span>
              )}
            </div>
            <button onClick={onClose} className="transition-colors text-lg leading-none" style={{ color: 'var(--t-faint)' }}>×</button>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto max-h-[560px]">
            {/* 基本信息 */}
            {desc && (
              <div className="flex flex-wrap gap-1.5">
                {[
                  `五行 · ${desc.element}`,
                  `性质 · ${desc.nature}`,
                  ...(palaceName ? [`位置 · ${palaceName}`] : []),
                  ...(star.brightness ? [star.brightness === 'bright' ? '庙旺' : star.brightness === 'dim' ? '落陷' : '平和'] : []),
                ].map(tag => (
                  <div key={tag} className="text-[10px] px-2 py-1 rounded-full"
                    style={{
                      border: '1px solid var(--t-border)',
                      color: tag.includes('庙旺') ? '#eab308' : tag.includes('落陷') ? '#ef4444' : 'var(--t-text2)',
                    }}>
                    {tag}
                  </div>
                ))}
              </div>
            )}

            {/* 关键词 */}
            {desc && (
              <div>
                <div className="text-[10px] tracking-widest mb-1.5" style={{ color: 'var(--t-faint)' }}>星曜特质</div>
                <div className="flex flex-wrap gap-1.5">
                  {desc.keywords.split('·').map(k => (
                    <span key={k} className="text-[11px] px-2 py-0.5 rounded-full"
                      style={{ color: 'var(--t-gold)', border: '1px solid rgba(212,168,67,0.2)', background: 'rgba(212,168,67,0.06)' }}>
                      {k.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 古书原文 */}
            {detail && (
              <div className="rounded-xl p-3" style={{ background: 'rgba(212,168,67,0.04)', border: '1px solid rgba(212,168,67,0.12)' }}>
                <div className="text-[10px] tracking-widest mb-1.5 flex items-center gap-1" style={{ color: 'var(--t-gold)', opacity: 0.7 }}>
                  古籍对读
                </div>
                <p className="text-[11px] leading-relaxed italic" style={{ color: 'var(--t-gold)', opacity: 0.8 }}>{detail.classical}</p>
              </div>
            )}

            {/* 现代阅读提示 */}
            {detail && (
              <>
                <div>
                  <div className="text-[10px] tracking-widest mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--t-faint)' }}>
                    <span className="w-3 h-px inline-block" style={{ background: 'var(--t-border-acc)' }} />
                    星性与条件
                    <span className="w-3 h-px inline-block" style={{ background: 'var(--t-border-acc)' }} />
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--t-text2)' }}>{detail.readingGuide}</p>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {[
                    { label: '事业方向', value: detail.career, icon: '◈' },
                    { label: '感情特质', value: detail.relationship, icon: '♡' },
                    { label: '财运分析', value: detail.wealth, icon: '◆' },
                    { label: '健康提示', value: detail.health, icon: '☯' },
                  ].map(item => (
                    <div key={item.label} className="card-inner rounded-lg p-3">
                      <div className="text-[10px] mb-1 flex items-center gap-1" style={{ color: 'var(--t-faint)' }}>
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--t-text2)' }}>{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="text-[10px] p-2.5 rounded-lg" style={{ border: '1px solid rgba(74,222,128,0.15)', background: 'rgba(74,222,128,0.05)' }}>
                    <div className="text-emerald-500 mb-0.5 font-medium">最佳宫位</div>
                    <div className="text-emerald-500/70">{detail.bestPalace}</div>
                  </div>
                  <div className="text-[10px] p-2.5 rounded-lg" style={{ border: '1px solid rgba(248,113,113,0.15)', background: 'rgba(248,113,113,0.05)' }}>
                    <div className="text-red-500 mb-0.5 font-medium">注意宫位</div>
                    <div className="text-red-500/70">{detail.worstPalace}</div>
                  </div>
                </div>
              </>
            )}

            {/* 辅星/煞星说明 */}
            {!detail && star.type !== 'major' && (
              <div className="text-xs leading-relaxed" style={{ color: 'var(--t-text2)' }}>
                {star.type === 'lucky' && (
                  <>
                    {star.name === '文昌' && '文昌入宫，主学业考试顺利，文书印鉴有利，宜从事文字相关工作。古诀：「文昌科甲，主文章显达，逢考必第。」'}
                    {star.name === '文曲' && '文曲入宫，主才艺出众，口才佳，善于表达，艺术天赋强。古诀：「文曲为才艺之星，能文能武，口才胜人。」'}
                    {star.name === '左辅' && '左辅入宫，主贵人相助，有人提携，该宫位事项受到善意支持。古诀：「左辅为助力之星，坐命则贵人多，逢凶化吉。」'}
                    {star.name === '右弼' && '右弼入宫，主贵人相助，多出女性贵人，该宫位事项有人协助。古诀：「右弼为阴助之星，多女性贵人，化险为夷。」'}
                    {star.name === '天魁' && '天魁入宫，主白天出生的贵人，男性贵人多，逢凶化吉之力。古诀：「天魁为天乙贵人，逢之必有贵人扶持。」'}
                    {star.name === '天钺' && '天钺入宫，主夜晚出生的贵人，女性贵人多，增添吉祥之气。古诀：「天钺为玉堂贵人，主阴助，女贵人多。」'}
                    {star.name === '禄存' && '禄存入宫，主财禄守成，该宫位有财气，但属于保守型财运。古诀：「禄存为财禄之星，主守财有余，进财稳健。」'}
                    {star.name === '天马' && '天马入宫，主奔波动荡，动中求财，宜主动出击，不宜守株待兔。古诀：「天马主动，逢禄则财禄双全，动中生财。」'}
                  </>
                )}
                {star.type === 'sha' && (
                  <>
                    {star.name === '地空' && '地空入宫，主该宫位事项有落空感，精神耗散，宜注意心理健康。古诀：「地空主虚耗，入命宫者多精神迷茫，须防空想。」'}
                    {star.name === '地劫' && '地劫入宫，主该宫位事项有意外损失，财物需谨慎，防小人。古诀：「地劫主劫财，入命宫者财运受损，防意外之失。」'}
                    {star.name === '火星' && '火星入宫，主该宫位事项急躁冲动，情绪波动，但若遇贪狼则反吉。古诀：「火星主急燥，然遇贪狼同宫，反为火贪格，主暴发。」'}
                    {star.name === '铃星' && '铃星入宫，主该宫位事项有暗中阻碍，防背后小人，凡事宜低调。古诀：「铃星主暗煞，入命者多暗中受敌，须防背后是非。」'}
                    {star.name === '擎羊' && '擎羊入宫，主刑克，该宫位事项多波折，有血光之灾或意外。古诀：「擎羊为刑克之星，入命宫者多刑克，须防意外血光。」'}
                    {star.name === '陀罗' && '陀罗入宫，主是非缠身，该宫位事项拖延不决，凡事宜早做准备。古诀：「陀罗主是非拖延，入命宫者做事迟缓，须防纠缠不清。」'}
                  </>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
