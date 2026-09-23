/* Inline stroke icons (no icon font, no network). `d` is an SVG path. */
export const I = {
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3', redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  play: 'M7 5l12 7-12 7z', check: 'M5 12l4 4 10-10', list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6L6 18', layout: 'M4 4h7v7H4zM13 13h7v7h-7zM11 7.5h4.5V13', fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  shield: 'M12 3l7 3v6c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6z', globe: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18',
  info: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 11v6M12 7.5h.01', search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-4-4', warn: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  step: 'M6 5v14M10 5l9 7-9 7z', trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13', link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6',
  chevron: 'M9 6l6 6-6 6', copy: 'M9 9h10v10H9zM5 15V5h10', upload: 'M12 16V4M7 9l5-5 5 5M5 20h14', file: 'M6 3h8l4 4v14H6zM14 3v4h4'
};
export default function Icon({ d, className = 'icon', title }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>{title ? <title>{title}</title> : null}<path d={d} /></svg>;
}
