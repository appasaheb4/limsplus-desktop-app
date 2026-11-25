import { Icon } from './icon.component';
import { Menu, Toggle, useDismiss } from './primitives.component';
import type { IntegrationPlatformModel } from '../use-integration-platform';

export function PlatformHeader({ model }: { model: IntegrationPlatformModel }) {
  const menuRef = useDismiss(model.menu === 'settings', () => model.setMenu(null));
  return (
    <header className='ip-header'>
      <div className='ip-brand'>
        <strong>
          LIMSPLUS <span>Connect</span>
        </strong>
        <em>INTEGRATION PLATFORM</em>
      </div>
      <div className='ip-header-status'>
        <span className={`ip-status-pill ${model.connected ? 'is-on' : ''}`}>
          <i className={`ip-dot ${model.connected ? 'is-live' : 'is-idle'}`} />
          {model.connected ? 'Instrument connected' : 'Instrument not connected'}
        </span>
        <span className='ip-status-pill is-on'>
          <i className='ip-dot is-live' />
          Platform running
        </span>
        <div className='ip-menu-wrap' ref={menuRef}>
          <button
            type='button'
            className='ip-icon-btn'
            aria-label='Platform preferences'
            onClick={() => model.setMenu(model.menu === 'settings' ? null : 'settings')}
          >
            <Icon name='gear' size={16} />
          </button>
          <Menu open={model.menu === 'settings'}>
            <div className='ip-switch-row'>
              <span>Sound on message</span>
              <Toggle on={model.soundOn} label='Sound on message' onChange={model.setSoundOn} />
            </div>
            <button type='button' onClick={model.save}>Save preferences</button>
          </Menu>
        </div>
      </div>
    </header>
  );
}
