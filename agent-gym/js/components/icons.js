// Inline SVG icons for Agent Gym v2. Original line glyphs on a 24px grid. No vendor logo is reproduced.
//
//   icon(name, { size = 18, label }) -> SVGElement      a line icon. Decorative unless `label` is given.
//   appIcon(app, { size = 20 }) -> HTMLElement          a tinted mark for a simulated component or a generic kind
//   logoMark({ size = 26 }) -> SVGElement               the SILEX mark for the header
//   ICON_NAMES, APP_NAMES                               every valid key, for the kit page and tests
//
// App keys: salesforce, gmail, gcal, customdb, and the kinds crm, email, calendar, db, tickets, payments, kb,
// identity, logs, cloud, workflow, model. An unknown key draws the generic `box` mark.
import { h, s } from './dom.js';

const c = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const rr = (x, y, w, ht, r) => `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${ht - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(ht - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;

const CYLINDER = ['M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z', 'M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6', 'M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6'];
const CLOUD = 'M7 18.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 10.6a4 4 0 0 1-.5 7.9H7z';
const LAYERS = ['M12 3l9 4.8-9 4.8-9-4.8L12 3z', 'M3 12.2l9 4.8 9-4.8', 'M3 16.6l9 4.8 9-4.8'];

const PATHS = {
  plus: ['M12 5v14M5 12h14'],
  x: ['M6 6l12 12M18 6L6 18'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  'check-circle': [c(12, 12, 9), 'M8 12.5l3 3 5-6'],
  search: [c(11, 11, 6.5), 'M16 16l4.5 4.5'],
  'chevron-down': ['M6 9l6 6 6-6'],
  'chevron-up': ['M6 15l6-6 6 6'],
  'chevron-right': ['M9 6l6 6-6 6'],
  'chevron-left': ['M15 6l-6 6 6 6'],
  'arrow-right': ['M5 12h14M13 6l6 6-6 6'],
  'arrow-left': ['M19 12H5M11 6l-6 6 6 6'],
  'arrow-up-right': ['M7 17L17 7M9 7h8v8'],
  'arrow-up': ['M12 19V5M6 11l6-6 6 6'],
  'arrow-down': ['M12 5v14M6 13l6 6 6-6'],
  database: CYLINDER,
  mail: [rr(3, 5, 18, 14, 2), 'M3.5 7.5l8.5 6 8.5-6'],
  calendar: [rr(3, 5, 18, 16, 2), 'M3 10h18M8 3v4M16 3v4'],
  users: [c(9, 8, 3.5), 'M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6', 'M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.3c2.1.8 3.5 2.8 3.5 5.7'],
  user: [c(12, 8, 4), 'M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7'],
  headset: ['M4 14v-2a8 8 0 0 1 16 0v2', rr(3, 13, 4, 6, 1.5), rr(17, 13, 4, 6, 1.5), 'M20 19c0 1.6-2 2.5-5 2.5'],
  laptop: [rr(4, 5, 16, 11, 1.5), 'M2 19.5h20'],
  layers: LAYERS,
  play: ['M7 4.5v15l12-7.5-12-7.5z'],
  pause: ['M8 5v14M16 5v14'],
  stop: [rr(6, 6, 12, 12, 1.5)],
  save: ['M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M8 3v5h7V3', 'M7 21v-7h10v7'],
  pencil: ['M4 20l1-4.5L16.5 4a2.1 2.1 0 0 1 3 3L8 18.5 4 20z', 'M14.5 6l3.5 3.5'],
  wand: ['M4 20L15 9', 'M13.5 7.5l3 3', 'M18 3v4M16 5h4', 'M8 3.5v2M7 4.5h2', 'M20 12v2M19 13h2'],
  sparkle: ['M12 3c1 5.5 3.5 8 9 9-5.5 1-8 3.5-9 9-1-5.5-3.5-8-9-9 5.5-1 8-3.5 9-9z'],
  alert: ['M12 4L2.8 20h18.4L12 4z', 'M12 10v4.5M12 17.4v.1'],
  info: [c(12, 12, 9), 'M12 11v6M12 7.6v.1'],
  undo: ['M8 6L4 10l4 4', 'M4 10h10a5 5 0 0 1 0 10h-3'],
  redo: ['M16 6l4 4-4 4', 'M20 10H10a5 5 0 0 0 0 10h3'],
  paperclip: ['M20 11.5l-8.2 8.2a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8'],
  send: ['M21 3L10 14', 'M21 3l-7 18-4-7-7-4 18-7z'],
  building: [rr(4, 3, 10, 18, 1), 'M14 9h5a1 1 0 0 1 1 1v11', 'M2 21h20', 'M7.5 7h3M7.5 11h3M7.5 15h3'],
  bolt: ['M13 2L4 14h7l-1 8 9-12h-7l1-8z'],
  gamepad: ['M7 7h10a5 5 0 0 1 5 5v2.5a3 3 0 0 1-5.4 1.8L15.5 15h-7l-1.1 1.3A3 3 0 0 1 2 14.5V12a5 5 0 0 1 5-5z', 'M7 10v3M5.5 11.5h3', 'M16 10.4v.1M18 12.4v.1'],
  file: ['M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M14 3v5h5'],
  'file-text': ['M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M14 3v5h5', 'M8.5 13h7M8.5 17h5'],
  sliders: ['M4 7h10M18 7h2', c(16, 7, 2), 'M4 17h2M10 17h10', c(8, 17, 2)],
  grip: [c(9, 6, 0.7), c(15, 6, 0.7), c(9, 12, 0.7), c(15, 12, 0.7), c(9, 18, 0.7), c(15, 18, 0.7)],
  workflow: [c(12, 5, 2.2), c(5, 19, 2.2), c(19, 19, 2.2), 'M12 7.2v4.3M12 11.5l-5.6 5.8M12 11.5l5.6 5.8'],
  branch: [c(6, 5, 2), c(6, 19, 2), c(18, 8, 2), 'M6 7v10M18 10c0 4.5-6.5 3-11.4 7.2'],
  refresh: ['M20 11a8 8 0 0 0-14.5-4L4 9', 'M4 4v5h5', 'M4 13a8 8 0 0 0 14.5 4L20 15', 'M20 20v-5h-5'],
  shield: ['M12 3l7 3v5.5c0 4.5-3 7.8-7 9.5-4-1.7-7-5-7-9.5V6l7-3z', 'M9 12l2.2 2.2L15 10'],
  chat: ['M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z'],
  upload: ['M12 16V4M7 9l5-5 5 5', 'M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3'],
  download: ['M12 4v12M7 11l5 5 5-5', 'M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3'],
  lock: [rr(5, 10, 14, 11, 2), 'M8 10V7a4 4 0 0 1 8 0v3'],
  more: [c(5, 12, 0.8), c(12, 12, 0.8), c(19, 12, 0.8)],
  trash: ['M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13'],
  clock: [c(12, 12, 9), 'M12 7v5l3.5 2'],
  eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', c(12, 12, 3)],
  copy: [rr(8, 8, 12, 12, 2), 'M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3'],
  list: ['M8 6h12M8 12h12M8 18h12M4 6v.1M4 12v.1M4 18v.1'],
  filter: ['M4 5h16l-6 7.5V19l-4 1.5v-8L4 5z'],
  ticket: ['M3 8a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2.5a1.5 1.5 0 0 0 0 3V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2.5a1.5 1.5 0 0 0 0-3V8z', 'M14 7v10'],
  card: [rr(3, 5, 18, 14, 2), 'M3 10h18M7 15h3'],
  book: ['M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4z', 'M5 18a2 2 0 0 1 2-2h12'],
  id: [rr(3, 5, 18, 14, 2), c(9, 11, 2), 'M6 16c.5-1.4 1.6-2 3-2s2.5.6 3 2M14.5 10h4M14.5 14h3'],
  logs: ['M5 5h14M5 9.5h10M5 14h14M5 18.5h8'],
  cloud: [CLOUD],
  cpu: [rr(6, 6, 12, 12, 2), rr(9.5, 9.5, 5, 5, 0.5), 'M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3'],
  box: ['M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z', 'M4 7.5l8 4.5 8-4.5M12 12v9'],
  flask: ['M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3', 'M7.5 15h9'],
};

export const ICON_NAMES = Object.freeze(Object.keys(PATHS));

export function icon(name, { size = 18, label } = {}) {
  const paths = PATHS[name] || PATHS.box;
  return s('svg', {
    class: 'gym-icon', viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
    'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    role: label ? 'img' : null, 'aria-label': label || null, 'aria-hidden': label ? null : 'true', focusable: 'false',
  }, paths.map(d => s('path', { d })));
}

// Each product mark is a plain object in the product's usual tint: a cloud, an envelope, a calendar page, a cylinder.
const fill = (d, color) => ({ d, fill: color, stroke: 'none' });
const line = (d, color, width = 1.8) => ({ d, fill: 'none', stroke: color, 'stroke-width': width });
const MARKS = {
  salesforce: [fill('M6.6 19.5a5 5 0 0 1-.9-9.9A6.6 6.6 0 0 1 18.3 10.8a4.4 4.4 0 0 1-.6 8.7H6.6z', '#1b96e0')],
  gmail: [fill(rr(2.5, 5, 19, 14, 2), '#ffffff'), line(rr(2.5, 5, 19, 14, 2), '#d5d2e3', 1.2), line('M4.5 17.5V8l7.5 5.6L19.5 8v9.5', '#e0392b', 2.6)],
  gcal: [fill(rr(3.5, 4.5, 17, 16, 2.5), '#ffffff'), line(rr(3.5, 4.5, 17, 16, 2.5), '#2f74e6', 1.8), fill('M3.5 7a2.5 2.5 0 0 1 2.5-2.5h12A2.5 2.5 0 0 1 20.5 7v2.5h-17V7z', '#2f74e6'), line('M8 13h2.5M13.5 13H16M8 16.5h2.5M13.5 16.5H16', '#2f74e6', 1.8)],
  customdb: CYLINDER.map(d => line(d, '#5b23f0')),
};
const KIND_ICON = { crm: 'users', email: 'mail', calendar: 'calendar', db: 'database', tickets: 'ticket', payments: 'card', kb: 'book', identity: 'id', logs: 'logs', cloud: 'cloud', workflow: 'workflow', model: 'sparkle' };

export const APP_NAMES = Object.freeze([...Object.keys(MARKS), ...Object.keys(KIND_ICON)]);

export function appIcon(app, { size = 20 } = {}) {
  const mark = MARKS[app];
  const glyph = mark
    ? s('svg', { viewBox: '0 0 24 24', width: size, height: size, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' }, mark.map(attrs => s('path', attrs)))
    : icon(KIND_ICON[app] || 'box', { size });
  return h('span', { class: `gym-appicon${mark ? '' : ' gym-appicon--kind'}`, dataset: { app } }, glyph);
}

export function logoMark({ size = 30 } = {}) {
  return s('svg', { class: 'gym-logo__mark', viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true', focusable: 'false' },
    s('path', { d: 'M7.5 16.5L12 12l4.5-5', fill: 'none', stroke: 'currentColor', 'stroke-width': 4.2, 'stroke-linecap': 'round' }),
    s('path', { d: c(7, 17, 4.6), fill: 'currentColor' }),
    s('path', { d: c(17, 6.5, 3.7), fill: 'currentColor' }));
}
