import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './styles/tokens.css';
import './styles/app.css';
import App from './App.jsx';
import { boot } from './state/controller.js';
import { getLang } from './i18n/index.js';

document.documentElement.lang = getLang() === 'zh' ? 'zh-CN' : 'en';
import { store } from './state/storeAdapter.js';
import { pending } from './state/pendingInputs.js';
import * as ctl from './state/controller.js';
import { setLang } from './i18n/index.js';
import * as model from '../../js/model.js';
import * as validator from '../../js/validate.js';
import * as io from '../../js/io.js';

import { initEmbed, EMBED } from './embed.js';
import { storage, schedulePublish } from './state/storeAdapter.js';
import { t } from './i18n/index.js';

boot();
createRoot(document.getElementById('root')).render(<App />);
if (EMBED) document.documentElement.dataset.embed = '1';
schedulePublish(0);
/* Host commands (cutover plan §2.2). Standalone pages accept them too, so a link can deep-open a revision. */
initEmbed({
  storage,
  apply: (c, doc) => {
    if (c.cmd === 'new') ctl.openGallery(true);
    else if (c.cmd === 'resume') ctl.openGallery(false);
    else ctl.openDocument(doc, c.rev, c.view, c.stage);
  },
  refuse: () => ctl.toast(t('embed.missing', "This revision is no longer in this browser's copy of the document."), 'error')
});
/* Read-only hook for the acceptance probes (tests/probe/run-probes-v2.mjs). */
window.__bs2 = { store, pending, ctl, setLang, model, validator, io };
requestAnimationFrame(() => { document.documentElement.dataset.ready = '1'; });
