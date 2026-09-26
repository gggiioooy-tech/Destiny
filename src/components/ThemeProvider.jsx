import React, { createContext, useContext, useEffect, useState } from 'react';
import { Moon, Sun, Sparkles, Snowflake } from 'lucide-react';
const ThemeContext = createContext(null);
const STORAGE_KEY = '15month_theme';
function initialTheme() {
  try { const saved = localStorage.getItem(STORAGE_KEY); if (saved === 'light' || saved === 'dark' || saved === 'miku' || saved === 'alya') return saved; } catch {}
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('miku', theme === 'miku');
    document.documentElement.classList.toggle('alya', theme === 'alya');
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  }, [theme]);
  return <ThemeContext.Provider value={{ theme, toggleAlya: () => setTheme(value => value === 'alya' ? 'light' : 'alya'), toggleMiku: () => setTheme(value => value === 'miku' ? 'light' : 'miku'), toggle: () => setTheme(value => value === 'dark' ? 'light' : 'dark') }}>{children}</ThemeContext.Provider>;
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
