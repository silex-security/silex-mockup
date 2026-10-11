// Hard veto / deterministic path (T1). Evaluated before Jev; a Jev answer can
// never override these (R p.13 "Hard veto 一票否决").

import { LATENCY_BUDGET } from './types.js';
import { hashString } from './rng.js';

const SEVERITY = { STOP: 5, BLOCK: 4, HOLD: 3, ALERT: 2 };

export function checkRules(state, tenant) {
  const hits = [];
  const boundary = state.boundary;
  // Hard payment rules are AP-only: narrowed to `payments.execute` so creator payment-impact tools
  // (refunds, payouts, promotion buys) never inherit the AP amount/approval checks (plan E3).
  const isPayment = state.tool?.name === 'payments.execute';
  const creator = state.facts.creator ?? null;

  if (state.stale) {
    hits.push({ id: 'stale_state', verdict: 'STOP', reason: 'state snapshot is stale', evidence_refs: [] });
  }

  const repeatFailures = state.features.repeat_failures ?? 0;
  if (repeatFailures >= tenant.repeat_failure_n) {
    hits.push({
      id: 'repeat_failure', verdict: 'STOP',
      reason: `${repeatFailures} prior tool failures in this trace`,
      evidence_refs: [],
    });
  }

  if (boundary === 'pre_tool' && isPayment) {
    if (state.facts.amount_usd != null && state.facts.amount_usd > tenant.approval_limit_usd) {
      hits.push({
        id: 'amount_limit', verdict: 'BLOCK',
        reason: `amount ${state.facts.amount_usd} exceeds approval limit ${tenant.approval_limit_usd}`,
        evidence_refs: ['tool:args', 'context:invoice'],
      });
    }
  }

  if (boundary === 'pre_tool' && state.facts.domain_allowed === false) {
    hits.push({
      id: 'domain_allowlist', verdict: 'BLOCK',
      reason: `destination ${state.facts.dest_domain} is not allowlisted`,
      evidence_refs: ['tool:args'],
    });
  }

  if (boundary === 'pre_tool' && isPayment && state.facts.has_approval_evidence !== true) {
    hits.push({
      id: 'approval_evidence', verdict: 'HOLD',
      reason: 'payment requested without approved approval evidence',
      evidence_refs: ['context:approval'],
    });
  }

  // SOC (logs/2026-09-30_DEMO_SOC_PLAN.md §2): code, not policy; the pinned reasons are tested.
  if (boundary === 'pre_tool' && state.tool?.name === 'identity.suspend_user'
    && state.facts.target_privileged === true && state.facts.incident_approved_for_target !== true) {
    hits.push({
      id: 'privileged_suspend_incident', verdict: 'HOLD',
      reason: `suspending privileged account ${state.facts.target_user} without an approved incident`,
      evidence_refs: ['context:soc:incident'],
    });
  }

  if (boundary === 'pre_tool' && state.tool?.name === 'firewall.allowlist_ip'
    && state.facts.change_approved_for_ip !== true) {
    hits.push({
      id: 'allowlist_change_approval', verdict: 'HOLD',
      reason: `allowlisting ${state.facts.target_ip} without an approved change`,
      evidence_refs: ['context:soc:change'],
    });
  }

  if (boundary === 'post_tool'
    && state.facts.tool_status != null
    && state.facts.tool_status >= 200 && state.facts.tool_status < 300
    && state.facts.readback_posted === false) {
    hits.push({
      id: 'readback_mismatch', verdict: 'ALERT',
      reason: 'tool returned 2xx but ERP read-back shows nothing posted',
      evidence_refs: ['tool:result', 'tool:readback'],
    });
  }

  // Creator-platform rules (web/demo/CREATOR_CONTRACT.md §4): pre_tool, positive typed facts only,
  // pinned reasons, evidence_refs ['context:creator']. With ?ontology=0 the slice is gone
  // (facts.creator === null) and none of these can fire.
  if (boundary === 'pre_tool' && creator != null) {
    const args = state.tool?.args ?? {};
    const refs = ['context:creator'];
    if (creator.verification_short === true) {
      hits.push({ id: 'credential_change_verification', verdict: 'BLOCK',
        reason: 'credential change on a session below the required verification level', evidence_refs: refs });
    }
    if (creator.payout_scope_excluded === true) {
      hits.push({ id: 'mcn_payout_scope', verdict: 'BLOCK',
        reason: `${args.requester} manages ${args.creator_id} without payout scope`, evidence_refs: refs });
    }
    if (creator.subject_scope_missing === true) {
      hits.push({ id: 'cross_principal_read', verdict: 'BLOCK',
        reason: `${args.requester} has no analytics scope over ${args.creator_id}`, evidence_refs: refs });
    }
    if (creator.license_invalid === true) {
      hits.push({ id: 'asset_license', verdict: 'BLOCK',
        reason: `no valid license for ${args.asset_id} in ${args.region} on ${creator.as_of}`, evidence_refs: refs });
    }
    if (creator.sensitive_event_unapproved === true) {
      hits.push({ id: 'sensitive_event_push', verdict: 'HOLD',
        reason: `topic ${args.topic_id} is related to an active sensitive event without trust-safety approval`, evidence_refs: refs });
    }
    if (creator.cumulative_over_limit === true) {
      hits.push({ id: 'cumulative_limit', verdict: 'HOLD',
        reason: 'cumulative amount would exceed the limit', evidence_refs: refs });
    }
    if (creator.ad_ineligible === true) {
      hits.push({ id: 'ad_use_eligibility', verdict: 'BLOCK',
        reason: `video ${args.video_id} is not eligible for advertising`, evidence_refs: refs });
    }
    if (creator.hot_pool_reaches_ads_ineligible === true) {
      hits.push({ id: 'latent_ad_path', verdict: 'HOLD',
        reason: `pool ${args.pool_id} syncs to ad candidates and video ${args.video_id} is not eligible for advertising`, evidence_refs: refs });
    }
  }

  let verdict = null;
  for (const h of hits) {
    if (!verdict || SEVERITY[h.verdict] > SEVERITY[verdict]) verdict = h.verdict;
  }

  const latency_ms = rulesLatency(state.span_id);
  return { hits, verdict, latency_ms };
}

// checkRules has no seed in its signature (CONTRACT §3), so its latency is a
// deterministic function of span_id (via hashString) rather than rngFor(seed, …).
function rulesLatency(spanId) {
  const [lo, hi] = LATENCY_BUDGET.rules;
  return lo + (hashString(`${spanId}:rules`) % (hi - lo + 1));
}
