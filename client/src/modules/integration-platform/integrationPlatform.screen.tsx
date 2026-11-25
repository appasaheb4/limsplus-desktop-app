import { useEffect } from 'react';
import { IntegrationPlatformView } from './ui/integration-platform-view.component';

const IntegrationPlatform = () => {
  useEffect(() => {
    try {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('set-title', 'INTEGRATION PLATFORM');
    } catch {
      /* Browser preview has no Electron bridge. */
    }
  }, []);

  return <IntegrationPlatformView />;
};

export default IntegrationPlatform;
