/** First edition extracted from the CC BY 4.0 v4.0 dataset; not the upstream private library. */
import { GENERATED_STAR_DB } from './star-db.generated';

export type TopicKey =
  | 'overview' | 'personality' | 'love' | 'career' | 'wealth' | 'health'
  | 'family' | 'children' | 'move' | 'friends' | 'home' | 'spirit' | 'parents';

// iztro zh-CN 宫位名：命宫保留「宫」字，其余无「宫」字，「交友」在 iztro 里叫「仆役」
export const TOPIC_PALACE_NAME: Record<TopicKey, string> = {
  overview:    '命宫',
  personality: '命宫',
  love:        '夫妻',
  career:      '官禄',
  wealth:      '财帛',
  health:      '疾厄',
  family:      '兄弟',
  children:    '子女',
  move:        '迁移',
  friends:     '仆役',
  home:        '田宅',
  spirit:      '福德',
  parents:     '父母',
};

export const TOPIC_LABEL: Record<TopicKey, string> = {
  overview:    '命格总览',
  personality: '性格特质',
  love:        '感情婚姻',
  career:      '事业职业',
  wealth:      '财富运势',
  health:      '身心状态 / 生活节奏',
  family:      '兄弟合伙',
  children:    '子女缘分',
  move:        '迁移外出',
  friends:     '人际贵人',
  home:        '田宅不动产',
  spirit:      '精神福德',
  parents:     '父母长辈',
};

export interface StarProfile {
  mingGong?: string;
  personality?: string;
  fuQi?: string;
  guanLu?: string;
  caiBo?: string;
  jiE?: string;
  xiongDi?: string;
  ziNv?: string;
  qianYi?: string;
  jiaoYou?: string;
  tianZhai?: string;
  fuDe?: string;
  fuMu?: string;
}
export type StarDatabase = Record<string, StarProfile>;

/** Exact combinations use '+'; empty palaces use '空宫借:' and are never resident stars. */
export const STAR_DB: StarDatabase = GENERATED_STAR_DB;
