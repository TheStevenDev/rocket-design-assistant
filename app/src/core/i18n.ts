// Minimal two-language support. Texts live next to the code that uses them:
// `tr(it, en)` for inline strings, `Text` + `txt()` for data tables.
// The current language is module state so that non-React code (checks,
// validation, catalog) can produce messages; the store keeps it in sync.

export type Lang = 'it' | 'en';

export const LANGS: { id: Lang; label: string; name: string }[] = [
  { id: 'it', label: 'IT', name: 'Italiano' },
  { id: 'en', label: 'EN', name: 'English' },
];

export interface Text { it: string; en: string }

let current: Lang = 'en';

export function setLang(l: Lang) { current = l; }
export function getLang(): Lang { return current; }

/** Picks the text for the current language. */
export function tr(it: string, en: string): string {
  return current === 'en' ? en : it;
}

export function txt(t: Text): string {
  return t[current];
}

export function locale(): string {
  return current === 'en' ? 'en-GB' : 'it-IT';
}
