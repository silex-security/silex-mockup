/* One-line config summary shown on each node card (plan §3.5). */
import { t } from '../i18n/index.js';

export function nodeSummary(n) {
  const c = n.config || {};
  switch (n.type) {
    case 'trigger': return `${t('ch.' + c.channel, (c.channel || '').replace(/_/g, ' '))} · ${t('trust.' + c.trust, c.trust)}`;
    case 'agent': { const caps = (c.capabilities || []).map(x => `${x.cap} ≤ ${x.limit}`).join(', '); return (caps || t('sum.noWrite', 'no write capability')) + (c.canSplit ? ' · ' + t('sum.canSplit', 'can split') : ''); }
    case 'tool': return `${c.cap || '—'} · ${c.sideEffect === 'write' ? t('sum.write', 'writes') : t('sum.readOnly', 'no side effect')}${c.idempotencyKey ? ' · ' + t('sum.idem', 'idempotent') : ''}`;
    case 'decision': return c.condition || t('sum.noCondition', 'no condition yet');
    case 'control': return c.kind === 'policy_gate'
      ? (c.action === 'block' ? t('sum.gateBlock', 'gate · pass if {r}', { r: c.rule || '…' }) : t('sum.gateRedact', 'gate · redact above {l}', { l: c.redactAbove }))
      : `${t('kind.' + c.kind, c.kind.replace('_', ' '))} · ${t('sum.bind', 'bind')} ${(c.binding || []).join('+') || '—'}${c.singleUse ? ' · ' + t('sum.singleUse', 'single-use') : ''}${c.appliesWhen ? ' · ' + t('sum.when', 'when') + ' ' + c.appliesWhen : ''}`;
    case 'data': return t('sens.' + c.sensitivity, c.sensitivity);
    case 'outcome': return `${c.success ? t('sum.success', 'success') : t('sum.notSuccess', 'not success')}${c.external ? ' · ' + t('sum.external', 'sent to requester') : ''}`;
    case 'prohibited': return c.monitor === 'unauthorized_write' ? t('sum.unauth', 'approval required above {x} per {s}', { x: c.threshold, s: t('scope.' + c.scope, c.scope) }) : t('monitor.' + c.monitor + '.label', c.monitor);
    default: return '';
  }
}
