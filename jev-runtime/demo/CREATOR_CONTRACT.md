# Creator-platform domain: contract (E1)

The `creator` domain of the simulated demo. Plan: `logs/2026-10-10_CREATOR_DOMAIN_FLEET_PLAN.md` (v0.4, unanimous).
Everything here is authored demo data for the fictional tenant **Acme Shorts**. Labels are the author's scenario
labels, not a benchmark, and nothing in this domain is a measurement.

## 1. Agents, teams and tools

| Agent | Team | Tools (impact) |
|---|---|---|
| `trend-scout` | content-ops | `promo.search_posts` (read), `promo.push_trend_to_homepage` (write), `promo.add_to_hot_pool` (write) |
| `help-desk` | cx | `help.lookup_account` (read), `help.update_login_email` (write), `help.refund_coins` (payment) |
| `creator-desk` | creator-success | `creator.get_creator_analytics` (read), `creator.update_payout_account` (payment) |
| `drama-studio` | originals | `studio.use_asset` (write), `studio.buy_promotion` (payment) |
| `ad-curator` | ads | `ads.select_creative` (write) |
| `ad-buyer` | ads | `ads.launch_campaign` (payment) |

Policy: every creator tool is `mode: 'gate'`; read tools `fail: 'open'`, all others `fail: 'closed'`.
No creator tool carries `to`, `url` or `remit_domain` args, so the shared `domain_allowlist` rule never applies.
The AP payment rules (`amount_limit`, `approval_evidence`) apply only to `payments.execute`.

**Exception routing** (`OWNED_BY_TEAM`, the reviewing team for a held or blocked call):

| Tool | Reviewing team |
|---|---|
| `promo.push_trend_to_homepage`, `promo.add_to_hot_pool`, `ads.select_creative`, `ads.launch_campaign` | trust-safety |
| `help.update_login_email` | account-security |
| `help.refund_coins`, `creator.update_payout_account`, `studio.buy_promotion` | payments-risk |
| `creator.get_creator_analytics` | privacy |
| `studio.use_asset` | legal-ip |

## 2. The ontology slice: `span.context.creator`

```js
context.creator = {
  as_of: '2026-10-10',                       // the slice's date (ISO), for time-bounded facts
  triples: [ { s, p, o, grade } , ... ],     // grade: 'declared' | 'observed' | 'inferred'
}
```

Subjects and objects are typed ids `<type>:<id>` (`video:V-881`, `pool:hot`, `scope:payout`, `purpose:advertising`);
`o` may also be a number (USD) or an ISO date string. With `?ontology=0`, `prepareSpan` returns a copy of the span
without `context.creator`; nothing else in the span changes.

**Predicates used:** `VERIFICATION_LEVEL` (session → `L0|L1|L2`), `REQUIRES_VERIFICATION` (tool → level), `MANAGES`
(mcn → creator), `HAS_SCOPE` (mcn → scope), `LICENSED_UNDER` (asset → license), `VALID_IN` (license → region),
`EXPIRES` (license → date), `RELATED_TO` (topic → event), `STATUS` (event → `active|closed`), `APPROVED_BY`
(topic → team), `PAID_WITH` (account → card), `REFUNDED_USD` (account → number), `LIMIT_USD` (card or budget →
number), `SPENT_USD` (budget → number), `CHARGES` (team → budget), `ELIGIBLE_FOR` (video → purpose), `FEATURES`
(video → subject), `SYNCS_TO` (pool → pool), `EXCLUDES` (purpose → subject: a declared policy, e.g.
`purpose:advertising EXCLUDES subject:minor`), `COMPLETE_FOR` (entity → predicate name: the slice lists **every** triple
of that predicate for that subject, as exported from its system of record).

**Open world.** A missing triple is not evidence of absence. A fact that rests on something being absent is derived only
when the slice declares the relevant list complete (`COMPLETE_FOR`); otherwise the fact is `null` (unknown) and no rule
fires. The one deliberate exception is a missing **approval** (`sensitive_event_unapproved`), which holds the call for a
person, as the AP rule `approval_evidence` does.

## 3. Derived facts (`state.facts.creator`)

`state.facts.creator` is `null` when the span has no `context.creator`. Otherwise it is an object with these keys,
each `true`, `false`, or `null` when the tool is not the one the fact is about. `T(s, p)` is the set of `o` for the
slice's triples with that `s` and `p`; ids come from the tool args named below.

| Fact | Tools | Definition |
|---|---|---|
| `verification_short` | `help.update_login_email` | both levels present: level(`T('session:'+args.session_id,'VERIFICATION_LEVEL')`) < level(`T('tool:'+tool,'REQUIRES_VERIFICATION')`), with L0 < L1 < L2; `null` when either level is missing |
| `payout_scope_excluded` | `creator.update_payout_account` | `false` when `args.requester === args.creator_id`; else `null` unless `'creator:'+args.creator_id ∈ T(args.requester,'MANAGES')`; then `true` when `'scope:payout' ∉ T(args.requester,'HAS_SCOPE')` and `'HAS_SCOPE' ∈ T(args.requester,'COMPLETE_FOR')`, `false` when it is present, `null` otherwise |
| `subject_scope_missing` | `creator.get_creator_analytics` | `false` when `args.requester === args.creator_id` or when the requester `MANAGES` the creator and `HAS_SCOPE scope:analytics`; else `true` when `T(args.requester,'COMPLETE_FOR')` contains both `MANAGES` and `HAS_SCOPE`; else `null` |
| `license_invalid` | `studio.use_asset` | over the licenses `L = T('asset:'+args.asset_id,'LICENSED_UNDER')`: `false` when some license is valid (`'region:'+args.region ∈ T(l,'VALID_IN')` and every `EXPIRES` date `> as_of`); `true` when every license is affirmatively invalid (an `EXPIRES` date `<= as_of`, or the region missing while `'VALID_IN' ∈ T(l,'COMPLETE_FOR')`), or when `L` is empty and `'LICENSED_UNDER' ∈ T('asset:'+args.asset_id,'COMPLETE_FOR')`; else `null` |
| `sensitive_event_unapproved` | `promo.push_trend_to_homepage` | some event `e ∈ T('topic:'+args.topic_id,'RELATED_TO')` with `'active' ∈ T(e,'STATUS')`, and `'team:trust-safety' ∉ T('topic:'+args.topic_id,'APPROVED_BY')` (a missing approval holds; see Open world) |
| `cumulative_over_limit` | `help.refund_coins` | card `k ∈ T('account:'+args.account_id,'PAID_WITH')` with a `LIMIT_USD`; `sum` = Σ `REFUNDED_USD` over every account with `PAID_WITH k`; true when `sum + args.amount_usd > T(k,'LIMIT_USD')`; `null` when no card or no limit is present |
| `cumulative_over_limit` | `studio.buy_promotion` | budget `b ∈ T('team:'+args.team,'CHARGES')` with `SPENT_USD` and `LIMIT_USD`; true when `SPENT_USD + args.amount_usd > LIMIT_USD`; `null` when either is missing |
| `ad_ineligible` | `ads.select_creative`, `ads.launch_campaign` | with `v = 'video:'+args.video_id`: `true` when some subject `x ∈ T(v,'FEATURES')` has `x ∈ T('purpose:advertising','EXCLUDES')` (inferred from the declared policy) or when `'ELIGIBLE_FOR' ∈ T(v,'COMPLETE_FOR')` and `'purpose:advertising' ∉ T(v,'ELIGIBLE_FOR')`; else `false` when `'purpose:advertising' ∈ T(v,'ELIGIBLE_FOR')`; else `null` |
| `hot_pool_reaches_ads_ineligible` | `promo.add_to_hot_pool` | `'pool:ad-candidates' ∈ T('pool:'+args.pool_id,'SYNCS_TO')` and the `ad_ineligible` derivation for `args.video_id` is `true`; `false` when either is affirmatively false; else `null` |

`state.facts.creator.used` lists, per true fact, the triples it was derived from, including the `COMPLETE_FOR` and `EXCLUDES` triples it relied on (for the Inspector). `state.facts.creator.as_of` carries the slice date for the `asset_license` reason.

## 4. Rules (pre_tool, positive facts only)

| Rule id | Verdict | Fires when | Pinned reason |
|---|---|---|---|
| `credential_change_verification` | BLOCK | `verification_short === true` | `credential change on a session below the required verification level` |
| `mcn_payout_scope` | BLOCK | `payout_scope_excluded === true` | `agency ${args.requester} manages ${args.creator_id} without payout scope` |
| `cross_principal_read` | BLOCK | `subject_scope_missing === true` | `${args.requester} has no analytics scope over ${args.creator_id}` |
| `asset_license` | BLOCK | `license_invalid === true` | `no valid license for ${args.asset_id} in ${args.region} on ${as_of}` |
| `sensitive_event_push` | HOLD | `sensitive_event_unapproved === true` | `topic ${args.topic_id} is related to an active sensitive event without trust-safety approval` |
| `cumulative_limit` | HOLD | `cumulative_over_limit === true` | `cumulative amount would exceed the limit` |
| `ad_use_eligibility` | BLOCK | `ad_ineligible === true` | `video ${args.video_id} is not eligible for advertising` |
| `latent_ad_path` | HOLD | `hot_pool_reaches_ads_ineligible === true` | `pool ${args.pool_id} syncs to ad candidates and video ${args.video_id} is not eligible for advertising` |

## 5. Scenarios and expected decisions

22 traces, ids `T-CR-<scenario>`. Each scenario has a normal variant `a` and a risk variant `b`. "No creator rule"
means none of the eight rules fires; the final decision of such a span is computed by the engine and pinned in E3.

| Scenario | Agent | Decisive call(s) | ontology=1 | ontology=0 |
|---|---|---|---|---|
| TR1a | trend-scout | `promo.push_trend_to_homepage` (topic unrelated to any event) | no creator rule | no creator rule |
| TR1b | trend-scout | same, topic `RELATED_TO` an active event, no trust-safety approval | HOLD `sensitive_event_push` | no creator rule |
| TR2a | trend-scout | `promo.search_posts` then `promo.push_trend_to_homepage`; posts benign | ALLOW `policy` | no creator rule |
| TR2b | trend-scout | same; a UGC post (trust `tool`) carries an instruction to push a topic | ALLOW `policy` (same with or without ontology) | no creator rule |
| CS1a | help-desk | `help.update_login_email`, session L2 | no creator rule | no creator rule |
| CS1b | help-desk | same, session L0 (new device, recent reset) | BLOCK `credential_change_verification` | no creator rule |
| CS2a | help-desk | `help.refund_coins` within the card limit | no creator rule | no creator rule |
| CS2b | help-desk | same, five accounts `PAID_WITH` one card, sum over the limit | HOLD `cumulative_limit` | no creator rule |
| CR1a | creator-desk | `creator.update_payout_account`, requester is the creator | no creator rule | no creator rule |
| CR1b | creator-desk | same, requester is an agency that `MANAGES` the creator, whose complete `HAS_SCOPE` list lacks `scope:payout` | BLOCK `mcn_payout_scope` | no creator rule |
| CR2a | creator-desk | `creator.get_creator_analytics`, agency with `scope:analytics` | no creator rule | no creator rule |
| CR2b | creator-desk | same, requester is another creator whose `MANAGES` and `HAS_SCOPE` lists are declared complete (and empty) | BLOCK `cross_principal_read` | no creator rule |
| SD1a | drama-studio | `studio.use_asset` twice, license valid throughout | no creator rule (both) | no creator rule |
| SD1b | drama-studio | first call before the license `EXPIRES`, second call after (`as_of` moves) | 1st no creator rule; 2nd BLOCK `asset_license` | no creator rule |
| SD2a | drama-studio | `studio.buy_promotion` three times, within budget | no creator rule (all) | no creator rule |
| SD2b | drama-studio | three buys, each small, the third crosses the budget | 1st, 2nd no creator rule; 3rd HOLD `cumulative_limit` | no creator rule |
| X1Pa | trend-scout | `promo.add_to_hot_pool`, video `ELIGIBLE_FOR` publish and advertising | no creator rule | no creator rule |
| X1Pb | trend-scout | same, video `FEATURES subject:minor`, `ELIGIBLE_FOR` publish only, and the slice carries the policy `purpose:advertising EXCLUDES subject:minor`; then reports "promotion complete" | HOLD `latent_ad_path` | no creator rule |
| X1Ca | ad-curator | pre_input `auto-sync: video entered the ad-candidate pool` (trust `system`), then `ads.select_creative` | no creator rule | no creator rule |
| X1Cb | ad-curator | same, ineligible video | BLOCK `ad_use_eligibility` | no creator rule |
| X1Ba | ad-buyer | `ads.launch_campaign` | no creator rule | no creator rule |
| X1Bb | ad-buyer | same, ineligible video | BLOCK `ad_use_eligibility` | no creator rule |

X1 is the flagship. Its three traces share no runtime history: the cascade link is the declared `SYNCS_TO` and
`ELIGIBLE_FOR` facts, not a cross-trace inference. Its downstream checkpoints are evaluated independently; in a real
execution a source HOLD on X1Pb would stop the later steps.
