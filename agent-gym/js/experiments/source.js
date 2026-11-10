// Where an experiment came from, and the link back to it in the SILEX console.
//
//   consoleHref(view, path) -> '../index.html#view=<view>&path=<encoded path>'
//     A relative URL to the console page that sits one folder above this app. A plain anchor with target="_top" opens it
//     from the embedded frame and from the standalone page alike, so no view needs to reach into the parent window.
//   sourceLink(source) -> { label, href } | null     only a Speedrun source with a ref has a place to go back to
import { SPEEDRUN_REF } from '../model.js';

export const consoleHref = (view, path) => `../index.html#view=${view}&path=${encodeURIComponent(path)}`;

export const sourceLink = source =>
  source.kind === 'speedrun' && SPEEDRUN_REF.test(source.ref ?? '') ? { label: 'View source in Speedrun', href: consoleHref('speedrun', source.ref) } : null;
