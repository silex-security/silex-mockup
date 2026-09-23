/* Edits the config panel refused (an invalid expression, a non-number). They
   are UI state, never in the graph (plan §3.6). While any exist, Confirm is
   disabled. Keyed by `${nodeId}::${field}`. */
import { bump } from './storeAdapter.js';

const map = new Map();
export const pending = {
  set(nodeId, field, draft, message) { map.set(`${nodeId}::${field}`, { nodeId, field, draft, message }); bump(); },
  clear(nodeId, field) { if (map.delete(`${nodeId}::${field}`)) bump(); },
  clearAll() { if (map.size) { map.clear(); bump(); } },
  get(nodeId, field) { return map.get(`${nodeId}::${field}`) || null; },
  list() { return [...map.values()]; },
  get size() { return map.size; }
};
