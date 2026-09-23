/* Node search (Coze Studio pattern; plan §3.3): a cmdk menu grouped by
   category, each entry with a one-line explanation. It matches English and
   中文 labels, descriptions and synonyms, and it is filtered to the node
   types that can legally go at the place it was opened from. */
import { useEffect, useRef } from 'react';
import { Command } from 'cmdk';
import { CATALOG, GROUPS, typeLabel, typeDesc, typeSyn, groupLabel } from './catalog.js';
import { t } from '../i18n/index.js';

export default function NodeSearch({ at, allowed, title, onPick, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const away = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const esc = e => { if (e.key === 'Escape') onClose(); };
    const id = setTimeout(() => document.addEventListener('pointerdown', away), 0);
    document.addEventListener('keydown', esc);
    return () => { clearTimeout(id); document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [onClose]);
  const x = Math.min(at.x, window.innerWidth - 340), y = Math.min(at.y + 8, window.innerHeight - 380);
  const items = CATALOG.filter(c => allowed.includes(c.type));
  return (
    <div className="search-pop" ref={ref} style={{ left: Math.max(12, x), top: Math.max(56, y) }} role="dialog" aria-label={title}>
      <Command label={title} loop>
        <div className="search-head"><span>{title}</span></div>
        <Command.Input autoFocus id="nodeSearchInput" placeholder={t('search.placeholder', 'Search steps — e.g. approval, 审批, tool')} />
        <Command.List>
          <Command.Empty>{t('search.empty', 'No step matches. Try another word.')}</Command.Empty>
          {GROUPS.map(([g]) => {
            const inGroup = items.filter(c => c.group === g);
            if (!inGroup.length) return null;
            return (
              <Command.Group key={g} heading={groupLabel(g)}>
                {inGroup.map(c => (
                  <Command.Item key={c.type} value={`${c.type} ${c.label} ${c.desc} ${typeLabel(c.type)} ${typeDesc(c.type)} ${typeSyn(c.type)}`} onSelect={() => onPick(c.type)} data-type={c.type}>
                    <span className="si-tile" style={{ '--tc': c.color }}><svg viewBox="0 0 24 24" className="icon"><path d={c.icon} /></svg></span>
                    <span className="si-text"><b>{typeLabel(c.type)}</b><small>{typeDesc(c.type)}</small></span>
                  </Command.Item>))}
              </Command.Group>);
          })}
        </Command.List>
      </Command>
    </div>);
}
