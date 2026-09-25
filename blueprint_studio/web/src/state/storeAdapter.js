/* React integration for js/store.js (plan §4, web/CONTRACT.md).
   The store mutates its document in place, so the snapshot React compares is a
   monotonically increasing `version`, bumped on every store event (and on
   pending-input changes). Components read store.active()/store.doc during
   render. store.dispatch stays the single mutation choke point. */
import { useSyncExternalStore } from 'react';
import { createStore } from '../../../js/store.js';
import { lint } from '../../../js/validate.js';
import { publishSummary } from './summary.js';

const storage = (() => { try { localStorage.setItem('bs2.t', '1'); localStorage.removeItem('bs2.t'); return localStorage; } catch { return null; } })();
export const store = createStore({ storage, lint });

let version = 0;
const listeners = new Set();
export function bump() { version++; for (const l of listeners) l(); }
store.on(() => bump());

/* Cutover plan §2.3: republish bs.summary.v1 (rebuilt from every saved document)
   after store changes, and re-read registrations written by other contexts. */
let publishTimer = 0;
export function schedulePublish(delay = 120) { clearTimeout(publishTimer); publishTimer = setTimeout(() => publishSummary(storage), delay); }
store.on(() => schedulePublish());
if (typeof window !== 'undefined') window.addEventListener('storage', e => {
  if (e.key && e.key.startsWith('bs.reg.')) { store.refreshInventory(); bump(); }
});
export { storage };

const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export function useStudio() { return useSyncExternalStore(subscribe, () => version); }
export const currentVersion = () => version;
