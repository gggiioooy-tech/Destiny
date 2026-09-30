import React, { createContext, useContext, useEffect, useState, useId } from 'react';
import { Moon, Sun, Sparkles, Snowflake, Waves, WandSparkles } from 'lucide-react';
const ThemeContext = createContext(null);
const STORAGE_KEY = '15month_theme';
const TRANSPARENCY_KEY = '15month_transparency';
function initialTransparency() {
  try {
    const saved = localStorage.getItem(TRANSPARENCY_KEY);
    if (saved !== null && saved.trim() !== '' && Number.isFinite(Number(saved))) return Math.min(100, Math.max(0, Math.round(Number(saved))));
  } catch {}
  return 40;
}
function initialTheme() {
  try { const saved = localStorage.getItem(STORAGE_KEY); if (saved === 'light' || saved === 'dark' || saved === 'miku' || saved === 'alya' || saved === 'marciana' || saved === 'elaina' || saved === 'yuno' || saved === 'emilia') return saved; } catch {}
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);
  const [transparency, setTransparency] = useState(initialTransparency);
  useEffect(() => {
    document.documentElement.style.setProperty('--panel-alpha', String(1 - transparency / 100));
    try { localStorage.setItem(TRANSPARENCY_KEY, String(transparency)); } catch {}
  }, [transparency]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('miku', theme === 'miku');
    document.documentElement.classList.toggle('alya', theme === 'alya');
    document.documentElement.classList.toggle('marciana', theme === 'marciana');
    document.documentElement.classList.toggle('elaina', theme === 'elaina');
    document.documentElement.classList.toggle('yuno', theme === 'yuno');
    document.documentElement.classList.toggle('emilia', theme === 'emilia');
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  }, [theme]);
  return <ThemeContext.Provider value={{ theme, transparency, setTransparency, toggleEmilia: () => setTheme(value => value === 'emilia' ? 'light' : 'emilia'), toggleYuno: () => setTheme(value => value === 'yuno' ? 'light' : 'yuno'), toggleElaina: () => setTheme(value => value === 'elaina' ? 'light' : 'elaina'), toggleMarciana: () => setTheme(value => value === 'marciana' ? 'light' : 'marciana'), toggleAlya: () => setTheme(value => value === 'alya' ? 'light' : 'alya'), toggleMiku: () => setTheme(value => value === 'miku' ? 'light' : 'miku'), toggle: () => setTheme(value => value === 'dark' ? 'light' : 'dark') }}>{children}</ThemeContext.Provider>;
}
export function TransparencyControl({ className = '' }) {
  const { transparency, setTransparency } = useContext(ThemeContext);
  const id = useId();
  return <div className={`rounded-xl border border-zinc-200 bg-white p-3 ${className}`}>
    <div className="flex items-center justify-between gap-2 text-xs font-semibold text-zinc-700">
      <label htmlFor={id}>배경 투명도</label><output htmlFor={id}>{transparency}%</output>
    </div>
    <input id={id} type="range" min="0" max="100" step="1" value={transparency} onChange={e => setTransparency(Number(e.target.value))}
      className="mt-3 block w-full cursor-pointer accent-blue-600" />
    <div className="mt-1 flex justify-between text-[10px] text-zinc-500"><span>불투명</span><span>투명</span></div>
  </div>;
}
export function ThemeToggle({ compact = false, className = '' }) {
  const { theme, toggle } = useContext(ThemeContext);
  const dark = theme === 'dark';
  return <button type="button" onClick={toggle} aria-label={dark ? '라이트 모드로 전환' : '다크 모드로 전환'} title={dark ? '라이트 모드로 전환' : '다크 모드로 전환'} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 ${className}`}>
    {dark ? <Sun size={17} /> : <Moon size={17} />}{!compact && (dark ? '라이트 모드' : '다크 모드')}
  </button>;
}

export function MikuThemeToggle({ compact = false, className = '' }) {
  const { theme, toggleMiku } = useContext(ThemeContext);
  const selected = theme === 'miku';
  return <button type="button" onClick={toggleMiku} aria-pressed={selected} aria-label={selected ? '미쿠 테마 끄기' : '미쿠 테마'} title={selected ? '미쿠 테마 끄기' : '미쿠 테마'} className={`miku-theme-toggle inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 ${className}`}>
    <Sparkles size={17} />{!compact && (selected ? '미쿠 테마 켜짐' : '미쿠 테마')}
  </button>;
}

export function AlyaThemeToggle({ compact = false, className = '' }) {
  const { theme, toggleAlya } = useContext(ThemeContext);
  const selected = theme === 'alya';
  return <button type="button" onClick={toggleAlya} aria-pressed={selected} aria-label={selected ? '아랴 테마 끄기' : '아랴 테마'} title={selected ? '아랴 테마 끄기' : '아랴 테마'} className={`alya-theme-toggle inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 ${className}`}>
    <Snowflake size={17} />{!compact && (selected ? '아랴 테마 켜짐' : '아랴 테마')}
  </button>;
}

export function MarcianaThemeToggle({ compact = false, className = '' }) {
  const { theme, toggleMarciana } = useContext(ThemeContext);
  const selected = theme === 'marciana';
  return <button type="button" onClick={toggleMarciana} aria-pressed={selected} aria-label={selected ? '마르차나 테마 끄기' : '마르차나 테마'} title={selected ? '마르차나 테마 끄기' : '마르차나 테마'} className={`marciana-theme-toggle inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 ${className}`}>
    <Waves size={17} />{!compact && (selected ? '마르차나 테마 켜짐' : '마르차나 테마')}
  </button>;
}

export function ElainaThemeToggle({ compact = false, className = '' }) {
  const { theme, toggleElaina } = useContext(ThemeContext);
  const selected = theme === 'elaina';
  return <button type="button" onClick={toggleElaina} aria-pressed={selected} aria-label={selected ? '일레이나 테마 끄기' : '일레이나 테마'} title={selected ? '일레이나 테마 끄기' : '일레이나 테마'} className={`elaina-theme-toggle inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 ${className}`}>
    <WandSparkles size={17} />{!compact && (selected ? '일레이나 테마 켜짐' : '일레이나 테마')}
  </button>;
}

export function AnimeThemeMenu({ compact = false, className = '' }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className={`relative ${className}`}>
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 ${compact ? '' : 'w-full'}`}>
      <Sparkles size={17} />씹덕모드<span aria-hidden="true">{open ? '▴' : '▾'}</span>
    </button>
    {open && <div id={id} className={compact ? 'absolute right-0 top-full z-50 mt-2 grid max-h-[70vh] overflow-y-auto w-56 gap-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-lg' : 'mt-2 grid gap-2'}>
      {compact && <TransparencyControl />}
      <MikuThemeToggle className="w-full" />
      <AlyaThemeToggle className="w-full" />
      <MarcianaThemeToggle className="w-full" />
      <ElainaThemeToggle className="w-full" />
      <YunoThemeToggle className="w-full" />
      <EmiliaThemeToggle className="w-full" />
    </div>}
  </div>;
}

export function YunoThemeToggle({ compact = false, className = '' }) {
  const { theme, toggleYuno } = useContext(ThemeContext);
  const selected = theme === 'yuno';
  return <button type="button" onClick={toggleYuno} aria-pressed={selected} aria-label={selected ? '유노 테마 끄기' : '유노 테마'} title={selected ? '유노 테마 끄기' : '유노 테마'} className={`yuno-theme-toggle inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 ${className}`}>
    <Moon size={17} />{!compact && (selected ? '유노 테마 켜짐' : '유노 테마')}
  </button>;
}

export function EmiliaThemeToggle({ compact = false, className = '' }) {
  const { theme, toggleEmilia } = useContext(ThemeContext);
  const selected = theme === 'emilia';
  return <button type="button" onClick={toggleEmilia} aria-pressed={selected} aria-label={selected ? '에밀리아 테마 끄기' : '에밀리아 테마'} title={selected ? '에밀리아 테마 끄기' : '에밀리아 테마'} className={`emilia-theme-toggle inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 ${className}`}>
    <Snowflake size={17} />{!compact && (selected ? '에밀리아 테마 켜짐' : '에밀리아 테마')}
  </button>;
}
