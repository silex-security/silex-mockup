import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './styles/tokens.css';
import './styles/app.css';
import App from './App.jsx';
import { boot } from './state/controller.js';
import { getLang } from './i18n/index.js';

document.documentElement.lang = getLang() === 'zh' ? 'zh-CN' : 'en';
boot();
createRoot(document.getElementById('root')).render(<App />);
