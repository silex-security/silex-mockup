# UX path fixes

**Page:** `index.html` (9/15). These fixes address the issues found in [`SITEMAP.md`](SITEMAP.md).
**Date:** 2026-09-15

**Verification after the fixes:**
- **Click-through test:** 61 checks covering every nav item, the PRD demo story and each fixed path. 0 failures, 0 JavaScript errors.
- **Full re-crawl:** 201 interactive elements. 0 JavaScript errors.
- **Remaining "no reaction" clicks:** only the expected no-ops, meaning a tab or segment that is already selected, and the natural-language textarea.

**Guiding rule for ambiguous cases:** keep the PRD lifecycle intact. A later step can never be reached, approved or registered without the earlier ones, every decision is recorded once, and every screen ends in a next action.

---

## 1. Lifecycle integrity

### 5-A · Reviewing a blueprint recommendation skipped Confirm and Validate
- **Before:** *Review in context* (Policy Review, Executive queue, Overview) opened Blueprint Studio at Optimize, even when the blueprint was still a Draft.
- **Logic now:** the blueprint tracks its progress: furthest step reached, confirmed, validated, decision, registered. *Review in context* opens:
  - **Register**, if the blueprint is already registered;
  - **Decide**, if it was validated and the user had reached Decide, or **Optimize**, if it was validated but not yet decided;
  - otherwise the step still needed (Build, Confirm or Validate), with a message: *"Confirm and validate this blueprint before reviewing its recommendation."*
- **Knock-on:** the blueprint recommendation is not "ready for approval" before validation. On Overview, Policy Review and the Executive queue its status now starts as **Awaiting validation** and only becomes **Ready for approval** when validation completes.

### 5-B · *New Blueprint* after registration led to a finished flow
- **Before:** *＋ New Agentic Blueprint* / *＋ New Blueprint* just showed Blueprint Studio, still on the completed Register step.
- **Logic now:**
  - If the current blueprint is **registered**, *New Blueprint* resets the studio to a fresh **Draft** on Build. The registered workflow stays in the Workflow Library.
  - If a blueprint is **in progress**, it reopens that blueprint at the furthest step reached ("Continuing the blueprint in progress"), so work is not lost.
  - If nothing was started, it opens Build.

### 5-C · Decisions could be repeated; counts drifted
- **Before:** Approve could be clicked again and again, each time lowering Overview's *Policy Decisions* count, even for items that were never in it. A registered workflow could still be rejected from Policy Review.
- **Logic now:**
  - **Pending items:** Overview counts pending decisions as a set of items, not a number. Resolving the same item twice has no effect.
  - **After approval:** Approve, Modify, Reject and Re-run validation are **disabled**, and the decision panel shows the recorded state. That applies to both the blueprint and each incident.
  - **Rejection:** stays reversible. The user returns to the candidates and can decide again.
  - **Register Workflow** is disabled unless the blueprint is approved and not yet registered.

### 5-N · Stage bar was not navigable
- **Logic now:** completed steps in the Blueprint stage bar are clickable, so the user can review them. Steps not yet reached stay inactive.
- **Build after confirmation:** returning to Build shows a note: *"Confirmed v1.0 is locked. Edits here are not saved to v1.0"*, with *Edit as v1.1 draft*.
- **Incident flow bar:** its four steps are now clickable too; they switch the tabs.

---

## 2. Continuity: every decision leads somewhere

### 5-D · Incident approval was a dead end
- **Logic now:** approving an incident recommendation:
  1. marks the policy **Approved** everywhere it is shown;
  2. sets the affected workflow to **Needs Revalidation** and adds one approved policy to it;
  3. adds a *Policy approved* entry to Short-Term Validation's change feed and puts the workflow in its affected list;
  4. shows three next actions: **Open affected workflow →**, **Revalidate workflow**, **Back to queue**.

### 5-E · Overview's blueprint decision opened the wrong step
- **Logic now:** the Overview row uses the same review logic as 5-A.

### 5-G · *Revalidate* always opened the same page
- **Before:** Workflow Detail › *Revalidate* went to Short-Term Validation with a fixed list of three other workflows.
- **Logic now:** *↻ Revalidate* runs **in place on Workflow Detail** for that workflow:
  - three visible steps;
  - a result: *Revalidated*, or *Needs revision* with a link to the related incident;
  - the workflow's lifecycle, last validation, Library row and Short-Term Validation row all update.
- **Same action elsewhere:** *Revalidate workflow* after an incident approval.

### 5-H · A newly deployed workflow was invisible to Short-Term Validation
- **Logic now:** *Mark as deployed* counts as an environment change:
  - the workflow becomes **Deployed** with lifecycle **Needs Revalidation**;
  - a *New deployment* entry is added to the change feed, and the workflow joins the affected list.
- **Short-Term Validation is now generated from state:**
  - Change feed, affected workflows, the "N workflows may be affected" text and the change count are computed.
  - *Revalidate Affected Workflows* processes exactly the workflows still waiting, and reports how many were revalidated and which need revision.
  - The button is disabled when nothing is waiting.

---

## 3. Dead controls

### 4-1 · Incident filters did nothing
- **Logic now:** the seven filter buttons are real dropdowns: Domain, Workflow, Agent, Severity, Status, Type, Time. They combine with the search box and filter both the card and list views.
  - **Status defaults to Open**, because the queue is an operational list. Closed incidents are available under *Status: Closed* or *All statuses*.
  - **Time** uses each incident's age (last 24 hours / 7 days / 30 days / all time).
  - A "*N shown*" counter reflects the result.

### 4-2 / 4-3 · *Recommended control* cards looked clickable
- **Logic now:** cards without a selectable input no longer use the pointer cursor. They are summaries, not controls.

### 4-4 · Inspector *Role* field changed nothing
- **Logic now:** typing a role renames the selected node on the canvas and in the inspector header, and marks the draft as changed ("re-grounding"). The value is remembered when the node is selected again.

### 4-5 · Inspector *Permission scope* and *Credential* changed nothing
- **Logic now:** both are stored on the selected node and shown in the node's footer line ("*scope · credential*"). They are restored when the node is selected again, and the draft is marked as changed.

---

## 4. Consistency

### 5-F · Closed incident still offered approval
- **Logic now:** a closed incident (I-0994) is read-only:
  - all paths show as closed;
  - only the applied control is shown, labelled *Approved · re-validated*;
  - the decision buttons are disabled;
  - the decision panel explains that the control was approved earlier and links to the workflow.

### 5-I · Registered counts differed between Overview and Library
- **Logic now:** the counts are computed from one workflow inventory:
  - Overview: *registered*, *known in the environment*, *deployed*, workflow coverage %, *workflows at risk* and *needing revalidation*;
  - Library: the matching metrics.
  
  Registering, deploying, approving and revalidating update both pages.
  - **Known workflows** = registered + 3 workflows discovered in the environment but not registered.
  - **Workflows at risk** = registered workflows with open risks and a risk level above Low. The Overview link now opens the library filtered to exactly those.

### 5-J · Domain suite names differed
- **Logic now:** Overview uses the Security Model names: *Identity & IT* and *Human Resources*.

### 5-K · *Immediate Validation* card led to Overview
- **Logic now:** Immediate Validation has no page of its own; it happens inside each Blueprint validation and incident. Its card is informational and says so. The card for the current page is also no longer a button. Only the other horizon page stays clickable, marked with →.

### 5-L · List view missed the closed incident
- **Logic now:** the list view includes I-0994, so the card and list views show the same incidents under the same filters.

### 5-M · *Review unregistered workflows* opened the full library
- **Logic now:** the Workflow Library has a **Known · not registered** deployment filter listing the 3 discovered workflows, each with *Start Agentic Blueprint →*. Two entry points open the library with that filter applied:
  - Overview › *3 known workflows not yet registered*;
  - Security Model › Coverage Gaps › *Review*.
  
  A second filter, **At risk**, backs the Overview link from 5-I.

---

## 5. Decisions made where the brief was open

| Question | Choice | Why |
| --- | --- | --- |
| Can a rejected recommendation be approved later? | Yes | Rejection returns to the candidates; the PRD's Reject means "review alternatives", not "close". |
| Can an approved recommendation be changed? | No, not in place | Approval is a recorded human decision. Changing it means a new revision (blueprint) or a new recommendation (incident). |
| What does *New Blueprint* do mid-flow? | Reopens the blueprint in progress | Avoids silently discarding a confirmed or validated draft. |
| Is deployment a change that needs revalidation? | Yes | PRD §31: security validity decays as the environment changes; a first production deployment is the first such change. |
| Does an approved incident policy trigger revalidation? | Yes, the affected workflow is queued | The policy changes the workflow, so its earlier validation is out of date. |
| Default incident status filter | Open | The queue is an operational list; closed incidents remain one filter away. |
| Should *Immediate Validation* get its own page? | No | The PRD defines it as "does the workflow appear safe now", which is already answered inside each validation and incident. |

---

## 6. Files

**silex-mockup:**
- `index.html`: rebuilt page.
- `SITEMAP.md`: audit that found these issues.
- `UX_FIXES.md`: this document.

**Build sources:** the templates, CSS and JS in the `meeting-to-mockup` skill's `examples/0915/`. The click-through steps there cover every fix listed above.
