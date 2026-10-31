/**
 * 古籍原典查询库 — 类型定义
 *
 * 设计：古籍原文（繁转简）以静态数据打包；来源和版本信息随书保留。
 * Next.js 启动时一次性加载到内存，零 DB 依赖
 */

export const CLASSICS_NOTICE = '原文据维基文库《紫微斗数全书》整理（CC BY-SA 4.0），繁体转简体，未逐字校勘，可能有错讹；仅供对读参考，不构成对任何健康、感情或收益结果的判断。';

export const CLASSICS_SOURCE = 'https://zh.wikisource.org/wiki/紫微斗數全書';

export interface Paragraph {
  /** 段落唯一 id（用于锚点跳转） */
  id: string;
  /** 段落序号（章节内） */
  idx: number;
  /** 古籍原文段落（繁转简，未逐字校勘） */
  text: string;
  /** 现代翻译（可选，未来填充） */
  translation?: string;
  /** 现代阅读提示（可选） */
  readingNote?: string;
}

export interface Chapter {
  /** 章节标题（如"卷一"、"总论篇"）*/
  title: string;
  /** 章节副标题/简介（可选）*/
  subtitle?: string;
  paragraphs: Paragraph[];
}

export interface Book {
  /** 书名 */
  title: string;
  /** 书 slug（URL 用，如 'guisuifu'）*/
  slug: string;
  /** 朝代 */
  dynasty: string;
  /** 作者（多人或不详时填"不详"或多人）*/
  author: string;
  /** 简介 */
  intro: string;
  /** 正文汉字数（不含标点、空白、标题与图表占位说明）*/
  wordCount: number;
  /** 来源 URL */
  source?: string;
  /** 版本说明 */
  edition?: string;
  /** 授权说明 */
  license?: string;
  chapters: Chapter[];
}

export interface SearchHit {
  bookSlug: string;
  bookTitle: string;
  chapterTitle: string;
  paragraphId: string;
  /** 高亮片段（含 <mark> 标签） */
  snippet: string;
  /** 命中的古籍原文文本 */
  text: string;
}
