'use client';
import { useEffect, useLayoutEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { termDescription } from '@/lib/glossary';
export default function Term({ name, children }: { name: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const button = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const id = useId();
  const restoringFocus = useRef(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepOpen = () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); };
  const leave = () => { if (window.matchMedia('(hover: hover)').matches) hoverTimer.current = setTimeout(() => setOpen(false), 180); };
  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);
  const close = () => {
    setOpen(false); restoringFocus.current = true; button.current?.focus(); restoringFocus.current = false;
  };
  const show = () => {
    const r = button.current?.getBoundingClientRect();
    if (r) setPosition({ left: Math.max(12, Math.min(r.left, window.innerWidth - 292)), top: Math.max(12, Math.min(r.bottom + 8, window.innerHeight - 200)) });
    setOpen(true);
  };
  useLayoutEffect(() => {
    if (!open || !popup.current) return;
    const r = popup.current.getBoundingClientRect();
    const top = Math.max(12, Math.min(position.top, window.innerHeight - r.height - 12));
    if (top !== position.top) setPosition(p => ({ ...p, top }));
  }, [open, position.top]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!button.current?.contains(e.target as Node) && !popup.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    const dismiss = () => setOpen(false);
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key);
    window.addEventListener('scroll', dismiss, true); window.addEventListener('resize', dismiss);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); window.removeEventListener('scroll', dismiss, true); window.removeEventListener('resize', dismiss); };
  }, [open]);
  return <><button ref={button} type="button" className="term-trigger" aria-expanded={open} aria-controls={open ? id : undefined}
    onMouseEnter={() => { keepOpen(); if (window.matchMedia('(hover: hover)').matches) show(); }} onMouseLeave={leave}
    onFocus={() => { if (!restoringFocus.current) show(); }} onBlur={e => { if (!popup.current?.contains(e.relatedTarget as Node)) setOpen(false); }}
    onKeyDown={e => { if (open && (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey))) { e.preventDefault(); popup.current?.querySelector<HTMLElement>('button, a')?.focus(); } }}
    onClick={e => { e.stopPropagation(); if (!open) show(); }}>
    {children ?? name}<span aria-hidden="true" className="text-xs opacity-60">ⓘ</span></button>
    {open && createPortal(<div ref={popup} id={id} role="dialog" aria-label={`${name}简介`} className="term-popover" style={{ ...position }} onMouseEnter={keepOpen} onMouseLeave={leave} onClick={e => e.stopPropagation()} onBlur={e => { if (!popup.current?.contains(e.relatedTarget as Node) && !button.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <div className="flex justify-between"><strong>{name}</strong><button aria-label="关闭解释" onClick={close}>×</button></div>
      <p className="my-2">{termDescription(name)}</p><a href="/knowledge" className="underline">了解更多 → /knowledge</a>
    </div>, document.body)}</>;
}
