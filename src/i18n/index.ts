// UI and content strings. en.json is the source; every other locale has one file with the same
// keys. A missing key falls back to English with a warning at build time, and `npm test` fails
// on it (test/i18n.test.mjs).
import en from './en.json';

export type Key = keyof typeof en;
type Dict = Partial<Record<Key, string>>;

export interface Locale {
  /** BCP 47 code, for <html lang> and hreflang. */
  code: string;
  /** URL prefix: '' for English at /. */
  path: string;
  /** The language's own name, for the language menu. */
  name: string;
}

export const locales: Locale[] = [
  { code: 'en', path: '', name: 'English' },
  { code: 'zh-CN', path: 'zh', name: '简体中文' },
  { code: 'ja', path: 'ja', name: '日本語' },
  { code: 'ko', path: 'ko', name: '한국어' },
  { code: 'es', path: 'es', name: 'Español' },
  { code: 'pt-BR', path: 'pt', name: 'Português (Brasil)' },
  { code: 'fr', path: 'fr', name: 'Français' },
  { code: 'de', path: 'de', name: 'Deutsch' },
  { code: 'ru', path: 'ru', name: 'Русский' },
  { code: 'uk', path: 'uk', name: 'Українська' },
];

export const defaultLocale = locales[0];

const dicts = import.meta.glob<Dict>('./*.json', { eager: true, import: 'default' });
const warned = new Set<string>();

export function localeByPath(path: string | undefined): Locale {
  return locales.find((l) => l.path === (path ?? '')) ?? defaultLocale;
}

/** The URL of a page in a locale: `/` and `/zh/` for the home page. */
export function localeHref(locale: Locale, page = ''): string {
  return `/${locale.path ? `${locale.path}/` : ''}${page}`;
}

export type T = (key: Key, vars?: Record<string, string | number>) => string;

/**
 * A translator for one locale. Strings may hold inline HTML (`<code>`), and `{name}`
 * placeholders are replaced by `vars` as given (which may be HTML, such as a link).
 */
export function useTranslations(locale: Locale): T {
  const dict: Dict = dicts[`./${locale.code}.json`] ?? {};
  if (locale.code !== 'en' && !warned.has(locale.code)) {
    warned.add(locale.code);
    const missing = (Object.keys(en) as Key[]).filter((k) => typeof dict[k] !== 'string');
    if (missing.length) {
      console.warn(`[i18n] ${locale.code}: ${missing.length} missing key(s), English used: ${missing.join(', ')}`);
    }
  }
  return (key, vars) => {
    let s = dict[key] ?? en[key];
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

/** An external link as HTML, for a `{link}` placeholder. */
export function link(href: string, text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return `<a href="${esc(href)}">${esc(text)}</a>`;
}

export const repo = 'https://github.com/jtwebman/jpm';
export const docs = (name: string) => `${repo}/blob/main/docs/${name}.md`;
