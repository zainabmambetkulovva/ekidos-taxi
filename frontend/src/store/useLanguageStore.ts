import { create } from 'zustand';
import t, { Lang } from '@/lib/translations';

interface LanguageState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  lang: (typeof window !== 'undefined' ? (localStorage.getItem('ekidos-lang') as Lang) : null) || 'ru',
  setLang: (lang: Lang) => {
    if (typeof window !== 'undefined') localStorage.setItem('ekidos-lang', lang);
    set({ lang });
  },
  t: (key: string) => {
    const lang = get().lang;
    return t[lang]?.[key] || t['en']?.[key] || key;
  },
}));
