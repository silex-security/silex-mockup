/* Node search (Coze Studio pattern; plan §3.3): each entry has a one-line
   explanation. Matching is substring, in English and 中文 at once, ranked by
   catalog.rankType (label prefix > label > synonym > description); the list is
   grouped by category when the query is empty, and ranked flat while typing.
   It only offers node types that can legally go where it was opened. */
import { useEffect, useRef, useState } from 'react';
import { Command } from 'cmdk';
import { CATALOG, GROUPS, typeLabel, typeDesc, groupLabel, rankType } from './catalog.js';
import { t } from '../i18n/index.js';

function Item({ c, onPick }) {
  return (
    <Command.Item value={c.type} onSelect={() => onPick(c.type)} data-type={c.type}>
      <span className="si-tile" style={{ '--tc': c.color }}><svg viewBox="0 0 24 24" className="icon"><path d={c.icon} /></svg></span>
      <span className="si-text"><b>{typeLabel(c.type)}</b><small>{typeDesc(c.type)}</small></span>
    </Command.Item>);
}

export default function NodeSearch({ at, allowed, title, onPick, onClose }) {
  const ref = useRef(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    const away = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const esc = e => { if (e.key === 'Escape') onClose(); };
    const id = setTimeout(() => document.addEventListener('pointerdown', away), 0);
    document.addEventListener('keydown', esc);
    return () => { clearTimeout(id); document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [onClose]);
  const x = Math.min(at.x, window.innerWidth - 340), y = Math.min(at.y + 8, window.innerHeight - 380);
  const items = CATALOG.filter(c => allowed.includes(c.type));
  const ranked = q.trim() ? items.map(c => ({ c, r: rankType(c.type, q) })).filter(x => x.r > 0).sort((a, b) => b.r - a.r || items.indexOf(a.c) - items.indexOf(b.c)).map(x => x.c) : null;
  return (
    <div className="search-pop" ref={ref} style={{ left: Math.max(12, x), top: Math.max(56, y) }} role="dialog" aria-label={title}>
      <Command label={title} loop shouldFilter={false}>
        <div className="search-head"><span>{title}</span></div>
        <Command.Input autoFocus id="nodeSearchInput" value={q} onValueChange={setQ} placeholder={t('search.placeholder', 'Search steps — e.g. approval, 审批, tool')} />
        <Command.List>
          {ranked ? (ranked.length ? ranked.map(c => <Item key={c.type} c={c} onPick={onPick} />) : <p className="search-empty">{t('search.empty', 'No step matches. Try another word.')}</p>)
            : GROUPS.map(([g]) => {
              const inGroup = items.filter(c => c.group === g);
              return inGroup.length ? <Command.Group key={g} heading={groupLabel(g)}>{inGroup.map(c => <Item key={c.type} c={c} onPick={onPick} />)}</Command.Group> : null;
            })}
        </Command.List>
      </Command>
    </div>);
}
