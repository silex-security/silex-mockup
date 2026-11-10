// Dev route #/kit: every shared widget once, for visual checks against the N1 to N3 reference screens.
import { h } from '../components/dom.js';
import { icon, appIcon, ICON_NAMES, APP_NAMES } from '../components/icons.js';
import * as ui from '../components/ui.js';

const row = (...kids) => h('div', { class: 'gym-row' }, kids);
const block = (title, ...kids) => h('div', { class: 'gym-stack', dataset: { kit: title } }, h('h3', { class: 'gym-muted', style: { fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.06em' } }, title), kids);

export function mount(root, ctx) {
  const out = h('span', { class: 'gym-muted', dataset: { kitOut: '' } }, 'Nothing pressed yet.');
  const say = text => { out.textContent = text; ctx.announce(text); };
  const tabsDemo = variant => ui.tabs({
    variant, label: `${variant} tabs`, value: ctx.router.current().query[variant] || 'topology', focusKey: `kit:${variant}`,
    items: [{ id: 'topology', label: 'Topology' }, { id: 'tools', label: 'Tools' }, { id: 'data', label: 'Data' }, { id: 'permissions', label: 'Permissions', icon: 'shield' }],
    onChange: id => ctx.router.replaceQuery({ [variant]: id }),
  });

  root.append(
    ui.pageHeader({
      title: 'UI kit', subtitle: 'Every shared widget once. Compare with the reference screens.',
      breadcrumb: [{ label: 'Agent Gym', href: ctx.router.href('workbench', { experimentId: 'exp-029' }) }, { label: 'Dev' }, { label: 'UI kit' }],
      actions: [ui.button({ label: 'Save draft' }), ui.button({ label: 'Validate environment', variant: 'primary' })],
      meta: [ui.textInput({ value: 'Sales operations', icon: 'pencil', ariaLabel: 'Environment name' }), ui.badge({ status: 'draft' })],
    }),
    ui.columns({
      template: '26fr 46fr 26fr',
      children: [
        ui.panel({
          title: 'Buttons and status', subtitle: 'Actions, badges and chips.',
          children: h('div', { class: 'gym-stack' },
            block('Buttons',
              row(ui.button({ label: 'Run simulation', variant: 'primary', icon: 'play', onClick: () => say('Primary pressed') }), ui.button({ label: 'Save experiment', icon: 'save', onClick: () => say('Secondary pressed') })),
              row(ui.button({ label: 'Create', variant: 'outline', icon: 'plus', size: 'sm' }), ui.button({ label: 'Compare changes', variant: 'ghost', icon: 'sliders' }), ui.button({ label: 'View results', variant: 'link', iconRight: 'arrow-right' })),
              row(ui.button({ label: 'Save as template', disabled: true, reason: 'Validate the environment first.' }), ui.button({ label: 'Delete', variant: 'danger', size: 'sm' }), ui.button({ label: 'Large', variant: 'primary', size: 'lg' })),
              row(ui.iconButton({ icon: 'undo', label: 'Undo' }), ui.iconButton({ icon: 'redo', label: 'Redo', disabled: true, reason: 'Nothing to redo.' }), ui.iconButton({ icon: 'x', label: 'Close', variant: 'ghost' }), ui.iconButton({ icon: 'send', label: 'Send', variant: 'primary' }), ui.iconButton({ icon: 'pencil', label: 'Edit', variant: 'ghost', size: 'sm' }))),
            block('Status badges', row(Object.keys(ui.STATUS).map(status => ui.badge({ status }))), row(ui.badge({ label: 'From Speedrun', tone: 'violet' }), ui.badge({ label: 'Timeout injection', tone: 'amber' }))),
            block('Chips',
              row(ui.chip({ label: 'CRM' }), ui.chip({ label: 'Email', icon: 'mail' }), ui.chip({ label: 'Model', tone: 'violet' }), ui.chip({ label: 'Email requires approval', tone: 'amber', icon: 'alert' }), ui.chip({ label: 'Database: read only', tone: 'green', icon: 'check' })),
              row(ui.chip({ label: 'Tool dependencies', onClick: () => say('Chip pressed') }), ui.chip({ label: 'Rephrasing', selected: true, onClick: () => {} }), ui.chip({ label: 'Removable', onRemove: () => say('Chip removed') })),
              row(ui.appChip({ app: 'salesforce', label: 'Salesforce' }), ui.appChip({ app: 'gmail', label: 'Gmail', caret: true, onClick: () => say('App chip pressed') }), ui.appChip({ app: 'gcal', label: 'Google Calendar' }), ui.appChip({ app: 'customdb', label: 'Customer DB' })))),
        }),
        ui.panel({
          title: 'Environment preview', subtitle: 'Tabs, cards, notices and progress.',
          actions: [ui.iconButton({ icon: 'undo', label: 'Undo' }), ui.button({ label: 'Add component', variant: 'outline', icon: 'plus' })],
          children: h('div', { class: 'gym-stack' },
            row(tabsDemo('segmented'), tabsDemo('pill')),
            tabsDemo('solid'),
            h('div', { class: 'gym-row', style: { alignItems: 'stretch' } },
              ui.card({ class: 'kit-card', children: [row(appIcon('salesforce', { size: 34 }), h('strong', 'Salesforce')), h('p', { class: 'gym-muted' }, 'CRM · Customer relationship management'), ui.badge({ status: 'simulated' })] }),
              ui.card({ class: 'kit-card', selected: true, children: [row(appIcon('gmail', { size: 34 }), h('strong', 'Gmail')), h('p', { class: 'gym-muted' }, 'Email sending and message management'), ui.badge({ status: 'simulated' })] }),
              ui.card({ class: 'kit-card', onClick: () => say('Card pressed'), children: [row(appIcon('customdb', { size: 34 }), h('strong', 'Customer DB')), h('p', { class: 'gym-muted' }, 'A card that is one button'), ui.badge({ status: 'ready' })] })),
            ui.notice({ tone: 'warning', text: '1 behavior assumption needs confirmation' }),
            ui.notice({ tone: 'info', title: 'Agent context', children: row(ui.chip({ label: 'Tool dependencies' }), ui.chip({ label: 'Approval requirement' })) }),
            ui.notice({ tone: 'error', title: 'Dependencies missing.', text: 'email.send_email is not enabled.', actions: ui.button({ label: 'Fix', size: 'sm' }) }),
            ui.notice({ tone: 'success', text: 'Dependencies matched', onDismiss: () => say('Notice dismissed') }),
            ui.progress({ value: 12, max: 18, label: 'Sales follow-up · Variant A', text: '12/18' }),
            ui.emptyState({ icon: 'layers', title: 'No scenarios selected', text: 'Pick at least one scenario to run this experiment.', action: ui.button({ label: 'Create', variant: 'outline', icon: 'plus', size: 'sm' }) }),
            block('App marks', row(APP_NAMES.map(app => h('span', { class: 'gym-chip', title: app }, appIcon(app, { size: 20 }), app)))),
            block('Icons', h('div', { class: 'gym-row' }, ICON_NAMES.map(name => h('span', { title: name, style: { display: 'inline-grid', placeItems: 'center', width: '30px', height: '30px' } }, icon(name, { size: 20 })))))),
        }),
        ui.panel({
          title: 'Gmail', subtitle: 'Component settings', icon: appIcon('gmail', { size: 26 }),
          actions: ui.iconButton({ icon: 'x', label: 'Close', variant: 'ghost' }),
          children: h('div', { class: 'gym-stack' },
            ui.textInput({ label: 'Name', value: 'Gmail simulator', focusKey: 'kit:name' }),
            ui.select({ label: 'Mode', value: 'simulated', options: [{ value: 'simulated', label: 'Simulated' }] }),
            h('div', { class: 'gym-stack', style: { gap: '4px' } }, h('span', { class: 'gym-field__label' }, 'Available tools'),
              ui.checkbox({ label: 'search_messages', checked: true }), ui.checkbox({ label: 'send_email', checked: true }), ui.checkbox({ label: 'get_send_status' }),
              ui.checkbox({ label: 'delete_message', disabled: true, reason: 'Not part of this simulated component.' })),
            ui.select({ label: 'Failure behavior', value: 'timeout_after_send', hint: 'Available for scenario injection.', options: [{ value: 'none', label: 'None' }, { value: 'timeout_after_send', label: 'Timeout after send' }] }),
            ui.textInput({ label: 'Adapter', value: '', placeholder: 'custom-adapter', error: 'Name the adapter to continue.' }),
            ui.searchField({ placeholder: 'Search environments…' }),
            ui.textarea({ label: 'Original prompt', value: 'Draft a follow-up to Alex at Acme. Ask me to approve before sending.', rows: 2 }),
            row(
              ui.popoverMenu({ label: 'Scenario actions', trigger: { label: 'More', iconRight: 'chevron-down', focusKey: 'kit:menu' }, items: [
                { heading: 'Scenario' }, { label: 'Duplicate', icon: 'copy', onSelect: () => say('Duplicate chosen') },
                { label: 'Move up', icon: 'arrow-up', disabled: true, reason: 'Already first.' }, { separator: true },
                { label: 'Remove', icon: 'trash', danger: true, onSelect: () => say('Remove chosen') }] }),
              ui.button({ label: 'Open dialog', focusKey: 'kit:dialog', onClick: async () => say((await ui.confirmDialog({ title: 'Apply changes?', message: 'The preview updates. You can undo this.', confirmLabel: 'Apply changes' })) ? 'Dialog confirmed' : 'Dialog cancelled') })),
            row(ui.button({ label: 'Reset changes', class: 'gym-spacer' }), ui.button({ label: 'Apply changes', variant: 'primary', class: 'gym-spacer' })),
            out),
        }),
      ],
    }),
    ui.footerBar({
      lead: [row(ui.badge({ label: '3 components ready', tone: 'green', icon: 'check-circle' }), ui.badge({ label: '1 assumption to confirm', tone: 'amber', icon: 'alert' })), h('p', { class: 'gym-muted' }, 'Validate tool schemas, relationships and state behavior.')],
      actions: [ui.button({ label: 'Save as template', size: 'lg', disabled: true, reason: 'Validate the environment first.' }), ui.button({ label: 'Validate environment', variant: 'primary', size: 'lg' })],
    }));
  return { update() {}, destroy() { root.replaceChildren(); } };
}
