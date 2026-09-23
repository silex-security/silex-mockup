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

boot();
createRoot(document.getElementById('root')).render(<App />);
/* Read-only hook for the acceptance probes (tests/probe/run-probes-v2.mjs). */
window.__bs2 = { store, pending, ctl, setLang, model, validator, io };
requestAnimationFrame(() => { document.documentElement.dataset.ready = '1'; });
