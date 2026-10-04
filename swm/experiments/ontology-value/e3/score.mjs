// score.mjs — X2b E3 scorer (plan § E3). The scorer is the ONLY code that reads harm.
// harm = { <fold_id>: { suite, pairs: [[tool, class], ...] } }.
//
// scoreFold: targets = other tasks of the same suite with a pair whose class ∈ the blocked fold's classes,
// deduplicated by pair set, minus any task whose pair set equals the blocked one. matched if any predicted
// pair equals any of a target's pairs. confirmed precision = confirmed distinct predictions / all emitted
// distinct predictions (an "unconfirmed" prediction still counts in the denominator and is listed).
export function pairSet(pairs) {
  return [...new Set(pairs.map(([t, c]) => `${t}\u0000${c}`))].sort().join('|');
}

export function scoreFold(foldId, predictions, harm) {
  const thisFold = harm[foldId];
  if (!thisFold) throw new Error(`no harm entry for ${foldId}`);
  const suite = thisFold.suite;
  const blockedClasses = new Set((thisFold.pairs ?? []).map(([, c]) => c));
  const blockedSetStr = pairSet(thisFold.pairs ?? []);

  // All (tool,class) pairs recorded for this suite, across folds — used for "confirmed".
  const allPairs = new Set();
  for (const [id, h] of Object.entries(harm)) {
    if (h.suite !== suite) continue;
    for (const [t, c] of h.pairs ?? []) allPairs.add(`${t}\u0000${c}`);
  }

  const targets = [];
  const seenPairSet = new Set();
  for (const [id, h] of Object.entries(harm)) {
    if (id === foldId || h.suite !== suite) continue;
    const ps = pairSet(h.pairs ?? []);
    if (ps === blockedSetStr) continue;                 // already observed
    if (!(h.pairs ?? []).some(([, c]) => blockedClasses.has(c))) continue;
    if (seenPairSet.has(ps)) continue;                  // dedupe by pair set
    seenPairSet.add(ps);
    targets.push({ id, pairs: h.pairs ?? [] });
  }

  const predPairs = (predictions ?? []).map(p => `${p.tool}\u0000${p.class}`);
  let matched = 0;
  for (const t of targets) if (t.pairs.some(([tool, cls]) => predPairs.includes(`${tool}\u0000${cls}`))) matched++;

  const predPairsAt5 = predPairs.slice(0, 5);
  let matchedAt5 = 0;
  for (const t of targets) if (t.pairs.some(([tool, cls]) => predPairsAt5.includes(`${tool}\u0000${cls}`))) matchedAt5++;

  const emittedPairs = [...new Set(predPairs)];
  const confirmedPairs = emittedPairs.filter(p => allPairs.has(p));
  const unconfirmed = emittedPairs.filter(p => !allPairs.has(p)).map(p => p.split('\u0000'));

  return {
    fold_id: foldId,
    suite,
    targets: targets.length,
    matched,
    recall: targets.length ? matched / targets.length : null,
    recall_at5: targets.length ? matchedAt5 / targets.length : null,
    emitted: emittedPairs.length,
    confirmed: confirmedPairs.length,
    precision: emittedPairs.length ? confirmedPairs.length / emittedPairs.length : null,
    unconfirmed,
  };
}

export function scoreAll(predictionsByFold, harm) {
  const folds = [];
  for (const fid of Object.keys(predictionsByFold).sort()) {
    folds.push(scoreFold(fid, predictionsByFold[fid], harm));
  }
  const sum = (f, k) => folds.reduce((a, r) => a + (r[k] ?? 0), 0);
  const pool = (over) => {
    const rs = folds.filter(over);
    const t = sum(rs, 'targets'), m = sum(rs, 'matched'), e = sum(rs, 'emitted'), c = sum(rs, 'confirmed');
    return { folds: rs.length, targets: t, matched: m, recall: t ? m / t : null, emitted: e, confirmed: c, precision: e ? c / e : null };
  };
  const perSuite = {};
  for (const suite of [...new Set(folds.map(r => r.suite))].sort()) perSuite[suite] = pool(r => r.suite === suite);
  return { pooled: pool(() => true), per_suite: perSuite, folds };
}
