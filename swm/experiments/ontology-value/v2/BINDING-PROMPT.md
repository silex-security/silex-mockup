# Onboarding binding v2 (one-shot)

Files in this directory: tool-manifest-v2.json (74 tools: name, description, and each agent-visible parameter with its description)
and snapshot.json (an enterprise ontology). Read only these two files.

For EVERY tool write, in binding.json in this directory:
{"version":2,"tools":{"<tool id>":{"effects":[<effect ids>],"params":{"<parameter name>":"<class id or none>"},"reason":"<one line>"}}}
with tool ids and parameter names exactly as in the manifest, every tool and every parameter present, keys sorted.

- effects: the subset of the effect nodes below that a successful call of this tool may cause (possibly empty). Judge from the
  tool description alone.
- params: for each parameter, the ONE ontology class below that the parameter value denotes or identifies (for example the party,
  account, credential, resource or record it names), or "none" if no class fits (for example a date, a free-text title or a count).
- reason: one line citing the tool description.

Judge each tool on its own, as an enterprise onboarding these tools into its ontology would. Validate that the JSON parses and every
id you use appears in the lists below before finishing.

## Effect nodes (allowed effect ids)
- core:core-effect-authority-grant — Authority Grant Effect: An identity gains a right it did not previously hold.
- core:core-effect-authority-removal — Authority removal: An authority, credential or access an identity held is removed or cancelled.
- core:core-effect-configuration-change — Configuration Change Effect: A setting, permission or integration is altered from its approved state.
- core:core-effect-data-disclosure — Data Disclosure Effect: Data reaches a party that was not entitled to see it.
- core:core-effect-data-read — Data Read Effect: Business state changes only in that data was observed.
- core:core-effect-data-write — Data Write Effect: Business state changes because a stored fact was created or updated.
- core:core-effect-record-alteration — Record Alteration Effect: A stored fact is changed in a way that no longer matches the event that produced it.
- core:core-effect-service-disruption — Service Disruption Effect: A business service becomes unavailable or degraded.
- core:financial-value-transfer — Financial-value transfer: Money or equivalent value leaves the enterprise or moves between accounts.

## Classes (allowed class ids, plus "none")
- core:core-account — Account (value or access holding): A named holding of value or access, such as a bank account or a user account.
- core:core-agent — Agent: A goal-directed software actor that reasons and takes steps, alone or handing off to another agent.
- core:core-agent-identity — Agent Identity: The identity an autonomous agent presents when it acts, distinct from the model instance behind it.
- core:core-authenticated-subject — Authenticated Subject: The identity a request is proven to come from after verification, as opposed to one merely asserted.
- core:core-authority — Authority: The right to make a particular decision or cause a particular state change on behalf of the enterprise.
- core:core-authorization-scope — Authorization Scope: The boundary of what an authority permits: which resources, actions and amounts it covers.
- core:core-commitment — Commitment: An obligation to deliver or pay, such as an order, refund or payment run.
- core:core-connector — Connector: A transport or adapter that exposes an external system's capabilities to an agent.
- core:core-consent — Consent: A subject permission that limits whether and how their data or authority may be used.
- core:core-credential — Authentication credential: A secret or token that proves an identity and can be replayed or stolen if mishandled.
- core:core-delegation — Delegation: The act of passing authority to another actor, and the record of how far that authority travelled.
- core:core-entitlement — Access entitlement (general): A granted right or threshold that determines what an identity may do.
- core:core-execution-context — Runtime environment: The sandbox, runtime permissions and resource limits a single run executes inside.
- core:core-external-party — External Party: An actor outside the enterprise boundary whose requests or data the system must treat as untrusted by default.
- core:core-guardrail — Guardrail: A rule or policy engine that decides whether a proposed action may proceed.
- core:core-handoff-channel — Agent hand-off channel: A mechanism through which one agent passes a task and its authority to another.
- core:core-human-gate — Human decision point: A named human decision point that can stop or release an otherwise automatic action.
- core:core-human-user — Human User: A person who authenticates and acts directly, or on whose behalf an agent acts.
- core:core-identity-provider — Identity Provider: A service that issues or brokers the identities and credentials an actor uses.
- core:core-initiative — Initiative: A planned or running enterprise effort with an intended business result.
- core:core-memory — Memory: State an agent carries between steps or across runs, and can later read back.
- core:core-outcome-harness — Outcome Harness: The business constraints and completion conditions an agent process must respect.
- core:core-party — Party: A person or organisation the enterprise deals with, such as a customer or supplier.
- core:core-principal — Principal: An actor that can hold identity, authority and accountability in an enterprise system.
- core:core-prospect — Prospect: A potential counterparty, sale or engagement the enterprise is pursuing but has not yet committed to.
- core:core-provenance — Provenance: The origin and chain of custody of a request, datum or instruction.
- core:core-purpose — Purpose: The stated reason a request is made, which an action must remain consistent with.
- core:core-reasoning-component — Reasoning component: A component that decomposes a goal and selects the next action, without acting on the environment itself.
- core:core-record — Business Record: A stored statement of business fact, such as an invoice, ticket or review.
- core:core-registry — Registry: A maintained index of the tools, capabilities or assets available to a system.
- core:core-request — Request: An instruction or demand that starts a unit of work and should stay attached to its outcome.
- core:core-resource — Resource: A thing of enterprise value, data or capability — including stored records, obligations and holdings — that actions read or change.
- core:core-retrieval — Retrieval Index: A searchable store that selects content to place into an agent context.
- core:core-service-account — Service Account: A non-human identity issued to software or an agent so it can act under its own name.
- core:core-telemetry — Telemetry: The observed record of steps, calls and decisions that later evidence is read from.
- core:core-tool — Callable tool (agent-facing): A callable capability with a defined scope and side effect that an agent can invoke.
- core:core-trust-boundary — Trust Boundary: A line across which the trust level of content or an actor changes and must be re-established.
- core:core-value-flow — Value Flow: The path by which money or another measurable value moves through a process.
