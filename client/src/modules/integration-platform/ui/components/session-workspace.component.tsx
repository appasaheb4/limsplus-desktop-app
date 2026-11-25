import { useEffect, useState } from 'react';
import { cx } from '../integration-platform.helpers';
import type { WorkspaceView } from '../integration-platform.types';
import type { IntegrationPlatformModel } from '../use-integration-platform';
import { CommunicationLog } from './communication-log.component';
import { Icon, type IconName } from './icon.component';
import { MessageFrame } from './message-frame.component';
import { ParsedMessage } from './parsed-message.component';
import { Menu, useDismiss } from './primitives.component';

const TABS: Array<{ id: WorkspaceView; label: string; icon: IconName }> = [
  { id: 'log', label: '1 Communication log', icon: 'list' },
  { id: 'frame', label: '2 Message frame', icon: 'frame' },
  { id: 'parsed', label: '3 Parsed message', icon: 'parsed' },
  { id: 'all', label: 'All views', icon: 'grid' },
];

export function SessionWorkspace({ model }: { model: IntegrationPlatformModel }) {
  const menuRef = useDismiss(model.menu === 'export', () => model.setMenu(null));
  return (
    <div className='ip-session'>
      <div className='ip-toolbar'>
        <div className='ip-tabs' role='tablist'>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type='button'
              role='tab'
              aria-selected={model.view === tab.id}
              className={cx('ip-tab', model.view === tab.id && 'is-on')}
              onClick={() => model.openView(tab.id)}
            >
              <Icon name={tab.icon} size={14} />
              {tab.label}
            </button>
          ))}
        </div>
        <div className='ip-toolbar-actions'>
          <button type='button' className='ip-btn' onClick={() => model.sendToLims()}>
            <Icon name='send' size={14} /> Send to LIMS
          </button>
          <div className='ip-radios' role='group' aria-label='Send mode'>
            <button
              type='button'
              className={cx(model.sendMode === 'auto' && 'is-on')}
              onClick={() => model.setSendMode('auto')}
            >
              <i className='ip-radio-dot' /> Auto
            </button>
            <button
              type='button'
              className={cx(model.sendMode === 'manual' && 'is-on')}
              onClick={() => model.setSendMode('manual')}
            >
              <i className='ip-radio-dot' /> Manual
            </button>
          </div>
          <button type='button' className='ip-btn' onClick={model.clearLog}>
            <Icon name='trash' size={14} /> Clear log
          </button>
          <div className='ip-menu-wrap' ref={menuRef}>
            <button
              type='button'
              className='ip-btn'
              onClick={() => model.setMenu(model.menu === 'export' ? null : 'export')}
            >
              <Icon name='export' size={14} /> Export <Icon name='chevron' size={14} />
            </button>
            <Menu open={model.menu === 'export'}>
              <button type='button' onClick={() => model.exportLogs('csv')}>Export CSV</button>
              <button type='button' onClick={() => model.exportLogs('json')}>Export JSON</button>
            </Menu>
          </div>
          <button
            type='button'
            className={cx('ip-icon-btn', model.workspaceOpen && 'is-open')}
            aria-expanded={model.workspaceOpen}
            aria-label={model.workspaceOpen ? 'Collapse workspace' : 'Expand workspace'}
            onClick={() => model.setWorkspaceOpen(!model.workspaceOpen)}
          >
            <Icon name='chevron' size={16} />
          </button>
        </div>
      </div>

      <div className='ip-stats'>
        <article className='ip-stat is-live'>
          <strong><i className='ip-dot is-live' /> Listening</strong>
          <em>{model.listening}</em>
        </article>
        <Stat label='Messages received' value={model.stats.received} />
        <Stat label='Sent to LIMS' value={model.stats.sent} />
        <Stat label='ACK sent' value={model.stats.ack} />
        <Stat label='Warnings' value={model.stats.warnings} tone='warn' />
        <Stat label='Errors' value={model.stats.errors} tone='err' />
        <Stat label='Last activity' value={model.stats.lastActivity} tone='time' />
      </div>

      <div className={cx('ip-collapse', !model.workspaceOpen && 'is-shut')}>
        <div className='ip-collapse-inner'>
          <WorkspaceBody model={model} />
        </div>
      </div>
    </div>
  );
}

function WorkspaceBody({ model }: { model: IntegrationPlatformModel }) {
  if (model.view === 'log') return <CommunicationLog model={model} />;
  if (model.view === 'frame') return <MessageFrame model={model} />;
  if (model.view === 'parsed') return <ParsedMessage model={model} detailed />;
  return (
    <div className='ip-workspace is-all'>
      <CommunicationLog model={model} compact />
      <MessageFrame model={model} compact />
      <ParsedMessage model={model} />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'warn' | 'err' | 'time';
}) {
  const numeric = typeof value === 'number';
  return (
    <article className={cx('ip-stat', tone)}>
      <span>{label}</span>
      <strong>{numeric ? <CountUp value={value} /> : value}</strong>
    </article>
  );
}

function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 650);
      const eased = 1 - (1 - progress) ** 3;
      setShown(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{shown}</>;
}
