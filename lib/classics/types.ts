/**
 * 古籍原典查询库 — 类型定义
 *
 * 设计：主题整理以静态数据打包；未完成版本校勘，不据目录名认定权利。
 * Next.js 启动时一次性加载到内存，零 DB 依赖
 */

export const CLASSICS_NOTICE = '本页是未经版本逐字校勘的主题整理稿，含现代说明，不作为所署古籍的原文或公版授权证明；请与可靠影印版本对读，不据此推断健康、收益或关系结果。';

export interface Paragraph {
  /** 段落唯一 id（用于锚点跳转） */
  id: string;
  /** 段落序号（章节内） */
  idx: number;
  /** 整理稿段落；不自动视为古籍原文 */
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
  /** 总字数（粗略）*/
  wordCount: number;
  chapters: Chapter[];
}

export interface SearchHit {
  bookSlug: string;
  bookTitle: string;
  chapterTitle: string;
  paragraphId: string;
  /** 高亮片段（含 <mark> 标签） */
  snippet: string;
  /** 命中的整理稿文本 */
  text: string;
}
