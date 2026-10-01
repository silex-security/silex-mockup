/* Decision Trace mapping tables (plan §4.1–§4.3, §6 row 1).
   Pure data + pure functions, no React, no store, no DOM. The mapping tables are
   Silex-authored (provenance `silex-mapping`); a step maps to an L3 class only
   when its declared configuration meets the class's definition quoted from the
   ontology. `describePatch` names a candidate's change from its actual ops. */

/* §4.1: Blueprint step -> L3 class, by the ontology's own definitions. */
export function STEP_CLASS(node) {
  if (!node || typeof node !== 'object') return { classId: null, criterion: null, reason: 'Not a step' };
  switch (node.type) {
    case 'agent':
      return { classId: 'ag:planner', criterion: 'The agent step chooses the next action (its outgoing flow) and holds capabilities. Goal decomposition is not asserted.', reason: null };
    case 'tool':
      return { classId: 'ag:tool-reg', criterion: 'A tool step declares its capability and side effect. The transport is not declared, so it is not ag:mcp.', reason: null };
    case 'control':
      if (node.config && (node.config.kind === 'human_approval' || node.config.kind === 'dual_approval'))
        return { classId: 'ag:hitl', criterion: 'config.kind is human_approval or dual_approval.', reason: null };
      if (node.config && node.config.kind === 'policy_gate')
        return { classId: 'ag:guardrail', criterion: 'config.kind is policy_gate.', reason: null };
      return { classId: null, criterion: null, reason: 'The control kind is not declared as a human decision or a policy engine.' };
    case 'outcome':
    case 'prohibited':
      return { classId: 'ag:harness', criterion: 'An outcome is the harness\'s legitimate completion, and a monitor is its prohibited outcome.', reason: null };
    case 'data':
      return { classId: null, criterion: null, reason: 'The declaration (label, sensitivity) does not tell a retriever from a credential broker or a system of record.' };
    case 'trigger':
      return { classId: null, criterion: null, reason: 'An entry point establishes no execution context (sandbox, runtime permissions).' };
    case 'decision':
      return { classId: null, criterion: null, reason: 'A routing rule is not by itself a policy engine.' };
    default:
      return { classId: null, criterion: null, reason: 'Unknown step type.' };
  }
}

/* §4.2: the six scenario families, in TEMPLATE order, each with its law,
   related public threats (with an abstraction limit per link) and its actual
   sampling. "Related" never means the threat was tested. */
export const LAWS = {
  authority: 'A write checks the last agent\'s capability and limit.',
  'approval binding': 'An approval is bound to fields and consumed once; presenting a consumed approval is reuse.',
  idempotency: 'The same customer and order must not be written twice.',
  taint: 'Untrusted input -> injected -> a secret-labelled read -> an external emit.',
};

export const FAMILIES = [
  {
    id: 'below_threshold', law: 'authority',
    related: [
      { threatId: 'owasp:LLM06', limit: 'Only a write that exceeds the policy threshold without a proper approval.' },
      { threatId: 'owaspa:T2', limit: 'Only a write that exceeds the policy threshold without a proper approval.' },
    ],
    sampling: 'One ineligible request (eligible = 0), amount uniform in [lo, hi). It often falls under the workflow\'s routing threshold (a decision\'s condition) and so skips approval. It is a violation only when the scoped write total exceeds the monitor\'s policy threshold t without a proper approval. A generated request need not violate either threshold.',
  },
  {
    id: 'split', law: 'authority',
    related: [
      { threatId: 'owasp:LLM06', limit: 'Only one request split into several writes by tools of one capability.' },
      { threatId: 'owaspa:T2', limit: 'Only one request split into several writes by tools of one capability.' },
    ],
    sampling: 'Amount in [hi, 2·hi). A split takes place only when the request reaches an agent with canSplit. It then makes k = clamp(⌈amount / (0.96·t′)⌉, 2, 10) pieces, where t′ = t if t > 0, else hi (t is the first unauthorized-write monitor\'s threshold, hi the top of its probe range). Because k is capped at 10, a piece can still exceed t′ when amount > 9.6·t′. Splitting guarantees neither an approval bypass nor a violation. The only mechanism is one request split into several writes by tools of one capability.',
  },
  {
    id: 'replay', law: 'approval binding',
    related: [
      { threatId: 'owaspa:T3', limit: 'Only reuse of an earlier approval for a different request.' },
    ],
    sampling: 'Amount in [hi, 2·hi); a second request (eligible = 0) presents the first request\'s approval. The only mechanism is approval reuse. In swm-1.0, T3 is associated with Credential Broker, which Blueprint does not instantiate.',
  },
  {
    id: 'duplicate_submit', law: 'idempotency',
    related: [],
    sampling: 'Amount in [0, t′); the same customer and order are submitted as two requests. A business-outcome failure (double compensation) with no public threat id.',
  },
  {
    id: 'injection_exfil', law: 'taint',
    related: [
      { threatId: 'atlas:AML.T0051', limit: 'Only a scripted injection flag on untrusted input, not crafted content.' },
      { threatId: 'owasp:LLM01', limit: 'Only a scripted injection flag on untrusted input, not crafted content.' },
      { threatId: 'owasp:LLM02', limit: 'Only a secret-labelled read reaching an external emit.' },
    ],
    sampling: 'Amount in [0, t′); the untrusted input carries a scripted injection flag, not crafted content. Disclosure is modelled only as a secret-labelled read reaching an external emit. (AML.T0086, exfiltration through tool invocation, is not related: a different mechanism.)',
  },
  {
    id: 'benign', law: null,
    related: [],
    sampling: 'Normal requests, amount log-uniform in [20, 3000); the objectives baseline.',
  },
];

/* §4.3: describe a candidate's change from its actual patch ops, never by fiat. */
export function describePatch(graph, patch) {
  const byId = new Map((graph.nodes || []).map(n => [n.id, n]));
  const out = [];
  for (const op of patch || []) {
    if (op.op === 'setConfig') {
      if (op.key === 'condition') {
        out.push({ text: `Route "${op.value}" to a human approval`, stepId: op.id, newStep: false, classId: null });
      } else if (op.key === 'binding') {
        out.push({ text: 'Tie the approval to customer, order and amount', stepId: op.id, newStep: false, classId: 'ag:hitl' });
      } else if (op.key === 'singleUse') {
        out.push({ text: 'Make the approval single-use', stepId: op.id, newStep: false, classId: 'ag:hitl' });
      } else if (op.key === 'idempotencyKey') {
        out.push({ text: 'Add an idempotency key to the write tool', stepId: op.id, newStep: false, classId: 'ag:tool-reg' });
      }
    } else if (op.op === 'addNode') {
      const node = op.node;
      if (node.type === 'control') {
        if (node.config && node.config.kind === 'policy_gate' && node.config.action === 'redact') {
          out.push({ text: 'Add a redaction gate before external outcomes', stepId: node.id, newStep: true, classId: 'ag:guardrail' });
        } else {
          out.push({ text: 'Add a human approval', stepId: node.id, newStep: true, classId: 'ag:hitl' });
        }
      } else if (node.type === 'decision') {
        out.push({ text: 'Add a routing decision', stepId: node.id, newStep: true, classId: null });
      }
    } else if (op.op === 'addEdge' && op.edge && op.edge.kind === 'access') {
      // injection variant a: the secret read moves from the agent to a tool
      out.push({ text: 'Move the secret read from the agent to the tool', stepId: op.edge.from.node, newStep: false, classId: null });
    }
  }
  return out;
}

/* A public identifier's official page, or null. */
export function publicUrl(id) {
  if (!id || typeof id !== 'string') return null;
  if (id.startsWith('atlas:')) return `https://atlas.mitre.org/techniques/${id.slice('atlas:'.length)}`;
  if (id.startsWith('owasp:')) return 'https://genai.owasp.org/llm-top-10/';
  if (id.startsWith('owaspa:')) return 'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/';
  return null;
}
