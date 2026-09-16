# Demo rewrite plan — from the 9/15 review

**Input:** the 9/15 page-by-page demo review (3 participants, 54 min).
**Target:** the next revision of `index.html`, for tonight's UX sync and tomorrow morning's feedback round.
**Status:** steps 1–6 were applied to `index.html` on 2026-09-15 — see [`CHANGES.md`](CHANGES.md). Steps 7–10 and §4.5 are still open, and §5 still needs confirming.

A note on scope: the review walked through a *different* build of the demo, generated separately. Several of its findings do not apply to this page, which already resolved them. Those are listed in §6 so nobody re-fixes them.

---

## 1. Summary

Seven decisions from the review affect this page. Four are structural and change navigation, which touches every screen. Three are content.

| # | Decision | Scope | Priority |
| --- | --- | --- | --- |
| 1 | Navigation regrouped into **Workspace / Security / Environment** | Sidebar + every page's context | **P0** |
| 2 | `Short-Term` → **Workflow Validation**, `Long-Term` → **System Validation**, the two pages merged into one with tabs | 2 pages → 1 | **P0** |
| 3 | `Security Model` → **World Model**, first item under Environment | 1 page + links | **P0** |
| 4 | The automation ladder (manual → suggested → automatic) comes out of the UI | 1 strip, several mentions | **P0** |
| 5 | World Model Coverage leaves Overview | Overview + World Model | **P0**, see §5 conflict |
| 6 | Validation cadence is enterprise-defined, not hardcoded monthly | 1 page | P1 |
| 7 | Control points shown as **critical outputs only** | Blueprint canvas | P1, design needed |

Two further items are content additions rather than fixes: the booking-approval case (§4.3) and aligning the dashboard with what a CISO already monitors (§4.4).

---

## 2. Navigation (P0)

### Now

| Group | Items |
| --- | --- |
| Workspace | Overview |
| Workflow Security | Agentic Blueprint Studio · Incident Queue · Workflow Library · Policy Review |
| Environment | Short-Term Validation · Long-Term Validation · Security Model |

### After

| Group | Items |
| --- | --- |
| **Workspace** | Overview · Agentic Blueprint Studio · Workflow Library |
| **Security** | Incident Queue · Policy Review |
| **Environment** | **World Model** · Workflow Validation · System Validation |

**The reasoning given:** the operational sequence is pre-deploy → deployment → incident → policy review, and the Workflow Library does not sit on that line — it is a horizontal resource, like a library. Blueprint Studio is the same kind of thing, a place you go to build. So both move to Workspace, and Security narrows to the two screens that are actually reactive: the incident queue and the policy decisions it produces.

**Consequences:**
- The group label `Workflow Security` disappears. `Security` replaces it.
- Sidebar item count drops from 8 to 7. The review's stated threshold was that more than about 10 would need reducing, so there is room.
- The menu label stays **Agentic Blueprint Studio** on two lines, with its icon. Shortening it to `Agentic` was discussed and dropped.
- Every cross-page jump keeps working, since the views themselves are unchanged. Only grouping and order move.

---

## 3. The validation pages (P0)

### 3.1 Rename and merge

The three-tier framing (immediate / short-term / long-term) was called out as unclear — in the review's words, it reads as something written for investors rather than for the operator using the screen. The replacement is a plain distinction:

> **Long-term is system-wise; short-term is workflow-wise.**

Which becomes the product naming:

| Now | After | What it is |
| --- | --- | --- |
| Short-Term Validation | **Workflow Validation** | Change-triggered. A workflow changes, it gets revalidated. |
| Long-Term Validation | **System Validation** | Periodic. The whole enterprise environment and world model. |

**The two pages merge into a single page with two tabs.** Suggested shape:

```
Environment › Validation
  [ Workflow Validation ] [ System Validation ]      ← tabs, Workflow default
```

**Immediate Validation** loses its card. It has no page of its own and never did — it is answered inside each blueprint validation and each incident, which is where it should stay described.

**Remove the horizon strip** (the three `.hz` cards, present on both pages). It exists only to explain the three-tier framing that is being retired. The tabs now carry that job.

### 3.2 The automation ladder comes out

The strip reading `Automation: Manual trigger · V1 → Suggested revalidation · V2 → Automatic revalidation · V3` is removed (`index.html` line 901). The objection was specific: it appears in many places and tells the user about our roadmap, not about the flow they are in. The same wording also sits inside the `?` help text on the Short-Term title and should come out with it.

### 3.3 Cadence

`Monthly` is currently hardcoded as a pill next to *Run Environment Validation* (line 936) and again as `Monthly cadence` in the metric row. The review's position: the period is defined by the enterprise — two weeks, a month, a quarter. Make it a selector with a stated default, rather than a fixed label. The button then reads **Run System Validation**.

### 3.4 Backtest stays

Explicitly kept, with its reasoning recorded: rerun the scenarios that were not covered before, since scenarios, agents and workflows all accumulate over time. No change needed — the *Backtest history* card already does this. It moves under the System Validation tab.

---

## 4. Content changes

### 4.1 World Model Coverage leaves Overview (P0, but see §5)

Today Overview has a `World Model Coverage` card: a single 84% figure, three sub-bars, and a largest-gap note. The review removed it from the overview page for one reason, stated plainly: **it is not actionable.** The user cannot tell what a higher number would let them do, unless they can feel that higher coverage means more secure.

- **Overview:** remove the card. The `two-col` row it shares with *Domain Suites* becomes a single-column row, or Domain Suites widens.
- **World Model page:** the coverage panel already exists there and stays.
- **Coverage Gaps stays** on the World Model page. It survived the cut because it is the one part that does produce an action.

**One distinction worth preserving in the copy,** because the review spent time separating them and the current page blurs them:

| | Question it answers |
| --- | --- |
| **World Model Coverage** | How much of this enterprise's environment do we understand? |
| **Coverage Gap** | Of the failures and attacks, how many do the policies in place cover? |

These are not one chain, though the page currently presents Coverage Gaps as the action arising from World Model Coverage. They compound instead: if the environment is only 60% understood, then even 100% policy coverage leaves a large uncovered remainder. Treat them as two separate readings on the World Model page, not as a funnel.

### 4.2 Ontology layers — no change, and why

The review spent time on whether the ontology tiers are multiplicative (L2 × L3) or additive (each layer building on the last), and left it unresolved, to be settled with the co-founder who owns the model.

**This page is already on the additive side** — the panel reads *Four Tiers Over One Runtime Graph* — which matches the repository's own definition of L1→L4 as successive specialisation. **No change.** If the multiplicative reading wins later, this panel is where it lands. It is a real modelling disagreement, not a drawing error, so it should not be quietly "fixed" in either direction before that conversation happens.

### 4.3 The booking-approval case (P1)

A concrete case from the review, to be worked into the demo: an agent asked repeatedly to book travel, steering around a $500 approval threshold until it obtains a $1,200 booking. This is exactly the shape the *Bind control to cumulative outcome* recommendation already addresses — a control bound to a single request misses the cumulative outcome.

Cheapest place to put it: a second incident in the queue, sharing the existing incident detail layout. It demonstrates a failure the audience recognises immediately, without new UI.

### 4.4 Dashboard framing (P1)

Guidance recorded for Overview: match what CISOs already monitor, then do it better. The specific comparison named was existing log-monitoring consoles. This is a direction for the next Overview pass, not a discrete edit; pending answers from the security-side conversation (§5).

### 4.5 Control points as critical outputs (P1, needs design)

The sharpest challenge in the review was scale: a single production agent can sit behind on the order of a hundred control middlewares — one internal chatbot was described as having fifty to sixty skills and more MCP endpoints than that. The Blueprint canvas today shows control points individually, which does not survive that number.

The direction offered: **treat decisions and control points as critical outputs — surface only the nodes the user needs to decide about.** No concrete design was agreed, and the demo was not changed. Flagged here as the open design problem behind the canvas, not as a ready edit.

Related, and worth stating on the page: agents are expected to be **imported and scanned**, not built on our platform. The current Blueprint Studio reads as a builder. A framing pass on Build — "import a declared agent configuration" rather than "draw one" — would align it, and matches how the product's design-time check is defined internally.

---

## 5. Decide before building

**1. Does the spider chart go to the homepage, or does World Model Coverage leave it?**

Both were agreed in the same review, six minutes apart, and they pull against each other. Early on, the radar chart was called more intuitive and richer and was wanted on the homepage. Later, World Model Coverage — which is what that chart visualises — was cut from Overview for not being actionable.

**Recommendation: the later decision governs.** Take the coverage card off Overview and leave the radar on the World Model page. The alternative reading — the homepage keeps a radar of *security posture* across dimensions, which is a different metric than world-model completeness — is defensible, but nobody said it in those words. Worth one sentence of confirmation before building either.

**2. Is the merged validation page one nav item or two?**

The decision was to merge the pages and use tabs; the new structure still lists both names under Environment. Two readings: one nav item (`Validation`) with two tabs, or two nav items that both open the same page on different tabs. The second keeps both names visible in the sidebar, which is where the naming work pays off. **Recommendation: two nav items, one page, tab preselected.**

**3. Who is this revision for?**

Functionality was repeatedly trimmed by asking whether a CISO would care, while two of the framings were described as being for investors. These two audiences disagree about what counts as useful: one wants every screen to end in an action, the other wants the story to be complete. Worth settling explicitly before the next pass, since it decides several of the cuts above.

---

## 6. Findings that do not apply here

From the review, already true of this page — do not re-fix:

- **Ontology layers** are already additive four tiers, not a product of two dimensions (§4.2).
- **Dead clicks.** The review noted many non-responding elements in the build it walked through. This page was audited separately and every path fixed; see `SITEMAP.md` and `UX_FIXES.md`.
- **Blueprint canvas edges** cannot be hand-drawn between controls here, and the graph is generated rather than free-drawn, so the broken-line problem does not arise in the same form.

---

## 7. Work breakdown

Ordered so that the structural changes land first, since they touch everything else. **Steps 1–6 and 9 are done**; 7, 8 and 10 remain.

| Step | Change | Files |
| --- | --- | --- |
| 1 | Regroup the sidebar; Security replaces Workflow Security; World Model first under Environment | `tpl_shell.html` |
| 2 | Merge the two validation views into one with tabs; rename both; remove the horizon strips | `tpl_env.html`, `js_b.js` |
| 3 | Rename Security Model → World Model everywhere, including definitions and the changes modal | all templates, `js_a.js` |
| 4 | Remove the automation ladder and its help text | `tpl_env.html` |
| 5 | Cadence selector; *Run System Validation* | `tpl_env.html`, `js_b.js` |
| 6 | Remove the World Model Coverage card from Overview; re-lay out the row | `tpl_overview.html`, `css_0915.css` |
| 7 | Separate the two coverage readings on the World Model page | `tpl_env.html` |
| 8 | Add the booking-approval incident | `build_0915.py`, `js_a.js` |
| 9 | Update the click-through steps for the new nav and merged page | `steps_0915.js` |
| 10 | Rewrite this revision's section of `CHANGES.md` | `CHANGES.md` |

Steps 1–6 are mechanical and can go in one pass. Step 7 needs the copy decided, step 8 needs the incident written, and §4.5 needs design work before it becomes a step at all.

**Verification, as with the last revision:** static checks, then the click-through suite, then a full crawl for dead paths. The suite will need updating in step 9 before it can pass — the nav assertions and the two validation views are named in it.
