import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import { useStores } from '../../stores';
import { IpcRendererEvent } from 'electron';
import './style.css';
import { useNavigate } from 'react-router-dom';
import AccountModal from './components/modal-account.component';
import BackupRestoreModal from './components/backup-restore-modal.component';

const { ipcRenderer } = window.require('electron');

type User = {
  userId: string;
  companyCode: string;
};

type DashboardSection = 'dashboard' | 'notifications' | 'clipboard';

type DummyNotification = {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  level: 'info' | 'warning' | 'error';
};

type DummyClipboardRow = {
  id: string;
  capturedAt: string;
  source: string;
  format: string;
  rowCount: number;
  preview: string;
  status: 'parsed' | 'skipped' | 'error';
};

const DUMMY_NOTIFICATIONS: DummyNotification[] = [
  {
    id: 'n1',
    title: 'Instrument queue cleared',
    message:
      'BC-7000 completed batch #4821. 14 samples moved to validated state.',
    time: '2 min ago',
    read: false,
    level: 'info',
  },
  {
    id: 'n2',
    title: 'HL7 send retry',
    message:
      'Message ORU^R01 to LAB-INTERFACE-02 failed once; automatic retry scheduled in 30s.',
    time: '18 min ago',
    read: false,
    level: 'warning',
  },
  {
    id: 'n3',
    title: 'Low disk space',
    message:
      'Data volume /archive is below 15% free. Consider running cleanup or extending storage.',
    time: '1 hr ago',
    read: true,
    level: 'warning',
  },
  {
    id: 'n4',
    title: 'Integration Gateway heartbeat',
    message: 'Gateway responded OK. Last sync 2026-05-26T09:12:00Z.',
    time: '3 hr ago',
    read: true,
    level: 'info',
  },
  {
    id: 'n5',
    title: 'Parser schema mismatch',
    message:
      'Clipboard payload line 3 expected column HCT, found HGB. Row stored as quarantine.',
    time: 'Yesterday',
    read: true,
    level: 'error',
  },
];

const DUMMY_CLIPBOARD_ROWS: DummyClipboardRow[] = [
  {
    id: 'c1',
    capturedAt: '2026-05-26 10:42:11',
    source: 'Excel export',
    format: 'TSV',
    rowCount: 24,
    preview: 'SampleId\\tWBC\\tRBC\\tHGB\\nS-1001\\t7.2\\t4.61\\t14.1',
    status: 'parsed',
  },
  {
    id: 'c2',
    capturedAt: '2026-05-26 10:39:02',
    source: 'Browser table',
    format: 'HTML table',
    rowCount: 6,
    preview: '<table><tr><th>Acc</th><th>Test</th></tr>...</table>',
    status: 'parsed',
  },
  {
    id: 'c3',
    capturedAt: '2026-05-26 10:35:55',
    source: 'Instrument text',
    format: 'Fixed-width',
    rowCount: 1,
    preview: '20260526103545  S-9921  GLU  92  mg/dL',
    status: 'skipped',
  },
  {
    id: 'c4',
    capturedAt: '2026-05-26 10:21:18',
    source: 'CSV paste',
    format: 'CSV',
    rowCount: 0,
    preview:
      'Patient,Name,DOB | "O\'Brien, Ann",1984-03-01 — delimiter parse error',
    status: 'error',
  },
];

const levelStyles: Record<DummyNotification['level'], string> = {
  info: 'bg-sky-900/50 text-sky-200 border-sky-700/60',
  warning: 'bg-amber-900/40 text-amber-100 border-amber-700/50',
  error: 'bg-rose-900/40 text-rose-100 border-rose-700/50',
};

const statusStyles: Record<DummyClipboardRow['status'], string> = {
  parsed: 'text-emerald-400',
  skipped: 'text-amber-400',
  error: 'text-rose-400',
};

type LimsLiteProgressFromMain =
  | { phase: 'step'; step: number; hint?: string }
  | { phase: 'error'; message: string };

const LIMS_LITE_SETUP_STEPS = [
  {
    title: 'Check frontend & Nest API builds',
    blurb:
      'Ensures React build (frontend) and compiled Nest backend (dist/main.js) exist before starting.',
  },
  {
    title: 'Start local MongoDB',
    blurb:
      'Runs only on 127.0.0.1 (this computer). Other machines on your network cannot connect. First launch may download server files.',
  },
  {
    title: 'Restore database backup',
    blurb:
      'Imports client/database/dump only on first run; later runs read live local MongoDB (your backend changes).',
  },
  {
    title: 'Start NestJS API locally',
    blurb:
      'Listens on loopback using PORT/HOST from the desktop shell (default port 8080). First startup can take a few minutes if optional integrations load.',
  },
  {
    title: 'Save offline connection file',
    blurb:
      'Writes lims-lite-offline.json (Mongo URI + Lite API URL) for tools and portal config.',
  },
  {
    title: 'Open LimsPlus Lite',
    blurb:
      'Serves the SPA with serve-handler and opens the Lite window fullscreen.',
  },
] as const;


const Home = observer(() => {
  const { integrationGatewayStore } = useStores();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] =
    useState<DashboardSection>('dashboard');
  const [signedInUserId, setSignedInUserId] = useState<string | null>(null);
  const [backupRestoreOpen, setBackupRestoreOpen] = useState(false);
  const [limsLiteSetup, setLimsLiteSetup] = useState<{
    modalOpen: boolean;
    loading: boolean;
    currentStep: number;
    stepHint: string;
    bannerError: string | null;
  }>({
    modalOpen: false,
    loading: false,
    currentStep: 1,
    stepHint: '',
    bannerError: null,
  });
  const menuRef = useRef<HTMLDivElement>(null);
  const limsLiteInFlight = useRef(false);

  const userInitial =
    signedInUserId && signedInUserId.length > 0
      ? signedInUserId.slice(0, 2).toUpperCase()
      : '—';

  useEffect(() => {
    const onSendUser = (_event: IpcRendererEvent, user: User) => {
      setSignedInUserId(user.userId);
      void integrationGatewayStore.integrationGatewayService
        .fetchEnvironment({ code: user.companyCode })
        .catch((err: unknown) => {
          console.warn(
            '[Home] fetchEnvironment failed (offline or REST unavailable)',
            err,
          );
        });
    };

    ipcRenderer.invoke('read-user');
    ipcRenderer.on('send-user', onSendUser);
    return () => {
      ipcRenderer.removeListener('send-user', onSendUser);
    };
  }, [integrationGatewayStore]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const toggleMenu = () => {
    setIsOpen((open) => !open);
  };

  const handleSignOut = async () => {
    const checkFileExists = async (filePath: string) => {
      return await ipcRenderer.invoke('check-file-exists', filePath);
    };

    const userDataPath = await ipcRenderer.invoke('get-user-data-path');
    const filePath = `${userDataPath}/user-preferences.json`;

    const fileExists = await checkFileExists(filePath);

    if (fileExists) {
      await ipcRenderer.invoke('remove-file', filePath);
      navigate('/dashboard');
    } else {
      alert('Something Went Wrong..');
    }
  };

  const unreadCount = DUMMY_NOTIFICATIONS.filter((n) => !n.read).length;

  const openOfflineLimsPlusLite = async () => {
    if (limsLiteInFlight.current) {
      return;
    }
    limsLiteInFlight.current = true;
    setLimsLiteSetup({
      modalOpen: true,
      loading: true,
      currentStep: 1,
      stepHint: '',
      bannerError: null,
    });

    const onProg = (_e: IpcRendererEvent, payload: unknown) => {
      if (!payload || typeof payload !== 'object' || !('phase' in payload)) {
        return;
      }
      const data = payload as LimsLiteProgressFromMain;
      if (data.phase === 'step') {
        setLimsLiteSetup((s) => ({
          ...s,
          currentStep: data.step,
          stepHint: data.hint ?? '',
          bannerError: null,
        }));
      } else if (data.phase === 'error') {
        setLimsLiteSetup((s) => ({
          ...s,
          bannerError: data.message,
        }));
      }
    };

    ipcRenderer.on('lims-lite-setup-progress', onProg);

    try {
      const result = (await ipcRenderer.invoke(
        'prepare-and-open-limsplus-lite',
      )) as
        | { ok: true; firstRunRestore?: boolean }
        | { ok: false; error?: string; portalIndexPath?: string; backendEntryPath?: string };

      if (result.ok) {
        setLimsLiteSetup({
          modalOpen: false,
          loading: false,
          currentStep: 1,
          stepHint: '',
          bannerError: null,
        });
        return;
      }

      let msg =
        result.error ??
        'Could not prepare LimsPlus Lite. Check Electron logs.';
      if ('portalIndexPath' in result && result.portalIndexPath) {
        msg += `\n\nPortal path:\n${result.portalIndexPath}\n(from repo root: npm run copy-frontend)`;
      }
      if ('backendEntryPath' in result && result.backendEntryPath) {
        msg += `\n\nNest API bundle:\n${result.backendEntryPath}\n(cd client/app/backend && npm install && npm run build)`;
      }
      setLimsLiteSetup((s) => ({
        ...s,
        loading: false,
        bannerError: s.bannerError ?? msg,
      }));
    } finally {
      ipcRenderer.removeListener('lims-lite-setup-progress', onProg);
      setLimsLiteSetup((s) => ({ ...s, loading: false }));
      limsLiteInFlight.current = false;
    }
  };

  return (
    <div className='flex flex-col w-full min-h-screen bg-[#1a1a1a] text-gray-100'>
      <header className='header justify-between w-full'>
        <div className='flex items-center gap-3'>
          <span className='text-lg font-semibold tracking-tight text-white'>
            LIMS<span className='text-[#00bcd4]'>Plus</span> Desktop
          </span>
          <span className='hidden sm:inline text-xs font-normal text-gray-500 border-l border-gray-600 pl-3'>
            Connector dashboard
          </span>
        </div>
        <div
          ref={menuRef}
          className='relative flex items-center text-sm'
        >
          <button
            type='button'
            id='user-menu-trigger'
            aria-haspopup='menu'
            aria-expanded={isOpen}
            aria-label='User menu'
            onClick={toggleMenu}
            className='flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 pl-2 pr-2 text-left text-gray-200 shadow-inner transition hover:border-[#00bcd4]/40 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00bcd4]'
          >
            <span
              className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#006064] to-[#00838f] text-xs font-bold text-white shadow'
              aria-hidden
            >
              {userInitial}
            </span>
            <span className='hidden min-w-0 flex-col sm:flex'>
              <span className='text-[11px] font-medium uppercase tracking-wide text-gray-500'>
                Signed in
              </span>
              <span id='userId' className='truncate text-sm font-medium text-white'>
                {signedInUserId ? `Welcome, ${signedInUserId}` : 'Welcome'}
              </span>
            </span>
            <svg
              className={`ms-1 h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 sm:ms-0 ${isOpen ? 'rotate-180' : ''}`}
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
              strokeWidth={2}
              aria-hidden
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M19 9l-7 7-7-7'
              />
            </svg>
          </button>

          {isOpen && (
            <div
              className='absolute right-0 top-[calc(100%+8px)] z-50 w-64 origin-top-right overflow-hidden rounded-xl border border-white/10 bg-[#1e1e1e] text-white shadow-2xl ring-1 ring-black/40'
              role='menu'
              aria-orientation='vertical'
              aria-labelledby='user-menu-trigger'
            >
              <div className='border-b border-white/10 bg-gradient-to-r from-[#0d3d42]/80 to-[#1a1a24] px-4 py-3'>
                <p className='text-xs font-medium uppercase tracking-wide text-gray-500'>
                  Account
                </p>
                <p className='mt-0.5 truncate text-sm font-semibold text-white'>
                  {signedInUserId ?? 'Loading…'}
                </p>
                <p className='mt-1 text-xs text-gray-400'>
                  LIMSPlus desktop session
                </p>
              </div>
              <div className='p-1.5'>
                <button
                  type='button'
                  role='menuitem'
                  className='flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-200 transition hover:bg-white/10 hover:text-[#00bcd4] focus:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#00bcd4]'
                  onClick={() => {
                    setIsSidebarOpen(true);
                    setIsOpen(false);
                  }}
                >
                  <span className='flex h-8 w-8 items-center justify-center rounded-md bg-white/5 text-[#00bcd4]'>
                    <svg
                      className='h-4 w-4'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                      strokeWidth={2}
                      aria-hidden
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
                      />
                    </svg>
                  </span>
                  <span>
                    <span className='block font-medium'>Account settings</span>
                    <span className='block text-xs font-normal text-gray-500'>
                      Paths and preferences
                    </span>
                  </span>
                </button>
                <button
                  type='button'
                  role='menuitem'
                  className='mt-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-200 transition hover:bg-rose-950/40 hover:text-rose-300 focus:bg-rose-950/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-500'
                  onClick={() => void handleSignOut()}
                >
                  <span className='flex h-8 w-8 items-center justify-center rounded-md bg-white/5 text-rose-400'>
                    <svg
                      className='h-4 w-4'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                      strokeWidth={2}
                      aria-hidden
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'
                      />
                    </svg>
                  </span>
                  <span>
                    <span className='block font-medium'>Sign out</span>
                    <span className='block text-xs font-normal text-gray-500'>
                      Clear local session
                    </span>
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className='flex flex-1 min-h-0'>
        <aside className='sidebar' aria-label='Main navigation'>
          <div className='sidebar-nav-label'>Views</div>
          <button
            type='button'
            className={`sidebar-nav-item ${activeSection === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveSection('dashboard')}
          >
            Dashboard
          </button>
          <button
            type='button'
            className={`sidebar-nav-item ${activeSection === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveSection('notifications')}
          >
            Notification
            {unreadCount > 0 && (
              <span className='ml-2 inline-flex min-w-[1.25rem] justify-center rounded-full bg-[#00bcd4] px-1.5 text-xs font-bold text-[#1a1a1a]'>
                {unreadCount}
              </span>
            )}
          </button>
          <button
            type='button'
            className={`sidebar-nav-item ${activeSection === 'clipboard' ? 'active' : ''}`}
            onClick={() => setActiveSection('clipboard')}
          >
            Clipboard Parser
          </button>
        </aside>

        <main className='flex-1 overflow-auto bg-gradient-to-br from-[#1e293b] via-[#1a1a24] to-[#312e81]'>
          {activeSection === 'dashboard' && (
            <div className='p-4'>
              <div className='mb-4 rounded-lg border border-white/10 bg-black/20 p-4 backdrop-blur-sm'>
                <h1 className='text-lg font-semibold text-white'>Dashboard</h1>
                <p className='mt-1 text-sm text-gray-400'>
                  Workspaces, reports, and local configuration shortcuts.
                </p>
                <div className='mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3'>
                  <div className='rounded-md border border-white/10 bg-white/5 px-4 py-3'>
                    <p className='text-xs uppercase tracking-wide text-gray-500'>
                      Dummy stat
                    </p>
                    <p className='text-2xl font-bold text-[#00bcd4]'>12</p>
                    <p className='text-xs text-gray-400'>Items in queue</p>
                  </div>
                  <div className='rounded-md border border-white/10 bg-white/5 px-4 py-3'>
                    <p className='text-xs uppercase tracking-wide text-gray-500'>
                      Dummy stat
                    </p>
                    <p className='text-2xl font-bold text-emerald-400'>3</p>
                    <p className='text-xs text-gray-400'>Active instruments</p>
                  </div>
                  <div className='rounded-md border border-white/10 bg-white/5 px-4 py-3'>
                    <p className='text-xs uppercase tracking-wide text-gray-500'>
                      Dummy stat
                    </p>
                    <p className='text-2xl font-bold text-amber-300'>98%</p>
                    <p className='text-xs text-gray-400'>Uptime (sample)</p>
                  </div>
                </div>
              </div>

              <div className='gap-4 grid grid-cols-1 md:grid-cols-3'>
                <div className='bg-[#2a2a2a] p-2 rounded-md'>
                  <div className='bg-[#00bcd4] p-3 text-center rounded-md mb-4 text-[#1a1a1a] font-semibold'>
                    Workspaces
                  </div>
                  <div className='flex flex-col gap-2'>
                    <button
                      className='item'
                      onClick={() => {
                        ipcRenderer.send(
                          'navigate-to-integration-gateway',
                          '/integration-gateway',
                        );
                      }}
                    >
                      Integration Gateway
                    </button>
                    <button
                      type='button'
                      className={`item ${limsLiteSetup.loading ? 'cursor-wait opacity-70 pointer-events-none' : ''}`}
                      disabled={limsLiteSetup.loading}
                      onClick={() => void openOfflineLimsPlusLite()}
                    >
                      {limsLiteSetup.loading
                        ? 'Preparing LimsPlus Lite…'
                        : 'LimsPlus Lite'}
                    </button>
                    <button className='item'>HL7 Message</button>
                  </div>
                </div>
                <div className='bg-[#2a2a2a] p-2 rounded-md'>
                  <div className='bg-[#00bcd4] p-3 text-center rounded-md mb-4 text-[#1a1a1a] font-semibold'>
                    Reports
                  </div>
                  <div className='flex flex-col gap-2'>
                    <button className='item'>Pending for Processing</button>
                    <button className='item'>Pending Result Transmission</button>
                    <button className='item'>Pending HL7 Message</button>
                  </div>
                </div>
                <div className='bg-[#2a2a2a] p-2 rounded-md'>
                  <div className='bg-[#00bcd4] p-3 text-center rounded-md mb-4 text-[#1a1a1a] font-semibold'>
                    Configurations
                  </div>
                  <div className='flex flex-col gap-2'>
                    <button
                      className='item'
                      onClick={async () => {
                        const checkFileExists = async (filePath: string) => {
                          return await ipcRenderer.invoke(
                            'check-file-exists',
                            filePath,
                          );
                        };
                        const filePath =
                          (await ipcRenderer.invoke('get-user-data-path')) +
                          '/instrument-logs/instrument-logs.txt';
                        const fileExists = await checkFileExists(filePath);
                        if (fileExists) {
                          await ipcRenderer.invoke('open-file', filePath);
                        } else {
                          alert('Log file does not exist');
                        }
                      }}
                    >
                      Instrument Logs
                    </button>
                    <button className='item'>Image Files</button>
                    <button className='item'>HL7 Files</button>
                    <button
                      type='button'
                      className='item'
                      onClick={() => setBackupRestoreOpen(true)}
                    >
                      Backup/Restore
                    </button>
                    <button className='item'>FTP Locations</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className='p-4 max-w-4xl'>
              <div className='mb-6'>
                <h1 className='text-xl font-semibold text-white'>
                  Notifications
                </h1>
                <p className='text-sm text-gray-400'>
                  Sample feed for the desktop connector (dummy data).
                </p>
              </div>
              <ul className='space-y-3'>
                {DUMMY_NOTIFICATIONS.map((n) => (
                  <li
                    key={n.id}
                    className={`rounded-lg border p-4 ${levelStyles[n.level]} ${n.read ? 'opacity-80' : ''}`}
                  >
                    <div className='flex flex-wrap items-start justify-between gap-2'>
                      <div className='flex items-center gap-2'>
                        {!n.read && (
                          <span className='h-2 w-2 shrink-0 rounded-full bg-[#00bcd4]' />
                        )}
                        <span className='font-semibold'>{n.title}</span>
                      </div>
                      <span className='text-xs text-gray-400'>{n.time}</span>
                    </div>
                    <p className='mt-2 text-sm text-gray-300'>{n.message}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeSection === 'clipboard' && (
            <div className='p-4'>
              <div className='mb-6 max-w-5xl'>
                <h1 className='text-xl font-semibold text-white'>
                  Clipboard Parser
                </h1>
                <p className='text-sm text-gray-400'>
                  Recent captures (dummy). Wire this to your parser service when
                  ready.
                </p>
              </div>
              <div className='overflow-x-auto rounded-lg border border-white/10 bg-black/25'>
                <table className='min-w-full text-left text-sm text-gray-300'>
                  <thead>
                    <tr className='border-b border-white/10 bg-black/40 text-xs uppercase tracking-wide text-gray-500'>
                      <th className='px-4 py-3'>Captured</th>
                      <th className='px-4 py-3'>Source</th>
                      <th className='px-4 py-3'>Format</th>
                      <th className='px-4 py-3'>Rows</th>
                      <th className='px-4 py-3'>Status</th>
                      <th className='px-4 py-3'>Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DUMMY_CLIPBOARD_ROWS.map((row, i) => (
                      <tr
                        key={row.id}
                        className={
                          i % 2 === 0 ? 'bg-white/5' : 'bg-transparent'
                        }
                      >
                        <td className='whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-400'>
                          {row.capturedAt}
                        </td>
                        <td className='px-4 py-3'>{row.source}</td>
                        <td className='px-4 py-3'>{row.format}</td>
                        <td className='px-4 py-3 tabular-nums'>{row.rowCount}</td>
                        <td
                          className={`px-4 py-3 font-medium capitalize ${statusStyles[row.status]}`}
                        >
                          {row.status}
                        </td>
                        <td className='max-w-xs truncate px-4 py-3 font-mono text-xs text-gray-500'>
                          {row.preview}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {limsLiteSetup.modalOpen && (
        <div
          className='fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm'
          role='dialog'
          aria-modal='true'
          aria-labelledby='lims-lite-setup-title'
        >
          <div className='w-full max-h-[85vh] max-w-full overflow-hidden rounded-xl border border-white/10 bg-[#1e1e1e] shadow-2xl sm:max-h-[min(90vh,640px)] sm:max-w-xl lg:max-w-2xl'>
            <div className='max-h-[85vh] overflow-y-auto overscroll-contain p-5 text-left text-gray-100 sm:p-6'>
              <div className='flex items-start gap-4'>
              {limsLiteSetup.loading && !limsLiteSetup.bannerError ? (
                <div
                  className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#00bcd4]/40 bg-[#00bcd4]/10'
                  aria-hidden
                >
                  <svg
                    className='h-6 w-6 animate-spin text-[#00bcd4]'
                    viewBox='0 0 24 24'
                    fill='none'
                    xmlns='http://www.w3.org/2000/svg'
                  >
                    <circle
                      className='opacity-25'
                      cx='12'
                      cy='12'
                      r='10'
                      stroke='currentColor'
                      strokeWidth='4'
                    />
                    <path
                      className='opacity-75'
                      fill='currentColor'
                      d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z'
                    />
                  </svg>
                </div>
              ) : (
                <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rose-700/60 bg-rose-950/50 text-xl text-rose-400'>
                  !
                </div>
              )}
              <div className='min-w-0 flex-1'>
                <h2
                  id='lims-lite-setup-title'
                  className='text-lg font-semibold text-white'
                >
                  LimsPlus Lite setup
                </h2>
                <p className='mt-1 text-sm text-gray-400'>
                  Follow these steps. The first launch is slower while MongoDB
                  starts and imports your backup once.
                </p>
              </div>
            </div>

            <ol className='mt-5 space-y-3'>
              {LIMS_LITE_SETUP_STEPS.map((step, idx) => {
                const stepNo = idx + 1;
                const isDone = limsLiteSetup.currentStep > stepNo;
                const isRunning =
                  limsLiteSetup.loading &&
                  !limsLiteSetup.bannerError &&
                  limsLiteSetup.currentStep === stepNo;
                const isPending = limsLiteSetup.currentStep < stepNo;
                return (
                  <li
                    key={step.title}
                    className={`flex gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                      isRunning
                        ? 'border-[#00bcd4]/50 bg-[#00bcd4]/10'
                        : isDone
                          ? 'border-emerald-800/40 bg-emerald-950/20'
                          : 'border-white/10 bg-white/5 opacity-80'
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
                      {isPending && (
                        <p className='mt-0.5 text-[11px] uppercase tracking-wide text-gray-500'>
                          Waiting
                        </p>
                      )}
                      {isRunning && (
                        <p className='mt-0.5 text-[11px] font-medium uppercase tracking-wide text-[#00bcd4]'>
                          In progress
                        </p>
                      )}
                      {isRunning &&
                        limsLiteSetup.stepHint &&
                        !limsLiteSetup.bannerError && (
                          <p className='mt-2 whitespace-pre-wrap rounded-md border border-[#00bcd4]/25 bg-black/35 px-2.5 py-2 text-xs leading-relaxed text-[#80deea]'>
                            {limsLiteSetup.stepHint}
                          </p>
                        )}
                    </div>
                  </li>
                );
              })}
            </ol>

            {limsLiteSetup.bannerError && (
              <div className='mt-4 rounded-lg border border-rose-800/60 bg-rose-950/30 p-3 text-sm text-rose-100 whitespace-pre-wrap'>
                {limsLiteSetup.bannerError}
                <p className='mt-2 text-xs text-rose-200/90'>
                  If MongoDB crashed after an earlier attempt, quit the app and
                  delete the folder&nbsp;
                  <code className='rounded bg-black/30 px-1'>lims-lite-mongodb</code>
                  &nbsp;inside your profile, then retry.
                </p>
              </div>
            )}

            {!limsLiteSetup.loading && limsLiteSetup.modalOpen && (
              <button
                type='button'
                className='mt-5 w-full rounded-lg border border-white/15 bg-white/10 py-2.5 text-sm font-medium text-white transition hover:bg-white/15'
                onClick={() =>
                  setLimsLiteSetup({
                    modalOpen: false,
                    loading: false,
                    currentStep: 1,
                    stepHint: '',
                    bannerError: null,
                  })
                }
              >
                Close
              </button>
            )}
            </div>
          </div>
        </div>
      )}

      <BackupRestoreModal
        isOpen={backupRestoreOpen}
        onClose={() => setBackupRestoreOpen(false)}
      />

      <AccountModal
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
    </div>
  );
});

export default Home;
