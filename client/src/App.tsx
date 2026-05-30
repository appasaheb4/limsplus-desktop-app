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
import { useCallback, useEffect, useState } from 'react';
import type { DesktopActivationProfile } from './modules/license-activation/desktop-activation-profile.types';
import {
  activationProfileLabel,
  extractLocalLoginCompanyCode,
  hasActivationProfileContent,
} from './modules/license-activation/desktop-activation-profile.types';
import {
  refreshLocalLoginCompanyFromStore,
  setLocalLoginCompanyCode,
} from './runtime/local-login-company';

const { ipcRenderer } = window.require('electron');

type DashboardWithWelcomeProps = {
  activationProfile: DesktopActivationProfile | null;
};

function DashboardWithWelcome({ activationProfile }: DashboardWithWelcomeProps) {
  const companyName = activationProfileLabel(activationProfile);

  return (
    <div className='flex min-h-screen w-full flex-col'>
      <header className='w-full border-b border-neutral-200 bg-neutral-100 px-4 py-3 text-base font-semibold text-neutral-900'>
        {companyName ? `Welcome ${companyName}` : 'Welcome'}
      </header>
      <Home activationProfile={activationProfile} />
    </div>
  );
}

function App() {
  const [licenseReady, setLicenseReady] = useState<
    'checking' | 'required' | 'activated'
  >('checking');
  const [activationProfile, setActivationProfile] =
    useState<DesktopActivationProfile | null>(null);

  const loadActivationProfile = useCallback(async () => {
    try {
      const stored = (await ipcRenderer.invoke(
        'get-activation-profile',
      )) as DesktopActivationProfile | null;
      const profile = hasActivationProfileContent(stored) ? stored : null;
      setActivationProfile(profile);
      const code = extractLocalLoginCompanyCode(profile);
      if (code) {
        setLocalLoginCompanyCode(code);
      } else {
        await refreshLocalLoginCompanyFromStore();
      }
    } catch {
      setActivationProfile(null);
    }
  }, []);

  useEffect(() => {
    stores.setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void ipcRenderer
      .invoke('get-license-activation-status')
      .then((res: { activated?: boolean; activationProfile?: unknown }) => {
        if (cancelled) return;
        setLicenseReady(res?.activated ? 'activated' : 'required');
        const profile = res?.activationProfile as DesktopActivationProfile | null;
        const next = hasActivationProfileContent(profile) ? profile : null;
        setActivationProfile(next);
        const code = extractLocalLoginCompanyCode(next);
        if (code) setLocalLoginCompanyCode(code);
        else void refreshLocalLoginCompanyFromStore();
      })
      .catch(() => {
        if (!cancelled) setLicenseReady('required');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onLicenseCleared = () => {
      setLicenseReady('required');
      setActivationProfile(null);
    };
    const onProfileUpdated = (
      _event: unknown,
      next: DesktopActivationProfile | null,
    ) => {
      const profile = hasActivationProfileContent(next) ? next : null;
      setActivationProfile(profile);
      const code = extractLocalLoginCompanyCode(profile);
      if (code) setLocalLoginCompanyCode(code);
      else setLocalLoginCompanyCode(null);
    };
    ipcRenderer.on('license-activation-cleared', onLicenseCleared);
    ipcRenderer.on('activation-profile-updated', onProfileUpdated);
    return () => {
      ipcRenderer.removeListener('license-activation-cleared', onLicenseCleared);
      ipcRenderer.removeListener('activation-profile-updated', onProfileUpdated);
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
        <ActivationKeyGate
          onActivated={() => {
            setLicenseReady('activated');
            void loadActivationProfile();
          }}
        />
      )}
      {licenseReady === 'activated' && (
        <Router>
          <Routes>
            <Route path='/' element={<Navigate to='/dashboard' replace />} />
            <Route path='/login' element={<Navigate to='/dashboard' replace />} />
            <Route
              path='/dashboard'
              element={
                <DashboardWithWelcome activationProfile={activationProfile} />
              }
            />
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
