/* T1 stub (CONTRACT.md): replaced by the Network engine. */
window.SWM_VOWL = function () {
  var noop = function () {}, none = function () { return null; };
  return { filter: function (n, l) { var ids = new Set(n.map(function (x) { return x.id; }));
      return { nodes: n, links: l.filter(function (x) { return ids.has(x.s) && ids.has(x.t); }), deg: new Map() }; },
    render: noop, update: noop, key: none, scope: none, pause: noop, reset: noop, fit: noop, zoom: noop, zoomed: noop,
    locate: noop, resize: noop, hide: noop, show: noop, destroy: noop, phase: none, on: noop,
    stats: function () { return {}; } };
};
