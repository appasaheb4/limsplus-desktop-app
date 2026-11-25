import './integration-platform.css';
import { ConnectionSetup } from './components/connection-setup.component';
import { InstrumentSidebar } from './components/instrument-sidebar.component';
import { InstrumentDetails } from './components/instrument-details.component';
import { PlatformFooter } from './components/platform-footer.component';
import { PlatformHeader } from './components/platform-header.component';
import { SessionWorkspace } from './components/session-workspace.component';
import { useIntegrationPlatform } from './use-integration-platform';

export function IntegrationPlatformView() {
  const model = useIntegrationPlatform();
  return (
    <div className='ip-app'>
      <div className='ip-shell'>
        <InstrumentSidebar model={model} />
        <div className='ip-main'>
          <div className='ip-scroll' key={model.activeSlotId}>
            <PlatformHeader model={model} />
            <InstrumentDetails model={model} />
            <div key={model.connected ? 'live' : 'setup'} className='ip-stage'>
              {model.connected ? (
                <SessionWorkspace model={model} />
              ) : (
                <ConnectionSetup model={model} />
              )}
            </div>
            <PlatformFooter model={model} />
          </div>
        </div>
      </div>
      {model.toast ? (
        <div className='ip-toast' role='status'>
          {model.toast}
        </div>
      ) : null}
    </div>
  );
}
