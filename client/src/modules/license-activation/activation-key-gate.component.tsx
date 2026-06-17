import { service } from '../../core-services/rest-api';
import { useCallback, useEffect, useState } from 'react';
import type { DesktopActivationSystemConfig } from './desktop-activation-system-info.types';
import {
  buildProfileForStorage,
  extractLocalLoginCompanyCode,
} from './desktop-activation-profile.types';
import {
  setLocalLoginCompanyCode,
} from '../../runtime/local-login-company';

const { ipcRenderer } = window.require('electron');

const MAX_ACTIVATION_KEY_LENGTH = 16;

function sanitizeActivationKeyInput(value: string): string {
  return value.slice(0, MAX_ACTIVATION_KEY_LENGTH);
}

type Props = {
  onActivated: () => void;
};

function readOnlineStatus(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

export default function ActivationKeyGate({ onActivated }: Props) {
  const [activationKey, setActivationKey] = useState('');
  const [clientName, setClientName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isOnline, setIsOnline] = useState(readOnlineStatus);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    setIsOnline(readOnlineStatus());
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const verifyActivationKey = useCallback(
    async (activeKey: string, clientName: string): Promise<{ ok: boolean; message?: string }> => {
      const trimmed = activeKey.trim();
      if (trimmed.length !== MAX_ACTIVATION_KEY_LENGTH) {
        return {
          ok: false,
          message: `Please enter all ${MAX_ACTIVATION_KEY_LENGTH} characters of your activation key.`,
        };
      }
      try {
        const systemConfig = (await ipcRenderer.invoke(
          'get-desktop-activation-system-info',
        )) as DesktopActivationSystemConfig;

        const result = (await service
          .post('/company/activationDesktopApp', {
            filter: {
              activeKey: trimmed,
              systemConfig:{
                 clientName: clientName,
                ...systemConfig,
              },
            },
          })
          .then((response) => response.data)) as {
          success?: boolean;
          message?: string;
          company?: Record<string, unknown>;
        };

        if (!result?.success) {
          return {
            ok: false,
            message:
             result.message ?? 'Invalid activation key. Please check and try again.',
          };
        }

        const profile = buildProfileForStorage(
          result.company ?? result,
        );
        const companyCode = extractLocalLoginCompanyCode(profile);

        const savedProfile = (await ipcRenderer.invoke(
          'save-activation-profile',
          profile,
        )) as { ok?: boolean };

        if (!savedProfile?.ok) {
          return {
            ok: false,
            message:
              'Activation succeeded online but company profile could not be saved on this device.',
          };
        }

        const persisted = (await ipcRenderer.invoke(
          'persist-license-activation',
          { activationKey: trimmed, profile, localLoginCompany: companyCode },
        )) as { ok?: boolean; message?: string };

        if (!persisted?.ok) {
          return {
            ok: false,
            message:
              persisted?.message ??
              'Activation succeeded online but could not be saved on this device.',
          };
        }

        if (companyCode) {
          setLocalLoginCompanyCode(companyCode);
        }
        return {
          ok: true,
          message: result.message ?? 'Activation successful.',
        };
      } catch {
        return {
          ok: false,
          message:
            'Unable to verify your key. Check your internet connection and try again.',
        };
      }
    },
    [],
  );

  const submit = useCallback(async () => {
    if (!readOnlineStatus()) {
      setError('Please connect to the internet.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await verifyActivationKey(activationKey, clientName);
      if (result.ok) {
        onActivated();
        return;
      }
      setError(result.message ?? 'Activation failed.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [activationKey, clientName, onActivated, verifyActivationKey]);

  const clientNameTooShort =
    clientName.length > 0 && clientName.trim().length <= 2;

  return (
    <div
      className='fixed inset-0 z-[200] flex items-center justify-center bg-[#1a1a1a]/90 p-4 backdrop-blur-sm'
      role='dialog'
      aria-modal='true'
      aria-labelledby='activation-key-title'
    >
      <div className='w-full max-w-md rounded-xl border border-white/10 bg-[#2a2a2a] p-6 shadow-2xl'>
        <h1
          id='activation-key-title'
          className='text-xl font-semibold text-white'
        >
          Activate LimsPlus Connect
        </h1>

        {!isOnline && (
          <p
            className='mt-3 rounded-lg border border-amber-700/50 bg-amber-950/50 px-3 py-2 text-sm text-amber-100'
            role='alert'
          >
            Please connect to the internet.
          </p>
        )}

        <p className='mt-2 text-sm text-gray-400'>
          Enter the activation key from your license email or card. You only
          need to do this once on this computer.
        </p>

        <label
          htmlFor='activation-key-input'
          className='mt-5 block text-sm font-medium text-gray-300'
        >
          Activation key
          <span className='ml-1 font-normal text-gray-500'>
            ({MAX_ACTIVATION_KEY_LENGTH} characters required)
          </span>
        </label>
        <input
          id='activation-key-input'
          type='text'
          autoComplete='off'
          autoFocus
          disabled={busy || !isOnline}
          maxLength={MAX_ACTIVATION_KEY_LENGTH}
          placeholder='Enter activation key'
          value={activationKey}
          onChange={(e) =>
            setActivationKey(sanitizeActivationKeyInput(e.target.value))
          }
          // onKeyDown={(e) => {
          //   if (
          //     e.key === 'Enter' &&
          //     !busy &&
          //     activationKey.length === MAX_ACTIVATION_KEY_LENGTH
          //   ) {
          //     void submit();
          //   }
          // }}
          className='mt-2 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 font-mono text-base text-white placeholder:text-gray-500 focus:border-[#00bcd4] focus:outline-none focus:ring-1 focus:ring-[#00bcd4] disabled:opacity-60'
          aria-describedby='activation-key-hint'
        />
        <p id='activation-key-hint' className='mt-1 text-xs text-gray-500'>
          {activationKey.length}/{MAX_ACTIVATION_KEY_LENGTH} characters
        </p>

        <label
          htmlFor='client-name-input'
          className='mt-4 block text-sm font-medium text-gray-300'
        >
          Client name
        </label>
        <input
          id='client-name-input'
          type='text'
          autoComplete='off'
          placeholder='Enter client name'
          required
          disabled={busy || !isOnline}
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              !busy &&
              activationKey.length === MAX_ACTIVATION_KEY_LENGTH &&
              clientName.trim().length > 2
            ) {
              void submit();
            }
          }}
          className={`mt-2 w-full rounded-lg border bg-black/40 px-3 py-2.5 font-mono text-base text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 disabled:opacity-60 ${
            clientNameTooShort
              ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500'
              : 'border-white/15 focus:border-[#00bcd4] focus:ring-[#00bcd4]'
          }`}
          aria-describedby='client-name-hint'
          aria-invalid={clientNameTooShort}
        />
        <p
          id='client-name-hint'
          className={`mt-1 text-xs ${clientNameTooShort ? 'text-rose-400' : 'text-gray-500'}`}
        >
          {clientNameTooShort
            ? 'Client name must be more than 2 characters.'
            : 'At least 3 characters required.'}
        </p>

        {error && (
          <p
            className='mt-3 rounded-lg border border-rose-800/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-100'
            role='alert'
          >
            {error}
          </p>
        )}

        <button
          type='button'
          disabled={
            busy ||
            !isOnline ||
            activationKey.length !== MAX_ACTIVATION_KEY_LENGTH ||
            clientName.trim().length <= 2
          }
          onClick={() => void submit()}
          className='mt-5 w-full rounded-lg bg-[#00bcd4] py-2.5 text-sm font-semibold text-[#1a1a1a] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'
        >
          {busy ? 'Verifying…' : 'Activate'}
        </button>

        <p className='mt-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-center text-sm leading-relaxed text-gray-400'>
          <span className='mr-1' aria-hidden>
            🔒
          </span>
          When you tap <span className='font-medium text-gray-200'>Activate</span>, we
          check your key and save it{' '}
          <span className='font-medium text-[#80deea]'>securely on this computer</span>.
          You will not be asked again on this device.
        </p>
      </div>
    </div>
  );
}
