import { content, prefix, type Lang } from '../lib/i18n';

export function sections(lang: Lang): { label: string; href: string }[] {
  const p = prefix(lang);
  return content[lang].nav.map((s) => ({ label: s.label, href: `${p}/${s.href}` }));
}

export function home(lang: Lang): string {
  return `${prefix(lang)}/`;
}
