'use client';
import { useEffect, useState } from 'react';
export default function ResultGuide() {
  const [visible, setVisible] = useState(false);
  useEffect(() => { try { setVisible(localStorage.getItem('tianjipan-result-guide-v1') !== 'closed'); } catch { setVisible(true); } }, []);
  if (!visible) return null;
  return <aside className="ux-notice my-4" aria-label="首次阅读引导"><div className="flex justify-between gap-4"><strong>从这三步开始</strong><button className="underline" onClick={() => { setVisible(false); try { localStorage.setItem('tianjipan-result-guide-v1', 'closed'); } catch {} }}>关闭引导</button></div><ol className="list-decimal pl-5 mt-2"><li>看命盘：每格是一个宫位，星曜是观察线索。</li><li>点宫位或星曜看本地简介，不消耗 AI 次数。</li><li>想问 AI，就点话题、解读按钮或输入问题。</li></ol></aside>;
}
