// State Engine (T1): turn a raw span into a dense, redacted decision snapshot.
//
// The feature definitions below are fixed by CONTRACT.md §3 and are the ONLY
// inputs the Jev simulator may read (plus seeded jitter) — no span ids, names
// or labels may be used to pick probabilities.

import { STATE_SCHEMA } from './types.js';

const SENSITIVE_FIELDS = new Set(['bank_account_number', 'routing_number', 'tax_id', 'ssn', 'session_token']);
const UNTRUSTED_TRUST = new Set(['retrieved', 'tool']);
const STOPWORDS = new Set(['llc', 'ltd', 'inc', 'co', 'corp']);
const IMPACT_NUM = { read: 0, write: 1, payment: 2 };

/**
 * Injection markers (documented weights). Each marker contributes its weight
 * once per untrusted source it matches; the score is the sum capped at 1.
 *   "ignore (all) previous / disregard prior / forget above"   0.9
 *   "also email / send a copy / cc me / forward a copy"        0.6
 *   "updated/new/revised … procedure/process/policy/step"      0.4
 *   an email address outside the tenant's domain allowlist     0.5
 * SOC (logs/2026-09-30_DEMO_SOC_PLAN.md §2); only the attack question reads them:
 *   text addressed to automation ("note/message/instruction to … automation/ai/agent/assistant/bot")  0.6
 *   a security-action imperative inside untrusted text (allowlist/whitelist/suspend/disable/close this ticket)  0.5
 */
const INJECTION_MARKERS = [
  { re: /ignore\s+(all\s+)?previous|disregard\s+(all\s+)?(prior|previous|above)|forget\s+(all\s+)?(prior|previous)/i, w: 0.9 },
  { re: /also\s+email|send\s+(a\s+)?copy|cc\s+(me|them|us)|forward\s+(this|it|a\s+copy)/i, w: 0.6 },
  { re: /(updated|new|revised|changed)\b[^.\n]*?\b(procedure|process|policy|instruction|step)/i, w: 0.4 },
  { re: /(?:note|message|instruction)\b[^.\n]{0,80}?\bto\s+(?:the\s+)?(?:security\s+)?(?:automation|ai|agent|assistant|bot)/i, w: 0.6 },
  { re: /allowlist|whitelist|suspend|disable|close\s+this\s+ticket/i, w: 0.5 },
];

export function domainOf(emailOrDomain) {
  if (emailOrDomain == null) return null;
  const at = emailOrDomain.indexOf('@');
  return at >= 0 ? emailOrDomain.slice(at + 1) : emailOrDomain;
}

/** Host of a URL string, or null when it is not a parseable http(s) URL. */
function urlHost(url) {
  if (typeof url !== 'string' || !url) return null;
  try { return new URL(url).hostname || null; } catch { return null; }
}

/** Normalise a name for token Jaccard: lower-case, punctuation → space, drop stopwords. */
export function normalizeName(name) {
  if (name == null) return null;
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t && !STOPWORDS.has(t));
}

/** Token Jaccard of two normalised token lists (null when both empty). */
export function tokenJaccard(a, b) {
  const sa = new Set(a), sb = new Set(b);
  if (sa.size === 0 && sb.size === 0) return null;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? null : inter / union;
}

function injectionMarkerScore(untrustedSources, tenant) {
  let score = 0;
  const emails = [];
  for (const s of untrustedSources) {
    const text = s.excerpt ?? s.text ?? '';
    for (const m of INJECTION_MARKERS) if (m.re.test(text)) score += m.w;
    const found = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g);
    if (found) emails.push(...found);
  }
  for (const e of emails) {
    const dom = e.slice(e.indexOf('@') + 1).toLowerCase();
    if (!tenant.domain_allowlist.includes(dom)) score += 0.5;
  }
  return Math.min(1, score);
}

function untrustedTextShare(text, sources) {
  let total = (text ?? '').length;
  let untrusted = 0;
  for (const s of sources) {
    const len = (s.text ?? '').length;
    total += len;
    if (UNTRUSTED_TRUST.has(s.trust)) untrusted += len;
  }
  return total === 0 ? null : untrusted / total;
}

/** Count of numbers / capitalised entities in `text` absent from all source text. */
function unsupportedClaims(text, sources) {
  if (text == null) return null;
  const haystack = sources.map(s => s.text ?? '').join('\n');
  const numbers = text.match(/\$?\d[\d,]*/g) ?? [];
  const caps = text.match(/[A-Z][a-zA-Z]{1,}/g) ?? [];
  let count = 0;
  for (const c of [...numbers, ...caps]) if (!haystack.includes(c)) count++;
  return count;
}

/**
 * Redaction for the safeView: strip numbers and account references so the judge
 * never sees raw amounts or account identifiers (CONTRACT §3 "no account refs /
 * numbers"). Email addresses (no digits) survive so a marker can be traced, but
 * numeric payloads do not.
 */
function redact(text) {
  return String(text)
    .replace(/\$?\d[\d,]*/g, '[redacted]')
    .replace(/\bACCT\w*(?:[-_]\w+)*\b/gi, '[redacted]');
}

// --- Creator-platform derived facts (web/demo/CREATOR_CONTRACT.md §3). -----------------------
// state.facts.creator is null unless the span carries span.context.creator = { as_of, triples }.
// Each fact is true, false, or null when the tool is not the one the fact is about. `used`
// records, per true fact, the triples it was derived from (for the Inspector).

const CREATOR_LEVEL = { L0: 0, L1: 1, L2: 2 };
const levelOf = v => CREATOR_LEVEL[v] ?? 0;
const firstOf = arr => (arr.length ? arr[0] : null);

function creatorFacts(slice, tool) {
  if (slice == null) return null;
  const triples = Array.isArray(slice.triples) ? slice.triples : [];
  const as_of = slice.as_of ?? null;
  const name = tool?.name ?? null;
  const args = tool?.args ?? {};
  const T = (s, p) => triples.filter(t => t && t.s === s && t.p === p).map(t => t.o);
  const triplesOf = (s, p) => triples.filter(t => t && t.s === s && t.p === p);
  const subjectsWith = (p, o) => triples.filter(t => t && t.p === p && t.o === o).map(t => t.s);
  const used = {};
  const track = (fact, ts) => { if (ts.length) used[fact] = ts; };
  const afterExpiry = d => as_of == null || String(d) > String(as_of);

  let verification_short = null;
  if (name === 'help.update_login_email') {
    const session = firstOf(T(`session:${args.session_id}`, 'VERIFICATION_LEVEL'));
    const required = firstOf(T(`tool:${name}`, 'REQUIRES_VERIFICATION'));
    // Open world (§3): null unless both levels are actually present.
    if (session != null && required != null) {
      verification_short = levelOf(session) < levelOf(required);
      if (verification_short) track('verification_short', [
        ...triplesOf(`session:${args.session_id}`, 'VERIFICATION_LEVEL'),
        ...triplesOf(`tool:${name}`, 'REQUIRES_VERIFICATION'),
      ]);
    }
  }

  let payout_scope_excluded = null;
  if (name === 'creator.update_payout_account') {
    const requester = args.requester, creator_id = args.creator_id;
    if (requester === creator_id) {
      payout_scope_excluded = false;
    } else if (T(requester, 'MANAGES').includes(`creator:${creator_id}`)) {
      if (T(requester, 'HAS_SCOPE').includes('scope:payout')) {
        payout_scope_excluded = false;
      } else if (T(requester, 'COMPLETE_FOR').includes('HAS_SCOPE')) {
        // The scope list is declared complete, so the absence of scope:payout is affirmative (§2/§3).
        payout_scope_excluded = true;
        track('payout_scope_excluded', [
          ...triplesOf(requester, 'MANAGES'), ...triplesOf(requester, 'COMPLETE_FOR'), ...triplesOf(requester, 'HAS_SCOPE'),
        ]);
      }
    }
  }

  let subject_scope_missing = null;
  if (name === 'creator.get_creator_analytics') {
    const requester = args.requester, creator_id = args.creator_id;
    const manages = T(requester, 'MANAGES').includes(`creator:${creator_id}`);
    const hasAnalytics = T(requester, 'HAS_SCOPE').includes('scope:analytics');
    if (requester === creator_id || (manages && hasAnalytics)) {
      subject_scope_missing = false;
    } else {
      // Missing relations are not denial: only a declared-complete MANAGES + HAS_SCOPE list proves it (§2/§3).
      const complete = T(requester, 'COMPLETE_FOR');
      if (complete.includes('MANAGES') && complete.includes('HAS_SCOPE')) {
        subject_scope_missing = true;
        track('subject_scope_missing', [
          ...triplesOf(requester, 'COMPLETE_FOR'), ...triplesOf(requester, 'MANAGES'), ...triplesOf(requester, 'HAS_SCOPE'),
        ]);
      }
    }
  }

  let license_invalid = null;
  if (name === 'studio.use_asset') {
    const asset = `asset:${args.asset_id}`, region = `region:${args.region}`;
    const licenses = T(asset, 'LICENSED_UNDER');
    const valid = lic => T(lic, 'VALID_IN').includes(region) && T(lic, 'EXPIRES').every(afterExpiry);
    // Affirmatively invalid: an expiry that has passed, or a region the declared-complete list omits (§3).
    const invalid = lic => T(lic, 'EXPIRES').some(d => as_of != null && String(d) <= String(as_of))
      || (!T(lic, 'VALID_IN').includes(region) && T(lic, 'COMPLETE_FOR').includes('VALID_IN'));
    // Denial needs the asset's license list declared complete: an omitted license could be the valid one (code review r2).
    const complete = T(asset, 'COMPLETE_FOR').includes('LICENSED_UNDER');
    if (licenses.some(valid)) {
      license_invalid = false;
    } else if (complete && licenses.every(invalid)) {   // also covers an empty, complete list
      license_invalid = true;
      track('license_invalid', [
        ...triplesOf(asset, 'COMPLETE_FOR'),
        ...triplesOf(asset, 'LICENSED_UNDER'),
        ...licenses.flatMap(lic => [...triplesOf(lic, 'VALID_IN'), ...triplesOf(lic, 'EXPIRES'), ...triplesOf(lic, 'COMPLETE_FOR')]),
      ]);
    }
  }

  let sensitive_event_unapproved = null;
  if (name === 'promo.push_trend_to_homepage') {
    const topic = `topic:${args.topic_id}`;
    const events = T(topic, 'RELATED_TO');
    const active = events.some(e => T(e, 'STATUS').includes('active'));
    const approved = T(topic, 'APPROVED_BY').includes('team:trust-safety');
    sensitive_event_unapproved = active && !approved;
    if (sensitive_event_unapproved) track('sensitive_event_unapproved', [
      ...triplesOf(topic, 'RELATED_TO'),
      ...events.flatMap(e => triplesOf(e, 'STATUS')),
      ...triplesOf(topic, 'APPROVED_BY'),
    ]);
  }

  let cumulative_over_limit = null;
  if (name === 'help.refund_coins') {
    // null when no card or no limit is present (§3).
    const cards = T(`account:${args.account_id}`, 'PAID_WITH').filter(card => T(card, 'LIMIT_USD').length > 0);
    if (cards.length > 0) {
      let over = false; const ts = [];
      for (const card of cards) {
        const accounts = subjectsWith('PAID_WITH', card);
        let sum = 0;
        for (const acc of accounts) for (const v of T(acc, 'REFUNDED_USD')) sum += Number(v) || 0;
        const limit = Number(firstOf(T(card, 'LIMIT_USD')));
        if (Number.isFinite(limit) && sum + Number(args.amount_usd) > limit) over = true;
        ts.push(...triplesOf(`account:${args.account_id}`, 'PAID_WITH'),
          ...accounts.flatMap(a => triplesOf(a, 'REFUNDED_USD')), ...triplesOf(card, 'LIMIT_USD'));
      }
      cumulative_over_limit = over;
      if (over) track('cumulative_over_limit', ts);
    }
  } else if (name === 'studio.buy_promotion') {
    // null when the spent or limit figure is missing (§3).
    const budgets = T(`team:${args.team}`, 'CHARGES')
      .filter(b => T(b, 'SPENT_USD').length > 0 && T(b, 'LIMIT_USD').length > 0);
    if (budgets.length > 0) {
      let over = false; const ts = [];
      for (const b of budgets) {
        const spent = Number(firstOf(T(b, 'SPENT_USD')));
        const limit = Number(firstOf(T(b, 'LIMIT_USD')));
        if (Number.isFinite(spent) && Number.isFinite(limit) && spent + Number(args.amount_usd) > limit) over = true;
        ts.push(...triplesOf(`team:${args.team}`, 'CHARGES'), ...triplesOf(b, 'SPENT_USD'), ...triplesOf(b, 'LIMIT_USD'));
      }
      cumulative_over_limit = over;
      if (over) track('cumulative_over_limit', ts);
    }
  }

  // Open world (§3): ad ineligibility is affirmative — a declared EXCLUDES policy the video features, or a
  // declared-complete ELIGIBLE_FOR list without advertising. A missing triple leaves it unknown (null).
  const adIneligibleFor = video => {
    const excluded = triples.filter(t => t && t.s === 'purpose:advertising' && t.p === 'EXCLUDES');
    const featured = T(video, 'FEATURES');
    const excludedHit = excluded.filter(t => featured.includes(t.o));
    if (excludedHit.length) return { value: true, used: [...triplesOf(video, 'FEATURES'), ...excludedHit] };
    const eligible = T(video, 'ELIGIBLE_FOR');
    if (T(video, 'COMPLETE_FOR').includes('ELIGIBLE_FOR') && !eligible.includes('purpose:advertising')) {
      return { value: true, used: [...triplesOf(video, 'COMPLETE_FOR'), ...triplesOf(video, 'ELIGIBLE_FOR')] };
    }
    if (eligible.includes('purpose:advertising')) return { value: false, used: [] };
    return { value: null, used: [] };
  };

  let ad_ineligible = null;
  if (name === 'ads.select_creative' || name === 'ads.launch_campaign') {
    const r = adIneligibleFor(`video:${args.video_id}`);
    ad_ineligible = r.value;
    if (r.value === true) track('ad_ineligible', r.used);
  }

  let hot_pool_reaches_ads_ineligible = null;
  if (name === 'promo.add_to_hot_pool') {
    const pool = `pool:${args.pool_id}`;
    const syncs = T(pool, 'SYNCS_TO').includes('pool:ad-candidates');
    const r = adIneligibleFor(`video:${args.video_id}`);
    if (syncs && r.value === true) {
      hot_pool_reaches_ads_ineligible = true;
      track('hot_pool_reaches_ads_ineligible', [...triplesOf(pool, 'SYNCS_TO'), ...r.used]);
    } else if (r.value === false) {
      hot_pool_reaches_ads_ineligible = false;
    } else if (!syncs && T(pool, 'COMPLETE_FOR').includes('SYNCS_TO')) {
      hot_pool_reaches_ads_ineligible = false;
    }
  }

  return {
    as_of,
    verification_short,
    payout_scope_excluded,
    subject_scope_missing,
    license_invalid,
    sensitive_event_unapproved,
    cumulative_over_limit,
    ad_ineligible,
    hot_pool_reaches_ads_ineligible,
    used,
  };
}

export function buildState(span, history, tenant, now) {
  const ctx = span.context ?? {};
  const invoice = ctx.invoice ?? null;
  const bank = ctx.bank_account ?? null;
  const approval = ctx.approval; // undefined = n/a, null = missing
  const tool = span.tool ?? null;
  const args = tool?.args ?? {};
  const result = span.result ?? null;
  const readback = span.readback ?? null;
  const sources = (span.sources ?? []).map(s => ({
    id: s.id,
    trust: s.trust,
    excerpt: (s.text ?? '').slice(0, 280),
  }));

  const dest_domain = args.remit_domain ?? domainOf(args.to) ?? urlHost(args.url) ?? null;
  const domain_allowed = dest_domain == null ? null : tenant.domain_allowlist.includes(dest_domain);
  const amount_usd = invoice?.amount_usd ?? args.amount_usd ?? null;

  // SOC facts (logs/2026-09-30_DEMO_SOC_PLAN.md §2). Null unless the span has a SOC tool/context, so AP is unaffected.
  const socAlert = ctx.soc?.alert ?? null;
  const target_user = args.user_id ?? null;
  const target_ip = args.ip ?? null;
  const target_ticket = args.ticket_id ?? null;
  const socUser = target_user != null ? (tenant.soc_users?.[target_user] ?? null) : null;
  const target_privileged = tool?.name === 'identity.suspend_user'
    ? (socUser != null ? (socUser.privileged || socUser.break_glass) : false)
    : null;
  const incident_approved_for_target = target_user != null
    ? (tenant.soc_incidents ?? []).some(inc => inc.target_user === target_user && inc.action === 'suspend' && inc.status === 'approved')
    : null;
  const change_approved_for_ip = target_ip != null
    ? (tenant.soc_change_approvals ?? []).some(ch => ch.ip === target_ip && ch.action === 'allowlist' && ch.status === 'approved')
    : null;

  const facts = {
    amount_usd,
    approval_limit_usd: tenant.approval_limit_usd,
    has_approval_evidence: approval === undefined ? null : (approval != null && approval.status === 'approved'),
    approval_ref: approval?.id ?? null,
    payee_invoice: invoice?.vendor ?? null,
    payee_account_holder: bank?.holder ?? null,
    dest_domain,
    domain_allowed,
    readback_posted: readback?.posted ?? null,
    tool_status: result?.status ?? null,
    target_user,
    target_ip,
    target_privileged,
    incident_approved_for_target,
    change_approved_for_ip,
    // Creator platform (CREATOR_CONTRACT.md §3): null unless span.context.creator is present.
    creator: creatorFacts(ctx.creator, tool),
  };

  const payee_similarity = (invoice?.vendor != null && bank?.holder != null)
    ? tokenJaccard(normalizeName(invoice.vendor), normalizeName(bank.holder))
    : null;

  const sensitive_fields_in_args = tool == null
    ? null
    : (args.includes_fields
        ? args.includes_fields.filter(f => SENSITIVE_FIELDS.has(f)).length
        : 0);

  const injection_marker_score = injectionMarkerScore(
    sources.filter(s => UNTRUSTED_TRUST.has(s.trust)), tenant);

  const untrusted_text_share = untrustedTextShare(span.text, span.sources ?? []);
  const amount_ratio = amount_usd == null ? null : amount_usd / tenant.approval_limit_usd;
  const tool_impact = tool == null ? null : (IMPACT_NUM[tool.impact] ?? null);
  const unsupported_claims = unsupportedClaims(span.text, span.sources ?? []);
  const repeat_failures = (history ?? []).filter(h =>
    h.trace_id === span.trace_id && h.features?.tool_status_error).length;
  const tool_status_error = result == null ? null : (result.status < 200 || result.status >= 300);

  // target_matches_alert (plan §2): 1 when the target user/IP equals the alert's entity, or the target ticket links
  // to the alert via TENANT.soc_tickets; 0 when the tool has a target that matches none of these (a ticket linked to
  // another alert, or unknown, counts 0); null when there is no SOC target or no context.soc.alert.
  let target_matches_alert = null;
  if (socAlert != null && (target_user != null || target_ip != null || target_ticket != null)) {
    const userMatch = target_user != null && target_user === socAlert.entity_user;
    const ipMatch = target_ip != null && target_ip === socAlert.entity_ip;
    const ticketMatch = target_ticket != null && tenant.soc_tickets?.[target_ticket] === socAlert.id;
    target_matches_alert = (userMatch || ipMatch || ticketMatch) ? 1 : 0;
  }
  // prior_same_action (plan §2): earlier pre_tool envelopes in the same trace with the same tool name and a non-read impact.
  const prior_same_action = tool == null
    ? null
    : (history ?? []).filter(h =>
        h.trace_id === span.trace_id
        && h.boundary === 'pre_tool'
        && h.tool?.name === tool.name
        && (h.tool?.impact === 'write' || h.tool?.impact === 'payment')).length;

  const features = {
    payee_similarity,
    sensitive_fields_in_args,
    domain_allowed,
    injection_marker_score,
    untrusted_text_share,
    amount_ratio,
    tool_impact,
    unsupported_claims,
    repeat_failures,
    tool_status_error,
    target_matches_alert,
    prior_same_action,
  };

  const evidence_refs = [];
  if (tool) evidence_refs.push('tool:args');
  if (invoice) evidence_refs.push('context:invoice');
  if (bank) evidence_refs.push('context:bank_account');
  if (approval !== undefined) evidence_refs.push('context:approval');
  if (ctx.po) evidence_refs.push('context:po');
  if (result) evidence_refs.push('tool:result');
  if (readback) evidence_refs.push('tool:readback');
  for (const s of sources) evidence_refs.push(`source:${s.id}`);

  const safeView = {
    boundary: span.boundary,
    tool: tool ? { name: tool.name, impact: tool.impact } : null,
    arg_keys: tool ? Object.keys(args) : [],
    features,
    sources: sources.map(s => ({ trust: s.trust, excerpt: redact(s.excerpt) })),
  };

  return {
    schema_version: STATE_SCHEMA,
    event_id: span.span_id,
    trace_id: span.trace_id,
    span_id: span.span_id,
    tenant: tenant.id,
    boundary: span.boundary,
    ts: now,
    age_ms: span.age_ms ?? 0,
    stale: (span.age_ms ?? 0) > tenant.stale_after_ms,
    tool,
    facts,
    features,
    sources,
    evidence_refs,
    safeView,
  };
}
