import type { IntegrationPlatformModel } from '../use-integration-platform';
import { Icon } from './icon.component';

export function PlatformFooter({ model }: { model: IntegrationPlatformModel }) {
  const { settings } = model;
  const editingSaved = model.sessionSaved && !model.sessionLocked;
  const actionsDisabled = !model.formReady || model.sessionLocked;
  const note = model.connected
    ? `Connected to ${settings.instrumentType} (${settings.instrumentId}). Results are reviewed here before they are sent to the LIMSPLUS result table.`
    : 'Review the settings, then click Connect. LIMS will connect to the instrument and start listening for messages.';
  return (
    <footer className='ip-footer'>
      <p>{note}</p>
      <div className='ip-footer-actions'>
        {editingSaved ? null : (
          <button
            type='button'
            className='ip-btn'
            onClick={model.reset}
            disabled={actionsDisabled}
          >
            <Icon name='reset' size={14} /> Reset
          </button>
        )}
        <button
          type='button'
          className='ip-btn'
          onClick={model.save}
          disabled={actionsDisabled}
        >
          <Icon name='save' size={14} /> Save settings
        </button>
        {model.connected ? (
          <button type='button' className='ip-btn ip-btn-danger' onClick={model.disconnect}>
            <Icon name='plug' size={14} /> Disconnect
          </button>
        ) : (
          <button
            type='button'
            className={cxBusy(model.connecting)}
            onClick={model.connect}
            disabled={model.connecting}
          >
            <Icon name='connect' size={14} />
            {model.connecting ? 'Connecting…' : 'Connect'}
          </button>
        )}
      </div>
    </footer>
  );
}

function cxBusy(busy: boolean) {
  return busy ? 'ip-btn ip-btn-primary is-busy' : 'ip-btn ip-btn-primary';
}
