import { useCallback, useState } from 'react';

const { ipcRenderer } = window.require('electron');

type Props = {
  onActivated: () => void;
};

export default function ActivationKeyGate({ onActivated }: Props) {
  const [activationKey, setActivationKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const result = (await ipcRenderer.invoke(
        'verify-activation-key',
        activationKey,
      )) as { ok: boolean; message?: string };
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
  }, [activationKey, onActivated]);

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
        <p className='mt-2 text-sm text-gray-400'>
          Enter the activation key from your license email or card. You only
          need to do this once on this computer.
        </p>

        <label
          htmlFor='activation-key-input'
          className='mt-5 block text-sm font-medium text-gray-300'
        >
          Activation key
        </label>
        <input
          id='activation-key-input'
          type='password'
          autoComplete='off'
          autoFocus
          disabled={busy}
          placeholder='Enter activation key'
          value={activationKey}
          onChange={(e) => setActivationKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !busy) void submit();
          }}
          className='mt-2 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-white placeholder:text-gray-500 focus:border-[#00bcd4] focus:outline-none focus:ring-1 focus:ring-[#00bcd4] disabled:opacity-60'
        />

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
          disabled={busy || activationKey.trim().length === 0}
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
