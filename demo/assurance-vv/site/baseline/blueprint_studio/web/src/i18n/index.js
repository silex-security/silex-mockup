/* i18n (plan §3.8). Every UI string is t(key, englishDefault, params).
   en.js may override the English default; zh.js must contain every key used
   (scripts/check-i18n.mjs enforces it). {name} placeholders are replaced by
   params. Language: localStorage 'bs2.lang', else the browser language. */
import { bump, useStudio } from '../state/storeAdapter.js';
import en from './en.js';
import zh from './zh.js';

const DICTS = { en, zh };
let lang = (() => {
  try { const s = localStorage.getItem('bs2.lang'); if (s === 'en' || s === 'zh') return s; } catch { /* no storage */ }
  return (typeof navigator !== 'undefined' && /^zh/i.test(navigator.language || '')) ? 'zh' : 'en';
})();
export const getLang = () => lang;
export function setLang(l) { lang = l === 'zh' ? 'zh' : 'en'; try { localStorage.setItem('bs2.lang', lang); } catch { /* ignore */ } document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'; bump(); }
export function t(key, fallback, params) {
  let s = DICTS[lang][key] ?? (lang === 'en' ? fallback : (DICTS.en[key] ?? fallback)) ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] ?? m));
  return s;
}
export function useT() { useStudio(); return t; }
