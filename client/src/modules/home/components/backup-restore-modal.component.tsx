import { useEffect, useRef, useState } from 'react';
import { IpcRendererEvent } from 'electron';

const { ipcRenderer } = window.require('electron');

export type MongoBackupRestoreProgress = {
  operation: 'backup' | 'restore';
  phase: 'step' | 'progress' | 'error' | 'done';
  step: number;
  totalSteps: number;
  label: string;
  percent: number;
  detail?: string;
};

const BACKUP_STEPS = [
  {
    title: 'Start Lite MongoDB',
    blurb: 'Same embedded server as the LimsPlus Lite button (127.0.0.1).',
  },
  {
    title: 'Load local data',
    blurb:
      'If needed, imports from client/database/dump (or bundled ZIP) — same as Lite first run.',
  },
  {
    title: 'Verify database',
    blurb: 'Ensures limsplus-prod (or your Lite DB) has collections before export.',
  },
  {
    title: 'Export to dump folder',
    blurb:
      'Writes dump/<database>/*.bson + .metadata.json (mongodump layout you can copy back to client/database/dump).',
  },
  { title: 'Finish', blurb: 'Backup saved outside the app; safe to copy or zip.' },
] as const;

const RESTORE_STEPS = [
  {
    title: 'Start Lite MongoDB',
    blurb: 'Uses the same local instance as LimsPlus Lite.',
  },
  {
    title: 'Load / keep local data',
    blurb: 'Opens embedded Mongo; keeps existing data unless you replace it.',
  },
  {
    title: 'Find backup files',
    blurb:
      'Accepts dump/limsplus-prod/*.bson or a folder that already contains .bson files.',
  },
  {
    title: 'Import collections',
    blurb: 'Drops the target database and imports all BSON files.',
  },
  { title: 'Finish', blurb: 'Open LimsPlus Lite to use the restored data.' },
] as const;

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function BackupRestoreModal({ isOpen, onClose }: Props) {
  const [tab, setTab] = useState<'backup' | 'restore'>('backup');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<MongoBackupRestoreProgress | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const inFlight = useRef(false);

  const steps = tab === 'backup' ? BACKUP_STEPS : RESTORE_STEPS;
  const currentStep = progress?.step ?? (busy ? 1 : 0);
  const percent = Math.min(100, Math.max(0, progress?.percent ?? 0));

  useEffect(() => {
    if (!isOpen) {
      setTab('backup');
      setSelectedPath(null);
      setBusy(false);
      setProgress(null);
      setBannerError(null);
      setSuccessMessage(null);
      inFlight.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    const onProg = (_e: IpcRendererEvent, payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      const data = payload as MongoBackupRestoreProgress;
      if (data.operation !== tab) return;
      setProgress(data);
      if (data.phase === 'error') {
        setBannerError(data.detail ?? data.label);
        setBusy(false);
        inFlight.current = false;
      }
      if (data.phase === 'done') {
        setSuccessMessage(data.detail ?? data.label);
        setBusy(false);
        inFlight.current = false;
      }
    };
    ipcRenderer.on('mongo-backup-restore-progress', onProg);
    return () => {
      ipcRenderer.removeListener('mongo-backup-restore-progress', onProg);
    };
  }, [tab, isOpen]);

  const pickFolder = async () => {
    setBannerError(null);
    setSuccessMessage(null);
    const title =
      tab === 'backup'
        ? 'Choose where to save the MongoDB backup'
        : 'Choose the backup folder to restore';
    const buttonLabel = tab === 'backup' ? 'Save here' : 'Use this folder';
    const res = (await ipcRenderer.invoke('select-folder-dialog', {
      title,
      buttonLabel,
    })) as { ok: boolean; path: string | null };
    if (res.ok && res.path) {
      setSelectedPath(res.path);
    }
  };

  const runOperation = async () => {
    if (!selectedPath || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setBannerError(null);
    setSuccessMessage(null);
    setProgress({
      operation: tab,
      phase: 'step',
      step: 1,
      totalSteps: 5,
      label: 'Starting…',
      percent: 2,
    });

    try {
      if (tab === 'backup') {
        const result = (await ipcRenderer.invoke(
          'run-mongo-backup',
          selectedPath,
        )) as { ok: boolean; error?: string; outputDir?: string };
        if (!result.ok) {
          setBannerError(result.error ?? 'Backup failed.');
        }
      } else {
        const confirmed = window.confirm(
          'Restore will replace all data in the local MongoDB database with the selected backup. Continue?',
        );
        if (!confirmed) {
          setBusy(false);
          inFlight.current = false;
          setProgress(null);
          return;
        }
        const result = (await ipcRenderer.invoke(
          'run-mongo-restore',
          selectedPath,
        )) as { ok: boolean; error?: string };
        if (!result.ok) {
          setBannerError(result.error ?? 'Restore failed.');
        }
      }
    } catch (e: unknown) {
      setBannerError(e instanceof Error ? e.message : String(e));
      setBusy(false);
      inFlight.current = false;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className='fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'
      role='dialog'
      aria-modal='true'
      aria-labelledby='backup-restore-title'
    >
      <div className='flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#1e1e1e] shadow-2xl'>
        <div className='border-b border-white/10 px-5 py-4 sm:px-6'>
          <h2
            id='backup-restore-title'
            className='text-lg font-semibold text-white'
          >
            MongoDB backup &amp; restore
          </h2>
          <p className='mt-1 text-sm text-gray-400'>
            Backs up the <strong className='text-gray-300'>same local MongoDB</strong>{' '}
            used by <strong className='text-gray-300'>LimsPlus Lite</strong> (from{' '}
            <code className='rounded bg-black/40 px-1 text-xs'>client/database/dump</code>
            ). Saves as <code className='rounded bg-black/40 px-1 text-xs'>dump/limsplus-prod/</code>{' '}
            on a folder you choose.
          </p>
          <div className='mt-4 flex gap-2'>
            <button
              type='button'
              disabled={busy}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === 'backup'
                  ? 'bg-[#00bcd4] text-[#1a1a1a]'
                  : 'bg-white/10 text-gray-300 hover:bg-white/15'
              } ${busy ? 'opacity-60' : ''}`}
              onClick={() => {
                if (!busy) {
                  setTab('backup');
                  setSelectedPath(null);
                  setProgress(null);
                  setBannerError(null);
                  setSuccessMessage(null);
                }
              }}
            >
              Backup
            </button>
            <button
              type='button'
              disabled={busy}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === 'restore'
                  ? 'bg-[#00bcd4] text-[#1a1a1a]'
                  : 'bg-white/10 text-gray-300 hover:bg-white/15'
              } ${busy ? 'opacity-60' : ''}`}
              onClick={() => {
                if (!busy) {
                  setTab('restore');
                  setSelectedPath(null);
                  setProgress(null);
                  setBannerError(null);
                  setSuccessMessage(null);
                }
              }}
            >
              Restore
            </button>
          </div>
        </div>

        <div className='flex-1 overflow-y-auto px-5 py-4 sm:px-6'>
          <div className='mb-4 rounded-lg border border-white/10 bg-black/30 p-4'>
            <p className='text-xs font-medium uppercase tracking-wide text-gray-500'>
              {tab === 'backup' ? 'Destination' : 'Backup source'}
            </p>
            <p className='mt-1 break-all font-mono text-sm text-[#80deea]'>
              {selectedPath ?? 'No folder selected'}
            </p>
            <button
              type='button'
              disabled={busy}
              className='mt-3 rounded-lg border border-[#00bcd4]/40 bg-[#00bcd4]/10 px-3 py-2 text-sm font-medium text-[#00bcd4] hover:bg-[#00bcd4]/20 disabled:opacity-50'
              onClick={() => void pickFolder()}
            >
              {tab === 'backup' ? 'Choose save location…' : 'Choose backup folder…'}
            </button>
          </div>

          <div className='mb-4'>
            <div className='mb-2 flex items-center justify-between text-sm'>
              <span className='font-medium text-white'>
                {progress?.label ?? (busy ? 'Working…' : 'Ready')}
              </span>
              <span className='tabular-nums text-[#00bcd4]'>{percent}%</span>
            </div>
            <div
              className='h-3 overflow-hidden rounded-full bg-gray-800'
              role='progressbar'
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className='h-full rounded-full bg-gradient-to-r from-[#00838f] to-[#00bcd4] transition-all duration-300 ease-out'
                style={{ width: `${percent}%` }}
              />
            </div>
            {progress?.detail && (
              <p className='mt-2 whitespace-pre-wrap text-xs leading-relaxed text-gray-400'>
                {progress.detail}
              </p>
            )}
          </div>

          <ol className='space-y-2'>
            {steps.map((step, idx) => {
              const stepNo = idx + 1;
              const isDone =
                progress?.phase === 'done' || currentStep > stepNo;
              const isRunning =
                busy &&
                !bannerError &&
                progress?.phase !== 'done' &&
                currentStep === stepNo;
              return (
                <li
                  key={step.title}
                  className={`flex gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                    isRunning
                      ? 'border-[#00bcd4]/50 bg-[#00bcd4]/10'
                      : isDone
                        ? 'border-emerald-800/40 bg-emerald-950/20'
                        : 'border-white/10 bg-white/5 opacity-75'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isDone
                        ? 'bg-emerald-600 text-white'
                        : isRunning
                          ? 'bg-[#00bcd4] text-[#1a1a1a]'
                          : 'bg-gray-600 text-gray-200'
                    }`}
                  >
                    {isDone ? '✓' : stepNo}
                  </span>
                  <div className='min-w-0'>
                    <p className='font-medium text-white'>{step.title}</p>
                    <p className='text-xs text-gray-400'>{step.blurb}</p>
                    {isRunning && (
                      <p className='mt-0.5 text-[11px] font-medium uppercase tracking-wide text-[#00bcd4]'>
                        In progress
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {bannerError && (
            <div className='mt-4 rounded-lg border border-rose-800/60 bg-rose-950/30 p-3 text-sm text-rose-100 whitespace-pre-wrap'>
              {bannerError}
            </div>
          )}

          {successMessage && !bannerError && (
            <div className='mt-4 rounded-lg border border-emerald-800/50 bg-emerald-950/30 p-3 text-sm text-emerald-100 whitespace-pre-wrap'>
              {successMessage}
            </div>
          )}
        </div>

        <div className='flex flex-wrap gap-2 border-t border-white/10 px-5 py-4 sm:px-6'>
          <button
            type='button'
            disabled={busy || !selectedPath}
            className='flex-1 rounded-lg bg-[#00bcd4] py-2.5 text-sm font-semibold text-[#1a1a1a] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'
            onClick={() => void runOperation()}
          >
            {busy
              ? tab === 'backup'
                ? 'Backing up…'
                : 'Restoring…'
              : tab === 'backup'
                ? 'Start backup'
                : 'Start restore'}
          </button>
          <button
            type='button'
            disabled={busy}
            className='rounded-lg border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-50'
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
