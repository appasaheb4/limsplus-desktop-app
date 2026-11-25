import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IntegrationPlatformService } from '../services';
import { getReactAppLocalLoginCompany } from '../../../runtime/local-login-company';
import {
  copyText,
  downloadText,
  filterLogs,
  listeningLine,
  logsToCsv,
  paginate,
} from './integration-platform.helpers';
import {
  applyInterfaceRecord,
  clearSelection,
  departmentsFor,
  findInterfaceRecord,
  instrumentsForSelection,
  labsFor,
  uniqueText,
  type InterfaceManagerRecord,
} from './interface-manager-selection';
import {
  FLOW_MODES,
  INITIAL_SETTINGS,
  MOCK_FRAMES,
  MOCK_LOGS,
  PROTOCOLS,
  SESSION_STATS,
} from './integration-platform.mock';
import type {
  FrameModel,
  InstrumentSlot,
  LogQuery,
  LogRecord,
  PlatformSettings,
  RunMode,
  SessionStats,
  WorkspaceView,
} from './integration-platform.types';

function cloneSettings(settings: PlatformSettings): PlatformSettings {
  return {
    ...settings,
    tcp: { ...settings.tcp },
    serial: { ...settings.serial },
    timeout: { ...settings.timeout },
  };
}

function createSlot(index: number): InstrumentSlot {
  return {
    id: `slot-${index}`,
    index,
    title: `Option ${index}`,
    named: false,
    connected: false,
    settings: cloneSettings(INITIAL_SETTINGS),
  };
}

const START_SLOTS = [createSlot(1), createSlot(2), createSlot(3)];

export function useIntegrationPlatform() {
  const [slots, setSlots] = useState<InstrumentSlot[]>(START_SLOTS);
  const [activeSlotId, setActiveSlotId] = useState(START_SLOTS[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [view, setView] = useState<WorkspaceView>('all');
  const [sendMode, setSendMode] = useState<RunMode>('auto');
  const [logs, setLogs] = useState<LogRecord[]>(MOCK_LOGS);
  const [selectedLogId, setSelectedLogId] = useState('log-4');
  const [selectedFrameId, setSelectedFrameId] = useState('frame-1');
  const [query, setQuery] = useState<LogQuery>({
    text: '',
    direction: 'all',
    kind: 'all',
    status: 'all',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const [menu, setMenu] = useState<'export' | 'settings' | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [stats, setStats] = useState<SessionStats>(SESSION_STATS);
  const [interfaceRecords, setInterfaceRecords] = useState<InterfaceManagerRecord[]>([]);
  const interfaceService = useRef(new IntegrationPlatformService());
  const toastTimer = useRef<number | null>(null);
  const connectTimer = useRef<number | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      if (connectTimer.current) window.clearTimeout(connectTimer.current);
    },
    [],
  );

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    let active = true;
    const ipcRenderer = window.require('electron').ipcRenderer as {
      invoke: (channel: string) => Promise<unknown>;
      on: (channel: string, listener: (_event: unknown, user: { companyCode?: string; environment?: string }) => void) => void;
      removeListener: (channel: string, listener: (_event: unknown, user: { companyCode?: string; environment?: string }) => void) => void;
    };
    const onUser = (_event: unknown, user: { companyCode?: string; environment?: string }) => {
      if (!active) return;
      const companyCode = String(user?.companyCode || getReactAppLocalLoginCompany() || '').trim();
      if (!companyCode) return;
      setSlots((current) => current.map((slot) => ({
        ...slot,
        settings: {
          ...slot.settings,
          companyCode,
          environment: slot.settings.environment || String(user?.environment || ''),
        },
      })));
      interfaceService.current
        .listInterfaceManagers({ input: { page: 1, limit: 1000 } })
        .then((response) => {
          if (!active) return;
          const rows = (response?.interfaceManagers?.data || []) as InterfaceManagerRecord[];
          const scoped = rows.filter(
            (row) => !row.companyCode || row.companyCode === companyCode,
          );
          setInterfaceRecords(scoped);
        })
        .catch(() => {
          if (active) notify('Unable to load interface manager records');
        });
    };
    ipcRenderer.on('send-user', onUser);
    void ipcRenderer.invoke('read-user');
    return () => {
      active = false;
      ipcRenderer.removeListener('send-user', onUser);
    };
  }, [notify]);

  useEffect(() => {
    if (!interfaceRecords.length) return;
    const known = new Set(uniqueText(interfaceRecords.map((record) => record.environment)));
    setSlots((current) => current.map((slot) => {
      if (!slot.settings.environment || known.has(slot.settings.environment)) return slot;
      return {
        ...slot,
        settings: clearSelection(slot.settings, { environment: '', lab: '', department: '' }),
        named: false,
        title: `Option ${slot.index}`,
      };
    }));
  }, [interfaceRecords]);

  const activeSlot = slots.find((slot) => slot.id === activeSlotId) ?? slots[0];
  const settings = activeSlot.settings;
  const connected = activeSlot.connected;

  const updateActive = useCallback((recipe: (slot: InstrumentSlot) => InstrumentSlot) => {
    setSlots((current) => current.map((slot) => (
      slot.id === activeSlotId ? recipe(slot) : slot
    )));
  }, [activeSlotId]);

  const nameWithInstrument = (slot: InstrumentSlot, next: PlatformSettings): InstrumentSlot => ({
    ...slot,
    settings: next,
    named: Boolean(next.instrumentId),
    title: next.instrumentId || `Option ${slot.index}`,
  });

  const patch = useCallback((partial: Partial<PlatformSettings>) => {
    updateActive((slot) => ({
      ...slot,
      settings: { ...slot.settings, ...partial },
    }));
  }, [updateActive]);

  const setEnvironment = (environment: string) => {
    updateActive((slot) => nameWithInstrument(slot, clearSelection(slot.settings, {
      environment,
      lab: '',
      department: '',
    })));
  };

  const setLab = (lab: string) => {
    updateActive((slot) => nameWithInstrument(slot, clearSelection(slot.settings, {
      environment: slot.settings.environment,
      lab,
      department: '',
    })));
  };

  const setDepartment = (department: string) => {
    updateActive((slot) => nameWithInstrument(slot, clearSelection(slot.settings, {
      environment: slot.settings.environment,
      lab: slot.settings.lab,
      department,
    })));
  };

  const setInstrument = (instrumentId: string) => {
    updateActive((slot) => {
      const match = findInterfaceRecord(interfaceRecords, {
        environment: slot.settings.environment,
        lab: slot.settings.lab,
        department: slot.settings.department,
        instrumentId,
      });
      const next = match
        ? applyInterfaceRecord(slot.settings, match)
        : clearSelection(slot.settings, {
          environment: slot.settings.environment,
          lab: slot.settings.lab,
          department: slot.settings.department,
        });
      return nameWithInstrument(slot, { ...next, instrumentId });
    });
  };

  const environments = uniqueText(interfaceRecords.map((record) => record.environment));
  const labs = labsFor(interfaceRecords, settings.environment);
  const departments = departmentsFor(interfaceRecords, settings.environment, settings.lab);
  const instrumentOptions = instrumentsForSelection(
    interfaceRecords,
    settings.environment,
    settings.lab,
    settings.department,
  );
  const protocol = PROTOCOLS.find((item) => item.id === settings.protocol)?.title ?? 'ASTM';
  const flow = FLOW_MODES.find((item) => item.id === settings.flow)?.title ?? 'Bi-directional';

  const filtered = useMemo(() => filterLogs(logs, query), [logs, query]);
  const pageData = paginate(filtered, page, pageSize);
  const selectedLog = logs.find((row) => row.id === selectedLogId) ?? filtered[0];
  const activeFrameId = selectedLog?.frameId ?? selectedFrameId;
  const frame = MOCK_FRAMES.find((item) => item.id === (view === 'frame' ? selectedFrameId : activeFrameId))
    ?? MOCK_FRAMES[0];

  const openView = (next: WorkspaceView) => {
    setView(next);
    setPageSize(next === 'log' ? 15 : 10);
    setPage(1);
    setWorkspaceOpen(true);
  };

  const selectLog = (row: LogRecord) => {
    setSelectedLogId(row.id);
    if (row.frameId) setSelectedFrameId(row.frameId);
  };

  const connect = () => {
    if (connecting || connected) return;
    const slotId = activeSlotId;
    const instrumentType = settings.instrumentType;
    updateActive((slot) => nameWithInstrument(slot, slot.settings));
    setConnecting(true);
    connectTimer.current = window.setTimeout(() => {
      setConnecting(false);
      setSlots((current) => current.map((slot) => (
        slot.id === slotId ? { ...slot, connected: true } : slot
      )));
      setView('all');
      setStats(SESSION_STATS);
      setLogs(MOCK_LOGS);
      notify(`Connected to ${instrumentType}`);
    }, 720);
  };

  const disconnect = () => {
    if (connectTimer.current) window.clearTimeout(connectTimer.current);
    setConnecting(false);
    updateActive((slot) => ({ ...slot, connected: false }));
    notify('Instrument disconnected');
  };

  const reset = () => {
    updateActive((slot) => ({
      ...slot,
      settings: cloneSettings(INITIAL_SETTINGS),
      title: slot.named ? INITIAL_SETTINGS.instrumentId : `Option ${slot.index}`,
    }));
    setSendMode('auto');
    notify('Settings reset');
  };

  const selectSlot = (id: string) => {
    if (id === activeSlotId) return;
    if (connectTimer.current) window.clearTimeout(connectTimer.current);
    setConnecting(false);
    setActiveSlotId(id);
  };

  const addSlot = () => {
    const index = slots.reduce((max, slot) => Math.max(max, slot.index), 0) + 1;
    const slot = createSlot(index);
    setSlots((current) => [...current, slot]);
    setActiveSlotId(slot.id);
    notify(`Option ${index} added`);
  };

  const save = () => {
    updateActive((slot) => nameWithInstrument(slot, slot.settings));
    notify('Settings saved');
  };

  const clearLog = () => {
    setLogs([]);
    setStats({ received: 0, sent: 0, ack: 0, warnings: 0, errors: 0, lastActivity: '—' });
    notify('Communication log cleared');
  };

  const sendToLims = (target: FrameModel = frame) => {
    const stamp = new Date();
    const time = stamp.toTimeString().slice(0, 8);
    const row: LogRecord = {
      id: `log-send-${stamp.getTime()}`,
      index: logs.length + 1,
      at: `2025-05-15 ${time}`,
      time,
      direction: 'out',
      kind: 'Send to LIMS',
      length: null,
      status: 'Success',
      message: `${target.results.length} results for sample ${target.order.specimenId} sent to LIMSPLUS.`,
      details: sendMode === 'auto' ? 'Auto' : 'Manual',
      frameId: target.id,
    };
    setLogs((current) => [row, ...current]);
    setStats((current) => ({
      ...current,
      sent: current.sent + target.results.length,
      lastActivity: time,
    }));
    setSelectedLogId(row.id);
    notify(row.message);
  };

  const exportLogs = (format: 'csv' | 'json') => {
    const body = format === 'csv' ? logsToCsv(filtered) : JSON.stringify(filtered, null, 2);
    downloadText(
      `limsplus-connect-log.${format}`,
      body,
      format === 'csv' ? 'text/csv' : 'application/json',
    );
    setMenu(null);
    notify(`Exported ${filtered.length} records`);
  };

  const copyFrame = async () => {
    const ok = await copyText(frame.records.map((record) => record.raw).join('\n'));
    notify(ok ? 'Frame copied' : 'Could not copy the frame');
  };

  const copyParsed = async () => {
    const text = frame.parsed
      .map((row) => `${row.segment}\t${row.field}\t${row.name}\t${row.value}`)
      .join('\n');
    const ok = await copyText(text);
    notify(ok ? 'Parsed message copied' : 'Could not copy the message');
  };

  const downloadFrame = () => {
    downloadText(`frame-${frame.number}.txt`, frame.records.map((record) => record.raw).join('\r\n'));
    notify('Frame downloaded');
  };

  const onLogFile = (file: File | undefined) => {
    patch({ logFileName: file?.name ?? '' });
    if (file) notify(`${file.name} ready to review`);
  };

  return {
    settings,
    slots,
    activeSlotId,
    selectSlot,
    addSlot,
    sidebarOpen,
    setSidebarOpen,
    labs,
    departments,
    environments,
    instrumentOptions,
    patch,
    setEnvironment,
    setLab,
    setDepartment,
    setInstrument,
    connected,
    connecting,
    connect,
    disconnect,
    reset,
    save,
    view,
    openView,
    sendMode,
    setSendMode,
    listening: listeningLine(settings, protocol, flow),
    stats,
    logs: pageData,
    query,
    setQuery,
    pageSize,
    setPageSize,
    setPage,
    selectedLogId,
    selectLog,
    frames: MOCK_FRAMES,
    frame,
    setSelectedFrameId,
    workspaceOpen,
    setWorkspaceOpen,
    menu,
    setMenu,
    soundOn,
    setSoundOn,
    toast,
    clearLog,
    sendToLims,
    exportLogs,
    copyFrame,
    copyParsed,
    downloadFrame,
    onLogFile,
  };
}

export type IntegrationPlatformModel = ReturnType<typeof useIntegrationPlatform>;
