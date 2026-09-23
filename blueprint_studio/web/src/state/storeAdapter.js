/* React integration for js/store.js (plan §4, web/CONTRACT.md).
   The store mutates its document in place, so the snapshot React compares is a
   monotonically increasing `version`, bumped on every store event (and on
   pending-input changes). Components read store.active()/store.doc during
   render. store.dispatch stays the single mutation choke point. */
import { useSyncExternalStore } from 'react';
import { createStore } from '../../../js/store.js';
import { lint } from '../../../js/validate.js';

const storage = (() => { try { localStorage.setItem('bs2.t', '1'); localStorage.removeItem('bs2.t'); return localStorage; } catch { return null; } })();
export const store = createStore({ storage, lint });

let version = 0;
const listeners = new Set();
export function bump() { version++; for (const l of listeners) l(); }
store.on(() => bump());

const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export function useStudio() { return useSyncExternalStore(subscribe, () => version); }
export const currentVersion = () => version;
