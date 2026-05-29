import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import Home from './modules/home/home.screen';
import IntegrationGateway from './modules/integration-gateway/integrationGateway.screen';
import ActivationKeyGate from './modules/license-activation/activation-key-gate.component';

import { stores } from './stores';
import { useEffect, useState } from 'react';

const { ipcRenderer } = window.require('electron');

function DashboardWithWelcome() {
  return (
    <div className='flex min-h-screen w-full flex-col'>
      <header className='w-full border-b border-neutral-200 bg-neutral-100 px-4 py-3 text-base font-semibold text-neutral-900'>
        Welcome Admin
      </header>
      <Home />
    </div>
  );
}

function App() {
  const [licenseReady, setLicenseReady] = useState<
    'checking' | 'required' | 'activated'
  >('checking');

  useEffect(() => {
    stores.setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void ipcRenderer
      .invoke('get-license-activation-status')
      .then((res: { activated?: boolean }) => {
        if (cancelled) return;
        setLicenseReady(res?.activated ? 'activated' : 'required');
      })
      .catch(() => {
        if (!cancelled) setLicenseReady('required');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (licenseReady === 'checking') {
    return (
      <div className='flex min-h-screen w-full items-center justify-center bg-[#1a1a1a] text-sm text-gray-400'>
        Loading…
      </div>
    );
  }

  return (
    <div className='flex'>
      {licenseReady === 'required' && (
        <ActivationKeyGate onActivated={() => setLicenseReady('activated')} />
      )}
      {licenseReady === 'activated' && (
        <Router>
          <Routes>
            <Route path='/' element={<Navigate to='/dashboard' replace />} />
            <Route path='/login' element={<Navigate to='/dashboard' replace />} />
            <Route path='/dashboard' element={<DashboardWithWelcome />} />
            <Route
              path='/integration-gateway'
              element={<IntegrationGateway />}
            />
            <Route path='*' element={<Navigate to='/dashboard' replace />} />
          </Routes>
        </Router>
      )}
    </div>
  );
}

export default App;
