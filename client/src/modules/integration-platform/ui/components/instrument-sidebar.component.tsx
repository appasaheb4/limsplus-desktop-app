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
            <div
              key={slot.id}
              role='button'
              tabIndex={0}
              className={cx('ip-slot', active && 'is-on')}
              title={slot.title}
              aria-current={active ? 'page' : undefined}
              onClick={() => model.selectSlot(slot.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  model.selectSlot(slot.id);
                }
              }}
            >
              <span className={cx('ip-slot-mark', slot.named && 'is-named', slot.saved && 'has-lock')}>
                {slot.index}
                {slot.saved ? (
                  <button
                    type='button'
                    className={cx('ip-slot-lock', !slot.locked && 'is-open')}
                    title={slot.locked ? 'Unlock session' : 'Unlocked for editing'}
                    aria-label={
                      slot.locked
                        ? `Unlock instrument ${slot.index}`
                        : `Instrument ${slot.index} is unlocked`
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      model.selectSlot(slot.id);
                      if (slot.locked) model.unlock(slot.id);
                    }}
                  >
                    <Icon name={slot.locked ? 'lock' : 'unlock'} size={10} />
                  </button>
                ) : null}
              </span>
              <span className='ip-slot-copy' key={slot.title}>
                <b>{slot.title}</b>
                <small>{slot.named ? slot.settings.instrumentType : 'Choose an instrument'}</small>
              </span>
              {slot.connected ? <i className='ip-dot is-live' /> : null}
            </div>
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
