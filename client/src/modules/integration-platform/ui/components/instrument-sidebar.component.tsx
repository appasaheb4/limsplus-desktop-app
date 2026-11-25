import { cx } from '../integration-platform.helpers';
import type { IntegrationPlatformModel } from '../use-integration-platform';
import { Icon } from './icon.component';

export function InstrumentSidebar({ model }: { model: IntegrationPlatformModel }) {
  const open = model.sidebarOpen;
  return (
    <aside className={cx('ip-sidebar', !open && 'is-collapsed')} aria-label='Instruments'>
      <div className='ip-sidebar-brand'>
        <span className='ip-title-icon'>
          <Icon name='beaker' size={16} />
        </span>
        <span className='ip-slot-copy'>
          <b>Instruments</b>
          <small>{model.slots.length} open</small>
        </span>
      </div>

      <nav className='ip-sidebar-list'>
        {model.slots.map((slot) => {
          const active = slot.id === model.activeSlotId;
          return (
            <button
              key={slot.id}
              type='button'
              className={cx('ip-slot', active && 'is-on')}
              title={slot.title}
              aria-current={active ? 'page' : undefined}
              onClick={() => model.selectSlot(slot.id)}
            >
              <span className={cx('ip-slot-mark', slot.named && 'is-named')}>{slot.index}</span>
              <span className='ip-slot-copy' key={slot.title}>
                <b>{slot.title}</b>
                <small>{slot.named ? slot.settings.instrumentType : 'Choose an instrument'}</small>
              </span>
              {slot.connected ? <i className='ip-dot is-live' /> : null}
            </button>
          );
        })}
      </nav>

      <div className='ip-sidebar-foot'>
        <button type='button' className='ip-side-btn' onClick={model.addSlot}>
          <Icon name='plus' size={16} />
          <span className='ip-slot-copy'>Add</span>
        </button>
        <button
          type='button'
          className='ip-side-btn ip-side-toggle'
          aria-expanded={open}
          onClick={() => model.setSidebarOpen(!open)}
        >
          <Icon name={open ? 'arrowLeft' : 'arrowRight'} size={16} />
          <span className='ip-slot-copy'>{open ? 'Collapse' : 'Expand'}</span>
        </button>
      </div>
    </aside>
  );
}
