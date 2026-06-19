import { useEffect, useState } from 'react';
import type { DesktopActivationProfile } from '../../license-activation/desktop-activation-profile.types';
import {
  activationProfileLabel,
  hasActivationProfileContent,
} from '../../license-activation/desktop-activation-profile.types';
import { service } from '../../../core-services/rest-api';

const { ipcRenderer } = window.require('electron');

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  activationProfile?: DesktopActivationProfile | null;
}

function profileRow(label: string, value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <p key={label} className='text-sm'>
      <span className='font-medium text-gray-300'>{label}: </span>
      <span className='text-white'>{String(value)}</span>
    </p>
  );
}

const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  activationProfile: activationProfileProp = null,
}) => {
  const [profile, setProfile] = useState<DesktopActivationProfile | null>(
    hasActivationProfileContent(activationProfileProp)
      ? activationProfileProp
      : null,
  );

  useEffect(() => {
    if (hasActivationProfileContent(activationProfileProp)) {
      setProfile(activationProfileProp);
    }
  }, [activationProfileProp]);

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      try {
        const stored = (await ipcRenderer.invoke(
          'get-activation-profile',
        )) as DesktopActivationProfile | null;
        // console.log({stored});
        if (hasActivationProfileContent(stored)) {
          setProfile(stored);
        } else if (hasActivationProfileContent(activationProfileProp)) {
          setProfile(activationProfileProp);
        } else {
          setProfile(null);
        }
      } catch {
        if (hasActivationProfileContent(activationProfileProp)) {
          setProfile(activationProfileProp);
        }
      }
    };
    void load();
    const onUpdated = (
      _event: unknown,
      next: DesktopActivationProfile | null,
    ) => {
      setProfile(hasActivationProfileContent(next) ? next : null);
    };
    ipcRenderer.on('activation-profile-updated', onUpdated);
    return () => {
      ipcRenderer.removeListener('activation-profile-updated', onUpdated);
    };
  }, [isOpen, activationProfileProp]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const companyName = activationProfileLabel(profile);
  const mobileDisplay =
    profile?.mobile ?? profile?.mobileNo ?? profile?.phone;

  return (
    <>
      {isOpen && (
        <div
          className='fixed inset-0 z-40 bg-black/50'
          onClick={onClose}
          aria-hidden
        />
      )}

      <div
        className={`fixed top-0 right-0 z-50 flex h-full w-96 transform flex-col bg-[#1e1e1e] text-gray-100 shadow-lg transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role='dialog'
        aria-label='Account settings'
      >
        <button
          type='button'
          className='absolute right-4 top-4 text-lg font-bold text-gray-400 hover:text-white'
          onClick={onClose}
        >
          ✖
        </button>
        <h2 className='border-b border-white/10 p-4 text-2xl font-bold text-white'>
          Account settings
        </h2>

        <div className='flex-1 overflow-y-auto p-4'>
          {!hasActivationProfileContent(profile) ? (
            <p className='text-sm text-gray-400'>
              No company details saved. Sign out and activate again with your
              license key.
            </p>
          ) : (
            <>
              <div className='flex flex-col items-center rounded-lg border border-white/10 bg-white/5 p-4'>
                <span className='flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#006064] to-[#00838f] text-xl font-bold text-white'>
                  {(companyName || 'LP').slice(0, 2).toUpperCase()}
                </span>
                <h3 className='mt-3 text-center text-lg font-semibold text-white'>
                  {companyName}
                </h3>
              </div>

              <div className='mt-4 space-y-2 rounded-lg border border-white/10 bg-[#2a2a2a] p-4'>
                <p className='text-xs font-semibold uppercase tracking-wide text-[#00bcd4]'>
                 System Details
                </p>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="modal-client-name-input"
                    className="text-sm text-gray-200 font-medium"
                  >
                    Client Name
                  </label>
                  <input
                    id="modal-client-name-input"
                    type="text"
                    value={profile?.desktopAppConfiguration?.sessionDetails?.systemConfig?.clientName ?? companyName ?? ''}
                    onChange={(e) => {
                      const clientName = e.target.value;
                      setProfile({
                        ...profile,
                        desktopAppConfiguration: {
                          ...profile?.desktopAppConfiguration,
                          sessionDetails: {
                            ...profile?.desktopAppConfiguration?.sessionDetails,
                            systemConfig: {
                              ...profile?.desktopAppConfiguration?.sessionDetails?.systemConfig,
                              clientName,
                            },
                          }
                          }
                        });
                    }}
                    onBlur={async(e) => {
                      const clientName = e.target.value;
                      const activeKey = (await ipcRenderer.invoke('get-activation-key')) as string | null;
                      // console.log({activeKey});
                      if (activeKey && clientName?.length > 2) {
                        const result = (await service
                          .post('/company/systemConfigUpdate', {
                            filter: {
                              company:profile,
                              activeKey,
                              systemConfig:{
                                ...profile?.desktopAppConfiguration?.sessionDetails?.systemConfig,
                              },
                            },
                          })
                          .then((response) => response.data)) as {
                          success?: boolean;
                          message?: string;
                          company?: Record<string, unknown>;
                        };
                        if(result.success){
                          const message = result?.message ?? 'Client name updated successfully';
                          await ipcRenderer.invoke(
                            'save-activation-profile',
                            {...profile, desktopAppConfiguration: {
                              ...profile?.desktopAppConfiguration,
                              sessionDetails: {
                                ...profile?.desktopAppConfiguration?.sessionDetails,
                                systemConfig: {
                                  ...profile?.desktopAppConfiguration?.sessionDetails?.systemConfig,
                                  clientName,
                                },
                              },
                            } as DesktopActivationProfile},
                          )
                         await ipcRenderer.invoke('show-toast', message);
                        }else{
                          const message = result?.message ?? 'Failed to update client name';
                         await ipcRenderer.invoke('show-toast', message);
                        }
                      }
                    }}
                    className="ml-2 w-2/3 rounded-md px-2 py-1 bg-[#232c2e] text-white border border-[#00838f]/30 focus:border-[#00bcd4] focus:outline-none text-sm"
                    placeholder="Enter client name"
                  />
                </div>
   
              </div>


              <div className='mt-4 space-y-2 rounded-lg border border-white/10 bg-[#2a2a2a] p-4'>
                <p className='text-xs font-semibold uppercase tracking-wide text-[#00bcd4]'>
                  Company details
                </p>
                {profileRow('Company name', profile?.name ?? companyName)}
                {profileRow('Email', profile?.email)}
                {profileRow('Mobile No', mobileDisplay)}
                {profileRow('Code', profile?.code ?? profile?.companyCode)}
                {profileRow('Environment', profile?.environment)}
                {profileRow('Address', profile?.address)}
                {profileRow('City', profile?.city)}
                {profileRow('State', profile?.state)}
                {profileRow('Country', profile?.country)}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default AccountModal;
