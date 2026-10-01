/* Localises an English string that derive.js/mapping.js produced, by a stable
   key; falls back to the English text (plan §3, CONTRACT.md). The keys are
   listed in i18n/required.js so the zh checker covers them. */
import { t } from '../i18n/index.js';

export const tr = (ns, key, fallback) => t(`trace.${ns}.${key}`, fallback ?? key);
